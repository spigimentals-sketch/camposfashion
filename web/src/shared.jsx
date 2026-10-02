// shared.jsx — infrastructure that makes the buttons work:
//  • DataProvider: loads everything from the backend and keeps it in state.
//    If the backend is unreachable it falls back to the seed data passed in,
//    so the UI still runs as a demo.
//  • Toasts, a generic Modal, simple form fields.
//  • CSV export helper.
//  • Entity forms (Product, Supplier, User, Purchase Order).
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, ShieldCheck, Delete, UserCircle2, Trash2, Building2, Eye, EyeOff, Lock } from 'lucide-react';
import api, { imageUrl, setToken, getToken, getTenantToken, setTenantToken, getPendingMutations, queuePendingMutation, flushPendingMutations, clearAllPendingMutations } from './api.js';

/* ---------------- CSV export ---------------- */
export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const CODE39_PATTERNS = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

// Renders a price-tag label: optional item name on top, the scannable CODE39
// barcode (always encoding just the SKU, so hardware scanners still match it
// against p.sku), the SKU as human-readable text, and an optional price at
// the bottom. Only the bars encode data — name/price are printed, not encoded.
// scale > 1 produces a higher-resolution canvas for sharp print output.
// Use scale=3 when generating for print (300 DPI equivalent on a 96 DPI screen).
export function createBarcodeDataUrl(text, { name, price, scale = 1 } = {}) {
  const s = Math.max(1, scale);
  const normalized = text.trim().toUpperCase();
  if (!normalized) throw new Error('SKU is required to generate a barcode');
  const codes = [`*`, ...normalized.split(''), `*`];
  const patternStrings = codes.map(c => CODE39_PATTERNS[c]);
  if (patternStrings.some(p => !p)) {
    throw new Error('SKU contains unsupported characters for barcode printing');
  }

  const moduleWidth = 2 * s;
  const barHeight = 100 * s;
  const quietZone = moduleWidth * 10;
  const charGap = moduleWidth;
  const totalModules = patternStrings.reduce((sum, pattern) => {
    return sum + pattern.split('').reduce((acc, digit) => acc + (digit === 'w' ? 3 : 1), 0);
  }, 0) + (patternStrings.length - 1) * charGap;

  const barsWidth = totalModules * moduleWidth + quietZone * 2;
  const nameText = (name || '').trim();
  const priceText = price != null && price !== '' ? `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(price)))} FCFA` : '';

  const nameFont = `bold ${20 * s}px Arial, sans-serif`;
  const priceFont = `bold ${22 * s}px Arial, sans-serif`;
  const skuFont = `${16 * s}px Arial, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = nameFont;
  const nameWidth = nameText ? measure.measureText(nameText).width : 0;
  measure.font = priceFont;
  const priceWidth = priceText ? measure.measureText(priceText).width : 0;

  const width = Math.ceil(Math.max(barsWidth, nameWidth + 24 * s, priceWidth + 24 * s));
  const nameBlockHeight = nameText ? 34 * s : 0;
  const priceBlockHeight = priceText ? 36 * s : 0;
  const skuBlockHeight = 32 * s;
  const topPad = 16 * s;
  const height = topPad + nameBlockHeight + barHeight + skuBlockHeight + priceBlockHeight + 12 * s;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';

  let y = topPad;
  if (nameText) {
    ctx.font = nameFont;
    y += 20 * s;
    ctx.fillText(nameText, width / 2, y);
    y += nameBlockHeight - 20 * s;
  }

  const barsTop = y;
  let x = (width - barsWidth) / 2 + quietZone;
  patternStrings.forEach((pattern, index) => {
    for (let i = 0; i < pattern.length; i += 1) {
      const w = pattern[i] === 'w' ? moduleWidth * 3 : moduleWidth;
      if (i % 2 === 0) ctx.fillRect(x, barsTop, w, barHeight);
      x += w;
    }
    if (index < patternStrings.length - 1) {
      x += charGap;
    }
  });
  y += barHeight;

  ctx.font = skuFont;
  y += 22 * s;
  ctx.fillText(normalized, width / 2, y);
  y += skuBlockHeight - 22 * s;

  if (priceText) {
    ctx.font = priceFont;
    y += 24 * s;
    ctx.fillText(priceText, width / 2, y);
  }

  return canvas.toDataURL('image/png');
}

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, message, type }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);
  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const colors = {
    success: 'bg-emerald-900 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-stone-900 text-white',
  };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] space-y-2">
        {items.map(t => {
          const Icon = icons[t.type] || Info;
          return (
            <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${colors[t.type]}`}>
              <Icon size={16} /> {t.message}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h3 className="font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-stone-100"><X size={16} className="text-stone-500" /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-stone-200 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <label className="block mb-3">
    <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
    {children}
  </label>
);
export const Input = (props) => (
  <input {...props} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
);
export const SelectInput = ({ options, ...props }) => (
  <select {...props} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100">
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);
export const PrimaryBtn = (p) => <button {...p} className="px-4 py-2 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800 disabled:opacity-50" />;
export const GhostBtn = (p) => <button {...p} className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg" />;

/* ---------------- Data layer ---------------- */
const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

export function DataProvider({ fallback, children }) {
  const [state, setState] = useState({
    products: fallback.products || [],
    customers: fallback.customers || [],
    suppliers: fallback.suppliers || [],
    purchaseOrders: fallback.purchaseOrders || [],
    stockMovements: fallback.stockMovements || [],
    users: fallback.users || [],
    employees: fallback.employees || [],
    shifts: fallback.shifts || [],
    settings: fallback.settings || {},
    categories: fallback.categories || [],
    stores: fallback.stores || [],
  });
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingMutations().length);

  const refresh = useCallback(async () => {
    try {
      const [products, customers, suppliers, purchaseOrders, stockMovements, users, employees, shifts, settings, categories, stores] =
        await Promise.all([
          api.getProducts(), api.getCustomers(), api.getSuppliers(), api.getPurchaseOrders(),
          api.getStockMovements(), api.getUsers(), api.getEmployees(), api.getShifts(), api.getSettings(), api.getCategories(),
          api.getStores(),
        ]);
      setState({ products, customers, suppliers, purchaseOrders, stockMovements, users, employees, shifts, settings, categories, stores });
      setOnline(true);
    } catch (e) {
      // A 401 here means the shop session itself is gone (expired/revoked),
      // not "backend unreachable" — no amount of retrying fixes that, so
      // send the browser back to the shop login instead of quietly sitting
      // in offline/demo mode forever.
      if (e.status === 401) { setTenantToken(null); window.location.reload(); return; }
      // Backend not running — keep using the fallback seed (demo mode).
      setOnline(false);
      console.warn('Backend unreachable, running in offline demo mode:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // A checkout/clock-in/clock-out/expense that couldn't reach the backend
  // queues itself instead of being lost. Try to flush that queue: once on
  // mount, periodically as a safety net (the `online` flag above is only as
  // fresh as the last refresh, not a live connection monitor), and
  // immediately when the OS reports the network came back.
  useEffect(() => {
    const tryFlush = async () => {
      if (getPendingMutations().length === 0) return;
      const { synced } = await flushPendingMutations();
      setPendingSyncCount(getPendingMutations().length);
      if (synced > 0) refresh();
    };
    tryFlush();
    const id = setInterval(tryFlush, 20000);
    window.addEventListener('online', tryFlush);
    return () => { clearInterval(id); window.removeEventListener('online', tryFlush); };
  }, [refresh]);

  // Used when checkout/clock-in/clock-out/an expense can't reach the
  // backend right now — queues it instead of losing it.
  const queueMutation = (type, payload) => {
    queuePendingMutation(type, payload);
    setPendingSyncCount(getPendingMutations().length);
  };

  // Generic local-state patch helpers so the UI updates instantly,
  // whether or not the backend call succeeds.
  const patch = (key, fn) => setState(prev => ({ ...prev, [key]: fn(prev[key]) }));

  const dismissPendingSync = () => {
    clearAllPendingMutations();
    setPendingSyncCount(0);
  };

  const value = {
    ...state, online, loading, refresh, patch, setState, pendingSyncCount, queueMutation, dismissPendingSync,
    upsertProduct: (p) => patch('products', list => {
      const i = list.findIndex(x => x.id === p.id);
      return i >= 0 ? list.map(x => x.id === p.id ? p : x) : [...list, p];
    }),
    upsertCategory: (c) => patch('categories', list => {
      const i = list.findIndex(x => x.id === c.id);
      return i >= 0 ? list.map(x => x.id === c.id ? c : x) : [...list, c];
    }),
    removeCategory: (id) => patch('categories', list => list.filter(x => x.id !== id)),
    upsertCustomer: (c) => patch('customers', list => {
      const i = list.findIndex(x => x.id === c.id);
      return i >= 0 ? list.map(x => x.id === c.id ? c : x) : [...list, c];
    }),
    upsertSupplier: (s) => patch('suppliers', list => {
      const i = list.findIndex(x => x.id === s.id);
      return i >= 0 ? list.map(x => x.id === s.id ? s : x) : [...list, s];
    }),
    upsertPO: (po) => patch('purchaseOrders', list => {
      const i = list.findIndex(x => x.id === po.id);
      return i >= 0 ? list.map(x => x.id === po.id ? po : x) : [po, ...list];
    }),
    upsertUser: (u) => patch('users', list => {
      const i = list.findIndex(x => x.id === u.id);
      return i >= 0 ? list.map(x => x.id === u.id ? u : x) : [...list, u];
    }),
    upsertEmployee: (e) => patch('employees', list => {
      const i = list.findIndex(x => x.id === e.id);
      return i >= 0 ? list.map(x => x.id === e.id ? e : x) : [...list, e];
    }),
  };
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

/* ---------------- Entity forms ---------------- */
const CATS = ['sets', 'jerseys', 'trousers', 'pullovers', 'shirts', 'shorts', 'tshirts', 'others'];

// A quick-pick set of common garment sizes, offered as chips in the variant
// editor — free text still works for anything outside this list (e.g. a
// numeric waist size). Runs up through plus sizes to match what's actually
// stocked (riskycfashion.com carries up to 4XL on several lines).
export const QUICK_SIZES = ['One Size', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];


export function ProductForm({ open, onClose, initial }) {
  const { upsertProduct, patch, categories: liveCategories, upsertCategory, settings } = useData();
  const useVariants = settings?.useVariants !== false;
  const { toast } = useToast();
  const blank = { name: '', name_fr: '', category: 'tshirts', price: 0, cost: 0, sku: '', emoji: '📦', image: null, packetPrice: 0, unitsPerPacket: 0, halfPacketPrice: 0, variants: [{ size: '', color: '', sku: '', stock: 0 }] };
  const [form, setForm] = useState(initial || blank);
  const [uploading, setUploading] = useState(false);
  const [autoGenerateSku, setAutoGenerateSku] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Bulk purchase calculator
  const [bulkTotal, setBulkTotal] = useState('');
  const [bulkQty, setBulkQty] = useState('');
  const bulkUnitCost = bulkTotal && bulkQty && Number(bulkQty) > 0
    ? Math.round(Number(bulkTotal) / Number(bulkQty))
    : null;

  useEffect(() => {
    const f = initial || blank;
    setForm(f);
    setAutoGenerateSku(false);
    setAddingCat(false);
    setNewCatName('');
  }, [initial, open]); // eslint-disable-line
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const categoryOptions = (liveCategories?.length ? liveCategories : CATS.map(c => ({ id: c, label: c })))
    .map(c => ({ value: c.id, label: c.label }));

  // Lets the form create a category that isn't one of the built-in ones yet,
  // instead of being stuck picking the closest existing match. The new
  // category becomes selected immediately so the rest of the form continues
  // uninterrupted.
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await api.createCategory(newCatName.trim());
      upsertCategory(created);
      setForm(f => ({ ...f, category: created.id }));
      setNewCatName('');
      setAddingCat(false);
      toast(`Category "${created.label}" added`);
    } catch (e) {
      toast(!e.status ? "Can't add a category while offline — try again once connected" : e.message, 'error');
    }
  };

  const makeSku = (category = 'SKU') => {
    const prefix = category.toString().replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 3) || 'SKU';
    return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  };
  const handleGenerateSku = () => setForm(f => ({ ...f, sku: makeSku(f.category) }));
  const handleToggleAutoSku = (checked) => {
    setAutoGenerateSku(checked);
    if (checked && !form.sku) setForm(f => ({ ...f, sku: makeSku(f.category) }));
  };

  // Variant rows: each is a sellable size/color combo with its own SKU and
  // stock count. A style with no real sizing just keeps a single row.
  const updateVariant = (idx, key, value) => setForm(f => ({
    ...f, variants: f.variants.map((v, i) => i === idx ? { ...v, [key]: value } : v),
  }));
  const addVariantRow = () => setForm(f => ({ ...f, variants: [...(f.variants || []), { size: '', color: '', sku: '', stock: 0 }] }));
  const removeVariantRow = (idx) => setForm(f => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }));
  const generateVariantSku = (idx) => setForm(f => {
    const base = f.sku || makeSku(f.category);
    const v = f.variants[idx];
    const sizeTag = (v.size || 'OS').replace(/\s+/g, '').toUpperCase();
    const colorTag = v.color ? '-' + v.color.slice(0, 3).toUpperCase() : '';
    return { ...f, sku: base, variants: f.variants.map((vv, i) => i === idx ? { ...vv, sku: `${base}-${sizeTag}${colorTag}` } : vv) };
  });
  const totalStock = (form.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);

  const printBarcode = () => {
    if (!form.sku) {
      toast('Please generate or enter a SKU before printing a barcode.', 'error');
      return;
    }
    try {
      // 3× scale → ~300 DPI-equivalent on a 4.33 in label at 96 DPI screen res.
      const dataUrl = createBarcodeDataUrl(form.sku, { name: form.name, price: form.price, scale: 3 });
      const popup = window.open('', '_blank');
      if (!popup) {
        toast('Unable to open print window. Please allow popups and try again.', 'error');
        return;
      }
      popup.document.write(`<!doctype html>
<html>
<head>
<title>Product label — ${(form.name || form.sku).replace(/</g, '&lt;')}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 20px; padding: 32px;
    font-family: 'Plus Jakarta Sans', system-ui, Arial, sans-serif;
    background: linear-gradient(135deg, #fafaf9 0%, #ffffff 55%, #fff1f2 100%);
    color: #1c1917;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-mark {
    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
    background: linear-gradient(135deg, #e11d48, #be123c, #881337);
    box-shadow: 0 6px 14px -4px rgba(127,29,29,.35);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 18px; font-family: Georgia, serif;
  }
  .brand-name { font-family: Georgia, serif; font-weight: 600; font-size: 18px; line-height: 1; color: #1c1917; }
  .brand-sub { font-size: 9px; letter-spacing: .15em; text-transform: uppercase; color: #78716c; margin-top: 2px; }
  .eyebrow { font-size: 11px; letter-spacing: .15em; text-transform: uppercase; color: #be123c; font-weight: 600; }
  .card {
    background: #fff; border: 1px solid #e7e5e4; border-radius: 20px;
    box-shadow: 0 16px 40px -16px rgba(28,25,23,.18);
    padding: 28px 32px; display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .card img { max-width: 100%; height: auto; }
  .btn {
    border: none; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600;
    padding: 12px 28px; border-radius: 12px; color: #fff;
    background: linear-gradient(135deg, #be123c, #881337);
    box-shadow: 0 8px 20px -8px rgba(127,29,29,.45);
  }
  .btn:hover { filter: brightness(1.05); }
  @media print {
    body { background: #fff; min-height: 0; padding: 0; margin: 0; display: block; }
    .brand, .eyebrow, .btn { display: none; }
    .card {
      border: none; box-shadow: none; border-radius: 0; padding: 0;
      margin: 0.5in auto 0;
      width: fit-content;
    }
    .card img { display: block; height: auto; }
  }
</style>
</head>
<body>
  <div class="brand">
    <div class="brand-mark">R</div>
    <div>
      <div class="brand-name">RISKYC FASHION</div>
      <div class="brand-sub">Point of Sale</div>
    </div>
  </div>
  <div class="eyebrow">Product label preview · 4.33 in label</div>
  <div class="card"><img src="${dataUrl}" alt="Barcode for ${(form.sku || '').replace(/</g, '&lt;')}" /></div>
  <button class="btn" onclick="window.print()">Print label</button>
</body>
</html>`);
      popup.document.close();
    } catch (error) {
      toast(error.message || 'Failed to generate barcode.', 'error');
    }
  };

  // When a photo is chosen: read it as a base64 data URL and upload it.
  // Inventory edits require connectivity (see note on `save` below), so this
  // fails honestly offline rather than pretending the photo attached.
  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please choose an image file', 'error'); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('Could not read file'));
        fr.readAsDataURL(file);
      });
      const { path } = await api.uploadImage(file.name, dataUrl);
      setForm(f => ({ ...f, image: path }));
      toast('Photo attached');
    } catch (err) {
      toast(!err.status ? "Can't upload while offline — try again once connected" : err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Inventory edits intentionally require connectivity rather than queueing:
  // an offline edit replayed later could silently overwrite newer changes
  // someone else made in the meantime, which is worse than asking for a retry.
  const save = async () => {
    const payload = {
      ...form, price: Number(form.price), cost: Number(form.cost || 0), discount: 0,
      packetPrice: Number(form.packetPrice || 0), unitsPerPacket: Number(form.unitsPerPacket || 0),
      halfPacketPrice: Number(form.halfPacketPrice || 0),
      variants: (form.variants?.length ? form.variants : [{ size: '', color: '', sku: '', stock: 0 }])
        .map(v => ({ ...v, stock: Number(v.stock) || 0 })),
    };
    delete payload.stock;
    if (!payload.sku) payload.sku = makeSku(payload.category);
    // Variants off: the only SKU the user ever sees is the product-level
    // field, so keep the (single) variant's own SKU mirrored to it — that's
    // what checkout/scan actually match against (see variantsOf).
    if (!useVariants) payload.variants = [{ ...payload.variants[0], size: payload.variants[0].size || 'One Size', sku: payload.sku }];
    try {
      const saved = initial?.id
        ? await api.updateProduct(initial.id, payload)
        : await api.createProduct(payload);
      upsertProduct(saved);
      toast(initial?.id ? 'Product updated' : 'Product added');
      onClose();
    } catch (e) {
      toast(!e.status ? "Can't save while offline — try again once connected" : e.message, 'error');
    }
  };

  const remove = async () => {
    if (!initial?.id) return;
    if (!window.confirm(`Delete "${initial.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteProduct(initial.id);
      patch('products', list => list.filter(p => p.id !== initial.id));
      toast('Product deleted');
      onClose();
    } catch (e) {
      toast(!e.status ? "Can't delete while offline — try again once connected" : e.message, 'error');
    }
  };

  const preview = form.image ? imageUrl(form.image) : null;

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit product' : 'Add product'}
      footer={<>
        {initial?.id && (
          <button onClick={remove} className="px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 rounded-lg mr-auto">Delete</button>
        )}
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={save} disabled={uploading}>{uploading ? 'Uploading…' : 'Save'}</PrimaryBtn>
      </>}>

      {/* Photo + Name side by side — the preview box itself is the upload
          trigger (click anywhere on it), rather than a separate button. No
          camera option; this shop always uses real product photos taken
          elsewhere and uploaded. */}
      <div className="flex items-start gap-4 mb-3">
        <div className="flex-shrink-0">
          <label className="block text-xs font-medium text-stone-600 mb-1">Photo</label>
          <label
            className="w-24 h-24 rounded-xl bg-stone-100 border-2 border-dashed border-stone-300 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-rose-400 hover:bg-stone-50 transition-colors group relative"
            title={preview ? 'Click to change photo' : 'Click to upload a photo'}
          >
            {preview ? (
              <>
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-white text-[11px] font-medium transition-opacity">Change</span>
                </div>
              </>
            ) : (
              <span className="text-[11px] text-stone-400 font-medium px-2 text-center">Click to upload photo</span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          </label>
          {preview && (
            <button type="button" onClick={() => setForm(f => ({ ...f, image: null }))}
              className="mt-1 text-xs text-stone-500 hover:text-rose-600">Remove photo</button>
          )}
        </div>
        <div className="flex-1 pt-5">
          <Field label="Name"><Input value={form.name} onChange={set('name')} /></Field>
        </div>
      </div>

      {/* Cost price + quantity — the two numbers needed to know what a
          restock actually cost and how much of it there is. Quantity only
          shows here as a single field when variants are off (settings >
          Product variants); with variants on, stock is per size/color
          further down instead, so this row is just cost price alone. */}
      <div className={useVariants ? '' : 'grid grid-cols-2 gap-3'}>
        <Field label="Cost price (FCFA)"><Input type="number" value={form.cost} onChange={set('cost')} /></Field>
        {!useVariants && (
          <Field label="Quantity">
            <Input type="number" value={form.variants?.[0]?.stock ?? 0} onChange={e => updateVariant(0, 'stock', e.target.value)} />
          </Field>
        )}
      </div>

      {/* Packet price + quantity — selling this product as a fixed-size
          packet (e.g. a case of 6) alongside the unit price. Leaving it at 0
          means that option isn't offered. */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Packet price (FCFA)"><Input type="number" value={form.packetPrice || ''} onChange={set('packetPrice')} placeholder="e.g. 2 800" /></Field>
        <Field label="Units per packet"><Input type="number" value={form.unitsPerPacket || ''} onChange={set('unitsPerPacket')} placeholder="e.g. 6" /></Field>
      </div>

      <Field label="Category">
        {addingCat ? (
          <div className="flex items-center gap-2">
            <Input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="New category name"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
            />
            <button type="button" onClick={handleAddCategory}
              className="px-3 py-2 bg-rose-900 text-white rounded-lg text-xs font-semibold hover:bg-rose-800 flex-shrink-0">
              Add
            </button>
            <button type="button" onClick={() => { setAddingCat(false); setNewCatName(''); }}
              className="p-2 text-stone-400 hover:text-stone-600 flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ) : (
          <SelectInput
            value={form.category}
            onChange={e => {
              if (e.target.value === '__new__') { setAddingCat(true); setNewCatName(''); }
              else set('category')(e);
            }}
            options={[...categoryOptions, { value: '__new__', label: '+ Add new category…' }]}
          />
        )}
      </Field>

      <Field label="Selling price (FCFA)"><Input type="number" value={form.price} onChange={set('price')} /></Field>

      {/* Bulk purchase calculator — a helper for filling in Cost price above. */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
        <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">📦 Cost Calculator</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Carton price (FCFA)</label>
            <Input type="number" value={bulkTotal} onChange={e => setBulkTotal(e.target.value)} placeholder="e.g. 45 000" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Units per carton</label>
            <Input type="number" value={bulkQty} onChange={e => setBulkQty(e.target.value)} placeholder="e.g. 30" />
          </div>
        </div>
        {bulkUnitCost != null && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-sm">
              <span className="text-stone-500">Unit cost: </span>
              <span className="font-semibold text-amber-900">{bulkUnitCost.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <button type="button"
              onClick={() => { setForm(f => ({ ...f, cost: bulkUnitCost })); setBulkTotal(''); setBulkQty(''); }}
              className="px-4 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex-shrink-0">
              Apply to cost
            </button>
          </div>
        )}
      </div>
      {Number(form.price) > 0 && Number(form.cost) > 0 && (
        <div className="-mt-1 mb-1 text-xs text-stone-500">
          Margin: <span className="font-medium text-rose-700">{(Number(form.price) - Number(form.cost)).toLocaleString()} FCFA</span>
          {' '}per unit ({Math.round(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100)}%)
        </div>
      )}

      {/* Variants: every style is sold as one or more size/color combos, each
          with its own SKU and stock count — price/cost above apply to all of
          them. A simple accessory with no real sizing just keeps one row.
          Shops that don't sell in sizes/colors can turn this off entirely in
          Settings ("Product variants") — the Quantity field near the top
          covers stock in that case, so nothing duplicates it here. */}
      {useVariants && (
        <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Variants (size / color)</div>
            <div className="text-xs text-stone-500">Total stock: <span className="font-semibold text-stone-700">{totalStock}</span></div>
          </div>
          <div className="space-y-2">
            {(form.variants || []).map((v, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-2 p-2.5 bg-white rounded-lg border border-stone-200">
                <div className="flex-1 min-w-[90px]">
                  <label className="block text-[11px] text-stone-500 mb-1">Size</label>
                  <Input value={v.size} onChange={e => updateVariant(idx, 'size', e.target.value)} placeholder="e.g. M" />
                </div>
                <div className="flex-1 min-w-[90px]">
                  <label className="block text-[11px] text-stone-500 mb-1">Color</label>
                  <Input value={v.color} onChange={e => updateVariant(idx, 'color', e.target.value)} placeholder="e.g. Black" />
                </div>
                <div className="flex-[1.4] min-w-[140px]">
                  <label className="block text-[11px] text-stone-500 mb-1">SKU</label>
                  <div className="flex gap-1">
                    <Input value={v.sku} onChange={e => updateVariant(idx, 'sku', e.target.value)} placeholder="auto-generated" />
                    <button type="button" onClick={() => generateVariantSku(idx)}
                      className="px-2.5 py-2 rounded-lg border border-stone-200 text-xs bg-stone-50 hover:bg-stone-100 flex-shrink-0">Gen</button>
                  </div>
                </div>
                <div className="w-20">
                  <label className="block text-[11px] text-stone-500 mb-1">Stock</label>
                  <Input type="number" value={v.stock} onChange={e => updateVariant(idx, 'stock', e.target.value)} />
                </div>
                <button type="button" onClick={() => removeVariantRow(idx)} disabled={(form.variants || []).length <= 1}
                  title={(form.variants || []).length <= 1 ? 'At least one variant is required' : 'Remove variant'}
                  className="p-2 text-stone-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-stone-500 mr-1">Quick add:</span>
            {QUICK_SIZES.map(s => (
              <button key={s} type="button"
                onClick={() => setForm(f => ({ ...f, variants: [...(f.variants || []), { size: s, color: '', sku: '', stock: 0 }] }))}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-stone-200 hover:border-rose-600 hover:bg-rose-50">
                {s}
              </button>
            ))}
            <button type="button" onClick={addVariantRow}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 border border-stone-200 hover:bg-stone-200">
              + Blank row
            </button>
          </div>
        </div>
      )}

      <Field label="Style SKU">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Input value={form.sku} onChange={set('sku')} placeholder="e.g. TOP-1234" disabled={autoGenerateSku} />
            <button type="button" onClick={handleGenerateSku}
              className="px-3 py-2 rounded-lg border border-stone-200 text-sm bg-stone-50 hover:bg-stone-100">Generate</button>
            <button type="button" onClick={printBarcode}
              className="px-3 py-2 rounded-lg border border-rose-300 text-sm bg-rose-50 text-rose-900 hover:bg-rose-100">Print barcode</button>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-stone-500">
            <input type="checkbox" checked={autoGenerateSku} onChange={(e) => handleToggleAutoSku(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500" />
            Generate SKU automatically
          </label>
        </div>
      </Field>
    </Modal>
  );
}

export function SupplierForm({ open, onClose, initial }) {
  const { upsertSupplier } = useData();
  const { toast } = useToast();
  const blank = { name: '', contact: '', phone: '', email: '', category: '', status: 'active', productsCount: 0 };
  const [form, setForm] = useState(initial || blank);
  useEffect(() => { setForm(initial || blank); }, [initial, open]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  // Requires connectivity — see note on ProductForm.save for why supplier
  // edits aren't queued offline.
  const save = async () => {
    try {
      const saved = initial?.id ? await api.updateSupplier(initial.id, form) : await api.createSupplier(form);
      upsertSupplier(saved);
      toast(initial?.id ? 'Supplier updated' : 'Supplier added');
      onClose();
    } catch (e) {
      toast(!e.status ? "Can't save while offline — try again once connected" : e.message, 'error');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit supplier' : 'Add supplier'}
      footer={<><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save}>Save</PrimaryBtn></>}>
      <Field label="Company name"><Input value={form.name} onChange={set('name')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact person"><Input value={form.contact} onChange={set('contact')} /></Field>
        <Field label="Category"><Input value={form.category} onChange={set('category')} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><Input value={form.email} onChange={set('email')} /></Field>
      </div>
      <Field label="Status"><SelectInput value={form.status} onChange={set('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Field>
    </Modal>
  );
}

export function UserForm({ open, onClose, initial }) {
  const { upsertUser } = useData();
  const { toast } = useToast();
  const blank = { name: '', username: '', role: 'cashier', email: '', store: 'Central', pin: '1234', whatsapp: '' };
  const [form, setForm] = useState(initial || blank);
  useEffect(() => { setForm(initial ? { ...initial, pin: '' } : blank); }, [initial, open]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  // Requires connectivity — user management is security-sensitive and not
  // something to queue blindly offline (see note on ProductForm.save).
  const save = async () => {
    if (!initial?.id && !/^\d{4,6}$/.test(String(form.pin || ''))) {
      toast('PIN must be 4–6 digits', 'error'); return;
    }
    try {
      const saved = initial?.id ? await api.updateUser(initial.id, form) : await api.createUser(form);
      upsertUser(saved);
      toast(initial?.id ? 'User updated' : 'User added');
      onClose();
    } catch (e) {
      toast(!e.status ? "Can't save while offline — try again once connected" : e.message, 'error');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit user' : 'Add user'}
      footer={<><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save}>Save</PrimaryBtn></>}>
      <Field label="Full name"><Input value={form.name} onChange={set('name')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username (for login)"><Input value={form.username || ''} onChange={set('username')} placeholder="e.g. paul" /></Field>
        <Field label="Email"><Input value={form.email} onChange={set('email')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role"><SelectInput value={form.role} onChange={set('role')} options={[{ value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' }, { value: 'cashier', label: 'Cashier' }, { value: 'accountant', label: 'Accountant' }]} /></Field>
        <Field label="Store"><Input value={form.store} onChange={set('store')} /></Field>
      </div>
      <Field label="WhatsApp number">
        <Input value={form.whatsapp || ''} onChange={set('whatsapp')} placeholder="+237 6XX XXX XXX" />
      </Field>
      <p className="text-xs text-stone-400 -mt-1 mb-1">Needs the country code (e.g. +237 677001122) — used by Settings &gt; Users &gt; "Notify via WhatsApp".</p>
      {!initial?.id
        ? <Field label="Login PIN (4–6 digits)"><Input value={form.pin} onChange={set('pin')} inputMode="numeric" placeholder="1234" /></Field>
        : <p className="text-xs text-stone-400 -mt-1">Use “Reset PIN” in the users table to change this user's PIN.</p>}
    </Modal>
  );
}

// Adds/edits a roster entry for the Staff register — sales-floor staff who
// never get a software login (see UserForm above for the 4 roles that do).
// Deliberately a plain text Role field, not a role <SelectInput>: this
// roster isn't limited to admin/manager/cashier/accountant.
export function EmployeeForm({ open, onClose, initial }) {
  const { upsertEmployee } = useData();
  const { toast } = useToast();
  const blank = { name: '', role: '', whatsapp: '' };
  const [form, setForm] = useState(initial || blank);
  useEffect(() => { setForm(initial || blank); }, [initial, open]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    if (!form.name?.trim()) { toast('Name is required', 'error'); return; }
    try {
      const saved = initial?.id ? await api.updateEmployee(initial.id, form) : await api.createEmployee(form);
      upsertEmployee(saved);
      toast(initial?.id ? 'Employee updated' : 'Employee added');
      onClose();
    } catch (e) {
      toast(!e.status ? "Can't save while offline — try again once connected" : e.message, 'error');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit employee' : 'Add employee'}
      footer={<><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save}>Save</PrimaryBtn></>}>
      <Field label="Full name"><Input value={form.name} onChange={set('name')} /></Field>
      <Field label="Role"><Input value={form.role} onChange={set('role')} placeholder="e.g. Salesperson, Stocker" /></Field>
      <Field label="WhatsApp number" hint="Needed to send this employee an attendance summary from Shifts">
        <Input value={form.whatsapp || ''} onChange={set('whatsapp')} placeholder="+237 6XX XXX XXX" />
      </Field>
    </Modal>
  );
}

export function POForm({ open, onClose }) {
  const { suppliers, upsertPO } = useData();
  const { toast } = useToast();
  const blank = { supplierId: suppliers[0]?.id || null, items: 1, total: 0, status: 'draft', dueDate: '' };
  const [form, setForm] = useState(blank);
  useEffect(() => { setForm({ ...blank, supplierId: suppliers[0]?.id || null }); }, [open]); // eslint-disable-line
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  // Requires connectivity — see note on ProductForm.save for why this isn't
  // queued offline.
  const save = async () => {
    const sup = suppliers.find(s => String(s.id) === String(form.supplierId));
    const payload = { supplierId: Number(form.supplierId), supplier: sup?.name || '', items: Number(form.items), total: Number(form.total), status: form.status, dueDate: form.dueDate || null };
    try {
      const saved = await api.createPurchaseOrder(payload);
      upsertPO(saved);
      toast('Purchase order created');
      onClose();
    } catch (e) {
      toast(!e.status ? "Can't save while offline — try again once connected" : e.message, 'error');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Create purchase order"
      footer={<><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save}>Create</PrimaryBtn></>}>
      <Field label="Supplier">
        <SelectInput value={form.supplierId || ''} onChange={set('supplierId')} options={suppliers.map(s => ({ value: s.id, label: s.name }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Items"><Input type="number" value={form.items} onChange={set('items')} /></Field>
        <Field label="Total (FCFA)"><Input type="number" value={form.total} onChange={set('total')} /></Field>
      </div>
      <Field label="Due date (optional)"><Input type="date" value={form.dueDate} onChange={set('dueDate')} /></Field>
    </Modal>
  );
}

/* ---------------- Auth: provider + login screen ---------------- */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // On load, if a token is saved, confirm it's still valid.
  useEffect(() => {
    const token = getToken();
    if (!token) { setChecking(false); return; }
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => { setToken(null); setUser(null); })
      .finally(() => setChecking(false));
  }, []);

  // While signed in, ping the backend every 45s so the admin's "who's online"
  // list (Settings > Users) knows this account is still active.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => { api.heartbeat().catch(() => {}); }, 45000);
    return () => clearInterval(id);
  }, [user]);

  const login = async (username, pin) => {
    const { token, user } = await api.login(username, pin);
    setToken(token);
    setUser(user);
    return user;
  };
  const logout = () => { setToken(null); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

// Login screen: username + PIN, with quick-pick suggestions of other users.
export function LoginScreen({ lang, setLang }) {
  const { login } = useAuth();
  const { toast } = useToast();
  const { settings } = useData();
  // Each shop's own name, from their own settings — this screen is shared
  // code across every shop on the platform, so it must never hardcode one
  // shop's name. Falls back to a neutral label for the brief moment before
  // settings finish loading (see DataProvider), rather than flashing
  // another shop's name.
  const shopName = settings?.businessName || 'Staff Sign-In';
  const [staff, setStaff] = useState([]);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.getStaff().then(setStaff).catch(() => setStaff([])); }, []);

  const colors = [
    'from-amber-400 to-rose-500', 'from-emerald-400 to-teal-600',
    'from-sky-400 to-indigo-600', 'from-fuchsia-400 to-purple-600',
    'from-orange-400 to-rose-500', 'from-cyan-400 to-blue-600',
  ];
  const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const submit = async () => {
    if (!username) { toast('Choose or type a username', 'error'); return; }
    if (!/^\d{4,6}$/.test(pin)) { toast('Enter your 4–6 digit PIN', 'error'); return; }
    setBusy(true);
    try { await login(username.trim(), pin); }
    catch (e) { toast(e.message || 'Login failed', 'error'); setPin(''); }
    finally { setBusy(false); }
  };

  const pick = (u) => { setUsername(u.username || ''); setPin(''); };
  const press = (d) => { if (!busy) setPin(p => (p + d).slice(0, 6)); };
  const back = () => setPin(p => p.slice(0, -1));

  // Lets the PIN be typed on a physical keyboard, not just clicked on the
  // on-screen keypad — skipped while the username field has focus so its
  // own typing (and the Enter-to-submit it already wires up) isn't hijacked.
  useEffect(() => {
    const handler = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (busy) return;
      if (e.key >= '0' && e.key <= '9') { press(e.key); return; }
      if (e.key === 'Backspace') { back(); return; }
      if (e.key === 'Enter') { submit(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, pin, username]);

  // The currently-typed user (to show their name nicely), plus everyone else as suggestions.
  const current = staff.find(s => (s.username || '').toLowerCase() === username.trim().toLowerCase());
  const others = staff.filter(s => s !== current);

  // Supplied supermarket photo, served from web/public so it's a plain static
  // asset (not bundled into the JS) — Vite serves anything in public/ at the
  // site root, so this is just /bg.jpg in both dev and the production build.
  // It's wide (1244x700, ~16:9) — wider than effectively every real device
  // viewport, so object-cover always preserves its full height (only the
  // sides ever get cropped), meaning the blurred aisle-and-produce backdrop
  // up top and the in-focus wooden counter along the bottom both stay fully
  // visible on any screen, unlike the previous photo's awkward portrait crop.
  const BG_IMAGE = '/bg.jpg';

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <img src={BG_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
      {/* A light overall tint keeps the photo in the brand palette; the radial
          darkening behind the card is what actually makes the white card and
          its text legible, without flattening the photo everywhere else. */}
      <div className="absolute inset-0 bg-rose-950/15" />
      {/* vmin-based sizing keeps the glow proportioned to the smaller screen
          dimension, so it stays a contained vignette behind the card instead
          of ballooning to cover a tall, narrow phone screen edge-to-edge. */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 34vmin 40vmin at center, rgba(4,30,23,0.55), transparent 70%)' }} />

      {/* Language can be chosen before signing in, not just from Settings
          afterward — it's the same lang/setLang state the rest of the app
          reads, so picking it here carries through once logged in. */}
      {setLang && (
        <div className="absolute top-4 right-4 z-20 flex items-center bg-white/15 backdrop-blur-sm border border-white/25 rounded-lg p-0.5 text-xs font-medium">
          <button onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-md transition-all ${lang === 'en' ? 'bg-white text-stone-900' : 'text-white/80 hover:text-white'}`}>
            EN
          </button>
          <button onClick={() => setLang('fr')}
            className={`px-2.5 py-1 rounded-md transition-all ${lang === 'fr' ? 'bg-white text-stone-900' : 'text-white/80 hover:text-white'}`}>
            FR
          </button>
        </div>
      )}

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.55)' }}>
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 mx-auto mb-3 flex items-center justify-center">
            <ShieldCheck className="text-white" size={26} />
          </div>
          <h1 className="text-2xl text-white" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{shopName}</h1>
          <p className="text-sm text-white/80 mt-1">Sign in to continue</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-2xl">
          {/* Username */}
          <label className="block text-xs font-medium text-stone-600 mb-1">Username</label>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 bg-gradient-to-br ${current ? colors[staff.indexOf(current) % colors.length] : 'from-stone-300 to-stone-400'}`}>
              {current ? initials(current.name) : <UserCircle2 size={18} />}
            </div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="Type your username"
              className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
          </div>

          {/* PIN dots + keypad */}
          <label className="block text-xs font-medium text-stone-600 mb-1">PIN</label>
          <div className="flex justify-center gap-3 my-3 h-4">
            {[0,1,2,3,4,5].map(i => i < Math.max(4, pin.length) && (
              <div key={i} className={`w-3 h-3 rounded-full ${pin.length > i ? 'bg-rose-700' : 'bg-stone-200'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => press(String(n))} disabled={busy}
                className="h-12 rounded-xl bg-stone-50 hover:bg-stone-100 text-lg font-medium text-stone-800 disabled:opacity-50">{n}</button>
            ))}
            <button onClick={back} disabled={busy} className="h-12 rounded-xl text-stone-500 hover:bg-stone-100 flex items-center justify-center"><Delete size={18} /></button>
            <button onClick={() => press('0')} disabled={busy} className="h-12 rounded-xl bg-stone-50 hover:bg-stone-100 text-lg font-medium text-stone-800 disabled:opacity-50">0</button>
            <button onClick={submit} disabled={busy} className="h-12 rounded-xl bg-rose-900 text-white hover:bg-rose-800 text-sm font-medium disabled:opacity-50">{busy ? '…' : 'Sign in'}</button>
          </div>
        </div>

        {/* Suggested users — always shown so it's easy to switch accounts */}
        {others.length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-wider text-white/70 font-medium mb-2 text-center" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
              {current ? 'Switch user' : 'Suggested users'}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {others.map((s, i) => (
                <button key={s.id} onClick={() => pick(s)}
                  className="flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-white/40 rounded-full pl-1 pr-3 py-1 hover:border-rose-600 hover:shadow-sm transition">
                  <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors[staff.indexOf(s) % colors.length]} flex items-center justify-center text-white text-[10px] font-semibold`}>{initials(s.name)}</span>
                  <span className="text-xs font-medium text-stone-700 pr-1">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-white/50 text-xs mt-6" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>© {new Date().getFullYear()} {shopName}</p>
      </div>
    </div>
  );
}

/* ---------------- Shop (platform) login ---------------- */
// This is a DIFFERENT login from LoginScreen above: it identifies WHICH
// SHOP this browser is about to use (username + real password, set once by
// the platform owner when they created the account), not which staff
// member is on the till. It must succeed before LoginScreen's PIN pad even
// makes sense — see PlatformGate in DialloPOS.jsx, which renders this
// until a tenant token exists.
export function PlatformLogin({ onSuccess }) {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!username.trim()) { toast('Enter your shop username', 'error'); return; }
    if (!password) { toast('Enter your shop password', 'error'); return; }
    setBusy(true);
    try {
      const { token, shopName, slug } = await api.platformLogin(username.trim(), password);
      setTenantToken(token);
      onSuccess({ shopName, slug });
    } catch (e) {
      toast(e.message || 'Sign in failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-stone-950">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 40vmin 46vmin at center, rgba(190,18,60,0.20), transparent 70%)' }} />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 mx-auto mb-3 flex items-center justify-center">
            <Building2 className="text-white" size={26} />
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-rose-300/80 font-medium mb-1">CamPOS Fashion</div>
          <h1 className="text-2xl text-white" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Sign in to your shop</h1>
          <p className="text-sm text-white/60 mt-1">The username and password you were given when your account was set up</p>
        </div>

        <form onSubmit={submit} className="bg-white/95 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-2xl space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Shop username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
              placeholder="e.g. riskyc"
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
              <button type="button" onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={busy}
            className="w-full py-2.5 mt-1 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800 disabled:opacity-50">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* The platform's OWN name (CamPOS Fashion), not any one shop's —
            this screen runs before a shop is identified, shared by every
            shop on the platform, so it must never show one shop's brand. */}
        <p className="text-center text-white/40 text-xs mt-6">© {new Date().getFullYear()} CamPOS Fashion</p>
      </div>
    </div>
  );
}

// Ends both the tenant session AND the staff session ON THIS DEVICE ONLY,
// back to the shop login screen — purely local (clears this browser's own
// localStorage), so it never touches or signs out any other device/staff
// member elsewhere in the shop. Needed for switching to an entirely
// different BUSINESS account (a different shop on the platform), not the
// same thing as the branch/store-location switcher in the top bar (which
// changes currentStoreId without signing anyone out — see StoreContext in
// DialloPOS.jsx). Clearing the staff session here (not just the shop
// session) is a safety requirement, not just tidiness: a staff PIN token
// is only meaningful within the shop database it was issued against, so
// carrying it into a different shop risks resolving to a different real
// person who happens to share that numeric user id.
export function switchShop() {
  setTenantToken(null);
  setToken(null);
  window.location.reload();
}
