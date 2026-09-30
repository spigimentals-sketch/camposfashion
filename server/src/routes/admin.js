// routes/admin.js — the platform owner's OWN panel: log in, create shops,
// suspend/activate them. Mounted in index.js before tenantResolve, so
// nothing here ever resolves (or can accidentally touch) a shop's own
// database — it only ever talks to platform.db. Deliberately does not
// expose anything from inside a shop (no sales, no products, nothing) —
// that's the whole point of keeping this a separate login and a separate
// set of routes from the shop app.
import { Router } from 'express';
import { platformDb } from '../platformDb.js';
import { verifyPin, hashPin, issuePlatformAdminToken, requirePlatformAdmin } from '../auth.js';
import { provisionTenant, deleteTenant, slugFor, ProvisioningError } from '../tenantProvisioning.js';

const r = Router();

const h = (fn) => (req, res) => {
  try {
    const result = fn(req, res);
    if (result && typeof result.catch === 'function') result.catch((e) => res.status(400).json({ error: e.message }));
  } catch (e) { res.status(400).json({ error: e.message }); }
};

r.post('/admin/login', h((req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  const admin = platformDb.prepare('SELECT * FROM platform_admins WHERE username = ? COLLATE NOCASE').get(String(username).trim());
  if (!admin || !verifyPin(password, admin.password_hash, admin.password_salt)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  res.json({ token: issuePlatformAdminToken(admin), id: admin.id, username: admin.username });
}));

// Every route below requires a valid platform-admin token.
r.use('/admin', requirePlatformAdmin);

// The shop list — intentionally excludes password_hash/password_salt/dbPath
// (nothing an admin panel needs) and includes no data from inside any
// shop's own database.
r.get('/admin/tenants', h((req, res) => {
  res.json(platformDb.prepare('SELECT id,slug,shopName,username,status,createdAt,updatedAt FROM tenants ORDER BY createdAt DESC').all());
}));

r.post('/admin/tenants', h((req, res) => {
  const { shopName, slug: requestedSlug, username, password, ownerName, ownerUsername, ownerPin } = req.body || {};
  const slug = requestedSlug || slugFor(shopName || '');
  try {
    const tenant = provisionTenant({ slug, shopName, username, password, ownerName, ownerUsername, ownerPin });
    res.status(201).json(tenant);
  } catch (e) {
    if (e instanceof ProvisioningError) return res.status(400).json({ error: e.message });
    throw e;
  }
}));

// Edits a shop's name/login username, and optionally resets its login
// password (leave password blank/omitted to keep the current one). Does
// NOT touch the slug — that's the shop's file/database path on disk, and
// renaming it would mean moving directories and rewriting dbPath, which
// isn't worth the risk for what this is for. Never touches anything
// inside the shop's own database.
r.put('/admin/tenants/:id', h((req, res) => {
  const { shopName, username, password } = req.body || {};
  const tenant = platformDb.prepare('SELECT * FROM tenants WHERE id=?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Shop not found' });
  if (!shopName) return res.status(400).json({ error: 'Shop name is required' });
  if (!username) return res.status(400).json({ error: 'Shop login username is required' });
  if (password && password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const clash = platformDb.prepare('SELECT 1 FROM tenants WHERE username=? COLLATE NOCASE AND id<>?').get(username, tenant.id);
  if (clash) return res.status(400).json({ error: `Another shop already uses the username "${username}"` });

  const now = new Date().toISOString();
  if (password) {
    const { hash, salt } = hashPin(password);
    platformDb.prepare('UPDATE tenants SET shopName=?, username=?, password_hash=?, password_salt=?, updatedAt=? WHERE id=?')
      .run(shopName, username, hash, salt, now, tenant.id);
  } else {
    platformDb.prepare('UPDATE tenants SET shopName=?, username=?, updatedAt=? WHERE id=?')
      .run(shopName, username, now, tenant.id);
  }
  res.json(platformDb.prepare('SELECT id,slug,shopName,username,status,createdAt,updatedAt FROM tenants WHERE id=?').get(tenant.id));
}));

// Turns access on/off for a shop without deleting anything — used when a
// shop hasn't paid its monthly license. tenantResolve.js already checks
// status='active' on every request, so suspending here takes effect
// immediately: their next request (or their very next login) is rejected.
r.put('/admin/tenants/:id/status', h((req, res) => {
  const { status } = req.body || {};
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: "status must be 'active' or 'suspended'" });
  const tenant = platformDb.prepare('SELECT id FROM tenants WHERE id=?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Shop not found' });
  platformDb.prepare('UPDATE tenants SET status=?, updatedAt=? WHERE id=?').run(status, new Date().toISOString(), req.params.id);
  res.json({ id: tenant.id, status });
}));

// Permanently deletes a shop: its database, its uploaded photos, everything
// — irreversible, unlike /status (which just locks them out but keeps their
// data). Requires the caller to echo back the shop's own slug as `confirm`,
// so this can't be triggered by a stray click the way a plain button could;
// the UI makes the admin type the shop name to get that value.
r.delete('/admin/tenants/:id', h((req, res) => {
  const tenant = platformDb.prepare('SELECT id,slug,shopName FROM tenants WHERE id=?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Shop not found' });
  const { confirm } = req.body || {};
  if (confirm !== tenant.slug) return res.status(400).json({ error: 'Confirmation did not match — nothing was deleted' });
  deleteTenant(tenant.id);
  res.json({ ok: true });
}));

// ---- Other people who can sign into this panel ----
// Never exposes password_hash/password_salt — just enough to show who has
// access and let you add or remove people.
r.get('/admin/admins', h((req, res) => {
  res.json(platformDb.prepare('SELECT id,username,createdAt FROM platform_admins ORDER BY createdAt ASC').all());
}));

r.post('/admin/admins', h((req, res) => {
  const { username, password } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (platformDb.prepare('SELECT 1 FROM platform_admins WHERE username=? COLLATE NOCASE').get(username)) {
    return res.status(400).json({ error: `An admin with username "${username}" already exists` });
  }
  const { hash, salt } = hashPin(password);
  const info = platformDb.prepare('INSERT INTO platform_admins (username,password_hash,password_salt,createdAt) VALUES (?,?,?,?)')
    .run(username, hash, salt, new Date().toISOString());
  res.status(201).json(platformDb.prepare('SELECT id,username,createdAt FROM platform_admins WHERE id=?').get(info.lastInsertRowid));
}));

// Edits an admin's username, and optionally resets their password (leave
// password blank/omitted to keep the current one).
r.put('/admin/admins/:id', h((req, res) => {
  const { username, password } = req.body || {};
  const admin = platformDb.prepare('SELECT * FROM platform_admins WHERE id=?').get(req.params.id);
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (password && password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const clash = platformDb.prepare('SELECT 1 FROM platform_admins WHERE username=? COLLATE NOCASE AND id<>?').get(username, admin.id);
  if (clash) return res.status(400).json({ error: `Another admin already uses the username "${username}"` });

  if (password) {
    const { hash, salt } = hashPin(password);
    platformDb.prepare('UPDATE platform_admins SET username=?, password_hash=?, password_salt=? WHERE id=?').run(username, hash, salt, admin.id);
  } else {
    platformDb.prepare('UPDATE platform_admins SET username=? WHERE id=?').run(username, admin.id);
  }
  res.json(platformDb.prepare('SELECT id,username,createdAt FROM platform_admins WHERE id=?').get(admin.id));
}));

// Can't remove the account making the request, and can't remove the last
// admin standing — either would lock the panel with nobody able to sign in.
r.delete('/admin/admins/:id', h((req, res) => {
  const id = Number(req.params.id);
  if (id === req.admin.id) return res.status(400).json({ error: "You can't remove your own admin account while signed in as it" });
  const count = platformDb.prepare('SELECT COUNT(*) AS n FROM platform_admins').get().n;
  if (count <= 1) return res.status(400).json({ error: 'At least one admin account must remain' });
  const admin = platformDb.prepare('SELECT id FROM platform_admins WHERE id=?').get(id);
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  platformDb.prepare('DELETE FROM platform_admins WHERE id=?').run(id);
  res.json({ ok: true });
}));

export default r;
