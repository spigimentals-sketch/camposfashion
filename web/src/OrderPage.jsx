// OrderPage.jsx — a shop's public, shareable self-service ordering page.
// Like CatalogPage.jsx, this runs with zero credentials: no shop login, no
// staff PIN, nothing in localStorage. Talks to exactly two endpoints with a
// plain fetch (GET/POST /api/order/:slug, see server/src/routes/onlineOrder.js)
// — deliberately not api.js, so this page can never accidentally carry a
// tenant/staff token even by refactor-accident later.
//
// Submitting an order here does NOT complete a sale — it reserves stock and
// drops a pending request the shop's staff must confirm once they've
// actually seen the mobile money land (see OnlineOrdersView in
// DialloPOS.jsx). The customer is told that plainly before they submit.
import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Phone, Package, ShoppingCart, Plus, Minus, X, CheckCircle2, AlertTriangle, Clock, Download, Search } from 'lucide-react';
// buildReceiptImage is a pure canvas-drawing function with no network/token
// logic of its own — safe to import from shared.jsx without pulling in any
// of api.js's token handling into this page, which still only ever talks
// to the server via its own plain `fetch` calls below, never api.js's
// request helper.
import { buildReceiptImage } from './shared.jsx';

const BASE = import.meta.env.VITE_API_URL || '';
const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

function imageUrl(p) {
  if (!p) return null;
  if (p.startsWith('http') || p.startsWith('data:')) return p;
  return `${BASE}${p}`;
}

// A proper product view instead of a tiny "pick a variant" popup — tapping
// any product card opens this: bigger image, size/color buttons shown
// right away (not hidden behind a second tap), a quantity stepper, then
// Add to cart. Matches the size-picker-first flow of the shop's real
// storefront (riskycfashion.com) rather than a bare list of options.
function ProductDetailModal({ product, cartQtyFor, onClose, onAdd }) {
  const sizes = Array.from(new Set(product.variants.map((v) => v.size).filter(Boolean)));
  const colors = Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean)));
  // Single-variant products (the common case for a simple accessory) have
  // nothing to pick — select it automatically so Add to cart works right
  // away instead of making someone tap a redundant one-item list.
  const [selectedSize, setSelectedSize] = useState(sizes.length === 1 ? sizes[0] : null);
  const [selectedColor, setSelectedColor] = useState(colors.length === 1 ? colors[0] : null);
  const [qty, setQty] = useState(1);

  const matchVariant = (size, color) => product.variants.find((v) =>
    (size ? v.size === size : !v.size) && (color ? v.color === color : !v.color));
  // Auto-resolve when only one axis actually varies (e.g. every variant is
  // the same color, sizes differ) so picking the size alone is enough.
  const resolvedVariant = product.variants.length === 1 ? product.variants[0]
    : matchVariant(selectedSize, selectedColor) || (sizes.length <= 1 && colors.length <= 1 ? product.variants[0] : null);

  useEffect(() => { setQty(1); }, [resolvedVariant?.id]);

  const availableForSelection = resolvedVariant?.stock ?? 0;
  const alreadyInCart = resolvedVariant ? cartQtyFor(resolvedVariant.id) : 0;
  const canAddMore = resolvedVariant && (alreadyInCart + qty) <= availableForSelection;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:w-[420px] max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-square bg-stone-100 flex items-center justify-center text-6xl overflow-hidden relative">
          {product.image ? <img src={imageUrl(product.image)} alt={product.name} className="w-full h-full object-cover" /> : (product.emoji || <Package size={40} className="text-stone-300" />)}
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-full text-stone-600 hover:bg-white"><X size={16} /></button>
        </div>
        <div className="p-5">
          <div className="text-xs text-stone-400 uppercase tracking-wide">{product.category}</div>
          <div className="text-lg font-semibold text-stone-900 mt-0.5" style={{ fontFamily: "'Fraunces', serif" }}>{product.name}</div>
          <div className="text-xl font-semibold text-rose-900 mt-1" style={{ fontFamily: "'Fraunces', serif" }}>{fmt(product.price)}</div>

          {sizes.length > 0 && (
            <div className="mt-5">
              <div className="text-xs font-medium text-stone-600 mb-2">Size: {selectedSize && <span className="text-rose-700">{selectedSize}</span>}</div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const stockForSize = product.variants.filter((v) => v.size === s && (!selectedColor || v.color === selectedColor)).reduce((sum, v) => sum + v.stock, 0);
                  return (
                    <button key={s} onClick={() => setSelectedSize(s)} disabled={stockForSize <= 0}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        selectedSize === s ? 'border-rose-600 bg-rose-600 text-white' : 'border-stone-200 text-stone-700 hover:border-rose-300'
                      }`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-stone-600 mb-2">Color: {selectedColor && <span className="text-rose-700">{selectedColor}</span>}</div>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const stockForColor = product.variants.filter((v) => v.color === c && (!selectedSize || v.size === selectedSize)).reduce((sum, v) => sum + v.stock, 0);
                  return (
                    <button key={c} onClick={() => setSelectedColor(c)} disabled={stockForColor <= 0}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        selectedColor === c ? 'border-rose-600 bg-rose-600 text-white' : 'border-stone-200 text-stone-700 hover:border-rose-300'
                      }`}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3">
            <div>
              <div className="text-xs text-stone-500">Quantity</div>
              <div className="text-[11px] text-stone-400">{resolvedVariant ? `${availableForSelection} available` : 'Choose options above'}</div>
            </div>
            <div className="flex items-center gap-2 bg-stone-100 rounded-lg p-1">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-md hover:bg-white flex items-center justify-center"><Minus size={14} /></button>
              <span className="w-8 text-center font-medium">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(availableForSelection - alreadyInCart, q + 1))}
                disabled={!resolvedVariant || qty >= availableForSelection - alreadyInCart}
                className="w-8 h-8 rounded-md hover:bg-white flex items-center justify-center disabled:opacity-30"><Plus size={14} /></button>
            </div>
          </div>

          <button onClick={() => { onAdd(product, resolvedVariant, qty); onClose(); }} disabled={!canAddMore}
            className="w-full mt-4 py-3 bg-rose-900 text-white rounded-xl text-sm font-medium hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Plus size={15} /> {!resolvedVariant ? 'Choose options above' : availableForSelection <= 0 ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage({ slug }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // { variantId, productId, name, price, size, color, qty, maxStock }
  const [detailProduct, setDetailProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmation, setConfirmation] = useState(null); // { id, code }
  // ?order=<id> in the URL — set automatically after a submit (see the
  // confirmation screen's "Track this order" link) so a customer can come
  // back later, check whether the shop confirmed yet, and download a
  // receipt once it's confirmed, without any account/login of their own.
  const [trackId, setTrackId] = useState(() => new URLSearchParams(window.location.search).get('order'));
  const [tracked, setTracked] = useState({ loading: !!trackId, error: null, data: null });
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/order/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('not_found');
        return res.json();
      })
      .then((data) => { if (!cancelled) setState({ loading: false, error: null, data }); })
      .catch(() => { if (!cancelled) setState({ loading: false, error: true, data: null }); });
    return () => { cancelled = true; };
  }, [slug]);

  const loadTracked = (id) => {
    setTracked({ loading: true, error: null, data: null });
    fetch(`${BASE}/api/order/${encodeURIComponent(slug)}/status/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('not_found');
        return res.json();
      })
      .then((data) => setTracked({ loading: false, error: null, data }))
      .catch(() => setTracked({ loading: false, error: true, data: null }));
  };
  useEffect(() => { if (trackId) loadTracked(trackId); }, [trackId]); // eslint-disable-line

  const downloadReceipt = () => {
    const o = tracked.data;
    if (!o) return;
    setDownloadingReceipt(true);
    try {
      const dataUrl = buildReceiptImage({
        items: o.items, subtotal: o.subtotal, total: o.subtotal,
        customer: { name: o.customerName }, method: 'mobile', invoiceNo: `ORD-${o.id}`,
      }, { businessName: o.shopName, address: o.address, phone: o.phone });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `receipt-ORD-${o.id}.jpg`;
      a.click();
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const total = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  const cartQtyFor = (variantId) => cart.find((it) => it.variantId === variantId)?.qty || 0;
  const addToCart = (product, variant, addQty = 1) => {
    if (!variant) return;
    setCart((prev) => {
      const existing = prev.find((it) => it.variantId === variant.id);
      if (existing) {
        return prev.map((it) => it.variantId === variant.id
          ? { ...it, qty: Math.min(variant.stock, it.qty + addQty) }
          : it);
      }
      return [...prev, {
        variantId: variant.id, productId: product.id, name: product.name,
        price: product.price, size: variant.size, color: variant.color,
        qty: Math.min(variant.stock, addQty), maxStock: variant.stock,
      }];
    });
  };
  const changeQty = (variantId, delta) => {
    setCart((prev) => prev
      .map((it) => it.variantId === variantId ? { ...it, qty: Math.max(0, Math.min(it.maxStock, it.qty + delta)) } : it)
      .filter((it) => it.qty > 0));
  };

  const submitOrder = async () => {
    if (!form.customerName.trim()) { setSubmitError('Please enter your name'); return; }
    if (!form.customerPhone.trim()) { setSubmitError('Please enter your phone number'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${BASE}/api/order/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim(),
          note: form.note.trim() || undefined,
          items: cart.map((it) => ({ variantId: it.variantId, qty: it.qty })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not submit your order');
      setConfirmation({ id: body.id, code: body.code });
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (state.loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-400 text-sm">Loading…</div>;
  }
  if (state.error || !state.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-stone-200 mx-auto mb-4 flex items-center justify-center">
            <Package size={24} className="text-stone-400" />
          </div>
          <h1 className="text-lg font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>Ordering not available</h1>
          <p className="text-sm text-stone-500 mt-1">This link may be out of date, or the shop hasn't turned on online ordering.</p>
        </div>
      </div>
    );
  }

  if (confirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="text-center max-w-sm bg-white border border-stone-200 rounded-2xl p-8">
          <div className="w-14 h-14 rounded-full bg-emerald-50 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 size={26} className="text-emerald-600" />
          </div>
          <h1 className="text-lg font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>Order submitted</h1>
          <p className="text-sm text-stone-500 mt-2">Your reference is <span className="font-mono font-medium text-stone-700">{confirmation.code}</span>. The shop will confirm your order once they've received your payment.</p>
          <button onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('order', confirmation.id);
            window.history.replaceState({}, '', url);
            setTrackId(String(confirmation.id));
            setConfirmation(null);
          }} className="mt-5 w-full px-4 py-2 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800">
            Track this order
          </button>
          <button onClick={() => setConfirmation(null)} className="mt-2 w-full px-4 py-2 text-stone-500 text-sm font-medium hover:text-stone-700">
            Place another order
          </button>
        </div>
      </div>
    );
  }

  // Tracking a specific order (?order=<id>) — a customer revisiting the
  // link they got after submitting. Status "confirmed" is what unlocks the
  // self-service receipt download they're expected to show when picking up
  // their items; "pending" just means the shop hasn't confirmed payment
  // yet, "rejected" means it won't be fulfilled.
  if (trackId) {
    const backToShopping = () => { setTrackId(null); window.history.replaceState({}, '', window.location.pathname); };
    if (tracked.loading) {
      return <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-400 text-sm">Loading…</div>;
    }
    if (tracked.error || !tracked.data) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
          <div className="text-center max-w-sm">
            <h1 className="text-lg font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>Order not found</h1>
            <p className="text-sm text-stone-500 mt-1">This reference doesn't match any order for this shop.</p>
            <button onClick={backToShopping} className="mt-4 px-4 py-2 bg-rose-900 text-white rounded-lg text-sm font-medium hover:bg-rose-800">Back to shopping</button>
          </div>
        </div>
      );
    }
    const o = tracked.data;
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="max-w-sm w-full bg-white border border-stone-200 rounded-2xl p-6">
          <div className="text-center mb-4">
            <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${
              o.status === 'confirmed' ? 'bg-emerald-50' : o.status === 'rejected' ? 'bg-rose-50' : 'bg-amber-50'
            }`}>
              {o.status === 'confirmed' ? <CheckCircle2 size={26} className="text-emerald-600" />
                : o.status === 'rejected' ? <X size={26} className="text-rose-600" />
                : <Clock size={26} className="text-amber-600" />}
            </div>
            <h1 className="text-lg font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>
              {o.status === 'confirmed' ? 'Order confirmed' : o.status === 'rejected' ? 'Order rejected' : 'Waiting for confirmation'}
            </h1>
            <p className="text-xs text-stone-500 mt-1">Order ORD-{o.id} · {o.shopName}</p>
          </div>
          <div className="bg-stone-50 rounded-xl p-3 mb-4 space-y-1">
            {o.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-stone-700">{it.qty} × {it.name}{(it.size || it.color) ? ` (${[it.size, it.color].filter(Boolean).join(' / ')})` : ''}</span>
                <span className="text-stone-500">{fmt(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-semibold text-stone-900 mb-5">
            <span>Total</span><span style={{ fontFamily: "'Fraunces', serif" }}>{fmt(o.subtotal)}</span>
          </div>
          {o.status === 'confirmed' && (
            <button onClick={downloadReceipt} disabled={downloadingReceipt}
              className="w-full py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2 mb-2">
              <Download size={15} /> {downloadingReceipt ? 'Preparing…' : 'Download receipt'}
            </button>
          )}
          {o.status === 'pending' && (
            <p className="text-xs text-stone-500 text-center mb-2">Check back once you've sent your payment and the shop has confirmed it.</p>
          )}
          <button onClick={() => loadTracked(trackId)} className="w-full py-2 text-xs text-stone-500 hover:text-stone-700">Refresh status</button>
          <button onClick={backToShopping} className="w-full py-2 text-xs text-stone-400 hover:text-stone-600">Back to shopping</button>
        </div>
      </div>
    );
  }

  const { shopName, address, phone, paymentNumber, paymentInstructions, products } = state.data;
  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];
  const q = search.trim().toLowerCase();
  const filtered = products
    .filter((p) => activeCat === 'all' || p.category === activeCat)
    .filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="bg-white border-b border-stone-200 px-4 py-5 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{shopName}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-stone-500">
            {address && <span className="flex items-center gap-1"><MapPin size={12} /> {address}</span>}
            {phone && <span className="flex items-center gap-1"><Phone size={12} /> {phone}</span>}
          </div>
          <p className="text-xs text-stone-400 mt-2">Pick what you want below, then pay by mobile money at checkout — the shop confirms your order once they've received it.</p>
          <div className="relative mt-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…"
              className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600 focus:bg-white" />
          </div>
        </div>
      </div>

      {categories.length > 2 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${activeCat === c ? 'bg-rose-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300'}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-stone-400 py-16">
            {q ? `Nothing matches "${search}".` : 'Nothing in stock right now — check back soon.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((p) => {
              const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
              const inCart = cart.filter((it) => it.productId === p.id).reduce((s, it) => s + it.qty, 0);
              const sizeCount = new Set(p.variants.map((v) => v.size).filter(Boolean)).size;
              const colorCount = new Set(p.variants.map((v) => v.color).filter(Boolean)).size;
              return (
                <button key={p.id} onClick={() => setDetailProduct(p)} disabled={totalStock <= 0}
                  className="bg-white rounded-xl border border-stone-200 overflow-hidden flex flex-col text-left hover:border-rose-300 hover:shadow-sm transition-all disabled:opacity-50">
                  <div className="aspect-square bg-stone-100 flex items-center justify-center text-4xl overflow-hidden">
                    {p.image ? <img src={imageUrl(p.image)} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : (p.emoji || <Package size={28} className="text-stone-300" />)}
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="text-sm font-medium text-stone-900 leading-snug">{p.name}</div>
                    <div className="text-sm font-semibold text-rose-900 mt-1" style={{ fontFamily: "'Fraunces', serif" }}>{fmt(p.price)}</div>
                    {(sizeCount > 1 || colorCount > 1) && (
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        {sizeCount > 1 ? `${sizeCount} sizes` : ''}{sizeCount > 1 && colorCount > 1 ? ' · ' : ''}{colorCount > 1 ? `${colorCount} colors` : ''}
                      </div>
                    )}
                    <div className="mt-auto pt-2 text-xs font-medium text-rose-700 flex items-center gap-1">
                      {totalStock <= 0 ? <span className="text-stone-400">Out of stock</span>
                        : inCart > 0 ? `${inCart} in cart — tap to add more` : 'Tap to choose options'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {detailProduct && (
        <ProductDetailModal product={detailProduct} cartQtyFor={cartQtyFor}
          onClose={() => setDetailProduct(null)} onAdd={addToCart} />
      )}

      {/* Floating cart bar */}
      {itemCount > 0 && !cartOpen && !checkoutOpen && (
        <button onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 bg-rose-900 text-white rounded-2xl shadow-xl px-5 py-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium"><ShoppingCart size={16} /> {itemCount} item{itemCount === 1 ? '' : 's'}</span>
          <span className="font-serif font-semibold" style={{ fontFamily: "'Fraunces', serif" }}>{fmt(total)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCartOpen(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:w-[420px] max-h-[85vh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
              <div className="font-medium text-stone-900">Your cart</div>
              <button onClick={() => setCartOpen(false)} className="p-1 text-stone-400 hover:text-stone-600"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center text-sm text-stone-400 py-8">Your cart is empty.</div>
              ) : cart.map((it) => (
                <div key={it.variantId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-900 truncate">{it.name}</div>
                    {(it.size || it.color) && <div className="text-xs text-stone-400">{[it.size, it.color].filter(Boolean).join(' / ')}</div>}
                    <div className="text-xs text-stone-500">{fmt(it.price)}</div>
                  </div>
                  <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5 flex-shrink-0">
                    <button onClick={() => changeQty(it.variantId, -1)} className="w-6 h-6 rounded-md hover:bg-white flex items-center justify-center"><Minus size={12} /></button>
                    <span className="w-7 text-center text-sm font-medium">{it.qty}</span>
                    <button onClick={() => changeQty(it.variantId, 1)} disabled={it.qty >= it.maxStock} className="w-6 h-6 rounded-md hover:bg-white flex items-center justify-center disabled:opacity-30"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-stone-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-stone-600">Total</span>
                  <span className="font-serif text-lg font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>{fmt(total)}</span>
                </div>
                <button onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                  className="w-full py-2.5 bg-rose-900 text-white rounded-xl text-sm font-medium hover:bg-rose-800">
                  Proceed to pay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !submitting && setCheckoutOpen(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:w-[420px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div className="font-medium text-stone-900">Pay & submit your order</div>
              <button onClick={() => setCheckoutOpen(false)} className="p-1 text-stone-400 hover:text-stone-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Step 1 — Send payment</div>
                <div className="text-sm text-amber-900">
                  Send <span className="font-semibold">{fmt(total)}</span> via mobile money to:
                </div>
                {paymentNumber && <div className="font-mono text-base font-semibold text-amber-900 mt-1">{paymentNumber}</div>}
                {paymentInstructions && <div className="text-xs text-amber-800 mt-1.5">{paymentInstructions}</div>}
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">Step 2 — Tell us it's done</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Your name</label>
                    <input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Your phone number</label>
                    <input value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                      placeholder="+237 6XX XXX XXX"
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Note (optional)</label>
                    <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder="e.g. delivery address"
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-rose-600" />
                  </div>
                </div>
              </div>
              {submitError && (
                <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {submitError}
                </div>
              )}
              <button onClick={submitOrder} disabled={submitting}
                className="w-full py-2.5 bg-rose-900 text-white rounded-xl text-sm font-medium hover:bg-rose-800 disabled:opacity-50">
                {submitting ? 'Submitting…' : "I've sent the payment — Submit order"}
              </button>
              <p className="text-[11px] text-stone-400 text-center">Your order isn't final until the shop confirms they've received your payment.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
