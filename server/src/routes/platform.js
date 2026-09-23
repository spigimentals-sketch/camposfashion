// routes/platform.js — the ONE endpoint that runs before a shop is known:
// logging into a shop account itself. Mounted in index.js BEFORE the
// tenantResolve middleware, since it's what establishes the tenant token
// tenantResolve later reads. Nothing else lives here — shop account
// creation is a CLI script (server/scripts/create-tenant.js), not an API
// route, per the "you create the account yourself" decision.
import { Router } from 'express';
import { platformDb } from '../platformDb.js';
import { verifyPin, issueTenantToken } from '../auth.js';

const r = Router();

const h = (fn) => (req, res) => {
  try {
    const result = fn(req, res);
    if (result && typeof result.catch === 'function') result.catch((e) => res.status(400).json({ error: e.message }));
  } catch (e) { res.status(400).json({ error: e.message }); }
};

r.post('/platform/login', h((req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  const tenant = platformDb.prepare('SELECT * FROM tenants WHERE username = ? COLLATE NOCASE').get(String(username).trim());
  if (!tenant || !verifyPin(password, tenant.password_hash, tenant.password_salt)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  // Password is correct at this point — safe to say WHY access is denied
  // rather than leaving them thinking they mistyped it (this doesn't leak
  // anything about accounts an attacker doesn't already have the password
  // for).
  if (tenant.status !== 'active') {
    return res.status(403).json({ error: 'This shop account is suspended. Contact the platform owner to reactivate it.' });
  }
  res.json({ token: issueTenantToken(tenant), shopName: tenant.shopName, slug: tenant.slug });
}));

export default r;
