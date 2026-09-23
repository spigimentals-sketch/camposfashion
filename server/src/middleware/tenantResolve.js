// tenantResolve.js — the gate every shop-scoped API request passes through.
// Reads the `X-Tenant-Token` header (issued by POST /api/platform/login,
// separate from the staff Authorization: Bearer token), resolves which
// shop it belongs to, opens/reuses that shop's SQLite connection, and runs
// the rest of the request inside that shop's AsyncLocalStorage context —
// see tenantContext.js and db.js's exported `db` Proxy for how routes/api.js
// then transparently sees the right shop's data.
import { platformDb } from '../platformDb.js';
import { verifyTenantToken } from '../auth.js';
import { getTenantConnection } from '../tenantDb.js';
import { runInTenant } from '../tenantContext.js';

export function tenantResolve(req, res, next) {
  const token = req.headers['x-tenant-token'];
  if (!token) return res.status(401).json({ error: 'No shop selected — please log in again' });

  const payload = verifyTenantToken(token);
  if (!payload) return res.status(401).json({ error: 'Your shop session expired — please log in again' });

  const tenant = platformDb.prepare("SELECT * FROM tenants WHERE slug=? AND status='active'").get(payload.tenantSlug);
  if (!tenant) return res.status(401).json({ error: 'This shop is unavailable' });

  const conn = getTenantConnection(tenant.slug, tenant.dbPath);
  runInTenant({ slug: tenant.slug, conn, tenantRow: tenant }, () => next());
}
