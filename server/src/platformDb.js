// platformDb.js — the platform-owner's directory of shops. Always the same
// one connection (never swapped via tenantContext.js/the ALS Proxy in
// db.js) — this is what a shop's login even RESOLVES against, so it can't
// itself be "which shop's data" the way everything else in the app is.
import { fileURLToPath } from 'url';
import path from 'path';
import { openRawConnection } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_DB_PATH = process.env.PLATFORM_DB_PATH || path.join(__dirname, '..', 'platform.db');

export const platformDb = openRawConnection(PLATFORM_DB_PATH);

platformDb.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT UNIQUE NOT NULL,
  shopName      TEXT NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  dbPath        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT NOT NULL
);

-- The platform owner's OWN login for the admin panel (create shops,
-- suspend/activate them). Deliberately a separate table from tenants —
-- an admin account has no shop of its own and never touches a shop's data.
CREATE TABLE IF NOT EXISTS platform_admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  createdAt     TEXT NOT NULL
);
`);

export default platformDb;
