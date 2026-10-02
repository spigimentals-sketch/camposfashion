// routes/catalog.js — the ONE public, unauthenticated surface in the app:
// a shop's shareable product catalog, reached by anyone with the link
// (posted on WhatsApp/Instagram etc.), no login of any kind. Mounted in
// index.js BEFORE tenantResolve, since there's no token to resolve a shop
// from here — just a slug in the URL.
//
// The response is built from an explicit field whitelist, not by trimming
// the normal admin-facing product shape (server/src/routes/api.js's
// withVariants) — that way a future column added to `products` doesn't
// silently leak here until someone remembers to blocklist it. Cost,
// discount, SKUs, per-store stock breakdowns, and anything from
// customers/orders/users/employees/shifts never appear in this file.
import { Router } from 'express';
import { platformDb } from '../platformDb.js';
import { getTenantConnection } from '../tenantDb.js';
import { runInTenant } from '../tenantContext.js';

const r = Router();

const h = (fn) => (req, res) => {
  try {
    const result = fn(req, res);
    if (result && typeof result.catch === 'function') result.catch(() => res.status(500).json({ error: 'Something went wrong' }));
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
};

r.get('/catalog/:slug', h((req, res) => {
  const tenant = platformDb.prepare("SELECT * FROM tenants WHERE slug=? AND status='active'").get(req.params.slug);
  // Same 404 whether the slug doesn't exist, the shop is suspended, or the
  // shop just hasn't turned their catalog on — never confirm which.
  if (!tenant) return res.status(404).json({ error: 'Catalog not found' });

  const conn = getTenantConnection(tenant.slug, tenant.dbPath);
  runInTenant({ slug: tenant.slug, conn, tenantRow: tenant }, () => {
    const settingsRow = conn.prepare('SELECT json FROM settings WHERE id=1').get();
    const settings = settingsRow ? JSON.parse(settingsRow.json) : {};
    if (!settings.catalogEnabled) return res.status(404).json({ error: 'Catalog not found' });

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

    const variantsByProduct = new Map();
    variants.forEach((v) => {
      const stock = stockByVariant.get(v.id) || 0;
      if (stock <= 0) return; // never list a variant that isn't actually available
      if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
      variantsByProduct.get(v.productId).push({ size: v.size, color: v.color });
    });

    const catalogProducts = products
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
      .filter((p) => p.variants.length > 0); // never list a product with nothing actually in stock

    res.json({
      shopName: settings.businessName || tenant.shopName,
      address: settings.address || null,
      phone: settings.phone || null,
      logoUrl: settings.logoUrl || null,
      products: catalogProducts,
    });
  });
}));

export default r;
