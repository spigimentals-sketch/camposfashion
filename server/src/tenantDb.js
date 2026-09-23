// tenantDb.js — lazily opens and caches one SQLite connection per shop, so
// repeat requests for the same shop reuse the same open connection instead
// of reopening the file every time. Fine for a handful to a few dozen shops
// on one process; would need an eviction policy if that grows very large.
import { openTenantDatabase } from './db.js';

const cache = new Map(); // slug -> connection

export function getTenantConnection(slug, filePath) {
  if (!cache.has(slug)) cache.set(slug, openTenantDatabase(filePath));
  return cache.get(slug);
}

// Mostly for scripts/tests that want a clean slate.
export function closeTenantConnection(slug) {
  const conn = cache.get(slug);
  if (conn) { conn.close(); cache.delete(slug); }
}
