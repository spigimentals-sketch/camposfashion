// CatalogPage.jsx — a shop's public, shareable product catalog. This is
// the ONE page in the whole app that runs with zero credentials: no shop
// login, no staff PIN, nothing in localStorage read or written. It talks
// to exactly one endpoint (GET /api/catalog/:slug, see
// server/src/routes/catalog.js) with a plain fetch — deliberately not
// api.js or adminApi.js, so this page can never accidentally carry a
// tenant/staff/admin token even by refactor-accident later.
import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Package } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '';
const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

function imageUrl(p) {
  if (!p) return null;
  if (p.startsWith('http') || p.startsWith('data:')) return p;
  return `${BASE}${p}`;
}

export default function CatalogPage({ slug }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [activeCat, setActiveCat] = useState('all');

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/catalog/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('not_found');
        return res.json();
      })
      .then((data) => { if (!cancelled) setState({ loading: false, error: null, data }); })
      .catch(() => { if (!cancelled) setState({ loading: false, error: true, data: null }); });
    return () => { cancelled = true; };
  }, [slug]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-400 text-sm">
        Loading…
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-stone-200 mx-auto mb-4 flex items-center justify-center">
            <Package size={24} className="text-stone-400" />
          </div>
          <h1 className="text-lg font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>Catalog not available</h1>
          <p className="text-sm text-stone-500 mt-1">This link may be out of date, or the shop hasn't shared their catalog.</p>
        </div>
      </div>
    );
  }

  const { shopName, address, phone, products } = state.data;
  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = activeCat === 'all' ? products : products.filter((p) => p.category === activeCat);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-4 py-5 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{shopName}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-stone-500">
            {address && <span className="flex items-center gap-1"><MapPin size={12} /> {address}</span>}
            {phone && <span className="flex items-center gap-1"><Phone size={12} /> {phone}</span>}
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
          <div className="text-center text-sm text-stone-400 py-16">Nothing in stock right now — check back soon.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((p) => {
              const sizes = Array.from(new Set(p.variants.map((v) => v.size).filter(Boolean)));
              const colors = Array.from(new Set(p.variants.map((v) => v.color).filter(Boolean)));
              return (
                <div key={p.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden flex flex-col">
                  <div className="aspect-square bg-stone-100 flex items-center justify-center text-4xl overflow-hidden">
                    {p.image ? <img src={imageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" /> : (p.emoji || <Package size={28} className="text-stone-300" />)}
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="text-sm font-medium text-stone-900 leading-snug">{p.name}</div>
                    <div className="text-sm font-semibold text-rose-900 mt-1" style={{ fontFamily: "'Fraunces', serif" }}>{fmt(p.price)}</div>
                    {(sizes.length > 0 || colors.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {sizes.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-medium">{s}</span>
                        ))}
                        {colors.map((c) => (
                          <span key={c} className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-medium">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
