// scripts/create-tenant.js — provisions a new shop account on the platform
// from the command line. For everyday use, prefer the admin panel
// (POST /api/admin/tenants, or just the "New shop" button in the UI) —
// this script exists mainly for the one thing the panel can't do:
// migrating an existing populated .db file in with --from-existing.
//
//   Blank new shop:
//     node scripts/create-tenant.js --slug my-shop --shop-name "My Shop" \
//       --username myshop --password s3cret \
//       --owner-name "Shop Owner" --owner-username admin --owner-pin 1234
//
//   Migrate an existing populated .db file in (used once, for Riskyc
//   Fashion's own pre-multitenant data):
//     node scripts/create-tenant.js --slug riskyc-fashion --shop-name "Riskyc Fashion" \
//       --username riskyc --password s3cret --from-existing ../data.db
//
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { openTenantDatabase } from '../src/db.js';
import { hashPin } from '../src/auth.js';
import { platformDb } from '../src/platformDb.js';
import { provisionTenant, ProvisioningError } from '../src/tenantProvisioning.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { out[a.slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const args = parseArgs(process.argv.slice(2));
const { slug, 'shop-name': shopName, username, password } = args;
const fromExisting = args['from-existing'];

if (!fromExisting) {
  // Blank shop — same code path the admin panel uses.
  try {
    const { 'owner-name': ownerName, 'owner-username': ownerUsername, 'owner-pin': ownerPin } = args;
    const tenant = provisionTenant({ slug, shopName, username, password, ownerName, ownerUsername, ownerPin });
    console.log(`\n✓ Shop "${tenant.shopName}" created.`);
    console.log(`  Shop login — username: ${username}   password: ${password}`);
    console.log(`  Give these to the shop owner yourself (this is the only time the password is shown).\n`);
  } catch (e) {
    if (e instanceof ProvisioningError) fail(e.message);
    throw e;
  }
  process.exit(0);
}

// --from-existing: migrate an already-populated database file in. Not
// something the admin panel does — kept CLI-only, deliberately manual.
if (!slug || !/^[a-z0-9-]+$/.test(slug)) fail('--slug is required and must be lowercase letters/numbers/hyphens only');
if (!shopName) fail('--shop-name is required');
if (!username) fail('--username is required (this is the shop-login username, NOT a staff PIN username)');
if (!password || password.length < 6) fail('--password is required and must be at least 6 characters');

if (platformDb.prepare('SELECT 1 FROM tenants WHERE slug=? OR username=? COLLATE NOCASE').get(slug, username)) {
  fail(`A shop with slug "${slug}" or username "${username}" already exists`);
}

const tenantDir = path.join(__dirname, '..', 'tenants', slug);
fs.mkdirSync(tenantDir, { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'uploads', slug), { recursive: true });
const dbPath = path.join(tenantDir, 'data.db');

const src = path.resolve(process.cwd(), fromExisting);
if (!fs.existsSync(src)) fail(`--from-existing file not found: ${src}`);
fs.copyFileSync(src, dbPath);
// Opening it runs the (idempotent) schema/migrations, bringing an older
// file up to the current schema — a no-op if it's already current.
openTenantDatabase(dbPath);
console.log(`• Copied existing database from ${src}`);

const { hash, salt } = hashPin(password);
const now = new Date().toISOString();
platformDb.prepare(
  'INSERT INTO tenants (slug,shopName,username,password_hash,password_salt,dbPath,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)'
).run(slug, shopName, username, hash, salt, dbPath, 'active', now, now);

console.log(`\n✓ Shop "${shopName}" created.`);
console.log(`  Shop login — username: ${username}   password: ${password}`);
console.log(`  Give these to the shop owner yourself (this is the only time the password is shown).`);
console.log(`  Database: ${dbPath}\n`);
