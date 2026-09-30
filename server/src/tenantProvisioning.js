// tenantProvisioning.js — the one real implementation of "create a new
// blank shop," shared by the CLI script (server/scripts/create-tenant.js)
// and the admin panel's POST /api/admin/tenants route, so there's exactly
// one place this logic can go wrong instead of two copies drifting apart.
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { openTenantDatabase } from './db.js';
import { closeTenantConnection } from './tenantDb.js';
import { seedBlankTenant } from './seed.js';
import { hashPin } from './auth.js';
import { platformDb } from './platformDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same pattern as PLATFORM_DB_PATH (platformDb.js) and UPLOAD_DIR
// (routes/api.js) — must be set to somewhere on a persistent disk in any
// real deployment (e.g. Render), or every shop's database gets silently
// wiped on the next deploy/restart while the platform's own directory
// (which WAS on the persistent disk) still points at the now-missing file,
// producing a 500 on every request for that shop. This one was missed when
// the other two were wired up — see the memory note on this bug.
const TENANTS_ROOT = process.env.TENANTS_DIR || path.join(__dirname, '..', 'tenants');
const UPLOADS_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

const slugify = (s) => (s || '').toString().toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export class ProvisioningError extends Error {}

// Turns a shop name into a free slug, appending -2/-3/... if it collides.
export function slugFor(shopName) {
  const base = slugify(shopName) || 'shop';
  let candidate = base, n = 1;
  while (platformDb.prepare('SELECT 1 FROM tenants WHERE slug=?').get(candidate)) candidate = `${base}-${++n}`;
  return candidate;
}

// Creates a brand-new blank shop: its own database file, seeded with one
// admin login and nothing else, plus its row in the platform's tenants
// directory. Throws ProvisioningError with a message safe to show the
// person filling in the form.
export function provisionTenant({ slug, shopName, username, password, ownerName, ownerUsername, ownerPin }) {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new ProvisioningError('Slug must be lowercase letters/numbers/hyphens only');
  if (!shopName) throw new ProvisioningError('Shop name is required');
  if (!username) throw new ProvisioningError('Shop username is required');
  if (!password || password.length < 6) throw new ProvisioningError('Password must be at least 6 characters');
  if (!ownerName) throw new ProvisioningError('Owner name is required');
  if (!ownerUsername) throw new ProvisioningError('Owner (staff) username is required');
  if (!ownerPin || !/^\d{4,6}$/.test(ownerPin)) throw new ProvisioningError('Owner PIN must be 4-6 digits');

  if (platformDb.prepare('SELECT 1 FROM tenants WHERE slug=? OR username=? COLLATE NOCASE').get(slug, username)) {
    throw new ProvisioningError(`A shop with slug "${slug}" or username "${username}" already exists`);
  }

  const tenantDir = path.join(TENANTS_ROOT, slug);
  fs.mkdirSync(tenantDir, { recursive: true });
  fs.mkdirSync(path.join(UPLOADS_ROOT, slug), { recursive: true });
  const dbPath = path.join(tenantDir, 'data.db');

  const conn = openTenantDatabase(dbPath);
  seedBlankTenant(conn, { shopName, ownerName, ownerUsername, ownerPin });

  const { hash, salt } = hashPin(password);
  const now = new Date().toISOString();
  const info = platformDb.prepare(
    'INSERT INTO tenants (slug,shopName,username,password_hash,password_salt,dbPath,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(slug, shopName, username, hash, salt, dbPath, 'active', now, now);

  return platformDb.prepare('SELECT id,slug,shopName,username,status,createdAt,updatedAt FROM tenants WHERE id=?').get(info.lastInsertRowid);
}

// Permanently removes a shop: its database file, its uploaded photos, and
// its row in the platform's tenants table. Irreversible — there is no
// backup step here, by design (a "soft delete" would just be status =
// 'suspended', which already exists). Closes the cached connection first
// (see tenantDb.js) so a stale open file handle can't keep the file alive
// after fs.rmSync, or serve a request that lands in the middle of deleting.
export function deleteTenant(id) {
  const tenant = platformDb.prepare('SELECT * FROM tenants WHERE id=?').get(id);
  if (!tenant) throw new ProvisioningError('Shop not found');

  closeTenantConnection(tenant.slug);
  fs.rmSync(path.dirname(tenant.dbPath), { recursive: true, force: true });
  fs.rmSync(path.join(UPLOADS_ROOT, tenant.slug), { recursive: true, force: true });
  platformDb.prepare('DELETE FROM tenants WHERE id=?').run(id);

  return { id, slug: tenant.slug };
}
