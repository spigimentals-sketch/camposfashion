// api.js — a thin wrapper around fetch() for every backend endpoint.
// In dev, BASE is '' and Vite proxies /api -> localhost:4000.
// In prod, set VITE_API_URL to your backend's URL.
const BASE = import.meta.env.VITE_API_URL || '';

// Turn a stored image path like "/uploads/x.jpg" into a full URL the browser can load.
// In dev, Vite proxies /uploads to the backend, so the bare path works too.
export function imageUrl(p) {
  if (!p) return null;
  if (p.startsWith('http') || p.startsWith('data:')) return p;
  return `${BASE}${p}`;
}

// --- Auth token: kept in memory + localStorage so login survives reloads ---
// This is the STAFF login (username + PIN) — which cashier/manager/admin is
// using the till right now, scoped to whichever shop the tenant token below
// resolved to.
let authToken = (typeof localStorage !== 'undefined' && localStorage.getItem('diallo_token')) || null;
export function setToken(t) {
  authToken = t;
  try { t ? localStorage.setItem('diallo_token', t) : localStorage.removeItem('diallo_token'); } catch {}
}
export function getToken() { return authToken; }

// --- Tenant token: a SEPARATE credential identifying which SHOP this
// browser is talking to (from the username+password "shop login" screen),
// independent of which staff member is currently clocked in above. Sent on
// its own header so the backend can tell the two apart.
let tenantToken = (typeof localStorage !== 'undefined' && localStorage.getItem('riskyc_tenant_token')) || null;
export function setTenantToken(t) {
  tenantToken = t;
  try { t ? localStorage.setItem('riskyc_tenant_token', t) : localStorage.removeItem('riskyc_tenant_token'); } catch {}
}
export function getTenantToken() { return tenantToken; }

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (tenantToken) headers['X-Tenant-Token'] = tenantToken;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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

export const api = {
  // shop (platform) login — establishes the tenant token, runs before any
  // staff auth call means anything
  platformLogin: (username, password) => req('POST', '/platform/login', { username, password }),
  // auth
  getStaff: () => req('GET', '/auth/staff'),
  login: (username, pin) => req('POST', '/auth/login', { username, pin }),
  me: () => req('GET', '/auth/me'),
  heartbeat: () => req('POST', '/auth/heartbeat'),
  setUserPin: (id, pin) => req('PUT', `/users/${id}/pin`, { pin }),
  // products
  getProducts: () => req('GET', '/products'),
  createProduct: (p) => req('POST', '/products', p),
  updateProduct: (id, p) => req('PUT', `/products/${id}`, p),
  deleteProduct: (id) => req('DELETE', `/products/${id}`),
  uploadImage: (filename, dataUrl) => req('POST', '/upload', { filename, dataUrl }),
  uploadDocument: (filename, dataUrl) => req('POST', '/upload-document', { filename, dataUrl }),
  // categories
  getCategories: () => req('GET', '/categories'),
  createCategory: (label) => req('POST', '/categories', { label }),
  deleteCategory: (id) => req('DELETE', `/categories/${id}`),
  // store locations (optional multi-store feature, see Settings)
  getStores: () => req('GET', '/stores'),
  createStore: (s) => req('POST', '/stores', s),
  updateStore: (id, s) => req('PUT', `/stores/${id}`, s),
  deleteStore: (id) => req('DELETE', `/stores/${id}`),
  // customers
  getCustomers: () => req('GET', '/customers'),
  createCustomer: (c) => req('POST', '/customers', c),
  updateCustomer: (id, c) => req('PUT', `/customers/${id}`, c),
  // suppliers
  getSuppliers: () => req('GET', '/suppliers'),
  createSupplier: (s) => req('POST', '/suppliers', s),
  updateSupplier: (id, s) => req('PUT', `/suppliers/${id}`, s),
  // supplier credit ledger
  getSupplierBalances: () => req('GET', '/supplier-balances'),
  getSupplierStatement: (id) => req('GET', `/suppliers/${id}/statement`),
  addSupplierCredit: (id, data) => req('POST', `/suppliers/${id}/credits`, data),
  addSupplierPayment: (id, data) => req('POST', `/suppliers/${id}/payments`, data),
  // purchase orders
  getPurchaseOrders: () => req('GET', '/purchase-orders'),
  createPurchaseOrder: (po) => req('POST', '/purchase-orders', po),
  updatePurchaseOrder: (id, patch) => req('PATCH', `/purchase-orders/${id}`, patch),
  recordPOPayment: (id, payment) => req('POST', `/purchase-orders/${id}/payments`, payment),
  getPOPayments: (id) => req('GET', `/purchase-orders/${id}/payments`),
  // stock movements
  getStockMovements: () => req('GET', '/stock-movements'),
  // users
  getUsers: () => req('GET', '/users'),
  createUser: (u) => req('POST', '/users', u),
  updateUser: (id, u) => req('PUT', `/users/${id}`, u),
  deleteUser: (id) => req('DELETE', `/users/${id}`),
  // employees & shifts
  getEmployees: () => req('GET', '/employees'),
  createEmployee: (e) => req('POST', '/employees', e),
  updateEmployee: (id, e) => req('PUT', `/employees/${id}`, e),
  deleteEmployee: (id) => req('DELETE', `/employees/${id}`),
  getShifts: () => req('GET', '/shifts'),
  // photoPath is the /uploads/... path from a prior uploadImage() call — a
  // clock-in photo, taken right at the moment of clocking in (see the
  // camera modal in the Shifts view), standing in for "this is really
  // that person" now that fingerprint verification proved impractical.
  clockIn: (photoPath) => req('POST', '/shifts/clock-in', { photo: photoPath }),
  clockOut: (countedCash) => req('POST', '/shifts/clock-out', { countedCash }),
  // Staff register — clocking a roster employee (no login) in/out on their
  // behalf; see server/src/routes/api.js for why there's no photo/cash here.
  registerClockIn: (employeeId) => req('POST', '/shifts/register-in', { employeeId }),
  registerClockOut: (employeeId) => req('POST', '/shifts/register-out', { employeeId }),
  // orders / checkout
  createOrder: (o) => req('POST', '/orders', o),
  createManualOrder: (o) => req('POST', '/orders/manual', o),
  getOrders: () => req('GET', '/orders'),
  getManualOrders: () => req('GET', '/orders?manual=1'),
  getOrder: (id) => req('GET', `/orders/${id}`),
  updateOrder: (id, data) => req('PUT', `/orders/${id}`, data),
  deleteOrder: (id, confirm) => req('DELETE', `/orders/${id}`, { confirm }),
  // settings
  getSettings: () => req('GET', '/settings'),
  saveSettings: (s) => req('PUT', '/settings', s),
  // this shop's own identity (slug), for building its public catalog link
  getTenantInfo: () => req('GET', '/tenant/info'),
  // reports
  salesReport: (days = 30) => req('GET', `/reports/sales?days=${days}`),
  profitabilityReport: (limit = 5) => req('GET', `/reports/profitability?limit=${limit}`),
  inventoryReport: () => req('GET', '/reports/inventory'),
  rangeReport: (from, to) => req('GET', `/reports/range?from=${from}&to=${to}`),
  zReport: (date) => req('GET', `/reports/z?date=${date}`),
  pnlReport: (from, to) => req('GET', `/reports/pnl?from=${from}&to=${to}`),
  pnlTrend: (months = 6) => req('GET', `/reports/pnl-trend?months=${months}`),
  breakevenReport: () => req('GET', '/reports/breakeven'),
  amountLeftTrend: (months = 12) => req('GET', `/reports/amount-left-trend?months=${months}`),
  // expenses
  getExpenses: () => req('GET', '/expenses'),
  createExpense: (e) => req('POST', '/expenses', e),
  deleteExpense: (id) => req('DELETE', `/expenses/${id}`),
  // maintenance
  clearData: () => req('POST', '/maintenance/clear-data'),
  clearActivity: () => req('POST', '/maintenance/clear-activity'),
  clearToday: () => req('POST', '/maintenance/clear-today'),
  // discount approval
  createDiscountRequest: (p) => req('POST', '/discount-requests', p),
  getDiscountRequest: (id) => req('GET', `/discount-requests/${id}`),
  getPendingDiscountRequests: () => req('GET', '/discount-requests/pending'),
  approveDiscountRequest: (id) => req('PUT', `/discount-requests/${id}/approve`),
  rejectDiscountRequest: (id, note) => req('PUT', `/discount-requests/${id}/reject`, { note }),
  cancelDiscountRequest: (id) => req('DELETE', `/discount-requests/${id}`),
  // return/exchange approval
  createReturnRequest: (p) => req('POST', '/return-requests', p),
  getReturnRequests: () => req('GET', '/return-requests'),
  getPendingReturnRequests: () => req('GET', '/return-requests/pending'),
  approveReturnRequest: (id) => req('PUT', `/return-requests/${id}/approve`),
  rejectReturnRequest: (id, note) => req('PUT', `/return-requests/${id}/reject`, { note }),
  // online orders (customer self-service ordering page, payment confirmed by staff)
  getOnlineOrders: () => req('GET', '/online-orders'),
  confirmOnlineOrder: (id) => req('PUT', `/online-orders/${id}/confirm`),
  rejectOnlineOrder: (id, note) => req('PUT', `/online-orders/${id}/reject`, { note }),
};

export default api;

// --- Offline mutation queue ---
// Floor-critical actions that can't be allowed to silently vanish when the
// backend is unreachable: checkout, clocking in/out, recording an expense.
// Each gets queued here instead of being lost, and retried automatically
// once the connection is back. Every handler is safe to retry — either via
// a clientId/clientOrderId the server dedupes on (order, expense), or
// because the resulting state is naturally idempotent (clock in/out: an
// "already clocked in"/"not clocked in" error on retry means it already
// worked, not that it failed). Everything else in the app (products,
// suppliers, settings, user management, edits/deletes) intentionally just
// fails honestly offline instead — queueing an edit risks overwriting newer
// server-side data with stale local data once it replays, which is a worse
// outcome than asking someone to retry once they're back online.
const PENDING_KEY = 'diallo_pending_mutations';

const MUTATION_HANDLERS = {
  order: { run: (p) => api.createOrder(p) },
  // The clock-in photo is queued as a raw data URL (the upload itself also
  // needs connectivity), so retrying means uploading it now and only then
  // clocking in with the resulting path.
  clockIn: {
    run: async (p) => {
      if (!p?.photo) return api.clockIn(null);
      const { path } = await api.uploadImage('clockin.jpg', p.photo);
      return api.clockIn(path);
    },
    alreadyDone: (e) => /already clocked in/i.test(e.message || ''),
  },
  clockOut: { run: (p) => api.clockOut(p?.countedCash), alreadyDone: (e) => /not clocked in/i.test(e.message || '') },
  expense: { run: (p) => api.createExpense(p) },
};

export function getPendingMutations() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}
function savePendingMutations(list) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch {}
}
export function queuePendingMutation(type, payload) {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  savePendingMutations([...getPendingMutations(), { id, type, payload, queuedAt: new Date().toISOString() }]);
  return id;
}
export function removePendingMutation(id) {
  savePendingMutations(getPendingMutations().filter((m) => m.id !== id));
}
export function clearAllPendingMutations() {
  savePendingMutations([]);
}

// Attempts to sync every queued mutation, in order. Stops on the first
// connectivity failure (no point hammering while still offline) but a
// genuine server rejection (e.g. bad data) doesn't block the rest of the
// queue — it's left in place for a human to investigate rather than
// silently dropped.
export async function flushPendingMutations() {
  let synced = 0, failing = 0;
  for (const m of getPendingMutations()) {
    const handler = MUTATION_HANDLERS[m.type];
    if (!handler) { removePendingMutation(m.id); continue; }
    try {
      await handler.run(m.payload);
      removePendingMutation(m.id);
      synced++;
    } catch (e) {
      if (handler.alreadyDone?.(e)) { removePendingMutation(m.id); synced++; continue; }
      if (!e.status) break; // still offline — retry the whole queue later
      failing++;
    }
  }
  return { synced, failing };
}
