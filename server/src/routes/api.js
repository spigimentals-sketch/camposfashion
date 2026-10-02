// routes/api.js — every REST endpoint for the POS.
import { Router } from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { db, recomputeProductStock, recomputeVariantStock, recomputeStock } from '../db.js';
import { hashPin, verifyPin, issueToken, requireAuth, requireRole, verifyToken } from '../auth.js';
import { getCurrentTenant } from '../tenantContext.js';

const r = Router();

// Point redemption rate, confirmed with the business: 100 points = 500 FCFA.
const FCFA_PER_POINT = 5;
const customerCreditBalance = (customerId) =>
  db.prepare('SELECT COALESCE(SUM(amount),0) AS bal FROM customer_credit_ledger WHERE customerId=?').get(customerId).bal;

// Where uploaded product photos are stored on disk — one folder per shop
// (`uploads/<slug>/...`), keyed off the shop resolved by tenantResolve
// middleware, so the returned /uploads/<slug>/<file> path itself is what
// keeps one shop's photos from colliding with (or being guessable
// alongside) another's; index.js serves the whole uploads/ root as one
// static mount, no per-request auth needed since the slug is already in
// the URL.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
const uploadDirFor = (slug) => {
  const dir = path.join(UPLOAD_ROOT, slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// Small helper to wrap handlers and forward errors — sync throws and
// rejected promises both land in the same place.
const h = (fn) => (req, res) => {
  const onError = (e) => { console.error(e); res.status(400).json({ error: e.message }); };
  try {
    const result = fn(req, res);
    if (result && typeof result.catch === 'function') result.catch(onError);
  } catch (e) { onError(e); }
};

// Clock-in is meant to happen at the fixed POS terminal, not on a handheld
// device — phones AND tablets are both rejected. This mirrors the same
// check the frontend makes before it even calls this endpoint; it's not
// airtight (a UA header can be spoofed) but it backs that check up rather
// than trusting the client alone.
const isHandheldUA = (ua = '') => {
  if (/iPad/i.test(ua)) return true;
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua)) return true;
  if (/Windows Phone/i.test(ua)) return true;
  return false;
};

// A user counts as "online" if they've logged in or sent a heartbeat in the
// last 90s (the front-end pings every 45s while signed in, so this tolerates
// one missed ping). Pre-existing demo accounts have a human string like
// "2 min ago" instead of a timestamp — Date.parse returns NaN for those, so
// they correctly fall through to offline rather than throwing.
const ONLINE_THRESHOLD_MS = 90 * 1000;
const withOnline = (u) => u && { ...u, online: !!u.lastActive && (Date.now() - Date.parse(u.lastActive)) < ONLINE_THRESHOLD_MS };

// A "half packet" sale consumes roughly half a full packet's units — e.g. a
// carton of 6 sold as 3. Rounded since packet sizes aren't always even.
const halfPackUnits = (p) => Math.max(1, Math.round((p?.unitsPerPacket || 0) / 2));
const publicUser = (u) => u && withOnline({ id: u.id, name: u.name, username: u.username, role: u.role, email: u.email, lastActive: u.lastActive, storeId: u.storeId, whatsapp: u.whatsapp, hourlyRate: u.hourlyRate });

// ---------------- AUTH ----------------
// Public: accounts to suggest on the login screen (no secrets).
r.get('/auth/staff', h((req, res) => {
  res.json(db.prepare('SELECT id, name, username, role, store FROM users ORDER BY name').all());
}));

// Public: exchange { username, pin } for a signed token.
r.post('/auth/login', h((req, res) => {
  const { username, pin } = req.body || {};
  if (!username || pin == null) return res.status(400).json({ error: 'Username and PIN are required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(String(username).trim());
  if (!user || !verifyPin(pin, user.pin_hash, user.pin_salt)) {
    return res.status(401).json({ error: 'Incorrect username or PIN' });
  }
  db.prepare('UPDATE users SET lastActive=? WHERE id=?').run(new Date().toISOString(), user.id);
  res.json({ token: issueToken(user), user: publicUser(user) });
}));

// Confirm a saved token is still valid (used on app reload).
r.get('/auth/me', requireAuth, h((req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ user: publicUser(user) });
}));

// Authenticated: ping to mark this account as currently active. The front-end
// calls this every 45s while signed in, powering the admin "who's online" list.
r.post('/auth/heartbeat', requireAuth, h((req, res) => {
  db.prepare('UPDATE users SET lastActive=? WHERE id=?').run(new Date().toISOString(), req.user.id);
  res.json({ ok: true });
}));

// Admin/manager: set or reset a user's PIN.
r.put('/users/:id/pin', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const { pin } = req.body || {};
  if (!/^\d{4,6}$/.test(String(pin || ''))) throw new Error('PIN must be 4–6 digits');
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(req.params.id)) throw new Error('user not found');
  const { hash, salt } = hashPin(pin);
  db.prepare('UPDATE users SET pin_hash=?, pin_salt=? WHERE id=?').run(hash, salt, req.params.id);
  res.json({ ok: true });
}));

// ---------------- IMAGE UPLOAD ----------------
// Accepts JSON { filename, dataUrl } where dataUrl is a base64 data URL from the
// browser (FileReader.readAsDataURL). Writes the file to /uploads and returns
// the public path the front-end should store, e.g. { path: "/uploads/ab12.jpg" }.
r.post('/upload', h((req, res) => {
  const { filename = 'photo', dataUrl } = req.body || {};
  if (!dataUrl || !dataUrl.startsWith('data:')) throw new Error('dataUrl (base64 image) is required');
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error('unsupported image data');
  const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9._-]/gi, '_').slice(0, 40) || 'photo';
  const name = `${Date.now()}-${base}.${ext}`;
  const slug = getCurrentTenant().slug;
  fs.writeFileSync(path.join(uploadDirFor(slug), name), Buffer.from(m[2], 'base64'));
  res.status(201).json({ path: `/uploads/${slug}/${name}` });
}));

// Same idea as /upload, but for PDFs — used by the WhatsApp notification
// feature so a generated payslip/notice has a real URL to put in the
// message text (wa.me links can only pre-fill text, never attach a file).
r.post('/upload-document', requireAuth, h((req, res) => {
  const { filename = 'document', dataUrl } = req.body || {};
  if (!dataUrl || !dataUrl.startsWith('data:application/pdf')) throw new Error('dataUrl (base64 PDF) is required');
  const m = dataUrl.match(/^data:application\/pdf;base64,(.+)$/);
  if (!m) throw new Error('unsupported document data');
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9._-]/gi, '_').slice(0, 40) || 'document';
  const name = `${Date.now()}-${base}.pdf`;
  const slug = getCurrentTenant().slug;
  fs.writeFileSync(path.join(uploadDirFor(slug), name), Buffer.from(m[1], 'base64'));
  res.status(201).json({ path: `/uploads/${slug}/${name}` });
}));

// ---------------- PRODUCTS ----------------
// A product is a "style"; what's actually sold/stocked is one of its
// product_variants rows (a size/color combo), and stock for a variant is
// itself split per shop in store_stock. GET attaches each product's
// variants as `.variants`, and each variant always carries a full
// `.stockByStore` breakdown (every shop, in one round trip — the product
// editor needs to show/edit all shops at once regardless of which one is
// "active"). When a storeId is passed, `.stock` on both the variant and
// the product is overridden to mean *that shop's* count — this is what
// lets every existing reader of `.stock` (out-of-stock checks, low-stock
// badges, sort-by-stock, CSV export) keep working unchanged in both the
// global view (Inventory, no storeId) and the shop-scoped view (Checkout).
const withVariants = (products, storeId = null) => {
  const list = Array.isArray(products) ? products : (products ? [products] : []);
  if (list.length) {
    const ids = list.map(p => p.id);
    const variants = db.prepare(`SELECT * FROM product_variants WHERE productId IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids);
    const allStores = db.prepare('SELECT id, name FROM stores ORDER BY id').all();
    const variantIds = variants.map(v => v.id);
    const stockRows = variantIds.length
      ? db.prepare(`SELECT * FROM store_stock WHERE variantId IN (${variantIds.map(() => '?').join(',')})`).all(...variantIds)
      : [];
    const stockByVariant = new Map(variantIds.map(id => [id, new Map()]));
    stockRows.forEach(row => stockByVariant.get(row.variantId).set(row.storeId, row.stock));

    const byProduct = new Map();
    variants.forEach(v => {
      const rowsForVariant = stockByVariant.get(v.id) || new Map();
      v.stockByStore = allStores.map(st => ({ storeId: st.id, name: st.name, stock: rowsForVariant.get(st.id) || 0 }));
      if (storeId != null) v.stock = rowsForVariant.get(Number(storeId)) || 0;
      if (!byProduct.has(v.productId)) byProduct.set(v.productId, []);
      byProduct.get(v.productId).push(v);
    });
    list.forEach(p => {
      p.variants = byProduct.get(p.id) || [];
      if (storeId != null) p.stock = p.variants.reduce((s, v) => s + (v.stock || 0), 0);
    });
  }
  return products;
};

// Replaces one variant's store_stock rows. Add/Edit Product only ever
// edits a flat `stock` number per variant — there is no UI anywhere that
// edits stockByStore (the per-store breakdown) itself. But GET /products
// echoes stockByStore back on every variant, and the form's local state
// carries that echoed array through untouched when editing an existing
// product. So preferring stockByStore whenever it's present (the original,
// more "faithful" reading) actually did the wrong thing: it kept
// overwriting the new flat `stock` value with the stale breakdown from
// before the edit, on every single save. Concretely, an edit changing
// stock 25 -> 40 would still write 25, because the untouched stockByStore
// array still said 25 — which is exactly the "stock edits don't stick"
// bug this fixes.
//
// The flat number is the only thing any UI actually intends to change, so
// it always wins when present, going entirely onto this shop's first
// store. stockByStore only applies as a fallback when the client sends no
// flat stock at all (nothing currently does that, but the shape is kept
// for a future proper multi-store editor).
const saveStoreStock = (variantId, stockByStore, flatStock) => {
  const stores = db.prepare('SELECT id FROM stores ORDER BY id').all();
  const hasFlat = flatStock !== undefined && flatStock !== null && flatStock !== '';
  const hasBreakdown = Array.isArray(stockByStore) && stockByStore.length > 0;
  const byStore = hasFlat
    ? new Map(stores.length ? [[stores[0].id, Number(flatStock) || 0]] : [])
    : hasBreakdown
      ? new Map(stockByStore.map(s => [Number(s.storeId), Number(s.stock) || 0]))
      : new Map();
  db.prepare('DELETE FROM store_stock WHERE variantId=?').run(variantId);
  const ins = db.prepare('INSERT INTO store_stock (storeId, variantId, stock) VALUES (?, ?, ?)');
  stores.forEach(st => ins.run(st.id, variantId, byStore.get(st.id) || 0));
};

// Upserts a product's variants from the array the client sent: rows with a
// known id are updated in place (keeping that id stable, since a cart built
// moments ago may already reference it as variantId), rows without an id (or
// with an id that's no longer valid) are inserted, and any existing row not
// present in the new array is deleted. Always leaves at least one variant
// (defaulting to "One Size") so a simple accessory with no real sizing still
// has a sellable row. Recomputes both stock rollups afterward.
const saveVariants = (productId, variants) => {
  const list = (Array.isArray(variants) && variants.length) ? variants : [{ size: 'One Size', color: null, sku: null, stockByStore: [], image: null }];
  const existingIds = db.prepare('SELECT id FROM product_variants WHERE productId=?').all(productId).map(v => v.id);
  const keepIds = new Set();
  const now = new Date().toISOString();
  const ins = db.prepare('INSERT INTO product_variants (productId,size,color,sku,stock,image,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)');
  const upd = db.prepare('UPDATE product_variants SET size=?,color=?,sku=?,image=?,updatedAt=? WHERE id=? AND productId=?');
  const touchedVariantIds = [];
  list.forEach((v, i) => {
    const sku = v.sku || `P${productId}-V${i + 1}`;
    let variantId;
    if (v.id && existingIds.includes(v.id)) {
      upd.run(v.size || null, v.color || null, sku, v.image || null, now, v.id, productId);
      variantId = v.id;
    } else {
      const info = ins.run(productId, v.size || null, v.color || null, sku, 0, v.image || null, now, now);
      variantId = info.lastInsertRowid;
    }
    keepIds.add(variantId);
    saveStoreStock(variantId, v.stockByStore, v.stock);
    touchedVariantIds.push(variantId);
  });
  const toDelete = existingIds.filter(id => !keepIds.has(id));
  if (toDelete.length) {
    db.prepare(`DELETE FROM product_variants WHERE id IN (${toDelete.map(() => '?').join(',')})`).run(...toDelete);
    db.prepare(`DELETE FROM store_stock WHERE variantId IN (${toDelete.map(() => '?').join(',')})`).run(...toDelete);
  }
  touchedVariantIds.forEach(recomputeVariantStock);
  recomputeProductStock(productId);
};

r.get('/products', h((req, res) => {
  const storeId = req.query.storeId != null && req.query.storeId !== '' ? Number(req.query.storeId) : null;
  res.json(withVariants(db.prepare('SELECT * FROM products ORDER BY id').all(), storeId));
}));

r.post('/products', h((req, res) => {
  const { name, name_fr = '', category, price, cost = 0, discount = 0, sku, emoji = '📦', image = null, packetPrice = null, unitsPerPacket = null, halfPacketPrice = null, variants = [] } = req.body;
  if (!name || !category || price == null || !sku) throw new Error('name, category, price and sku are required');
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO products (name,name_fr,category,price,cost,discount,stock,sku,emoji,image,createdAt,updatedAt,packetPrice,unitsPerPacket,halfPacketPrice) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(name, name_fr, category, price, cost, discount, 0, sku, emoji, image, now, now, packetPrice || null, unitsPerPacket || null, halfPacketPrice || null);
    saveVariants(info.lastInsertRowid, variants);
    return info.lastInsertRowid;
  });
  const id = tx();
  res.status(201).json(withVariants(db.prepare('SELECT * FROM products WHERE id=?').get(id)));
}));

r.put('/products/:id', h((req, res) => {
  const cur = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!cur) throw new Error('product not found');
  const n = { ...cur, ...req.body };
  const tx = db.transaction(() => {
    db.prepare('UPDATE products SET name=?,name_fr=?,category=?,price=?,cost=?,discount=?,sku=?,emoji=?,image=?,updatedAt=?,packetPrice=?,unitsPerPacket=?,halfPacketPrice=? WHERE id=?')
      .run(n.name, n.name_fr, n.category, n.price, n.cost ?? 0, n.discount ?? 0, n.sku, n.emoji, n.image ?? null, new Date().toISOString(), n.packetPrice || null, n.unitsPerPacket || null, n.halfPacketPrice || null, req.params.id);
    if (Array.isArray(req.body.variants)) saveVariants(req.params.id, req.body.variants);
    else recomputeProductStock(req.params.id);
  });
  tx();
  res.json(withVariants(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id)));
}));

r.delete('/products/:id', h((req, res) => {
  const variantIds = db.prepare('SELECT id FROM product_variants WHERE productId=?').all(req.params.id).map(v => v.id);
  if (variantIds.length) db.prepare(`DELETE FROM store_stock WHERE variantId IN (${variantIds.map(() => '?').join(',')})`).run(...variantIds);
  db.prepare('DELETE FROM product_variants WHERE productId=?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// Adjust one variant's stock directly at one shop (manual restock/correction
// from the inventory UI) without re-posting the whole product form. Logs a
// stock_movements row and keeps both stock rollups in sync.
r.post('/product-variants/:id/adjust', h((req, res) => {
  const { delta, storeId, type = 'adjustment', source = '', user = 'System' } = req.body || {};
  const d = Number(delta);
  if (!d) throw new Error('delta is required and must be non-zero');
  if (!storeId) throw new Error('storeId is required');
  const variant = db.prepare('SELECT * FROM product_variants WHERE id=?').get(req.params.id);
  if (!variant) throw new Error('variant not found');
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(variant.productId);
  const tx = db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO store_stock (storeId, variantId, stock) VALUES (?, ?, 0)').run(storeId, variant.id);
    db.prepare('UPDATE store_stock SET stock = MAX(0, stock + ?) WHERE storeId=? AND variantId=?')
      .run(d, storeId, variant.id);
    db.prepare('UPDATE product_variants SET updatedAt=? WHERE id=?').run(new Date().toISOString(), variant.id);
    recomputeStock(variant.id, variant.productId);
    const store = db.prepare('SELECT name FROM stores WHERE id=?').get(storeId);
    const label = [product?.name, [variant.size, variant.color].filter(Boolean).join(' / ')].filter(Boolean).join(' — ');
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    db.prepare('INSERT INTO stock_movements (productName,type,qty,source,date,user,productId,variantId,storeId) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(`${label}${store ? ` @ ${store.name}` : ''}`, type, Math.abs(d), source, date, user, variant.productId, variant.id, storeId);
  });
  tx();
  res.json(withVariants(db.prepare('SELECT * FROM products WHERE id=?').get(variant.productId), storeId));
}));

// ---------------- CATEGORIES ----------------
r.get('/categories', h((req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY label').all());
}));

// Lets the product form create a category on the fly instead of being
// limited to the 7 built-in ones. id is derived from the label (slugified)
// so it slots into products.category/checkout filters/Home cards the same
// way the built-ins do; re-posting an existing label just returns it as-is
// rather than erroring, so the form can call this unconditionally.
r.post('/categories', h((req, res) => {
  const { label } = req.body || {};
  if (!label || !label.trim()) throw new Error('label is required');
  const trimmed = label.trim();
  const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) throw new Error('Could not derive a category id from that name');
  const existing = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
  if (existing) return res.json(existing);
  db.prepare('INSERT INTO categories (id, label) VALUES (?, ?)').run(id, trimmed);
  res.status(201).json({ id, label: trimmed });
}));

// Refuses to delete a category still holding products — there's no
// reassignment UI, so silently orphaning products.category (a plain TEXT
// column, not a real foreign key) would leave them pointing at a category
// that no longer exists instead of actually moving them anywhere. Move
// affected products to a different category first (Edit Product), then
// delete.
r.delete('/categories/:id', h((req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);
  if (!category) throw new Error('Category not found');
  const inUse = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category=?').get(req.params.id).n;
  if (inUse > 0) throw new Error(`"${category.label}" still has ${inUse} product${inUse === 1 ? '' : 's'} in it — move them to another category first`);
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ---------------- STORES ----------------
r.get('/stores', h((req, res) => {
  res.json(db.prepare('SELECT * FROM stores ORDER BY id').all());
}));

r.post('/stores', requireAuth, requireRole('admin'), h((req, res) => {
  const { name, address = '', phone = '' } = req.body || {};
  if (!name || !name.trim()) throw new Error('name is required');
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO stores (name,address,phone,createdAt,updatedAt) VALUES (?,?,?,?,?)')
    .run(name.trim(), address, phone, now, now);
  res.status(201).json(db.prepare('SELECT * FROM stores WHERE id=?').get(info.lastInsertRowid));
}));

r.put('/stores/:id', requireAuth, requireRole('admin'), h((req, res) => {
  const cur = db.prepare('SELECT * FROM stores WHERE id=?').get(req.params.id);
  if (!cur) throw new Error('store not found');
  const n = { ...cur, ...req.body };
  db.prepare('UPDATE stores SET name=?,address=?,phone=?,updatedAt=? WHERE id=?')
    .run(n.name, n.address || '', n.phone || '', new Date().toISOString(), req.params.id);
  res.json(db.prepare('SELECT * FROM stores WHERE id=?').get(req.params.id));
}));

// Refuses to delete a shop that's still in use (staff assigned, stock on
// hand, or sales history) rather than silently orphaning those rows —
// there's no "move everything to another shop first" flow yet, so this is
// the safe default until one exists.
r.delete('/stores/:id', requireAuth, requireRole('admin'), h((req, res) => {
  const id = req.params.id;
  const staffCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE storeId=?').get(id).n;
  if (staffCount > 0) throw new Error('Cannot delete a shop with staff assigned to it — reassign them first');
  const stockCount = db.prepare('SELECT COALESCE(SUM(stock),0) AS n FROM store_stock WHERE storeId=?').get(id).n;
  if (stockCount > 0) throw new Error('Cannot delete a shop that still has stock on hand');
  const orderCount = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE storeId=?').get(id).n;
  if (orderCount > 0) throw new Error('Cannot delete a shop with sales history');
  db.prepare('DELETE FROM store_stock WHERE storeId=?').run(id);
  db.prepare('DELETE FROM stores WHERE id=?').run(id);
  res.json({ ok: true });
}));

// ---------------- CUSTOMERS ----------------
r.get('/customers', h((req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY spent DESC').all();
  res.json(rows.map(c => ({ ...c, creditBalance: customerCreditBalance(c.id) })));
}));
r.post('/customers', h((req, res) => {
  const { name, phone = '', points = 0, tier = 'Bronze', visits = 0, spent = 0 } = req.body;
  if (!name) throw new Error('name is required');
  const info = db.prepare('INSERT INTO customers (name,phone,points,tier,visits,spent) VALUES (?,?,?,?,?,?)')
    .run(name, phone, points, tier, visits, spent);
  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id=?').get(info.lastInsertRowid));
}));
r.put('/customers/:id', h((req, res) => {
  const cur = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!cur) throw new Error('customer not found');
  const n = { ...cur, ...req.body };
  db.prepare('UPDATE customers SET name=?,phone=?,points=?,tier=?,visits=?,spent=? WHERE id=?')
    .run(n.name, n.phone, n.points, n.tier, n.visits, n.spent, req.params.id);
  res.json(db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id));
}));

// ---------------- SUPPLIERS ----------------
r.get('/suppliers', h((req, res) => res.json(db.prepare('SELECT * FROM suppliers ORDER BY id').all())));
r.post('/suppliers', h((req, res) => {
  const { name, contact = '', phone = '', email = '', productsCount = 0, lastOrder = '', status = 'active', category = '' } = req.body;
  if (!name) throw new Error('name is required');
  const info = db.prepare('INSERT INTO suppliers (name,contact,phone,email,productsCount,lastOrder,status,category) VALUES (?,?,?,?,?,?,?,?)')
    .run(name, contact, phone, email, productsCount, lastOrder, status, category);
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(info.lastInsertRowid));
}));
r.put('/suppliers/:id', h((req, res) => {
  const cur = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
  if (!cur) throw new Error('supplier not found');
  const n = { ...cur, ...req.body };
  db.prepare('UPDATE suppliers SET name=?,contact=?,phone=?,email=?,productsCount=?,lastOrder=?,status=?,category=? WHERE id=?')
    .run(n.name, n.contact, n.phone, n.email, n.productsCount, n.lastOrder, n.status, n.category, req.params.id);
  res.json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id));
}));

// ---------------- SUPPLIER CREDIT LEDGER ----------------
r.get('/supplier-balances', requireAuth, h((req, res) => {
  const credits  = db.prepare('SELECT supplierId, SUM(amount) AS total FROM supplier_credits GROUP BY supplierId').all();
  const payments = db.prepare('SELECT supplierId, SUM(amount) AS total FROM supplier_payments GROUP BY supplierId').all();
  const suppliers = db.prepare('SELECT id, name FROM suppliers').all();
  const balances = suppliers.map(s => {
    const c = (credits.find(x => x.supplierId === s.id) || {}).total || 0;
    const p = (payments.find(x => x.supplierId === s.id) || {}).total || 0;
    return { supplierId: s.id, supplier: s.name, totalCredit: c, totalPaid: p, outstanding: c - p };
  });
  res.json(balances);
}));

r.get('/suppliers/:id/statement', requireAuth, h((req, res) => {
  const id = parseInt(req.params.id);
  const credits  = db.prepare('SELECT * FROM supplier_credits  WHERE supplierId=? ORDER BY date, createdAt').all(id);
  const payments = db.prepare('SELECT * FROM supplier_payments WHERE supplierId=? ORDER BY date, createdAt').all(id);
  const totalCredit = credits.reduce((s, c) => s + c.amount, 0);
  const totalPaid   = payments.reduce((s, p) => s + p.amount, 0);
  res.json({ credits, payments, totalCredit, totalPaid, outstanding: totalCredit - totalPaid });
}));

r.post('/suppliers/:id/credits', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const sup = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
  if (!sup) throw new Error('Supplier not found');
  const { amount, note = '', date } = req.body;
  if (!amount || Number(amount) <= 0) throw new Error('Amount must be positive');
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO supplier_credits (supplierId,supplier,amount,note,date,createdAt) VALUES (?,?,?,?,?,?)')
    .run(sup.id, sup.name, Number(amount), note, date || now.slice(0, 10), now);
  res.status(201).json(db.prepare('SELECT * FROM supplier_credits WHERE id=?').get(info.lastInsertRowid));
}));

r.post('/suppliers/:id/payments', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const sup = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
  if (!sup) throw new Error('Supplier not found');
  const { amount, note = '', date } = req.body;
  if (!amount || Number(amount) <= 0) throw new Error('Amount must be positive');
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO supplier_payments (supplierId,supplier,amount,note,date,createdAt) VALUES (?,?,?,?,?,?)')
    .run(sup.id, sup.name, Number(amount), note, date || now.slice(0, 10), now);
  res.status(201).json(db.prepare('SELECT * FROM supplier_payments WHERE id=?').get(info.lastInsertRowid));
}));

// ---------------- PURCHASE ORDERS ----------------
// Accounts payable: every PO carries amountPaid, so `outstanding` is what's
// still owed to that supplier. Computed on read rather than stored, so it
// can never drift out of sync with recorded payments.
const withOutstanding = (po) => po && { ...po, outstanding: po.total - (po.amountPaid || 0) };

r.get('/purchase-orders', h((req, res) =>
  res.json(db.prepare('SELECT * FROM purchase_orders ORDER BY date DESC').all().map(withOutstanding))
));
r.post('/purchase-orders', h((req, res) => {
  const { supplierId = null, supplier = '', items = 0, total = 0, status = 'draft', dueDate = null } = req.body;
  const year = new Date().getFullYear();
  const seq = (db.prepare('SELECT COUNT(*) AS n FROM purchase_orders').get().n + 146);
  const id = `PO-${year}-${String(seq).padStart(4, '0')}`;
  const date = new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO purchase_orders (id,supplierId,supplier,date,items,total,status,dueDate,amountPaid) VALUES (?,?,?,?,?,?,?,?,0)')
    .run(id, supplierId, supplier, date, items, total, status, dueDate);
  res.status(201).json(withOutstanding(db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(id)));
}));
r.patch('/purchase-orders/:id', h((req, res) => {
  const cur = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id);
  if (!cur) throw new Error('PO not found');
  const status = req.body.status ?? cur.status;
  const dueDate = req.body.dueDate ?? cur.dueDate;
  db.prepare('UPDATE purchase_orders SET status=?, dueDate=? WHERE id=?').run(status, dueDate, req.params.id);
  res.json(withOutstanding(db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id)));
}));

// Record a payment against a PO (accounts-payable ledger). Admin/manager
// only — this moves real money against a supplier balance.
r.post('/purchase-orders/:id/payments', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id);
  if (!po) throw new Error('PO not found');
  const { amount, method = 'cash', note = '' } = req.body || {};
  const amt = Math.round(Number(amount));
  if (!amt || amt <= 0) throw new Error('amount must be a positive number');
  const outstanding = po.total - (po.amountPaid || 0);
  if (amt > outstanding) throw new Error(`Amount exceeds outstanding balance of ${outstanding}`);

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO po_payments (purchaseOrderId,amount,method,note,createdBy,createdAt) VALUES (?,?,?,?,?,?)')
      .run(po.id, amt, method, note, req.user.name, new Date().toISOString());
    db.prepare('UPDATE purchase_orders SET amountPaid = amountPaid + ? WHERE id=?').run(amt, po.id);
  });
  tx();
  res.status(201).json(withOutstanding(db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(po.id)));
}));

r.get('/purchase-orders/:id/payments', h((req, res) =>
  res.json(db.prepare('SELECT * FROM po_payments WHERE purchaseOrderId=? ORDER BY createdAt DESC').all(req.params.id))
));

// ---------------- STOCK MOVEMENTS ----------------
r.get('/stock-movements', h((req, res) => res.json(db.prepare('SELECT * FROM stock_movements ORDER BY id DESC').all())));
r.post('/stock-movements', h((req, res) => {
  const { productName, type, qty, source = '', user = 'System' } = req.body;
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const info = db.prepare('INSERT INTO stock_movements (productName,type,qty,source,date,user) VALUES (?,?,?,?,?,?)')
    .run(productName, type, qty, source, date, user);
  res.status(201).json(db.prepare('SELECT * FROM stock_movements WHERE id=?').get(info.lastInsertRowid));
}));

// ---------------- USERS ----------------
r.get('/users', h((req, res) => {
  const rows = db.prepare('SELECT id,name,username,role,email,lastActive,storeId,whatsapp,hourlyRate FROM users ORDER BY id').all();
  res.json(rows.map(withOnline));
}));

r.post('/users', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const { name, role = 'cashier', email = '', storeId = null, pin = '1234', whatsapp = '', hourlyRate = 0 } = req.body;
  let { username } = req.body;
  if (!name) throw new Error('name is required');
  if (!/^\d{4,6}$/.test(String(pin))) throw new Error('PIN must be 4–6 digits');
  const slug = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
  username = slug(username) || slug((email || '').split('@')[0]) || slug(name) || 'user';
  let base = username, n = 1;
  while (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) username = `${base}${++n}`;
  const { hash, salt } = hashPin(pin);
  const info = db.prepare('INSERT INTO users (name,username,role,email,lastActive,storeId,pin_hash,pin_salt,whatsapp,hourlyRate) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(name, username, role, email, null, storeId || null, hash, salt, whatsapp, Number(hourlyRate) || 0);
  res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid)));
}));

r.put('/users/:id', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const cur = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!cur) throw new Error('user not found');
  const n = { ...cur, ...req.body };
  db.prepare('UPDATE users SET name=?,role=?,email=?,storeId=?,whatsapp=?,hourlyRate=? WHERE id=?')
    .run(n.name, n.role, n.email, n.storeId || null, n.whatsapp || '', Number(n.hourlyRate) || 0, req.params.id);
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)));
}));

// Admin only: delete a cashier or manager account.
// Guards: cannot delete an admin account, and cannot delete yourself.
// Also removes that person's shifts so they disappear from the Shifts page.
r.delete('/users/:id', requireAuth, requireRole('admin'), h((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) throw new Error('user not found');
  if (target.role === 'admin') throw new Error('Admin accounts cannot be deleted');
  if (Number(req.params.id) === Number(req.user.id)) throw new Error('You cannot delete your own account');
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM shifts WHERE userId=?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  });
  tx();
  res.json({ ok: true });
}));

// ---------------- EMPLOYEES & SHIFTS ----------------
// `employees` is the roster of shop-floor staff who never get a software
// login (salespeople, stockers, ...) — see the Staff register endpoints
// below. Self-service shift clock-in/out (further down) is unrelated and
// always keyed to the logged-in `users` account instead.
const EMPLOYEE_COLORS = [
  'from-amber-400 to-rose-500', 'from-emerald-400 to-teal-600',
  'from-sky-400 to-indigo-600', 'from-fuchsia-400 to-purple-600',
];
const employeeInitials = (name) => (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

r.get('/employees', h((req, res) => res.json(db.prepare('SELECT * FROM employees ORDER BY id').all())));

r.post('/employees', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const { name, role = '', rate = 0, whatsapp = '' } = req.body || {};
  if (!name || !name.trim()) throw new Error('name is required');
  const count = db.prepare('SELECT COUNT(*) AS n FROM employees').get().n;
  const color = EMPLOYEE_COLORS[count % EMPLOYEE_COLORS.length];
  const info = db.prepare('INSERT INTO employees (name,role,initials,color,rate,whatsapp) VALUES (?,?,?,?,?,?)')
    .run(name.trim(), role, employeeInitials(name), color, Number(rate) || 0, whatsapp || null);
  res.status(201).json(db.prepare('SELECT * FROM employees WHERE id=?').get(info.lastInsertRowid));
}));

r.put('/employees/:id', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const cur = db.prepare('SELECT * FROM employees WHERE id=?').get(req.params.id);
  if (!cur) throw new Error('employee not found');
  const n = { ...cur, ...req.body };
  db.prepare('UPDATE employees SET name=?,role=?,initials=?,rate=?,whatsapp=? WHERE id=?')
    .run(n.name, n.role || '', employeeInitials(n.name), Number(n.rate) || 0, n.whatsapp || null, req.params.id);
  res.json(db.prepare('SELECT * FROM employees WHERE id=?').get(req.params.id));
}));

r.delete('/employees/:id', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  db.prepare('DELETE FROM employees WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));
// Cashiers can see shift times but not the cash reconciliation outcome or
// their own clock-in photo — whether the drawer was balanced and who
// actually showed up are management/accounting's call to review, not
// something to surface back to the person being checked on. Stripped here,
// not just hidden in the UI, since the raw response is one devtools click
// away otherwise. This route stays public like its sibling reads
// (/products, /customers, /settings, ...) so the app's very first load —
// before anyone's logged in and there's no token yet to read a role from —
// doesn't fail; the front-end re-pulls this once a session exists, at
// which point the token here lets us actually tell who's asking.
r.get('/shifts', h((req, res) => {
  const shifts = db.prepare('SELECT * FROM shifts ORDER BY clockIn DESC').all();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  const canSeeCash = payload && ['admin', 'manager', 'accountant'].includes(payload.role);
  if (canSeeCash) return res.json(shifts);
  res.json(shifts.map(({ expectedCash, countedCash, cashVariance, clockInPhoto, ...rest }) => rest));
}));

// Clock IN — always the authenticated user. A photo is required for
// non-admin roles (stands in for "this is really that person"). Admins
// are the ones who review everyone else's photos, so requiring one of
// themselves adds no accountability — they clock in without one.
r.post('/shifts/clock-in', requireAuth, h((req, res) => {
  if (isHandheldUA(req.headers['user-agent'])) throw new Error('Use the POS terminal for this — not a phone or tablet');
  const { photo } = req.body || {};
  if (!photo && req.user.role !== 'admin') throw new Error('A clock-in photo is required');
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!u) throw new Error('account not found');
  const open = db.prepare('SELECT * FROM shifts WHERE userId=? AND clockOut IS NULL').get(u.id);
  if (open) throw new Error('You are already clocked in');
  const info = db.prepare('INSERT INTO shifts (userId,name,role,clockIn,clockOut,clockInPhoto,storeId) VALUES (?,?,?,?,NULL,?,?)')
    .run(u.id, u.name, u.role, new Date().toISOString(), photo || null, u.storeId || null);
  res.status(201).json(db.prepare('SELECT * FROM shifts WHERE id=?').get(info.lastInsertRowid));
}));

// Clock OUT — always the authenticated user. Reconciles the cash drawer:
// expectedCash is computed from this cashier's own cash-method sales during
// the shift, compared against what they actually counted (countedCash, from
// the clock-out prompt) to get an over/short variance for accountability.
// countedCash is optional so this stays robust for offline-queued retries —
// expectedCash is still recorded either way.
r.post('/shifts/clock-out', requireAuth, h((req, res) => {
  const open = db.prepare('SELECT * FROM shifts WHERE userId=? AND clockOut IS NULL').get(req.user.id);
  if (!open) throw new Error('You are not clocked in');
  const clockOutAt = new Date().toISOString();
  const { countedCash = null } = req.body || {};

  // Manual/backdated entries are excluded — no real cash moved through
  // today's till for a sale that was actually made (and written down on
  // paper) at some earlier time. Also scoped to the shop this shift was
  // worked at, when known — a same-named cashier's sales at a different
  // shop shouldn't count toward this till's reconciliation.
  const expectedCash = db.prepare(
    `SELECT COALESCE(SUM(total),0) AS amount FROM orders
     WHERE method='cash' AND cashier=? AND createdAt >= ? AND createdAt <= ? AND (manualEntry IS NULL OR manualEntry=0)
     AND (? IS NULL OR storeId=?)`
  ).get(open.name, open.clockIn, clockOutAt, open.storeId || null, open.storeId || null).amount;

  const counted = countedCash != null && countedCash !== '' ? Math.round(Number(countedCash)) : null;
  const cashVariance = counted != null ? counted - expectedCash : null;

  db.prepare('UPDATE shifts SET clockOut=?, expectedCash=?, countedCash=?, cashVariance=? WHERE id=?')
    .run(clockOutAt, expectedCash, counted, cashVariance, open.id);
  const updated = db.prepare('SELECT * FROM shifts WHERE id=?').get(open.id);
  // Clock-out is always self-service, so the requester here is whoever just
  // clocked out — don't hand a cashier their own variance in the response
  // even though the UI doesn't render it; the JSON itself shouldn't carry it.
  if (!['admin', 'manager', 'accountant'].includes(req.user.role)) {
    const { expectedCash, countedCash, cashVariance, clockInPhoto, ...rest } = updated;
    return res.json(rest);
  }
  res.json(updated);
}));

// ---------------- STAFF REGISTER ----------------
// Clocks a roster employee (someone with no software login) in or out, on
// their behalf, by whoever's operating the front desk — a plain
// arrival/departure log. No cash reconciliation and no required photo:
// those exist for self-service cashier clock-in/out because that person is
// accountable for a till; a salesperson clocked in by their manager isn't.
r.post('/shifts/register-in', requireAuth, requireRole('admin', 'manager', 'cashier'), h((req, res) => {
  const { employeeId, storeId = null } = req.body || {};
  if (!employeeId) throw new Error('employeeId is required');
  const emp = db.prepare('SELECT * FROM employees WHERE id=?').get(employeeId);
  if (!emp) throw new Error('employee not found');
  const open = db.prepare('SELECT * FROM shifts WHERE employeeId=? AND clockOut IS NULL').get(emp.id);
  if (open) throw new Error(`${emp.name} is already clocked in`);
  const info = db.prepare('INSERT INTO shifts (employeeId,name,role,clockIn,clockOut,storeId,recordedBy) VALUES (?,?,?,?,NULL,?,?)')
    .run(emp.id, emp.name, emp.role, new Date().toISOString(), storeId || null, req.user.name);
  res.status(201).json(db.prepare('SELECT * FROM shifts WHERE id=?').get(info.lastInsertRowid));
}));

r.post('/shifts/register-out', requireAuth, requireRole('admin', 'manager', 'cashier'), h((req, res) => {
  const { employeeId } = req.body || {};
  if (!employeeId) throw new Error('employeeId is required');
  const open = db.prepare('SELECT * FROM shifts WHERE employeeId=? AND clockOut IS NULL').get(employeeId);
  if (!open) throw new Error('That employee is not clocked in');
  db.prepare('UPDATE shifts SET clockOut=?, recordedBy=? WHERE id=?')
    .run(new Date().toISOString(), req.user.name, open.id);
  res.json(db.prepare('SELECT * FROM shifts WHERE id=?').get(open.id));
}));

// ---------------- ORDERS / CHECKOUT (the heart of the POS) ----------------
// Shared by a live checkout and a manual/backdated entry (a sale written on
// paper when it happened and only now being entered): create the order,
// store its line items, decrement product stock, log stock-out movements,
// bump customer stats — all in one transaction.
function insertSale({ items, customerId, method, cashier, discount, tva, createdAt, clientOrderId, manualEntry = false, storeId = null, pointsRedeemed = 0, creditApplied = 0 }) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const pointsDiscountAmt = Math.round((pointsRedeemed || 0) * FCFA_PER_POINT);
  const credit = Math.round(creditApplied || 0);
  const total = Math.max(0, Math.round(subtotal - discount - pointsDiscountAmt - credit + tva));
  const year = new Date(createdAt).getUTCFullYear();
  const invoiceNo = `INV-${year}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const tx = db.transaction(() => {
    // A customer can only ever spend points/credit they actually own —
    // re-checked against the live database, never trusted from the client.
    if (pointsRedeemed > 0 || credit > 0) {
      if (!customerId) throw new Error('a customer must be attached to redeem points or store credit');
      const cust = db.prepare('SELECT points FROM customers WHERE id=?').get(customerId);
      if (!cust) throw new Error('customer not found');
      if (pointsRedeemed > cust.points) throw new Error('customer does not have that many points');
      if (credit > customerCreditBalance(customerId)) throw new Error('customer does not have that much store credit');
    }

    // Re-check stock against the live database, not whatever the cart held
    // when the cashier started — another terminal may have sold the last
    // units in the meantime. Reject the whole sale rather than silently
    // selling stock that no longer exists. Stock lives on the specific
    // variant SOLD AT THIS SHOP (store_stock, keyed by storeId+variantId) —
    // it.variantId is the sellable row; it.productId just tags which style
    // it belongs to for packet pricing/cost/category. A variant with no
    // store_stock row yet for this shop reads as 0, not "unlimited".
    const variantOf = db.prepare(
      `SELECT pv.id AS variantId, COALESCE(ss.stock, 0) AS stock, pv.size, pv.color, pv.sku AS variantSku,
              p.id AS productId, p.name, p.unitsPerPacket
       FROM product_variants pv JOIN products p ON p.id = pv.productId
       LEFT JOIN store_stock ss ON ss.variantId = pv.id AND ss.storeId = ?
       WHERE pv.id=?`
    );
    const variantCache = new Map();
    const perUnitOf = (it, v) => it.mode === 'packet' ? (v?.unitsPerPacket || 1)
      : it.mode === 'half' ? halfPackUnits(v)
      : 1;
    const unitsOf = (it) => {
      const v = variantCache.get(it.variantId);
      return it.qty * perUnitOf(it, v);
    };
    for (const it of items) {
      if (!it.variantId) continue;
      const v = variantOf.get(storeId, it.variantId);
      if (!v) throw new Error(`Product no longer exists: ${it.name}`);
      variantCache.set(it.variantId, v);
      const needed = unitsOf(it);
      if (v.stock < needed) throw new Error(`Insufficient stock for ${v.name}: only ${v.stock} left`);
    }

    const orderInfo = db.prepare(
      'INSERT INTO orders (invoiceNo,customerId,subtotal,discount,tva,total,method,cashier,createdAt,clientOrderId,manualEntry,storeId,pointsRedeemed,pointsDiscountAmt,creditApplied) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(invoiceNo, customerId, subtotal, Math.round(discount), Math.round(tva), total, method, cashier, createdAt, clientOrderId, manualEntry ? 1 : 0, storeId, pointsRedeemed || 0, pointsDiscountAmt, credit);
    const orderId = orderInfo.lastInsertRowid;

    const itemIns = db.prepare('INSERT INTO order_items (orderId,productId,name,sku,price,cost,qty,mode,unitsPerPacket,variantId,size,color,variantSku) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const ensureRow = db.prepare('INSERT OR IGNORE INTO store_stock (storeId, variantId, stock) VALUES (?, ?, 0)');
    const stockUpd = db.prepare('UPDATE store_stock SET stock = MAX(0, stock - ?) WHERE storeId=? AND variantId=?');
    const moveIns = db.prepare('INSERT INTO stock_movements (productName,type,qty,source,date,user,productId,variantId,storeId) VALUES (?,?,?,?,?,?,?,?,?)');
    const costOf = db.prepare('SELECT cost FROM products WHERE id=?');
    const dateStr = createdAt.slice(0, 16).replace('T', ' ');
    const touchedVariants = new Map(); // variantId -> productId

    for (const it of items) {
      const v = it.variantId ? variantCache.get(it.variantId) : null;
      const productId = v?.productId || it.productId || null;
      const unitCost = productId ? (costOf.get(productId)?.cost || 0) : 0;
      const mode = it.mode === 'packet' ? 'packet' : it.mode === 'half' ? 'half' : 'unit';
      const packSize = mode === 'unit' ? null : perUnitOf({ mode }, v);
      itemIns.run(orderId, productId, it.name, it.sku, it.price, unitCost, it.qty, mode, packSize, it.variantId || null, v?.size || null, v?.color || null, v?.variantSku || null);
      if (v) {
        const units = unitsOf(it);
        ensureRow.run(storeId, it.variantId);
        stockUpd.run(units, storeId, it.variantId);
        touchedVariants.set(it.variantId, productId);
        const label = [it.name, [v.size, v.color].filter(Boolean).join(' / ')].filter(Boolean).join(' — ');
        moveIns.run(label, 'out', units, invoiceNo, dateStr, cashier || 'POS', productId, it.variantId, storeId);
      }
    }
    touchedVariants.forEach((productId, variantId) => recomputeStock(variantId, productId));

    if (customerId) {
      // 1 point earned per 100 FCFA actually paid — the only way points get
      // onto an account short of an admin editing the customer directly.
      const pointsEarned = Math.floor(total / 100);
      db.prepare('UPDATE customers SET spent = spent + ?, visits = visits + 1, points = points - ? + ? WHERE id=?')
        .run(total, pointsRedeemed || 0, pointsEarned, customerId);
      if (credit > 0) {
        db.prepare('INSERT INTO customer_credit_ledger (customerId,amount,reason,orderId,note,createdAt,createdBy) VALUES (?,?,?,?,?,?,?)')
          .run(customerId, -credit, 'redemption', orderId, null, createdAt, cashier || null);
      }
    }
    return orderId;
  });

  return tx();
}

r.post('/orders', h((req, res) => {
  const { items = [], customerId = null, method = 'cash', cashier = '', discount = 0, tva = 0, clientOrderId = null, storeId = null, pointsRedeemed = 0, creditApplied = 0 } = req.body;
  if (!items.length) throw new Error('cannot checkout an empty cart');
  if (!storeId) throw new Error('storeId is required');

  // Idempotency: a retried or offline-queued checkout sends the same
  // clientOrderId. If we already recorded it, return that sale instead of
  // creating a second one (e.g. the connection dropped after the order
  // saved but before the success response reached the cashier's browser).
  if (clientOrderId) {
    const existing = db.prepare('SELECT * FROM orders WHERE clientOrderId=?').get(clientOrderId);
    if (existing) {
      existing.items = db.prepare('SELECT * FROM order_items WHERE orderId=?').all(existing.id);
      return res.status(200).json(existing);
    }
  }

  const orderId = insertSale({ items, customerId, method, cashier, discount, tva, createdAt: new Date().toISOString(), clientOrderId, storeId, pointsRedeemed, creditApplied });
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  order.items = db.prepare('SELECT * FROM order_items WHERE orderId=?').all(orderId);
  res.status(201).json(order);
}));

// A sale that was written down on paper (the books) when it happened and is
// only now being entered into the system — same effect as a live checkout
// (stock moves, customer stats update) but dated to when it actually
// occurred instead of "now", and flagged (manualEntry) so it doesn't inflate
// a shift's cash-drawer reconciliation. Restricted to admin/manager since it
// can retroactively rewrite sales history.
r.post('/orders/manual', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const { items = [], customerId = null, method = 'cash', cashier = '', discount = 0, tva = 0, date, clientOrderId = null, storeId = null } = req.body;
  if (!items.length) throw new Error('cannot record an empty sale');
  if (!date) throw new Error('date is required');
  if (!storeId) throw new Error('storeId is required');
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) throw new Error('date cannot be in the future');

  if (clientOrderId) {
    const existing = db.prepare('SELECT * FROM orders WHERE clientOrderId=?').get(clientOrderId);
    if (existing) {
      existing.items = db.prepare('SELECT * FROM order_items WHERE orderId=?').all(existing.id);
      return res.status(200).json(existing);
    }
  }

  // Noon UTC keeps substr(createdAt,1,10) and every ISO date-range report
  // query matching `date` exactly, regardless of server timezone.
  const createdAt = `${date}T12:00:00.000Z`;
  const enteredBy = cashier || req.user.name;
  const orderId = insertSale({ items, customerId, method, cashier: enteredBy, discount, tva, createdAt, clientOrderId, manualEntry: true, storeId });
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  order.items = db.prepare('SELECT * FROM order_items WHERE orderId=?').all(orderId);
  res.status(201).json(order);
}));

r.get('/orders', h((req, res) => {
  // Manual/backdated entries carry an old createdAt, so `ORDER BY createdAt
  // DESC` can push them out of the normal 200-row window as live sales pile
  // up. ?manual=1 orders by insertion instead, so "recently recorded"
  // reflects when they were entered, not the (older) date they're for.
  if (req.query.manual === '1') {
    const orders = db.prepare('SELECT * FROM orders WHERE manualEntry=1 ORDER BY id DESC LIMIT 200').all();
    return res.json(orders);
  }
  const orders = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT 200').all();
  res.json(orders);
}));

r.get('/orders/:id', requireAuth, h((req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.items = db.prepare('SELECT * FROM order_items WHERE orderId=?').all(order.id);
  res.json(order);
}));

r.put('/orders/:id', requireAuth, requireRole('admin'), h((req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { items: newItems, discount = 0, method, note } = req.body;
  const oldItems = db.prepare('SELECT * FROM order_items WHERE orderId=?').all(order.id);

  // Reconcile stock: build maps of variantId → stock units (not line qty —
  // a packet/half-packet line's qty is a count of packets/half-packets, so
  // it must be expanded by its unitsPerPacket to get the actual units to
  // return/take from stock). unitsPerPacket already holds the right
  // per-line multiplier for either mode (full pack size, or half of it).
  // Stock lives on the variant (size/color) sold, not the parent product.
  const unitsOf = (i) => (i.mode === 'packet' || i.mode === 'half') ? i.qty * (i.unitsPerPacket || 1) : i.qty;
  const oldQty = {};
  oldItems.forEach(i => { if (i.variantId) oldQty[i.variantId] = (oldQty[i.variantId] || 0) + unitsOf(i); });
  const newQty = {};
  (newItems || []).forEach(i => { if (i.variantId) newQty[i.variantId] = (newQty[i.variantId] || 0) + unitsOf(i); });

  // Union of all variantIds touched — adjusted at the shop the order was
  // rung up at (orders don't change shops on edit, only their line items).
  const allVariantIds = new Set([...Object.keys(oldQty), ...Object.keys(newQty)]);
  const ensureRow = db.prepare('INSERT OR IGNORE INTO store_stock (storeId, variantId, stock) VALUES (?, ?, 0)');
  const adjustStock = db.prepare('UPDATE store_stock SET stock = MAX(0, stock + ?) WHERE storeId=? AND variantId=?');
  const productOfVariant = db.prepare('SELECT productId FROM product_variants WHERE id=?');
  const touchedVariants = new Map();
  allVariantIds.forEach(vid => {
    const diff = (oldQty[vid] || 0) - (newQty[vid] || 0); // positive → return to stock
    if (diff !== 0) {
      ensureRow.run(order.storeId, Number(vid));
      adjustStock.run(diff, order.storeId, Number(vid));
    }
    const row = productOfVariant.get(Number(vid));
    if (row) touchedVariants.set(Number(vid), row.productId);
  });
  touchedVariants.forEach((productId, variantId) => recomputeStock(variantId, productId));

  // Recalculate totals (no TVA on manual edits)
  const subtotal = (newItems || []).reduce((s, i) => s + i.price * i.qty, 0);
  const disc = Number(discount) || 0;
  const total = subtotal - disc;

  // Replace order header
  db.prepare('UPDATE orders SET subtotal=?,discount=?,tva=?,total=?,method=? WHERE id=?')
    .run(subtotal, disc, 0, total, method || order.method, order.id);

  // Replace items
  db.prepare('DELETE FROM order_items WHERE orderId=?').run(order.id);
  const ins = db.prepare('INSERT INTO order_items (orderId,productId,name,sku,price,cost,qty,mode,unitsPerPacket,variantId,size,color,variantSku) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  (newItems || []).forEach(i => {
    const mode = i.mode === 'packet' ? 'packet' : i.mode === 'half' ? 'half' : 'unit';
    ins.run(order.id, i.productId || null, i.name, i.sku || '', i.price, i.cost || 0, i.qty, mode, mode === 'unit' ? null : (i.unitsPerPacket || 1), i.variantId || null, i.size || null, i.color || null, i.variantSku || i.sku || null);
  });

  const updated = db.prepare('SELECT * FROM orders WHERE id=?').get(order.id);
  updated.items = db.prepare('SELECT * FROM order_items WHERE orderId=?').all(order.id);
  res.json(updated);
}));

// ---------------- DISCOUNT REQUESTS ----------------
// Cashier submits a discount request; manager/admin approves or rejects it
// before the order is finalised and the receipt prints.

r.post('/discount-requests', requireAuth, h((req, res) => {
  const { cashier, cashierId, items = [], subtotal, discountAmt } = req.body;
  if (!discountAmt || Number(discountAmt) <= 0) throw new Error('discountAmt required');
  const createdAt = new Date().toISOString();
  const info = db.prepare(
    'INSERT INTO discount_requests (cashier,cashierId,items,subtotal,discountAmt,status,createdAt) VALUES (?,?,?,?,?,?,?)'
  ).run(cashier, cashierId || null, JSON.stringify(items), Number(subtotal), Number(discountAmt), 'pending', createdAt);
  res.status(201).json({ id: info.lastInsertRowid, status: 'pending', createdAt });
}));

r.get('/discount-requests/pending', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const rows = db.prepare("SELECT * FROM discount_requests WHERE status='pending' ORDER BY createdAt ASC").all();
  res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items) })));
}));

r.get('/discount-requests/:id', requireAuth, h((req, res) => {
  const row = db.prepare('SELECT * FROM discount_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ ...row, items: JSON.parse(row.items) });
}));

r.put('/discount-requests/:id/approve', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const row = db.prepare('SELECT * FROM discount_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.status !== 'pending') return res.json({ id: row.id, status: row.status });
  const now = new Date().toISOString();
  db.prepare("UPDATE discount_requests SET status='approved',resolvedAt=?,resolvedBy=? WHERE id=?")
    .run(now, req.user.name || req.user.username, row.id);
  res.json({ id: row.id, status: 'approved', resolvedAt: now });
}));

r.put('/discount-requests/:id/reject', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const { note } = req.body || {};
  const row = db.prepare('SELECT * FROM discount_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.status !== 'pending') return res.json({ id: row.id, status: row.status });
  const now = new Date().toISOString();
  db.prepare("UPDATE discount_requests SET status='rejected',note=?,resolvedAt=?,resolvedBy=? WHERE id=?")
    .run(note || null, now, req.user.name || req.user.username, row.id);
  res.json({ id: row.id, status: 'rejected', resolvedAt: now, note });
}));

r.delete('/discount-requests/:id', requireAuth, h((req, res) => {
  db.prepare('DELETE FROM discount_requests WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ---------------- RETURNS / EXCHANGES ----------------
// A cashier submits a return against a real, already-completed order; a
// manager/admin approves or rejects it. Unlike discount_requests (submitted
// before the order it affects even exists), everything a return needs
// (which items, how many, the store credit owed) is already knowable at
// request time, so approval can safely perform the stock restock + credit
// grant itself, right here, server-side — no client polling loop needed to
// "finish" anything afterward.

r.post('/return-requests', requireAuth, h((req, res) => {
  const { orderId, items = [], reason, note } = req.body;
  if (!orderId) throw new Error('orderId is required');
  if (!items.length) throw new Error('select at least one item to return');
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  if (!order) throw new Error('order not found');
  const origItems = db.prepare('SELECT * FROM order_items WHERE orderId=?').all(orderId);
  const byId = new Map(origItems.map(i => [i.id, i]));

  // How much of each line has already been requested/approved for return,
  // so the same items can't be returned twice.
  const priorRows = db.prepare("SELECT items FROM return_requests WHERE orderId=? AND status IN ('pending','approved')").all(orderId);
  const alreadyReturned = {};
  priorRows.forEach(row => JSON.parse(row.items).forEach(it => {
    alreadyReturned[it.orderItemId] = (alreadyReturned[it.orderItemId] || 0) + it.qty;
  }));

  let creditAmt = 0;
  const built = items.map(({ orderItemId, qty }) => {
    const orig = byId.get(Number(orderItemId));
    if (!orig) throw new Error('item does not belong to this order');
    const q = Number(qty) || 0;
    const already = alreadyReturned[orderItemId] || 0;
    if (q <= 0 || already + q > orig.qty) throw new Error(`cannot return more than sold for ${orig.name}`);
    creditAmt += orig.price * q;
    return {
      orderItemId: orig.id, variantId: orig.variantId, productId: orig.productId,
      name: orig.name, size: orig.size, color: orig.color, price: orig.price,
      qty: q, mode: orig.mode, unitsPerPacket: orig.unitsPerPacket,
    };
  });

  const createdAt = new Date().toISOString();
  const info = db.prepare(
    'INSERT INTO return_requests (orderId,customerId,items,creditAmt,reason,requestedBy,requestedById,status,note,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(orderId, order.customerId, JSON.stringify(built), creditAmt, reason || null, req.user.name || req.user.username, req.user.id, 'pending', note || null, createdAt);
  res.status(201).json({ id: info.lastInsertRowid, status: 'pending', creditAmt, createdAt });
}));

r.get('/return-requests/pending', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const rows = db.prepare("SELECT * FROM return_requests WHERE status='pending' ORDER BY createdAt ASC").all();
  res.json(rows.map(row => ({ ...row, items: JSON.parse(row.items) })));
}));

r.get('/return-requests', requireAuth, h((req, res) => {
  const rows = db.prepare('SELECT * FROM return_requests ORDER BY createdAt DESC LIMIT 200').all();
  res.json(rows.map(row => ({ ...row, items: JSON.parse(row.items) })));
}));

r.get('/return-requests/:id', requireAuth, h((req, res) => {
  const row = db.prepare('SELECT * FROM return_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ ...row, items: JSON.parse(row.items) });
}));

r.put('/return-requests/:id/approve', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const row = db.prepare('SELECT * FROM return_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.status !== 'pending') return res.json({ id: row.id, status: row.status });
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(row.orderId);
  const items = JSON.parse(row.items);
  const now = new Date().toISOString();
  const resolvedBy = req.user.name || req.user.username;

  db.transaction(() => {
    const ensureRow = db.prepare('INSERT OR IGNORE INTO store_stock (storeId, variantId, stock) VALUES (?, ?, 0)');
    const restock = db.prepare('UPDATE store_stock SET stock = stock + ? WHERE storeId=? AND variantId=?');
    const moveIns = db.prepare('INSERT INTO stock_movements (productName,type,qty,source,date,user,productId,variantId,storeId) VALUES (?,?,?,?,?,?,?,?,?)');
    const dateStr = now.slice(0, 16).replace('T', ' ');
    items.forEach(it => {
      if (!it.variantId) return;
      const units = (it.mode === 'packet' || it.mode === 'half') ? it.qty * (it.unitsPerPacket || 1) : it.qty;
      ensureRow.run(order.storeId, it.variantId);
      restock.run(units, order.storeId, it.variantId);
      recomputeStock(it.variantId, it.productId);
      const label = [it.name, [it.size, it.color].filter(Boolean).join(' / ')].filter(Boolean).join(' — ');
      moveIns.run(label, 'in', units, `RET-${row.id}`, dateStr, resolvedBy, it.productId, it.variantId, order.storeId);
    });

    if (row.customerId) {
      db.prepare('INSERT INTO customer_credit_ledger (customerId,amount,reason,orderId,returnId,note,createdAt,createdBy) VALUES (?,?,?,?,?,?,?,?)')
        .run(row.customerId, row.creditAmt, 'return', row.orderId, row.id, row.note, now, resolvedBy);
      db.prepare('UPDATE customers SET spent = MAX(0, spent - ?) WHERE id=?').run(row.creditAmt, row.customerId);
    }

    db.prepare("UPDATE return_requests SET status='approved',resolvedAt=?,resolvedBy=? WHERE id=?").run(now, resolvedBy, row.id);
  })();

  res.json({ id: row.id, status: 'approved', resolvedAt: now });
}));

r.put('/return-requests/:id/reject', requireAuth, requireRole('admin', 'manager'), h((req, res) => {
  const { note } = req.body || {};
  const row = db.prepare('SELECT * FROM return_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.status !== 'pending') return res.json({ id: row.id, status: row.status });
  const now = new Date().toISOString();
  db.prepare("UPDATE return_requests SET status='rejected',note=?,resolvedAt=?,resolvedBy=? WHERE id=?")
    .run(note || row.note, now, req.user.name || req.user.username, row.id);
  res.json({ id: row.id, status: 'rejected', resolvedAt: now, note });
}));

// ---------------- ONLINE ORDERS ----------------
// Submitted via the public ordering page (routes/onlineOrder.js) with
// stock already reserved (decremented) at submission time. Confirming
// creates the real sale (orders/order_items) without touching stock
// again — it was already spent; rejecting gives the reserved stock back.
// Visible to the same roles that can run a till (admin/manager/cashier) —
// an accountant sees financial history but isn't the one who should be
// deciding whether a mobile money payment actually landed.
r.get('/online-orders', requireAuth, h((req, res) => {
  res.json(db.prepare('SELECT * FROM online_orders ORDER BY createdAt DESC LIMIT 200').all());
}));

// Loose digits-only match so "677 00 00 00", "+237677000000" and
// "237-677-00-00-00" are recognized as the same number — same idea as the
// client's normalizePhone, done here since this match has to happen
// server-side against the live customers table.
const phoneDigits = (s) => (s || '').toString().replace(/[^\d]/g, '').replace(/^0+/, '');

r.put('/online-orders/:id/confirm', requireAuth, requireRole('admin', 'manager', 'cashier'), h((req, res) => {
  const row = db.prepare('SELECT * FROM online_orders WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.status !== 'pending') return res.json({ id: row.id, status: row.status });
  const items = JSON.parse(row.items);
  const now = new Date().toISOString();
  const resolvedBy = req.user.name || req.user.username;
  const invoiceNo = `INV-${new Date(now).getUTCFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const costOf = db.prepare('SELECT cost FROM products WHERE id=?');

  const orderId = db.transaction(() => {
    // A customer ordering online becomes a real customer record, same as
    // one a cashier quick-adds by phone in-store — matched by phone first
    // so repeat online orders don't create duplicate customers.
    const wantDigits = phoneDigits(row.customerPhone);
    const existingCustomer = db.prepare('SELECT * FROM customers').all().find((c) => c.phone && phoneDigits(c.phone) === wantDigits);
    let customerId;
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const custInfo = db.prepare('INSERT INTO customers (name,phone,points,tier,visits,spent) VALUES (?,?,?,?,?,?)')
        .run(row.customerName, row.customerPhone, 0, 'Bronze', 0, 0);
      customerId = custInfo.lastInsertRowid;
    }

    const orderInfo = db.prepare(
      'INSERT INTO orders (invoiceNo,customerId,subtotal,discount,tva,total,method,cashier,createdAt,storeId,manualEntry) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(invoiceNo, customerId, row.subtotal, 0, 0, row.subtotal, 'mobile', resolvedBy, now, row.storeId, 0);
    const newOrderId = orderInfo.lastInsertRowid;
    const itemIns = db.prepare(
      'INSERT INTO order_items (orderId,productId,name,sku,price,cost,qty,mode,unitsPerPacket,variantId,size,color,variantSku) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    items.forEach((it) => {
      const unitCost = it.productId ? (costOf.get(it.productId)?.cost || 0) : 0;
      itemIns.run(newOrderId, it.productId, it.name, it.sku, it.price, unitCost, it.qty, 'unit', null, it.variantId || null, it.size || null, it.color || null, it.sku || null);
    });

    // Same points-earning rule as a normal till sale (insertSale): 1 point
    // per 100 FCFA actually paid.
    const pointsEarned = Math.floor(row.subtotal / 100);
    db.prepare('UPDATE customers SET spent = spent + ?, visits = visits + 1, points = points + ? WHERE id=?')
      .run(row.subtotal, pointsEarned, customerId);

    db.prepare("UPDATE online_orders SET status='confirmed',orderId=?,resolvedAt=?,resolvedBy=? WHERE id=?").run(newOrderId, now, resolvedBy, row.id);
    return newOrderId;
  })();

  res.json({ id: row.id, status: 'confirmed', orderId, resolvedAt: now });
}));

r.put('/online-orders/:id/reject', requireAuth, requireRole('admin', 'manager', 'cashier'), h((req, res) => {
  const { note } = req.body || {};
  const row = db.prepare('SELECT * FROM online_orders WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.status !== 'pending') return res.json({ id: row.id, status: row.status });
  const items = JSON.parse(row.items);
  const now = new Date().toISOString();
  const resolvedBy = req.user.name || req.user.username;

  db.transaction(() => {
    const ensureRow = db.prepare('INSERT OR IGNORE INTO store_stock (storeId, variantId, stock) VALUES (?, ?, 0)');
    const restock = db.prepare('UPDATE store_stock SET stock = stock + ? WHERE storeId=? AND variantId=?');
    const moveIns = db.prepare('INSERT INTO stock_movements (productName,type,qty,source,date,user,productId,variantId,storeId) VALUES (?,?,?,?,?,?,?,?,?)');
    const dateStr = now.slice(0, 16).replace('T', ' ');
    items.forEach((it) => {
      ensureRow.run(row.storeId, it.variantId);
      restock.run(it.qty, row.storeId, it.variantId);
      recomputeStock(it.variantId, it.productId);
      const label = [it.name, [it.size, it.color].filter(Boolean).join(' / ')].filter(Boolean).join(' — ');
      moveIns.run(label, 'in', it.qty, `ONLINE-rejected-${row.id}`, dateStr, resolvedBy, it.productId, it.variantId, row.storeId);
    });
    db.prepare("UPDATE online_orders SET status='rejected',note=?,resolvedAt=?,resolvedBy=? WHERE id=?").run(note || null, now, resolvedBy, row.id);
  })();

  res.json({ id: row.id, status: 'rejected', resolvedAt: now });
}));

// ---------------- TENANT INFO ----------------
// Which shop this is, from its own point of view. Not sensitive (just the
// slug/name), no requireAuth needed beyond tenantResolve already having run
// — used by Settings to build/show the shop's own public catalog link
// (nothing else in the shop-scoped API exposes a shop's own slug).
r.get('/tenant/info', h((req, res) => {
  const { slug, tenantRow } = getCurrentTenant();
  res.json({ slug, shopName: tenantRow.shopName });
}));

// ---------------- SETTINGS ----------------
r.get('/settings', h((req, res) => {
  const row = db.prepare('SELECT json FROM settings WHERE id=1').get();
  res.json(row ? JSON.parse(row.json) : {});
}));
r.put('/settings', h((req, res) => {
  const json = JSON.stringify(req.body || {});
  db.prepare('INSERT INTO settings (id,json) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(json);
  res.json(req.body);
}));

// ---------------- EXPENSES ----------------
// Recorded by accountants/managers/admins. Read by anyone who can see finance.
r.get('/expenses', requireAuth, h((req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all());
}));

r.post('/expenses', requireAuth, requireRole('admin', 'manager', 'accountant'), h((req, res) => {
  const { date, category = '', payee = '', amount, method = 'cash', note = '', clientId = null, type = 'operating' } = req.body || {};
  if (!date || amount == null) throw new Error('date and amount are required');
  if (type !== 'operating' && type !== 'setup') throw new Error('type must be "operating" or "setup"');

  // Same idempotency pattern as orders: a retried/offline-queued expense
  // carries the same clientId, so a retry can't double-record it.
  if (clientId) {
    const existing = db.prepare('SELECT * FROM expenses WHERE clientId=?').get(clientId);
    if (existing) return res.status(200).json(existing);
  }

  const info = db.prepare(
    'INSERT INTO expenses (date,category,payee,amount,method,note,createdBy,createdAt,clientId,type) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(date, category, payee, Math.round(Number(amount)), method, note, req.user.name, new Date().toISOString(), clientId, type);
  res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id=?').get(info.lastInsertRowid));
}));

r.delete('/expenses/:id', requireAuth, requireRole('admin', 'manager', 'accountant'), h((req, res) => {
  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// Admin only: wipe all demo/operational data so the shop starts from scratch.
// Clears inventory, sales, stock movements, purchase orders, customers,
// suppliers, expenses, shifts and employees. User accounts (logins/PINs/
// roles) are left untouched — staff shouldn't have to be recreated just
// because the shop's records were reset. Settings (business profile) are
// left untouched too.
r.post('/maintenance/clear-data', requireAuth, requireRole('admin'), h((req, res) => {
  const tx = db.transaction(() => {
    for (const tbl of [
      'order_items', 'orders', 'stock_movements', 'purchase_orders',
      'store_stock', 'product_variants', 'products', 'customers', 'suppliers', 'expenses', 'shifts', 'employees',
    ]) {
      db.prepare(`DELETE FROM ${tbl}`).run();
    }
  });
  tx();
  res.json({ ok: true });
}));

// Admin only: a narrower reset than clear-data above — wipes just the
// activity history that feeds the Dashboard (orders, their line items, and
// stock movements) plus the shift clock-in/out log. Products, customers,
// suppliers, expenses, employees, and user accounts are untouched, so this
// is safe to use to start a fresh reporting period without losing the
// shop's actual catalog/roster data.
//
// Deleting the order rows alone isn't enough: checkout also writes side
// effects directly onto products.stock (decremented) and customers.spent/
// visits (incremented) at the time of sale, outside the order_items ledger.
// Erasing the ledger without undoing those leaves inventory looking sold-out
// and loyalty stats looking active from sales that, as far as the app is now
// concerned, never happened — i.e. exactly the stale "previous sales still
// have an effect" bug this reset is supposed to fix. So before deleting,
// every sold qty is credited back to its product's stock, and every
// customer's spent/visits are zeroed out.
r.post('/maintenance/clear-activity', requireAuth, requireRole('admin'), h((req, res) => {
  const tx = db.transaction(() => {
    // Stock was decremented per-variant PER SHOP at sale time, so it must be
    // restored the same way — grouping by variantId alone (ignoring which
    // shop rang up the sale) would credit the wrong shop's stock.
    const soldByVariant = db.prepare(
      `SELECT oi.variantId, oi.productId, o.storeId,
              SUM(CASE WHEN oi.mode IN ('packet','half') THEN oi.qty * COALESCE(oi.unitsPerPacket,1) ELSE oi.qty END) AS qty
       FROM order_items oi JOIN orders o ON o.id = oi.orderId
       WHERE oi.variantId IS NOT NULL GROUP BY oi.variantId, o.storeId`
    ).all();
    const ensureRow = db.prepare('INSERT OR IGNORE INTO store_stock (storeId, variantId, stock) VALUES (?, ?, 0)');
    const restock = db.prepare('UPDATE store_stock SET stock = stock + ? WHERE storeId=? AND variantId=?');
    const touchedVariants = new Map();
    for (const row of soldByVariant) {
      ensureRow.run(row.storeId, row.variantId);
      restock.run(row.qty, row.storeId, row.variantId);
      touchedVariants.set(row.variantId, row.productId);
    }
    touchedVariants.forEach((productId, variantId) => recomputeStock(variantId, productId));

    db.prepare('UPDATE customers SET spent = 0, visits = 0').run();

    for (const tbl of ['order_items', 'orders', 'stock_movements', 'shifts']) {
      db.prepare(`DELETE FROM ${tbl}`).run();
    }
  });
  tx();
  res.json({ ok: true });
}));

// Admin only: delete today's orders and restore the stock they consumed.
// "Today" matches the same UTC-date slice the Dashboard uses for its KPIs.
r.post('/maintenance/clear-today', requireAuth, requireRole('admin'), h((req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const tx = db.transaction(() => {
    const soldToday = db.prepare(
      `SELECT oi.variantId, oi.productId, o.storeId,
              SUM(CASE WHEN oi.mode IN ('packet','half') THEN oi.qty * COALESCE(oi.unitsPerPacket,1) ELSE oi.qty END) AS qty
       FROM order_items oi JOIN orders o ON o.id = oi.orderId
       WHERE oi.variantId IS NOT NULL AND substr(o.createdAt,1,10)=? GROUP BY oi.variantId, o.storeId`
    ).all(today);
    const ensureRow = db.prepare('INSERT OR IGNORE INTO store_stock (storeId, variantId, stock) VALUES (?, ?, 0)');
    const restock = db.prepare('UPDATE store_stock SET stock = stock + ? WHERE storeId=? AND variantId=?');
    const touchedVariants = new Map();
    for (const row of soldToday) {
      ensureRow.run(row.storeId, row.variantId);
      restock.run(row.qty, row.storeId, row.variantId);
      touchedVariants.set(row.variantId, row.productId);
    }
    touchedVariants.forEach((productId, variantId) => recomputeStock(variantId, productId));

    db.prepare("DELETE FROM order_items WHERE orderId IN (SELECT id FROM orders WHERE substr(createdAt,1,10)=?)").run(today);
    db.prepare("DELETE FROM stock_movements WHERE substr(date,1,10)=?").run(today);
    const { changes } = db.prepare("DELETE FROM orders WHERE substr(createdAt,1,10)=?").run(today);
    return changes;
  });
  const deleted = tx();
  res.json({ ok: true, ordersDeleted: deleted });
}));

// ---------------- REPORTS ----------------
// Simple aggregations the front-end can render or download.
// `totals` is scoped to TODAY (it powers the Dashboard's "Today's sales" KPI
// — it previously summed every order ever placed, which is a different and
// much larger number than what the label claimed).
r.get('/reports/sales', h((req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  // Optional shop filter — omit (or "all") to see every shop combined.
  const storeId = req.query.storeId != null && req.query.storeId !== '' ? Number(req.query.storeId) : null;

  const daily = db.prepare(`
    SELECT substr(createdAt,1,10) AS day, COUNT(*) AS orders, COALESCE(SUM(total),0) AS sales
    FROM orders WHERE substr(createdAt,1,10) >= ? AND (? IS NULL OR storeId=?) GROUP BY day ORDER BY day ASC
  `).all(since, storeId, storeId);

  const totals = db.prepare(
    'SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders WHERE substr(createdAt,1,10) = ? AND (? IS NULL OR storeId=?)'
  ).get(today, storeId, storeId);

  // Real category breakdown for the same window (Dashboard's "By category" pie).
  const byCategory = db.prepare(`
    SELECT COALESCE(p.category, 'Other') AS category, COALESCE(SUM(oi.price*oi.qty),0) AS sales
    FROM order_items oi
    JOIN orders o ON o.id = oi.orderId
    LEFT JOIN products p ON p.id = oi.productId
    WHERE substr(o.createdAt,1,10) >= ? AND (? IS NULL OR o.storeId=?)
    GROUP BY category ORDER BY sales DESC
  `).all(since, storeId, storeId);

  res.json({ daily, totals, byCategory });
}));

// Ranks products by actual profit contribution (not just units sold) —
// answers "what's really making money" rather than "what's just busy".
r.get('/reports/profitability', h((req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const storeId = req.query.storeId != null && req.query.storeId !== '' ? Number(req.query.storeId) : null;
  const rows = db.prepare(`
    SELECT oi.productId AS productId, oi.name AS name, oi.sku AS sku,
           SUM(CASE WHEN oi.mode IN ('packet','half') THEN oi.qty * COALESCE(oi.unitsPerPacket,1) ELSE oi.qty END) AS unitsSold,
           SUM(oi.price*oi.qty) AS revenue,
           SUM(oi.cost*oi.qty) AS cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.orderId
    WHERE oi.productId IS NOT NULL AND (? IS NULL OR o.storeId=?)
    GROUP BY oi.productId
  `).all(storeId, storeId);
  const ranked = rows.map(r => {
    const grossProfit = r.revenue - r.cost;
    return { ...r, grossProfit, marginPct: r.revenue ? (grossProfit / r.revenue) * 100 : 0 };
  }).sort((a, b) => b.grossProfit - a.grossProfit).slice(0, limit);
  res.json(ranked);
}));

r.get('/reports/inventory', h((req, res) => {
  const storeId = req.query.storeId != null && req.query.storeId !== '' ? Number(req.query.storeId) : null;
  const products = storeId != null
    ? db.prepare(`
        SELECT p.name AS name, p.sku AS sku, p.category AS category, p.price AS price, p.cost AS cost,
               COALESCE((SELECT SUM(ss.stock) FROM store_stock ss JOIN product_variants pv ON pv.id = ss.variantId WHERE pv.productId = p.id AND ss.storeId = ?), 0) AS stock
        FROM products p ORDER BY stock ASC
      `).all(storeId)
    : db.prepare('SELECT name,sku,category,price,cost,stock FROM products ORDER BY stock ASC').all();
  const value = products.reduce((s, p) => s + p.price * p.stock, 0);
  const costValue = products.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);
  const settingsRow = db.prepare('SELECT json FROM settings WHERE id=1').get();
  const threshold = Number(settingsRow ? JSON.parse(settingsRow.json).lowStockThreshold : null) || 10;
  const low = products.filter(p => p.stock < threshold).length;
  res.json({ products, stockValue: value, stockCostValue: costValue, lowStock: low, totalSkus: products.length });
}));

// ---- Accounting: a date-range report powering exports, TVA and margin ----
// Query params: from=YYYY-MM-DD & to=YYYY-MM-DD (inclusive). Defaults to today.
// orders.createdAt is stored as a full ISO timestamp (e.g.
// "2026-06-21T02:55:30.244Z"). The bounds must use the same 'T'/'Z' shape —
// comparing against "YYYY-MM-DD HH:MM:SS" (space-separated) is a string
// comparison where 'T' (0x54) sorts after ' ' (0x20), which makes
// `createdAt <= t` false for every order on the end date and silently drops
// that whole day from every report.
const dayBounds = (from, to) => {
  const today = new Date().toISOString().slice(0, 10);
  const f = (from || today) + 'T00:00:00.000Z';
  const t = (to || from || today) + 'T23:59:59.999Z';
  return { f, t };
};

r.get('/reports/range', h((req, res) => {
  const { f, t } = dayBounds(req.query.from, req.query.to);
  const where = 'WHERE createdAt >= ? AND createdAt <= ?';

  const totals = db.prepare(
    `SELECT COUNT(*) AS orders,
            COALESCE(SUM(subtotal),0) AS subtotal,
            COALESCE(SUM(discount),0) AS discount,
            COALESCE(SUM(tva),0) AS tva,
            COALESCE(SUM(total),0) AS revenue
     FROM orders ${where}`
  ).get(f, t);

  const byMethod = db.prepare(
    `SELECT method, COUNT(*) AS orders, COALESCE(SUM(total),0) AS amount
     FROM orders ${where} GROUP BY method`
  ).all(f, t);

  const daily = db.prepare(
    `SELECT substr(createdAt,1,10) AS day, COUNT(*) AS orders,
            COALESCE(SUM(total),0) AS sales, COALESCE(SUM(tva),0) AS tva
     FROM orders ${where} GROUP BY day ORDER BY day`
  ).all(f, t);

  // Margin from order line items (cost snapshotted at sale time).
  const margin = db.prepare(
    `SELECT COALESCE(SUM(oi.price*oi.qty),0) AS itemRevenue,
            COALESCE(SUM(oi.cost*oi.qty),0) AS itemCost
     FROM order_items oi JOIN orders o ON o.id = oi.orderId ${where.replace('createdAt', 'o.createdAt')}`
  ).get(f, t);

  const orders = db.prepare(
    `SELECT invoiceNo, createdAt, cashier, method, subtotal, discount, tva, total
     FROM orders ${where} ORDER BY createdAt`
  ).all(f, t);

  const grossProfit = (margin.itemRevenue || 0) - (margin.itemCost || 0);
  const marginPct = margin.itemRevenue ? (grossProfit / margin.itemRevenue) * 100 : 0;

  res.json({
    from: req.query.from || new Date().toISOString().slice(0, 10),
    to: req.query.to || req.query.from || new Date().toISOString().slice(0, 10),
    totals, byMethod, daily,
    margin: { revenue: margin.itemRevenue, cost: margin.itemCost, grossProfit, marginPct },
    orders,
  });
}));

// Daily Z-report: one day's close-out summary + expected cash drawer.
r.get('/reports/z', h((req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const f = date + 'T00:00:00.000Z', t = date + 'T23:59:59.999Z';
  const where = 'WHERE createdAt >= ? AND createdAt <= ?';
  const totals = db.prepare(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal),0) AS subtotal,
            COALESCE(SUM(discount),0) AS discount, COALESCE(SUM(tva),0) AS tva,
            COALESCE(SUM(total),0) AS revenue FROM orders ${where}`
  ).get(f, t);
  const byMethod = db.prepare(
    `SELECT method, COUNT(*) AS orders, COALESCE(SUM(total),0) AS amount
     FROM orders ${where} GROUP BY method`
  ).all(f, t);
  const margin = db.prepare(
    `SELECT COALESCE(SUM(oi.price*oi.qty),0) AS itemRevenue, COALESCE(SUM(oi.cost*oi.qty),0) AS itemCost
     FROM order_items oi JOIN orders o ON o.id = oi.orderId WHERE o.createdAt >= ? AND o.createdAt <= ?`
  ).get(f, t);
  const cashDrawer = (byMethod.find(m => m.method === 'cash')?.amount) || 0;
  const grossProfit = (margin.itemRevenue || 0) - (margin.itemCost || 0);
  res.json({ date, totals, byMethod, expectedCash: cashDrawer,
    margin: { revenue: margin.itemRevenue, cost: margin.itemCost, grossProfit } });
}));

// ---- Profit & Loss: combines sales margin with recorded expenses for a
// date range. This is the one number an owner actually thinks in terms of —
// "did I make money" — rather than scattered margin/expense reports. ----
r.get('/reports/pnl', h((req, res) => {
  const { f, t } = dayBounds(req.query.from, req.query.to);
  const fromDate = req.query.from || new Date().toISOString().slice(0, 10);
  const toDate = req.query.to || req.query.from || new Date().toISOString().slice(0, 10);

  const margin = db.prepare(
    `SELECT COALESCE(SUM(oi.price*oi.qty),0) AS revenue, COALESCE(SUM(oi.cost*oi.qty),0) AS cogs
     FROM order_items oi JOIN orders o ON o.id = oi.orderId
     WHERE o.createdAt >= ? AND o.createdAt <= ?`
  ).get(f, t);

  const grossProfit = margin.revenue - margin.cogs;
  const grossMarginPct = margin.revenue ? (grossProfit / margin.revenue) * 100 : 0;

  // expenses.date is a plain YYYY-MM-DD string (from the date input), unlike
  // orders.createdAt which is a full timestamp — compare against the plain
  // from/to dates, not the time-bounded f/t used for orders. One-time
  // 'setup' costs are excluded here on purpose — they're tracked against
  // cumulative profit separately (see /reports/breakeven) instead of
  // distorting whichever single period they happened to be paid in.
  const expensesByCategory = db.prepare(
    `SELECT category, COALESCE(SUM(amount),0) AS amount FROM expenses
     WHERE date >= ? AND date <= ? AND type != 'setup' GROUP BY category ORDER BY amount DESC`
  ).all(fromDate, toDate);
  const totalExpenses = expensesByCategory.reduce((s, e) => s + e.amount, 0);

  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = margin.revenue ? (netProfit / margin.revenue) * 100 : 0;

  res.json({
    from: fromDate, to: toDate,
    revenue: margin.revenue, cogs: margin.cogs, grossProfit, grossMarginPct,
    expensesByCategory, totalExpenses, netProfit, netMarginPct,
  });
}));

// ---- Monthly P&L trend, for a real month-over-month view ----
r.get('/reports/pnl-trend', h((req, res) => {
  const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
  const rows = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const f = `${monthStr}-01T00:00:00.000Z`;
    const t = `${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

    const margin = db.prepare(
      `SELECT COALESCE(SUM(oi.price*oi.qty),0) AS revenue, COALESCE(SUM(oi.cost*oi.qty),0) AS cogs
       FROM order_items oi JOIN orders o ON o.id = oi.orderId
       WHERE o.createdAt >= ? AND o.createdAt <= ?`
    ).get(f, t);
    const expenseTotal = db.prepare(
      "SELECT COALESCE(SUM(amount),0) AS amount FROM expenses WHERE date >= ? AND date <= ? AND type != 'setup'"
    ).get(`${monthStr}-01`, `${monthStr}-${String(lastDay).padStart(2, '0')}`).amount;

    const grossProfit = margin.revenue - margin.cogs;
    rows.push({
      month: monthStr, revenue: margin.revenue, cogs: margin.cogs, grossProfit,
      expenses: expenseTotal, netProfit: grossProfit - expenseTotal,
    });
  }
  res.json(rows);
}));

// ---- Monthly view of the same plain "amount left" bottom line as
// /reports/breakeven's allTimeRevenue/allTimeExpenses/amountLeft — total
// sales minus every expense (operating AND setup, unlike pnl-trend above
// which excludes setup costs), no COGS/margin math. Lets Expenses show
// "how much was left" month by month, not just the all-time figure. ----
r.get('/reports/amount-left-trend', h((req, res) => {
  const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 24);
  const rows = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const f = `${monthStr}-01T00:00:00.000Z`;
    const t = `${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

    const revenue = db.prepare(
      'SELECT COALESCE(SUM(total),0) AS revenue FROM orders WHERE createdAt >= ? AND createdAt <= ?'
    ).get(f, t).revenue;
    const expenses = db.prepare(
      'SELECT COALESCE(SUM(amount),0) AS amount FROM expenses WHERE date >= ? AND date <= ?'
    ).get(`${monthStr}-01`, `${monthStr}-${String(lastDay).padStart(2, '0')}`).amount;

    rows.push({ month: monthStr, revenue, expenses, amountLeft: revenue - expenses });
  }
  res.json(rows);
}));

// ---- Break-even: have we earned back what it cost to set this place up? ----
// totalSetupCost is every expense ever logged with type='setup'. cumulativeNetProfit
// is the SAME net-profit math /reports/pnl uses (gross margin minus operating
// expenses) — but only counting from the day the OLDEST setup expense was
// recorded, onward. A store can have months of real sales history before its
// setup costs ever get logged; counting that pre-existing profit toward
// "recovering" a cost it never actually paid for would make recovery jump to
// 100% the instant the cost is entered, which is exactly backwards from what
// "haven't broken even yet" should mean. Profit only starts counting toward
// payback once there's an actual setup cost on the books to pay back.
r.get('/reports/breakeven', h((req, res) => {
  const setupCost = db.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM expenses WHERE type='setup'").get().amount;
  const earliestSetupDate = db.prepare("SELECT MIN(date) AS d FROM expenses WHERE type='setup'").get().d;
  const since = (earliestSetupDate || '9999-12-31') + 'T00:00:00.000Z';
  const margin = db.prepare(
    `SELECT COALESCE(SUM(oi.price*oi.qty),0) AS revenue, COALESCE(SUM(oi.cost*oi.qty),0) AS cogs
     FROM order_items oi JOIN orders o ON o.id = oi.orderId WHERE o.createdAt >= ?`
  ).get(since);
  const operatingExpenses = db.prepare(
    "SELECT COALESCE(SUM(amount),0) AS amount FROM expenses WHERE type != 'setup' AND date >= ?"
  ).get(earliestSetupDate || '9999-12-31').amount;
  const cumulativeNetProfit = (margin.revenue - margin.cogs) - operatingExpenses;
  const remaining = Math.max(0, setupCost - cumulativeNetProfit);

  // The plain bottom line: every FCFA a sale has ever brought in, minus
  // every FCFA any expense (operating or one-time setup) has ever taken
  // out — no date window, no COGS/margin math. "What's actually left."
  const allTimeRevenue = db.prepare('SELECT COALESCE(SUM(total),0) AS revenue FROM orders').get().revenue;
  const allTimeExpenses = db.prepare('SELECT COALESCE(SUM(amount),0) AS amount FROM expenses').get().amount;

  res.json({
    setupCost, cumulativeNetProfit, operatingExpenses,
    revenue: margin.revenue, cogs: margin.cogs,
    remaining, brokenEven: setupCost > 0 && cumulativeNetProfit >= setupCost,
    pctRecovered: setupCost > 0 ? Math.max(0, Math.min(100, Math.round((cumulativeNetProfit / setupCost) * 100))) : 0,
    allTimeRevenue, allTimeExpenses, amountLeft: allTimeRevenue - allTimeExpenses,
  });
}));

export default r;
