// scripts/create-admin.js — creates a login for the platform admin panel
// (where you create/suspend shops). Run this once to bootstrap your own
// access; run it again with a new --username to add another admin.
//
//   node scripts/create-admin.js --username you --password s3cretpass
//
import { hashPin } from '../src/auth.js';
import { platformDb } from '../src/platformDb.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { out[a.slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const { username, password } = parseArgs(process.argv.slice(2));
if (!username) fail('--username is required');
if (!password || password.length < 6) fail('--password is required and must be at least 6 characters');

if (platformDb.prepare('SELECT 1 FROM platform_admins WHERE username=? COLLATE NOCASE').get(username)) {
  fail(`An admin with username "${username}" already exists`);
}

const { hash, salt } = hashPin(password);
platformDb.prepare('INSERT INTO platform_admins (username,password_hash,password_salt,createdAt) VALUES (?,?,?,?)')
  .run(username, hash, salt, new Date().toISOString());

console.log(`\n✓ Admin panel login created.`);
console.log(`  Username: ${username}   Password: ${password}`);
console.log(`  Sign in at /admin on your deployment.\n`);
