// tenantProvisioning.js — the one real implementation of "create a new
// blank shop," shared by the CLI script (server/scripts/create-tenant.js)
// and the admin panel's POST /api/admin/tenants route, so there's exactly
// one place this logic can go wrong instead of two copies drifting apart.
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { openTenantDatabase } from './db.js';
import { seedBlankTenant } from './seed.js';
import { hashPin } from './auth.js';
import { platformDb } from './platformDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TENANTS_ROOT = path.join(__dirname, '..', 'tenants');
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

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
