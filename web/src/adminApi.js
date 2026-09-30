// adminApi.js — a deliberately separate, minimal client for the platform
// admin panel. Kept isolated from api.js's shop/staff token handling on
// purpose: the admin token must never be sent alongside (or mistaken for)
// a shop's X-Tenant-Token or a staff member's Authorization token, and
// this panel must never be able to call any shop-scoped endpoint.
const BASE = import.meta.env.VITE_API_URL || '';

let adminToken = (typeof localStorage !== 'undefined' && localStorage.getItem('riskyc_admin_token')) || null;
export function setAdminToken(t) {
  adminToken = t;
  try { t ? localStorage.setItem('riskyc_admin_token', t) : localStorage.removeItem('riskyc_admin_token'); } catch {}
}
export function getAdminToken() { return adminToken; }

// Who's currently signed in — kept alongside the token so a page reload
// still knows "this row is me" without a round trip (used to hide the
// delete option on your own admin account, mirroring the server-side guard).
let adminIdentity = null;
try { adminIdentity = JSON.parse(localStorage.getItem('riskyc_admin_identity') || 'null'); } catch {}
export function setAdminIdentity(identity) {
  adminIdentity = identity;
  try { identity ? localStorage.setItem('riskyc_admin_identity', JSON.stringify(identity)) : localStorage.removeItem('riskyc_admin_identity'); } catch {}
}
export function getAdminIdentity() { return adminIdentity; }

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const adminApi = {
  login: (username, password) => req('POST', '/admin/login', { username, password }),
  getTenants: () => req('GET', '/admin/tenants'),
  createTenant: (data) => req('POST', '/admin/tenants', data),
  updateTenant: (id, data) => req('PUT', `/admin/tenants/${id}`, data),
  setTenantStatus: (id, status) => req('PUT', `/admin/tenants/${id}/status`, { status }),
  deleteTenant: (id, confirmSlug) => req('DELETE', `/admin/tenants/${id}`, { confirm: confirmSlug }),
  // other people who can sign into this panel
  getAdmins: () => req('GET', '/admin/admins'),
  createAdmin: (username, password) => req('POST', '/admin/admins', { username, password }),
  updateAdmin: (id, data) => req('PUT', `/admin/admins/${id}`, data),
  deleteAdmin: (id) => req('DELETE', `/admin/admins/${id}`),
};

export default adminApi;
