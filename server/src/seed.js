// seed.js — fills the database with demo data for Riskyc Fashion.
// Run automatically on first boot (when tables are empty), or manually: npm run seed
import { db } from './db.js';
import { hashPin } from './auth.js';

// A small helper so each product's variant rows don't have to spell out a
// full SKU by hand: "{baseSku}-{SIZE}-{COL}", e.g. "TOP-001-M-WHI".
const variant = (baseSku, size, color, stock) => ({
  size, color,
  sku: `${baseSku}-${String(size || 'OS').replace(/\s+/g, '').toUpperCase()}${color ? '-' + color.slice(0, 3).toUpperCase() : ''}`,
  stock,
});

// The 4 shops, all in Douala. Bonanjo is the flagship (also the registered
// business address in DEFAULT_SETTINGS below), so it gets the largest share
// of every variant's stock; the rest is split across the other 3.
const STORES = [
  { name: 'Riskyc Fashion — Bonanjo', address: 'Rue Joss, Bonanjo, Douala', phone: '+237 6 77 00 00 00' },
  { name: 'Riskyc Fashion — Akwa', address: 'Rue Alfred Saker, Akwa, Douala', phone: '+237 6 77 00 01 01' },
  { name: 'Riskyc Fashion — Bonapriso', address: 'Rue des Manguiers, Bonapriso, Douala', phone: '+237 6 77 00 02 02' },
  { name: 'Riskyc Fashion — Deido', address: 'Avenue de la Liberté, Deido, Douala', phone: '+237 6 77 00 03 03' },
];

// Splits a variant's total stock across the 4 shops (Bonanjo-heaviest —
// 40/25/20/15 — since it's the flagship), correcting the last share so the
// parts still sum to exactly `total` rather than drifting from rounding.
const STORE_WEIGHTS = [0.4, 0.25, 0.2, 0.15];
const splitStock = (total) => {
  const parts = STORE_WEIGHTS.map(w => Math.round(total * w));
  const diff = total - parts.reduce((s, n) => s + n, 0);
  parts[0] += diff; // absorb any rounding remainder into the flagship
  return parts;
};

// Each product is a "style"; price/cost apply to every variant of it, but
// stock and SKU are tracked per size/color combo (see product_variants).
// Categories/sizing match the real riskycfashion.com storefront (menswear
// streetwear — sets, jerseys, trousers, pullovers, shirts, shorts, t-shirts
// — sized up through plus sizes, not just S–XL). packetPrice/unitsPerPacket
// carry the site's own "buy 10" bulk tier (e.g. its T-shirt page shows
// "1 = 5 500 FCFA" next to "10 = 50 000 FCFA") — the app's existing
// packet-pricing feature already renders and sells this as a "×10 pack"
// option right on the product tile, no new code needed.
const PRODUCTS = [
  {
    name: 'Classic Crew T-Shirt', name_fr: 'T-Shirt Col Rond Classique', category: 'tshirts',
    price: 5500, cost: 2500, sku: 'TSH-001', emoji: '👕', packetPrice: 50000, unitsPerPacket: 10,
    variants: [
      variant('TSH-001', 'S', 'White', 14), variant('TSH-001', 'M', 'White', 18), variant('TSH-001', 'L', 'White', 12), variant('TSH-001', 'XL', 'White', 8),
      variant('TSH-001', 'S', 'Black', 10), variant('TSH-001', 'M', 'Black', 16), variant('TSH-001', 'L', 'Black', 9), variant('TSH-001', 'XL', 'Black', 6),
    ],
  },
  {
    name: 'Graphic Print Tee', name_fr: 'T-Shirt Imprimé', category: 'tshirts',
    price: 6000, cost: 2800, sku: 'TSH-002', emoji: '👕', packetPrice: 54000, unitsPerPacket: 10,
    variants: [
      variant('TSH-002', 'M', 'Black', 9), variant('TSH-002', 'L', 'Black', 11),
      variant('TSH-002', 'XL', 'Grey', 7), variant('TSH-002', 'XXL', 'Grey', 4),
    ],
  },
  {
    name: 'Oxford Button-Down Shirt', name_fr: 'Chemise Oxford', category: 'shirts',
    price: 12000, cost: 5500, sku: 'SHT-001', emoji: '👔', packetPrice: 108000, unitsPerPacket: 10,
    variants: [
      variant('SHT-001', 'S', 'White', 6), variant('SHT-001', 'M', 'White', 9),
      variant('SHT-001', 'L', 'Sky Blue', 7), variant('SHT-001', 'XL', 'Sky Blue', 4),
    ],
  },
  {
    name: 'Flannel Check Shirt', name_fr: 'Chemise à Carreaux', category: 'shirts',
    price: 11000, cost: 5000, sku: 'SHT-002', emoji: '👔', packetPrice: 99000, unitsPerPacket: 10,
    variants: [
      variant('SHT-002', 'M', 'Red Check', 8), variant('SHT-002', 'L', 'Red Check', 6),
      variant('SHT-002', 'XL', 'Green Check', 5), variant('SHT-002', 'XXL', 'Green Check', 3),
    ],
  },
  {
    name: 'Crewneck Pullover', name_fr: 'Pull Col Rond', category: 'pullovers',
    price: 15000, cost: 7000, sku: 'PUL-001', emoji: '🧶', packetPrice: 135000, unitsPerPacket: 10,
    variants: [
      variant('PUL-001', 'S', 'Grey', 6), variant('PUL-001', 'M', 'Grey', 10), variant('PUL-001', 'L', 'Grey', 8),
      variant('PUL-001', 'M', 'Navy', 7), variant('PUL-001', 'XL', 'Navy', 4),
    ],
  },
  {
    name: 'Hooded Pullover', name_fr: 'Pull à Capuche', category: 'pullovers',
    price: 18000, cost: 8500, sku: 'PUL-002', emoji: '🧥', packetPrice: 162000, unitsPerPacket: 10,
    variants: [
      variant('PUL-002', 'M', 'Black', 9), variant('PUL-002', 'L', 'Black', 11),
      variant('PUL-002', 'XL', 'Charcoal', 7), variant('PUL-002', 'XXL', 'Charcoal', 5), variant('PUL-002', '3XL', 'Charcoal', 2),
    ],
  },
  {
    name: 'Slim Fit Jeans', name_fr: 'Jean Slim', category: 'trousers',
    price: 15000, cost: 7000, sku: 'TRO-001', emoji: '👖', packetPrice: 135000, unitsPerPacket: 10,
    variants: [
      variant('TRO-001', '30', 'Dark Blue', 9), variant('TRO-001', '32', 'Dark Blue', 14),
      variant('TRO-001', '34', 'Dark Blue', 10), variant('TRO-001', '36', 'Black', 6),
    ],
  },
  {
    name: 'Jogger Sweatpants', name_fr: 'Pantalon de Jogging', category: 'trousers',
    price: 13000, cost: 6000, sku: 'TRO-002', emoji: '👖', packetPrice: 117000, unitsPerPacket: 10,
    variants: [
      variant('TRO-002', 'M', 'Black', 10), variant('TRO-002', 'L', 'Black', 12),
      variant('TRO-002', 'XL', 'Grey', 7), variant('TRO-002', 'XXL', 'Grey', 4),
    ],
  },
  {
    name: 'Denim Shorts', name_fr: 'Short en Jean', category: 'shorts',
    price: 8000, cost: 3800, sku: 'SHO-001', emoji: '🩳', packetPrice: 72000, unitsPerPacket: 10,
    variants: [
      variant('SHO-001', 'M', 'Blue', 8), variant('SHO-001', 'L', 'Blue', 9), variant('SHO-001', 'XL', 'Blue', 5),
    ],
  },
  {
    name: 'Cargo Shorts', name_fr: 'Short Cargo', category: 'shorts',
    price: 9000, cost: 4200, sku: 'SHO-002', emoji: '🩳', packetPrice: 81000, unitsPerPacket: 10,
    variants: [
      variant('SHO-002', 'M', 'Khaki', 7), variant('SHO-002', 'L', 'Khaki', 8),
      variant('SHO-002', 'XL', 'Black', 6), variant('SHO-002', 'XXL', 'Black', 3),
    ],
  },
  {
    name: 'Football Club Jersey', name_fr: 'Maillot de Football', category: 'jerseys',
    price: 12000, cost: 5500, sku: 'JER-001', emoji: '🎽', packetPrice: 108000, unitsPerPacket: 10,
    variants: [
      variant('JER-001', 'S', 'Home Red', 7), variant('JER-001', 'M', 'Home Red', 12), variant('JER-001', 'L', 'Home Red', 9),
      variant('JER-001', 'M', 'Away White', 6), variant('JER-001', 'XL', 'Away White', 4),
    ],
  },
  {
    name: 'Tracksuit Set', name_fr: 'Ensemble Survêtement', category: 'sets',
    price: 25000, cost: 12000, sku: 'SET-001', emoji: '🥋', packetPrice: 225000, unitsPerPacket: 10,
    variants: [
      variant('SET-001', 'M', 'Black', 6), variant('SET-001', 'L', 'Black', 8),
      variant('SET-001', 'XL', 'Navy', 5), variant('SET-001', 'XXL', 'Navy', 3),
    ],
  },
  {
    name: 'Snapback Cap', name_fr: 'Casquette Snapback', category: 'others',
    price: 4000, cost: 1800, sku: 'OTH-001', emoji: '🧢', packetPrice: 36000, unitsPerPacket: 10,
    variants: [
      variant('OTH-001', 'One Size', 'Black', 12), variant('OTH-001', 'One Size', 'Red', 9),
    ],
  },
  {
    name: 'Canvas Belt', name_fr: 'Ceinture en Toile', category: 'others',
    price: 3500, cost: 1500, sku: 'OTH-002', emoji: '📦', packetPrice: 31500, unitsPerPacket: 10,
    variants: [
      variant('OTH-002', 'One Size', 'Brown', 10), variant('OTH-002', 'One Size', 'Black', 11),
    ],
  },
];

const CUSTOMERS = [
  { name: 'Aminata Bakary', phone: '+237 6 78 12 34 56', points: 1840, tier: 'Gold', visits: 47, spent: 425000 },
  { name: 'Jean-Paul Mbarga', phone: '+237 6 99 22 11 33', points: 920, tier: 'Silver', visits: 28, spent: 198000 },
  { name: 'Fatou Njoya', phone: '+237 6 55 67 89 01', points: 3210, tier: 'Platinum', visits: 89, spent: 782000 },
  { name: 'Samuel Nkomo', phone: '+237 6 71 23 45 67', points: 340, tier: 'Bronze', visits: 12, spent: 67000 },
];

const SUPPLIERS = [
  { name: 'Douala Textile Wholesale', contact: 'Pierre Etoga', phone: '+237 6 77 11 22 33', email: 'p.etoga@doualatextile.cm', productsCount: 0, lastOrder: '2026-05-20', status: 'active', category: 'Shirts & T-Shirts' },
  { name: 'Wouri Sportswear Imports', contact: 'Sylvie Manga', phone: '+237 6 91 88 77 66', email: 'contact@wourisportswear.cm', productsCount: 0, lastOrder: '2026-05-24', status: 'active', category: 'Jerseys' },
  { name: 'Bonapriso Tailoring House', contact: 'Robert Nguele', phone: '+237 6 55 44 33 22', email: 'robert@bonaprisotailoring.cm', productsCount: 0, lastOrder: '2026-05-25', status: 'active', category: 'Sets' },
  { name: 'Kribi Leather Goods', contact: 'Claudette Atangana', phone: '+237 6 78 99 88 77', email: 'claudette@kribileather.cm', productsCount: 0, lastOrder: '2026-05-26', status: 'active', category: 'Others' },
  { name: 'Deido Knitwear Co.', contact: 'Marc Tcheunkam', phone: '+237 6 22 11 00 99', email: 'marc@deidoknitwear.cm', productsCount: 0, lastOrder: '2026-05-18', status: 'active', category: 'Pullovers' },
  { name: 'Akwa Denim Supply', contact: 'Aïcha Souley', phone: '+237 6 33 22 44 55', email: 'a.souley@akwadenim.cm', productsCount: 0, lastOrder: '2026-05-15', status: 'active', category: 'Trousers' },
  { name: 'Bonanjo Fabric Traders', contact: 'Bruno Eyenga', phone: '+237 6 66 55 77 88', email: 'bruno@bonanjofabric.cm', productsCount: 0, lastOrder: '2026-04-28', status: 'inactive', category: 'Shorts' },
];

// Matches the real riskycfashion.com storefront's own category taxonomy
// (menswear/streetwear — sets, jerseys, trousers, pullovers, shirts,
// shorts, t-shirts), not a generic boutique catalog.
const CATEGORIES = [
  ['sets', 'Ensemble / Sets'], ['jerseys', 'Maillot / Jersey'], ['trousers', 'Pantalon / Trouser'],
  ['pullovers', 'Pull / Pullover'], ['shirts', 'Shirt'], ['shorts', 'Short'],
  ['tshirts', 'T-Shirt'], ['others', 'Others'],
];

const PURCHASE_ORDERS = [];

const STOCK_MOVEMENTS = [];
// storeIndex is resolved to a real stores.id once STORES has been inserted
// (see seedIfEmpty below) — indices line up with the STORES array above
// (0=Bonanjo, 1=Akwa, 2=Bonapriso, 3=Deido).
const USERS = [
  { name: "Joseph Eto'o", username: 'joseph', role: 'admin', email: 'joseph@riskycfashion.cm', lastActive: '2 min ago', storeIndex: 0 },
  { name: 'Mariam Ndongo', username: 'mariam', role: 'manager', email: 'mariam@riskycfashion.cm', lastActive: 'Just now', storeIndex: 0 },
  { name: 'Paul Atangana', username: 'paul', role: 'cashier', email: 'paul@riskycfashion.cm', lastActive: '12 min ago', storeIndex: 1 },
  { name: 'Esther Ngo', username: 'esther', role: 'cashier', email: 'esther@riskycfashion.cm', lastActive: '1 hour ago', storeIndex: 2 },
  { name: 'David Onana', username: 'david', role: 'manager', email: 'david@riskycfashion.cm', lastActive: '3 hours ago', storeIndex: 3 },
];

// The shop-floor roster — nobody here gets a software login (see USERS
// above for the 4 roles that do: admin/manager/cashier/accountant). Just
// name, role and hourly rate; clocked in/out via the Staff register.
const EMPLOYEES = [
  { name: 'Mariama Ndiaye', role: 'Salesperson', initials: 'MN', color: 'from-amber-400 to-rose-500', rate: 1500 },
  { name: 'Awa Sow', role: 'Salesperson', initials: 'AS', color: 'from-sky-400 to-indigo-600', rate: 1500 },
  { name: 'Chantal Biya', role: 'Salesperson', initials: 'CB', color: 'from-fuchsia-400 to-purple-600', rate: 1500 },
  { name: 'Ibrahim Bah', role: 'Stocker', initials: 'IB', color: 'from-emerald-400 to-teal-600', rate: 1200 },
];

const DEFAULT_SETTINGS = {
  businessName: 'Riskyc Fashion', currency: 'XAF', timezone: 'Africa/Douala', dateFormat: 'DD/MM/YYYY',
  address: 'Rue Joss, Bonanjo, Douala', phone: '+237 6 77 00 00 00', email: 'contact@riskycfashion.cm',
  website: 'www.riskycfashion.cm', rccm: 'RC/DLA/2024/B/01234', niu: 'P012345678901G',
  receiptHeader: 'Riskyc Fashion — Merci de votre visite', receiptFooter: 'Échanges sous 7 jours avec ticket de caisse, articles non portés',
  paperWidth: '80', showLogo: true, showQR: true,
  taxIdPrint: true, acceptCash: true, acceptCard: true, acceptMobile: true, lowStockThreshold: '10',
  dailySummary: true, weeklySummary: true, paymentAlerts: true,
};

export function seedIfEmpty() {
  // Decide "first run" by whether the database has ever been initialized, using
  // the settings row (which is never removed by the Clear-all-data feature).
  // Using product count here was unsafe: clearing data empties products, which
  // would wrongly trigger a re-seed and crash on the existing settings row.
  const initialized = db.prepare("SELECT COUNT(*) AS n FROM settings").get().n > 0
    || db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0;
  if (initialized) {
    console.log('• Database already initialized — skipping seed.');
    return;
  }
  console.log('• Seeding database…');
  const tx = db.transaction(() => {
    const now = new Date().toISOString();

    const storeIns = db.prepare('INSERT INTO stores (name,address,phone,createdAt,updatedAt) VALUES (?,?,?,?,?)');
    const storeIds = STORES.map(s => storeIns.run(s.name, s.address, s.phone, now, now).lastInsertRowid);

    const pIns = db.prepare('INSERT INTO products (name,name_fr,category,price,cost,stock,sku,emoji,createdAt,updatedAt,packetPrice,unitsPerPacket) VALUES (@name,@name_fr,@category,@price,@cost,@stock,@sku,@emoji,@createdAt,@updatedAt,@packetPrice,@unitsPerPacket)');
    const vIns = db.prepare('INSERT INTO product_variants (productId,size,color,sku,stock,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)');
    const ssIns = db.prepare('INSERT INTO store_stock (storeId,variantId,stock) VALUES (?,?,?)');
    PRODUCTS.forEach(p => {
      const stock = p.variants.reduce((s, v) => s + v.stock, 0);
      const info = pIns.run({ name: p.name, name_fr: p.name_fr, category: p.category, price: p.price, cost: p.cost, stock, sku: p.sku, emoji: p.emoji, createdAt: now, updatedAt: now, packetPrice: p.packetPrice || null, unitsPerPacket: p.unitsPerPacket || null });
      p.variants.forEach(v => {
        const variantInfo = vIns.run(info.lastInsertRowid, v.size || null, v.color || null, v.sku, v.stock, now, now);
        const perStore = splitStock(v.stock);
        storeIds.forEach((storeId, i) => ssIns.run(storeId, variantInfo.lastInsertRowid, perStore[i]));
      });
    });

    const cIns = db.prepare('INSERT INTO customers (name,phone,points,tier,visits,spent) VALUES (@name,@phone,@points,@tier,@visits,@spent)');
    CUSTOMERS.forEach(c => cIns.run(c));

    const sIns = db.prepare('INSERT INTO suppliers (name,contact,phone,email,productsCount,lastOrder,status,category) VALUES (@name,@contact,@phone,@email,@productsCount,@lastOrder,@status,@category)');
    SUPPLIERS.forEach(s => sIns.run(s));

    const poIns = db.prepare('INSERT INTO purchase_orders (id,supplierId,supplier,date,items,total,status) VALUES (@id,@supplierId,@supplier,@date,@items,@total,@status)');
    PURCHASE_ORDERS.forEach(po => poIns.run(po));

    const mIns = db.prepare('INSERT INTO stock_movements (productName,type,qty,source,date,user) VALUES (@productName,@type,@qty,@source,@date,@user)');
    STOCK_MOVEMENTS.forEach(m => mIns.run(m));

    // Each user gets a default PIN of 1234 (hashed). Change these in the app.
    const uIns = db.prepare('INSERT INTO users (name,username,role,email,lastActive,storeId,pin_hash,pin_salt) VALUES (@name,@username,@role,@email,@lastActive,@storeId,@pin_hash,@pin_salt)');
    USERS.forEach(u => {
      const { hash, salt } = hashPin('1234');
      const { storeIndex, ...rest } = u;
      uIns.run({ ...rest, storeId: storeIds[storeIndex], pin_hash: hash, pin_salt: salt });
    });

    const eIns = db.prepare('INSERT INTO employees (name,role,initials,color,rate) VALUES (@name,@role,@initials,@color,@rate)');
    EMPLOYEES.forEach(e => eIns.run(e));

    const catIns = db.prepare('INSERT INTO categories (id, label) VALUES (?, ?)');
    CATEGORIES.forEach(([id, label]) => catIns.run(id, label));

    // Shifts start empty — created when real user accounts clock in.
    db.prepare('INSERT OR IGNORE INTO settings (id,json) VALUES (1,@json)').run({ json: JSON.stringify(DEFAULT_SETTINGS) });
  });
  tx();
  console.log('• Seed complete.');
}

// A small, generic starter category set for a brand-new shop — NOT the
// Riskyc-specific streetwear taxonomy above (sets/jerseys/pullovers/...).
// A real shop edits these to fit what they actually sell.
const BLANK_CATEGORIES = [
  ['tops', 'Tops'], ['bottoms', 'Bottoms'], ['outerwear', 'Outerwear'],
  ['footwear', 'Footwear'], ['accessories', 'Accessories'], ['others', 'Others'],
];

// Sets up a brand-new shop's database: one admin login (so the owner can
// get into the till immediately), blank settings, a small generic starter
// category list, and one "Main Store" location (only relevant once/if the
// shop later turns on the multi-store toggle in Settings). Deliberately
// seeds NO products/customers/suppliers/orders — a real shop's data, not
// demo fixtures. `db` is passed explicitly (this runs from the CLI script,
// via a connection from openTenantDatabase, outside of any request/ALS
// context — it can't import the ambient `db` Proxy from db.js).
export function seedBlankTenant(db, { shopName, ownerName, ownerUsername, ownerPin }) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const storeId = db.prepare('INSERT INTO stores (name,address,phone,createdAt,updatedAt) VALUES (?,?,?,?,?)')
      .run('Main Store', '', '', now, now).lastInsertRowid;

    const catIns = db.prepare('INSERT INTO categories (id, label) VALUES (?, ?)');
    BLANK_CATEGORIES.forEach(([id, label]) => catIns.run(id, label));

    const { hash, salt } = hashPin(ownerPin);
    db.prepare('INSERT INTO users (name,username,role,email,lastActive,storeId,pin_hash,pin_salt) VALUES (?,?,?,?,?,?,?,?)')
      .run(ownerName, ownerUsername, 'admin', null, now, storeId, hash, salt);

    const settings = {
      businessName: shopName, currency: 'XAF', timezone: 'Africa/Douala', dateFormat: 'DD/MM/YYYY',
      address: '', phone: '', email: '', website: '', rccm: '', niu: '',
      receiptHeader: `${shopName} — Merci de votre visite`, receiptFooter: '',
      paperWidth: '80', showLogo: false, showQR: false,
      taxIdPrint: false, acceptCash: true, acceptCard: true, acceptMobile: true, lowStockThreshold: '10',
      dailySummary: true, weeklySummary: true, paymentAlerts: true,
      multiStore: false,
      catalogEnabled: false,
    };
    db.prepare('INSERT OR IGNORE INTO settings (id,json) VALUES (1,?)').run(JSON.stringify(settings));
  });
  tx();
}

// Allow running directly: `node src/seed.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty();
  process.exit(0);
}
