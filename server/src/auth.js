// auth.js — PIN hashing and signed session tokens, using only Node's built-in
// crypto (no extra npm packages). This is right-sized security for a POS:
//   • PINs are stored as a salted scrypt hash, never in plain text.
//   • Login returns a signed token (like a mini-JWT). The server verifies the
//     signature on every protected request, so tokens can't be forged.
import crypto from 'crypto';

// In production set AUTH_SECRET as an environment variable. The fallback lets
// it run locally out of the box; tokens are only as secret as this value.
const SECRET = process.env.AUTH_SECRET || 'diallo-pos-dev-secret-change-me';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// A separate secret for tenant (shop-login) tokens, deliberately distinct
// from AUTH_SECRET (staff PIN tokens) — cheap defense-in-depth so a leaked
// staff token from one shop can never be replayed as a tenant credential,
// even though both use the same compact HMAC scheme.
const TENANT_SECRET = process.env.TENANT_AUTH_SECRET || 'diallo-pos-dev-tenant-secret-change-me';
// One login, kept until the shop owner explicitly signs out (the "Switch
// business account" action — see switchShop() in web/src/shared.jsx, which
// clears this token client-side). No server-side session list exists to
// revoke a specific token early, so "never expires" is really "expires so
// far out it never will in practice" — 20 years.
const TENANT_TOKEN_TTL_MS = 20 * 365 * 24 * 60 * 60 * 1000;

// A third, again separate, secret for the platform-owner's own admin panel
// (create shops, suspend/activate them). This token is never sent anywhere
// near a shop's own data — the admin panel only ever calls /api/admin/*,
// which never resolves a tenant, so this never even reaches the
// AsyncLocalStorage/db Proxy machinery a shop's own requests go through.
const PLATFORM_ADMIN_SECRET = process.env.PLATFORM_ADMIN_SECRET || 'diallo-pos-dev-platform-admin-secret-change-me';
const PLATFORM_ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// ---- PIN hashing ----
export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return { hash, salt };
}

export function verifyPin(pin, hash, salt) {
  if (!hash || !salt) return false;
  const test = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  // constant-time compare to avoid timing leaks
  const a = Buffer.from(test, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Tokens (compact, signed) ----
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function issueToken(user) {
  const payload = { id: user.id, name: user.name, role: user.role, exp: Date.now() + TOKEN_TTL_MS };
  const body = b64(payload);
  return `${body}.${sign(body)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (sign(body) !== sig) return null;            // bad signature
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null; // expired
  return payload;
}

// Express middleware: rejects requests without a valid token.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  req.user = payload;
  next();
}

// Middleware factory: require a specific role (e.g. admin or manager).
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not allowed for your role' });
    }
    next();
  };
}

// ---- Tenant (shop-login) tokens ----
// Same compact HMAC scheme as issueToken/verifyToken above, parameterized
// over a different secret/TTL/payload shape so the two token kinds are
// never interchangeable even though the encoding is identical.
const signWith = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

export function issueTenantToken(tenant) {
  const payload = { tenantSlug: tenant.slug, exp: Date.now() + TENANT_TOKEN_TTL_MS };
  const body = b64(payload);
  return `${body}.${signWith(TENANT_SECRET, body)}`;
}

export function verifyTenantToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (signWith(TENANT_SECRET, body) !== sig) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

// ---- Platform admin (owner) tokens ----
export function issuePlatformAdminToken(admin) {
  const payload = { id: admin.id, username: admin.username, exp: Date.now() + PLATFORM_ADMIN_TOKEN_TTL_MS };
  const body = b64(payload);
  return `${body}.${signWith(PLATFORM_ADMIN_SECRET, body)}`;
}

export function verifyPlatformAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (signWith(PLATFORM_ADMIN_SECRET, body) !== sig) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

// Express middleware: rejects requests without a valid platform-admin token.
export function requirePlatformAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyPlatformAdminToken(token);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  req.admin = payload;
  next();
}
