// db.js — pure-JavaScript SQLite (no compiler, no Python needed).
//
// We use node-sqlite3-wasm (a WebAssembly build of SQLite) and wrap it so the
// rest of the project keeps using the familiar better-sqlite3 style API:
//   db.prepare(sql).run(...args) / .get(...args) / .all(...args)
//   db.exec(sql)
//   db.transaction(fn)
//   db.pragma(...)   (no-op shim)
//
// This means seed.js and routes/api.js did NOT have to change.
//
// Multi-tenant note: this file used to open ONE connection at import time.
// It now opens one connection PER SHOP on demand — see openTenantDatabase()
// below — and the `db` this module exports is a Proxy that transparently
// forwards to whichever shop's connection is active for the current request
// (via tenantContext.js's AsyncLocalStorage). routes/api.js and seed.js
// still just call `db.prepare(...)` etc. and get the right shop's data
// without knowing anything changed.
import pkg from 'node-sqlite3-wasm';
const { Database: WasmDatabase } = pkg;
import { getCurrentTenant } from './tenantContext.js';
import { hashPin } from './auth.js';

// Opens a SQLite file and wraps it in the better-sqlite3-shaped API this
// whole codebase writes against (.prepare/.exec/.transaction/.pragma/.close)
// — no schema applied. Used both by openTenantDatabase (which then runs the
// full shop schema below) and by platformDb.js (which runs its own much
// smaller `tenants`-table schema instead).
export function openRawConnection(filePath) {
const raw = new WasmDatabase(filePath);

// Normalise BigInt (wasm returns BigInt for row ids) back to Number.
const fix = (v) => (typeof v === 'bigint' ? Number(v) : v);
const fixRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  for (const k of Object.keys(row)) row[k] = fix(row[k]);
  return row;
};
// better-sqlite3 lets you pass args either spread (a, b, c) or as one array/object.
// For named parameters the code uses @name in the SQL and a plain {name: ...} object.
// node-sqlite3-wasm looks up each object key as the FULL parameter name, so the key
// must include the '@' prefix to match the @name placeholders. We add that prefix.
const norm = (args) => {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = args[0];
    const out = {};
    for (const k of Object.keys(obj)) {
      // If the key already starts with a binding sigil, leave it; otherwise prefix '@'.
      const key = /^[@:$]/.test(k) ? k : '@' + k;
      out[key] = obj[k];
    }
    return out;
  }
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args.length ? args : undefined;
};

// A prepared-statement wrapper matching better-sqlite3's surface.
class Stmt {
  constructor(sql) { this.sql = sql; }
  run(...args) {
    const info = raw.run(this.sql, norm(args));
    return { changes: fix(info.changes), lastInsertRowid: fix(info.lastInsertRowid) };
  }
  get(...args) { return fixRow(raw.get(this.sql, norm(args))); }
  all(...args) { return (raw.all(this.sql, norm(args)) || []).map(fixRow); }
}

const db = {
  prepare: (sql) => new Stmt(sql),
  exec: (sql) => { raw.exec(sql); },
  pragma: () => {},                       // pragmas are optional; ignore safely
  transaction: (fn) => {
    // Return a function that runs fn() wrapped in BEGIN/COMMIT, rolling back on error.
    return (...a) => {
      raw.exec('BEGIN');
      try { const r = fn(...a); raw.exec('COMMIT'); return r; }
      catch (e) { try { raw.exec('ROLLBACK'); } catch {} throw e; }
    };
  },
  close: () => raw.close(),
};

return db;
}

// Opens (and fully migrates) one shop's SQLite file, returning a
// better-sqlite3-shaped connection object tied to that one file. Called
// once per shop, lazily, by tenantDb.js's connection cache — never call
// this directly from route handlers, they should just use the exported
// `db` Proxy below.
export function openTenantDatabase(filePath) {
const db = openRawConnection(filePath);

// ---- Schema (unchanged) ----
db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  name_fr   TEXT,
  category  TEXT NOT NULL,
  price     INTEGER NOT NULL,
  cost      INTEGER NOT NULL DEFAULT 0,
  discount  INTEGER NOT NULL DEFAULT 0,
  stock     INTEGER NOT NULL DEFAULT 0,
  sku       TEXT UNIQUE NOT NULL,
  emoji     TEXT DEFAULT '📦',
  image     TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  packetPrice     INTEGER,
  unitsPerPacket  INTEGER,
  halfPacketPrice INTEGER
);

CREATE TABLE IF NOT EXISTS customers (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL,
  phone  TEXT,
  points INTEGER DEFAULT 0,
  tier   TEXT DEFAULT 'Bronze',
  visits INTEGER DEFAULT 0,
  spent  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS suppliers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  contact       TEXT,
  phone         TEXT,
  email         TEXT,
  productsCount INTEGER DEFAULT 0,
  lastOrder     TEXT,
  status        TEXT DEFAULT 'active',
  category      TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id         TEXT PRIMARY KEY,
  supplierId INTEGER,
  supplier   TEXT,
  date       TEXT,
  items      INTEGER DEFAULT 0,
  total      INTEGER DEFAULT 0,
  status     TEXT DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  productName TEXT,
  type        TEXT,
  qty         INTEGER,
  source      TEXT,
  date        TEXT,
  user        TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  username   TEXT UNIQUE,
  role       TEXT DEFAULT 'cashier',
  email      TEXT UNIQUE,
  lastActive TEXT,
  store      TEXT,
  pin_hash   TEXT,
  pin_salt   TEXT
);

-- The roster of shop-floor staff who do NOT get a software login (e.g.
-- salespeople, stockers) — only admin/manager/cashier/accountant get a real
-- users account. This table is what the Staff register (see shifts below)
-- clocks in and out.
CREATE TABLE IF NOT EXISTS employees (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  role     TEXT,
  initials TEXT,
  color    TEXT,
  rate     INTEGER DEFAULT 1000
);

-- A shift row is opened one of two ways: self-service (userId set — a
-- logged-in admin/manager/cashier/accountant clocking themselves in/out,
-- with cash-drawer reconciliation) or via the Staff register (employeeId
-- set — a manager/cashier clocking a roster employee in/out on their
-- behalf; no login, no cash fields). Exactly one of userId/employeeId is
-- set per row, never both.
CREATE TABLE IF NOT EXISTS shifts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employeeId   INTEGER,
  name         TEXT,
  role         TEXT,
  clockIn      TEXT,
  clockOut     TEXT,
  expectedCash INTEGER,
  countedCash  INTEGER,
  cashVariance INTEGER,
  clockInPhoto TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  invoiceNo TEXT UNIQUE,
  customerId INTEGER,
  subtotal  INTEGER,
  discount  INTEGER,
  tva       INTEGER,
  total     INTEGER,
  method    TEXT,
  cashier   TEXT,
  createdAt TEXT,
  clientOrderId TEXT,
  manualEntry INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId   INTEGER,
  productId INTEGER,
  name      TEXT,
  sku       TEXT,
  price     INTEGER,
  cost      INTEGER DEFAULT 0,
  qty       INTEGER,
  mode           TEXT DEFAULT 'unit',
  unitsPerPacket INTEGER
);

-- A product is a "style" (T-shirt, dress); a variant is what's actually sold
-- and stocked — one size/color combo, its own SKU and stock count. price/cost
-- live on the product (all variants of a style sell at the same price); stock
-- and sku live here. products.stock is kept as a denormalized SUM of its
-- variants' stock (see recomputeProductStock below) so existing code that
-- reads product.stock (low-stock alerts, CSV/reports) keeps working.
CREATE TABLE IF NOT EXISTS product_variants (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL,
  size      TEXT,
  color     TEXT,
  sku       TEXT UNIQUE NOT NULL,
  stock     INTEGER NOT NULL DEFAULT 0,
  image     TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

-- A physical shop location. Structural config, like categories — not wiped
-- by the "clear all data" maintenance action.
CREATE TABLE IF NOT EXISTS stores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  address   TEXT,
  phone     TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

-- Real source of truth for stock: one row per (store, variant). variants
-- and products keep their own .stock column as a rollup of this (same
-- pattern as products.stock rolling up product_variants.stock) so every
-- existing reader of .stock keeps working unchanged — see
-- recomputeVariantStock/recomputeProductStock below.
CREATE TABLE IF NOT EXISTS store_stock (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  storeId   INTEGER NOT NULL,
  variantId INTEGER NOT NULL,
  stock     INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_stock_store_variant ON store_stock(storeId, variantId);

CREATE TABLE IF NOT EXISTS settings (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  date      TEXT NOT NULL,
  category  TEXT,
  payee     TEXT,
  amount    INTEGER NOT NULL DEFAULT 0,
  method    TEXT,
  note      TEXT,
  createdBy TEXT,
  createdAt TEXT,
  clientId  TEXT
);
`);

// ---- Migrations for databases created before a column existed ----
// Adds the products.image column if an older data.db is missing it.
// Safe to run every boot: we check first and ignore "duplicate column" errors.
try {
  const cols = db.prepare('PRAGMA table_info(products)').all();
  if (!cols.some((c) => c.name === 'image')) {
    db.exec('ALTER TABLE products ADD COLUMN image TEXT');
    console.log('• Migrated: added products.image column');
  }
} catch (e) {
  console.warn('image-column migration skipped:', e.message);
}

// Ensure the users table has username + PIN columns on older databases.
try {
  const ucols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!ucols.includes('pin_hash')) db.exec('ALTER TABLE users ADD COLUMN pin_hash TEXT');
  if (!ucols.includes('pin_salt')) db.exec('ALTER TABLE users ADD COLUMN pin_salt TEXT');
  if (!ucols.includes('username')) db.exec('ALTER TABLE users ADD COLUMN username TEXT');
  // whatsapp: for the WhatsApp-notification feature (payslip/notice PDFs).
  // hourlyRate: used to compute payslip totals from actual shift hours.
  if (!ucols.includes('whatsapp')) db.exec('ALTER TABLE users ADD COLUMN whatsapp TEXT');
  if (!ucols.includes('hourlyRate')) db.exec('ALTER TABLE users ADD COLUMN hourlyRate INTEGER DEFAULT 0');
} catch (e) {
  console.warn('users-column migration skipped:', e.message);
}

// Same WhatsApp-notification field as users.whatsapp, but for the Staff
// Register roster — lets an attendance summary go to a no-login employee
// too, not just logged-in staff.
try {
  const ecols = db.prepare('PRAGMA table_info(employees)').all().map(c => c.name);
  if (!ecols.includes('whatsapp')) db.exec('ALTER TABLE employees ADD COLUMN whatsapp TEXT');
} catch (e) {
  console.warn('employees-column migration skipped:', e.message);
}

// Ensure cost columns exist for margin tracking on older databases.
try {
  const pcols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
  if (!pcols.includes('cost')) db.exec('ALTER TABLE products ADD COLUMN cost INTEGER NOT NULL DEFAULT 0');
  if (!pcols.includes('discount')) db.exec('ALTER TABLE products ADD COLUMN discount INTEGER NOT NULL DEFAULT 0');
  if (!pcols.includes('grade')) db.exec('ALTER TABLE products ADD COLUMN grade TEXT');
  const ocols = db.prepare('PRAGMA table_info(order_items)').all().map(c => c.name);
  if (!ocols.includes('cost')) db.exec('ALTER TABLE order_items ADD COLUMN cost INTEGER DEFAULT 0');
} catch (e) {
  console.warn('cost-column migration skipped:', e.message);
}

// Track when each product was registered/last modified, so Inventory can
// offer "Date Registered" / "Date Modified" sorting. Existing rows predate
// these columns and are backfilled with the migration's run time, since
// their real creation date was never recorded.
try {
  const pcols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
  if (!pcols.includes('createdAt')) {
    db.exec('ALTER TABLE products ADD COLUMN createdAt TEXT');
    const now = new Date().toISOString();
    db.prepare('UPDATE products SET createdAt=? WHERE createdAt IS NULL').run(now);
  }
  if (!pcols.includes('updatedAt')) {
    db.exec('ALTER TABLE products ADD COLUMN updatedAt TEXT');
    const now = new Date().toISOString();
    db.prepare('UPDATE products SET updatedAt=? WHERE updatedAt IS NULL').run(now);
  }
} catch (e) {
  console.warn('products timestamp migration skipped:', e.message);
}

// Packet selling: a product can optionally be sold either by the unit
// (existing price/stock) or by a fixed-size packet (packetPrice for
// unitsPerPacket units at once). Stock always tracks individual units;
// packetPrice/unitsPerPacket being unset (0/NULL) just means the product
// isn't sold by packet.
try {
  const pcols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
  if (!pcols.includes('packetPrice')) db.exec('ALTER TABLE products ADD COLUMN packetPrice INTEGER');
  if (!pcols.includes('unitsPerPacket')) db.exec('ALTER TABLE products ADD COLUMN unitsPerPacket INTEGER');
  const oicols = db.prepare('PRAGMA table_info(order_items)').all().map(c => c.name);
  if (!oicols.includes('mode')) db.exec("ALTER TABLE order_items ADD COLUMN mode TEXT DEFAULT 'unit'");
  if (!oicols.includes('unitsPerPacket')) db.exec('ALTER TABLE order_items ADD COLUMN unitsPerPacket INTEGER');
} catch (e) {
  console.warn('packet-pricing migration skipped:', e.message);
}

// Half-packet selling: a product with packet pricing can also be sold as
// half a packet (e.g. a 6-carton also sold as 3) at its own price, rather
// than just half of packetPrice. Uses the same order_items.mode/
// unitsPerPacket columns as full-packet sales — mode='half' with
// unitsPerPacket holding the half quantity actually consumed per line.
try {
  const pcols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
  if (!pcols.includes('halfPacketPrice')) db.exec('ALTER TABLE products ADD COLUMN halfPacketPrice INTEGER');
} catch (e) {
  console.warn('half-packet-pricing migration skipped:', e.message);
}

// Size/color variants: a sale/edit/restock targets one product_variants row,
// not the parent product. order_items snapshots which variant was actually
// sold (same pattern as its existing name/sku/price snapshot columns);
// stock_movements gains real FK-style columns alongside its legacy
// productName free text, so future movements can be traced to an exact row.
try {
  const oicols = db.prepare('PRAGMA table_info(order_items)').all().map(c => c.name);
  if (!oicols.includes('variantId')) db.exec('ALTER TABLE order_items ADD COLUMN variantId INTEGER');
  if (!oicols.includes('size')) db.exec('ALTER TABLE order_items ADD COLUMN size TEXT');
  if (!oicols.includes('color')) db.exec('ALTER TABLE order_items ADD COLUMN color TEXT');
  if (!oicols.includes('variantSku')) db.exec('ALTER TABLE order_items ADD COLUMN variantSku TEXT');
  const smcols = db.prepare('PRAGMA table_info(stock_movements)').all().map(c => c.name);
  if (!smcols.includes('productId')) db.exec('ALTER TABLE stock_movements ADD COLUMN productId INTEGER');
  if (!smcols.includes('variantId')) db.exec('ALTER TABLE stock_movements ADD COLUMN variantId INTEGER');
} catch (e) {
  console.warn('variant-columns migration skipped:', e.message);
}

// Multi-shop: which physical store a user belongs to, a sale was rung up
// at, a stock movement happened at, and a shift was worked at. The old
// free-text users.store column is left in place (unused) rather than
// dropped, same treatment as products.grade when school-materials support
// was removed.
try {
  const ucols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!ucols.includes('storeId')) db.exec('ALTER TABLE users ADD COLUMN storeId INTEGER');
  const ordcols2 = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
  if (!ordcols2.includes('storeId')) db.exec('ALTER TABLE orders ADD COLUMN storeId INTEGER');
  const smcols2 = db.prepare('PRAGMA table_info(stock_movements)').all().map(c => c.name);
  if (!smcols2.includes('storeId')) db.exec('ALTER TABLE stock_movements ADD COLUMN storeId INTEGER');
  const shcols2 = db.prepare('PRAGMA table_info(shifts)').all().map(c => c.name);
  if (!shcols2.includes('storeId')) db.exec('ALTER TABLE shifts ADD COLUMN storeId INTEGER');
} catch (e) {
  console.warn('multi-shop columns migration skipped:', e.message);
}

// Staff register: shifts.employeeId used to double as "the logged-in
// user's id" for self-service clock-in/out. That's now split in two —
// userId for the existing self-service flow, employeeId reserved for a
// real employees.id clocked in via the register. recordedBy names whoever
// (a manager/cashier) operated the register on a roster employee's behalf.
try {
  const shcols3 = db.prepare('PRAGMA table_info(shifts)').all().map(c => c.name);
  if (!shcols3.includes('userId')) db.exec('ALTER TABLE shifts ADD COLUMN userId INTEGER');
  if (!shcols3.includes('recordedBy')) db.exec('ALTER TABLE shifts ADD COLUMN recordedBy TEXT');
} catch (e) {
  console.warn('staff-register columns migration skipped:', e.message);
}

// Ensure orders.clientOrderId exists (lets a retried/offline-queued checkout
// be deduplicated instead of creating a second sale) and is unique.
try {
  const ordcols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
  if (!ordcols.includes('clientOrderId')) db.exec('ALTER TABLE orders ADD COLUMN clientOrderId TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_clientOrderId ON orders(clientOrderId)');
} catch (e) {
  console.warn('clientOrderId migration skipped:', e.message);
}

// Flags a sale that was written down on paper when it happened and only
// entered into the system later, dated to when it actually occurred rather
// than now. Kept out of shift cash-drawer reconciliation (no real cash moved
// through that till today for it) while still counting normally everywhere
// else (sales totals, TVA, margin) since createdAt carries the real date.
try {
  const ordcols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
  if (!ordcols.includes('manualEntry')) db.exec('ALTER TABLE orders ADD COLUMN manualEntry INTEGER DEFAULT 0');
} catch (e) {
  console.warn('orders manualEntry migration skipped:', e.message);
}

// Point redemption + store credit applied at checkout — two separate
// discount channels from the existing flat `discount` field (which routes
// through manager approval, see discount_requests above): neither needs
// approval, since a customer only ever spends points/credit they already
// own. pointsDiscountAmt is the FCFA value of pointsRedeemed, frozen at
// checkout time even if the conversion rate changes later.
try {
  const ordcols3 = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
  if (!ordcols3.includes('pointsRedeemed')) db.exec('ALTER TABLE orders ADD COLUMN pointsRedeemed INTEGER DEFAULT 0');
  if (!ordcols3.includes('pointsDiscountAmt')) db.exec('ALTER TABLE orders ADD COLUMN pointsDiscountAmt INTEGER DEFAULT 0');
  if (!ordcols3.includes('creditApplied')) db.exec('ALTER TABLE orders ADD COLUMN creditApplied INTEGER DEFAULT 0');
} catch (e) {
  console.warn('points/credit columns migration skipped:', e.message);
}

// Same idempotency mechanism as orders, for offline-queued expense entries.
try {
  const expcols = db.prepare('PRAGMA table_info(expenses)').all().map(c => c.name);
  if (!expcols.includes('clientId')) db.exec('ALTER TABLE expenses ADD COLUMN clientId TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_clientId ON expenses(clientId)');
} catch (e) {
  console.warn('expenses clientId migration skipped:', e.message);
}

// 'operating' (rent, utilities, salaries — the regular running costs that
// reduce P&L) vs 'setup' (one-time pre-opening/startup costs the owner is
// trying to recoup, tracked separately against cumulative net profit
// instead of distorting any single period's P&L). Existing rows predate
// this distinction and default to 'operating'.
try {
  const expcols = db.prepare('PRAGMA table_info(expenses)').all().map(c => c.name);
  if (!expcols.includes('type')) {
    db.exec("ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'operating'");
  }
} catch (e) {
  console.warn('expenses type migration skipped:', e.message);
}

// Per-shift cash reconciliation columns, for accountability at clock-out.
try {
  const shcols = db.prepare('PRAGMA table_info(shifts)').all().map(c => c.name);
  if (!shcols.includes('expectedCash')) db.exec('ALTER TABLE shifts ADD COLUMN expectedCash INTEGER');
  if (!shcols.includes('countedCash')) db.exec('ALTER TABLE shifts ADD COLUMN countedCash INTEGER');
  if (!shcols.includes('cashVariance')) db.exec('ALTER TABLE shifts ADD COLUMN cashVariance INTEGER');
  if (!shcols.includes('clockInPhoto')) db.exec('ALTER TABLE shifts ADD COLUMN clockInPhoto TEXT');
} catch (e) {
  console.warn('shifts cash-reconciliation migration skipped:', e.message);
}

// Accounts-payable columns on purchase orders: a due date and how much of
// the total has been paid so far (outstanding = total - amountPaid).
try {
  const pocols = db.prepare('PRAGMA table_info(purchase_orders)').all().map(c => c.name);
  if (!pocols.includes('dueDate')) db.exec('ALTER TABLE purchase_orders ADD COLUMN dueDate TEXT');
  if (!pocols.includes('amountPaid')) db.exec('ALTER TABLE purchase_orders ADD COLUMN amountPaid INTEGER NOT NULL DEFAULT 0');
} catch (e) {
  console.warn('purchase_orders AP migration skipped:', e.message);
}

// Payment history against purchase orders (accounts-payable ledger).
db.exec(`
CREATE TABLE IF NOT EXISTS po_payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  purchaseOrderId TEXT NOT NULL,
  amount          INTEGER NOT NULL,
  method          TEXT,
  note            TEXT,
  createdBy       TEXT,
  createdAt       TEXT
);
`);

// Product categories. id is the slug used everywhere else (products.category,
// checkout filters, Home page cards); label is what's actually shown/typed.
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
`);

// Note: this used to unconditionally backfill Riskyc Fashion's own
// category taxonomy (sets/jerseys/trousers/...) here for any database with
// an empty categories table. Now that a database means one specific shop
// (not necessarily Riskyc Fashion), that content moved to the seed
// functions instead — seedIfEmpty() for the Riskyc demo data, or
// seedBlankTenant()'s generic starter set for a brand-new real shop — so a
// fresh database just gets an empty categories table here, filled in by
// whichever seed path actually runs.

// Supplier credit ledger — tracks goods taken on credit and payments made.
db.exec(`
CREATE TABLE IF NOT EXISTS supplier_credits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplierId  INTEGER NOT NULL,
  supplier    TEXT    NOT NULL,
  amount      REAL    NOT NULL,
  note        TEXT,
  date        TEXT    NOT NULL,
  createdAt   TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS supplier_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplierId  INTEGER NOT NULL,
  supplier    TEXT    NOT NULL,
  amount      REAL    NOT NULL,
  note        TEXT,
  date        TEXT    NOT NULL,
  createdAt   TEXT    NOT NULL
);
`);

// Discount approval requests — cashier submits, manager approves/rejects.
db.exec(`
CREATE TABLE IF NOT EXISTS discount_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier     TEXT    NOT NULL,
  cashierId   INTEGER,
  items       TEXT    NOT NULL,
  subtotal    REAL    NOT NULL,
  discountAmt REAL    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending',
  note        TEXT,
  createdAt   TEXT    NOT NULL,
  resolvedAt  TEXT,
  resolvedBy  TEXT
);
`);

// Store credit ledger — a signed running balance per customer. Positive
// entries grant credit (a return being approved); negative entries spend it
// (redeeming credit at checkout). Balance is SUM(amount), same pattern as
// the supplier credit ledger above.
db.exec(`
CREATE TABLE IF NOT EXISTS customer_credit_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  amount     REAL    NOT NULL,
  reason     TEXT    NOT NULL,
  orderId    INTEGER,
  returnId   INTEGER,
  note       TEXT,
  createdAt  TEXT    NOT NULL,
  createdBy  TEXT
);
`);

// Return/exchange requests — a cashier submits against a real past order,
// a manager/admin approves or rejects. Unlike discount_requests (which
// precedes an order that doesn't exist yet), a return always references an
// order that already happened, so its own approval step can safely perform
// the stock-increment and credit-grant itself, server-side, in one
// transaction — no client-side polling/ref needed to "complete" anything
// afterward. `items` snapshots exactly what's being returned (qty, price,
// variant, packet mode) at request time, frozen even if the underlying
// order is edited later.
db.exec(`
CREATE TABLE IF NOT EXISTS return_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId       INTEGER NOT NULL,
  customerId    INTEGER,
  items         TEXT    NOT NULL,
  creditAmt     REAL    NOT NULL,
  reason        TEXT,
  requestedBy   TEXT    NOT NULL,
  requestedById INTEGER,
  status        TEXT    NOT NULL DEFAULT 'pending',
  note          TEXT,
  createdAt     TEXT    NOT NULL,
  resolvedAt    TEXT,
  resolvedBy    TEXT
);
`);

// Safety net for existing shop databases: make sure every user can log in
// (moved here from the old boot-time script in index.js — now runs once per
// shop file, the first time it's opened, instead of once globally).
// Backfill a username (from email/name) and a default PIN (1234) where missing.
try {
  const slug = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'user';
  const users = db.prepare('SELECT id, name, username, email, pin_hash FROM users').all();
  const setUser = db.prepare('UPDATE users SET username=? WHERE id=?');
  const setPin = db.prepare('UPDATE users SET pin_hash=?, pin_salt=? WHERE id=?');
  let fixedNames = 0, fixedPins = 0;
  for (const u of users) {
    if (!u.username) {
      let base = slug(u.email ? u.email.split('@')[0] : u.name);
      let candidate = base, n = 1;
      while (db.prepare('SELECT 1 FROM users WHERE username=? AND id<>?').get(candidate, u.id)) candidate = `${base}${++n}`;
      setUser.run(candidate, u.id); fixedNames++;
    }
    if (!u.pin_hash) { const { hash, salt } = hashPin('1234'); setPin.run(hash, salt, u.id); fixedPins++; }
  }
  if (fixedNames) console.log(`• Backfilled usernames for ${fixedNames} user(s)`);
  if (fixedPins) console.log(`• Set default PIN (1234) for ${fixedPins} user(s)`);
} catch (e) { console.warn('user backfill skipped:', e.message); }

// One-time cleanup: remove any shift not belonging to a real user account
// (e.g. old demo shifts for a renamed/removed employee). Real shifts carry a user's name.
try {
  const res = db.prepare('DELETE FROM shifts WHERE name NOT IN (SELECT name FROM users)').run();
  if (res.changes) console.log(`• Removed ${res.changes} shift(s) not linked to a user account`);
} catch (e) { console.warn('shift cleanup skipped:', e.message); }

return db;
}

// The rest of the codebase (routes/api.js, seed.js) imports `db` and calls
// `db.prepare(...)`/`db.exec(...)`/`db.transaction(...)` directly, exactly
// as when this was a single-tenant app. This Proxy is what makes that keep
// working correctly per-shop: every property access resolves, at the
// moment it's used, to whichever shop's connection tenantContext.js says is
// active for the current request. Calling it outside a request (e.g. a
// stray top-level script) throws a clear error instead of silently
// touching the wrong shop's data.
export const db = new Proxy({}, {
  get(_target, prop) {
    const conn = getCurrentTenant().conn;
    const val = conn[prop];
    return typeof val === 'function' ? val.bind(conn) : val;
  },
});

// Recompute a product's aggregate stock from its variants. Called after
// any write to product_variants (create/edit product, checkout, manual
// stock adjustment) so every existing reader of products.stock (low-stock
// alerts, CSV/reports) keeps seeing an accurate number without having to
// know variants exist.
export function recomputeProductStock(productId) {
  db.prepare(
    'UPDATE products SET stock = (SELECT COALESCE(SUM(stock),0) FROM product_variants WHERE productId=?) WHERE id=?'
  ).run(productId, productId);
}

// Same idea, one level down: a variant's own .stock is a rollup of its
// per-store store_stock rows. Called after any write to store_stock;
// always pair with recomputeProductStock(productId) right after (see
// recomputeStock below) so both rollups stay in sync in one step.
export function recomputeVariantStock(variantId) {
  db.prepare(
    'UPDATE product_variants SET stock = (SELECT COALESCE(SUM(stock),0) FROM store_stock WHERE variantId=?) WHERE id=?'
  ).run(variantId, variantId);
}

export function recomputeStock(variantId, productId) {
  recomputeVariantStock(variantId);
  recomputeProductStock(productId);
}

export default db;
