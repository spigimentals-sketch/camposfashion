// routes/onlineOrder.js — the public, unauthenticated self-service ordering
// page: a customer browses, adds to cart, "pays" by sending mobile money to
// a number the shop provides, then submits. Mounted in index.js BEFORE
// tenantResolve, same slug-based resolution as routes/catalog.js — no
// token of any kind, and gated by its own settings flag
// (onlineOrderingEnabled) rather than catalogEnabled, since a shop may want
// the browse-only catalog without taking orders through it, or vice versa.
//
// Submitting here does NOT create a sale. It reserves stock (decrements
// store_stock immediately, same as a real checkout would, so the same
// items can't be double-sold in-store while payment is being confirmed)
// and drops a 'pending' row in online_orders. A cashier/manager then either
// confirms it (routes/api.js's PUT /online-orders/:id/confirm — creates the
// real orders/order_items row once they've actually seen the money land)
// or rejects it (stock given back). The customer never gets to skip that
// human confirmation step.
import { Router } from 'express';
import { platformDb } from '../platformDb.js';
import { getTenantConnection } from '../tenantDb.js';
import { runInTenant } from '../tenantContext.js';
import { recomputeStock } from '../db.js';

const r = Router();

const h = (fn) => (req, res) => {
  try {
    const result = fn(req, res);
    if (result && typeof result.catch === 'function') result.catch(() => res.status(500).json({ error: 'Something went wrong' }));
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
};

const resolveTenant = (slug) => platformDb.prepare("SELECT * FROM tenants WHERE slug=? AND status='active'").get(slug);

r.get('/order/:slug', h((req, res) => {
  const tenant = resolveTenant(req.params.slug);
  // Same 404 whether the slug doesn't exist, the shop is suspended, or
  // online ordering just isn't turned on — never confirm which.
  if (!tenant) return res.status(404).json({ error: 'Not found' });

  const conn = getTenantConnection(tenant.slug, tenant.dbPath);
  runInTenant({ slug: tenant.slug, conn, tenantRow: tenant }, () => {
    const settingsRow = conn.prepare('SELECT json FROM settings WHERE id=1').get();
    const settings = settingsRow ? JSON.parse(settingsRow.json) : {};
    if (!settings.onlineOrderingEnabled) return res.status(404).json({ error: 'Not found' });

    const products = conn.prepare('SELECT * FROM products ORDER BY id').all();
    const ids = products.map((p) => p.id);
    const variants = ids.length
      ? conn.prepare(`SELECT * FROM product_variants WHERE productId IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids)
      : [];
    const variantIds = variants.map((v) => v.id);
    const stockRows = variantIds.length
      ? conn.prepare(`SELECT variantId, SUM(stock) AS stock FROM store_stock WHERE variantId IN (${variantIds.map(() => '?').join(',')}) GROUP BY variantId`).all(...variantIds)
      : [];
    const stockByVariant = new Map(stockRows.map((row) => [row.variantId, row.stock]));

    // Unlike the browse-only catalog, this exposes variant id + live stock
    // per variant — the customer has to pick an exact size/color to order,
    // and the submit step needs that id to reserve the right row.
    const variantsByProduct = new Map();
    variants.forEach((v) => {
      const stock = stockByVariant.get(v.id) || 0;
      if (stock <= 0) return;
      if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
      variantsByProduct.get(v.productId).push({ id: v.id, size: v.size, color: v.color, stock });
    });

    const orderProducts = products
      .map((p) => ({
        id: p.id,
        name: p.name,
        name_fr: p.name_fr || null,
        category: p.category,
        price: p.price,
        image: p.image || null,
        emoji: p.emoji || null,
        variants: variantsByProduct.get(p.id) || [],
      }))
      .filter((p) => p.variants.length > 0);

    res.json({
      shopName: settings.businessName || tenant.shopName,
      address: settings.address || null,
      phone: settings.phone || null,
      paymentNumber: settings.paymentNumber || null,
      paymentInstructions: settings.paymentInstructions || null,
      products: orderProducts,
    });
  });
}));

r.post('/order/:slug', h((req, res) => {
  const tenant = resolveTenant(req.params.slug);
  if (!tenant) return res.status(404).json({ error: 'Not found' });

  const conn = getTenantConnection(tenant.slug, tenant.dbPath);
  let result;
  runInTenant({ slug: tenant.slug, conn, tenantRow: tenant }, () => {
    const settingsRow = conn.prepare('SELECT json FROM settings WHERE id=1').get();
    const settings = settingsRow ? JSON.parse(settingsRow.json) : {};
    if (!settings.onlineOrderingEnabled) { result = { status: 404, body: { error: 'Not found' } }; return; }

    const { customerName, customerPhone, items, note } = req.body || {};
    if (!customerName || !customerName.trim()) { result = { status: 400, body: { error: 'Your name is required' } }; return; }
    if (!customerPhone || !customerPhone.trim()) { result = { status: 400, body: { error: 'Your phone number is required' } }; return; }
    if (!Array.isArray(items) || !items.length) { result = { status: 400, body: { error: 'Your cart is empty' } }; return; }

    // Orders placed online always reserve against this shop's first/default
    // store — same convention used elsewhere (saveStoreStock in api.js) for
    // the common single-store case; a multi-store shop can still move stock
    // between locations afterward like any other sale.
    const store = conn.prepare('SELECT id FROM stores ORDER BY id LIMIT 1').get();
    if (!store) { result = { status: 400, body: { error: 'This shop is not set up to take orders yet' } }; return; }

    try {
      const tx = conn.transaction(() => {
        const snapshot = [];
        let subtotal = 0;
        const ensureRow = conn.prepare('INSERT OR IGNORE INTO store_stock (storeId, variantId, stock) VALUES (?, ?, 0)');
        const stockUpd = conn.prepare('UPDATE store_stock SET stock = MAX(0, stock - ?) WHERE storeId=? AND variantId=?');
        const moveIns = conn.prepare('INSERT INTO stock_movements (productName,type,qty,source,date,user,productId,variantId,storeId) VALUES (?,?,?,?,?,?,?,?,?)');
        const variantOf = conn.prepare(
          `SELECT pv.id AS variantId, pv.size, pv.color, pv.sku, p.id AS productId, p.name, p.price,
                  COALESCE(ss.stock,0) AS stock
           FROM product_variants pv JOIN products p ON p.id = pv.productId
           LEFT JOIN store_stock ss ON ss.variantId = pv.id AND ss.storeId = ?
           WHERE pv.id = ?`
        );
        const now = new Date().toISOString();
        const dateStr = now.slice(0, 16).replace('T', ' ');

        for (const it of items) {
          const qty = Number(it.qty) || 0;
          if (!it.variantId || qty <= 0) throw new Error('Invalid item in cart');
          const v = variantOf.get(store.id, it.variantId);
          if (!v) throw new Error('A product in your cart no longer exists');
          const label = [v.name, [v.size, v.color].filter(Boolean).join(' / ')].filter(Boolean).join(' — ');
          if (v.stock < qty) throw new Error(`Only ${v.stock} left of ${label}`);
          ensureRow.run(store.id, v.variantId);
          stockUpd.run(qty, store.id, v.variantId);
          moveIns.run(label, 'out', qty, 'ONLINE-pending', dateStr, customerName.trim(), v.productId, v.variantId, store.id);
          subtotal += v.price * qty;
          snapshot.push({ variantId: v.variantId, productId: v.productId, name: v.name, sku: v.sku, size: v.size, color: v.color, price: v.price, qty });
        }
        snapshot.forEach((it) => recomputeStock(it.variantId, it.productId));

        const info = conn.prepare(
          'INSERT INTO online_orders (customerName,customerPhone,items,subtotal,storeId,note,status,createdAt) VALUES (?,?,?,?,?,?,?,?)'
        ).run(customerName.trim(), customerPhone.trim(), JSON.stringify(snapshot), subtotal, store.id, note || null, 'pending', now);
        return info.lastInsertRowid;
      });
      const id = tx();
      result = { status: 201, body: { id, code: `ORD-${id}` } };
    } catch (e) {
      result = { status: 400, body: { error: e.message } };
    }
  });
  res.status(result.status).json(result.body);
}));

export default r;
