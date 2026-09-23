// tenantContext.js — makes "which shop's database is this request for" an
// ambient, per-request value instead of a function parameter, using Node's
// built-in AsyncLocalStorage. This is what lets routes/api.js and seed.js
// keep calling `db.prepare(...)` completely unchanged even though `db` now
// secretly means "whichever shop's connection is active right now" — see
// db.js's exported `db` Proxy, which reads getCurrentTenant().conn on every
// access. Safe because every DB call in this codebase is synchronous, and
// ALS context reliably survives `await` boundaries within one request.
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();

// ctx: { slug, conn, tenantRow }
export function runInTenant(ctx, fn) {
  return als.run(ctx, fn);
}

export function getCurrentTenant() {
  const ctx = als.getStore();
  if (!ctx) {
    throw new Error(
      'No tenant context — this code ran outside a request that went through the tenant-resolution middleware. ' +
      'Scripts and seeders must call openTenantDatabase(...) directly instead of importing the shared `db`.'
    );
  }
  return ctx;
}
