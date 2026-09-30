// AdminApp.jsx — the platform owner's own panel: create shops, suspend or
// reactivate them for non-payment. Deliberately a separate app root (see
// main.jsx — served at /admin) from the shop POS itself: it never mounts
// AuthProvider/DataProvider/anything that could fetch a shop's own sales,
// products, or customers. It only ever talks to /api/admin/* via
// adminApi.js, which never sends or receives a shop token.
import React, { useState, useEffect } from 'react';
import { Building2, Plus, Lock, Eye, EyeOff, LogOut, X, CheckCircle2, Ban, Users, Trash2, Pencil } from 'lucide-react';
import { ToastProvider, useToast, Modal, Field, Input, PrimaryBtn, GhostBtn } from './shared.jsx';
import adminApi, { getAdminToken, setAdminToken, getAdminIdentity, setAdminIdentity } from './adminApi.js';

function AdminLogin({ onSuccess }) {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!username.trim() || !password) { toast('Enter your admin username and password', 'error'); return; }
    setBusy(true);
    try {
      const { token, id, username: uname } = await adminApi.login(username.trim(), password);
      setAdminToken(token);
      setAdminIdentity({ id, username: uname });
      onSuccess();
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
          <h1 className="text-2xl text-white" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Platform Admin</h1>
          <p className="text-sm text-white/60 mt-1">Create and manage shop accounts</p>
        </div>
        <form onSubmit={submit} className="bg-white/95 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-2xl space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
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
      </div>
    </div>
  );
}

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function NewShopModal({ open, onClose, onCreated }) {
  const { toast } = useToast();
  const blank = { shopName: '', slug: '', username: '', password: '', ownerName: '', ownerUsername: 'admin', ownerPin: '1234' };
  const [form, setForm] = useState(blank);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setForm(blank); setSlugTouched(false); } }, [open]); // eslint-disable-line

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === 'shopName' && !slugTouched ? { slug: slugify(v) } : {}) }));
  };

  const save = async () => {
    if (!form.shopName || !form.username || !form.password || !form.ownerName) {
      toast('Fill in the shop name, shop login, and owner name', 'error'); return;
    }
    setSaving(true);
    try {
      await adminApi.createTenant(form);
      toast(`"${form.shopName}" created`);
      onCreated();
      onClose();
    } catch (e) {
      toast(e.message || 'Could not create shop', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New shop"
      footer={<><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create shop'}</PrimaryBtn></>}>
      <div className="space-y-3">
        <Field label="Shop name"><Input value={form.shopName} onChange={set('shopName')} placeholder="e.g. Bella Boutique" /></Field>
        <Field label="Slug" hint="Used internally for their database/files — auto-filled, edit only if you need to">
          <Input value={form.slug} onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shop login username"><Input value={form.username} onChange={set('username')} /></Field>
          <Field label="Shop login password"><Input value={form.password} onChange={set('password')} placeholder="min. 6 characters" /></Field>
        </div>
        <div className="h-px bg-stone-100 my-1" />
        <div className="text-xs font-medium text-stone-500">First staff account (the shop owner signs in with this PIN once inside)</div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Owner name"><Input value={form.ownerName} onChange={set('ownerName')} /></Field>
          <Field label="Staff username"><Input value={form.ownerUsername} onChange={set('ownerUsername')} /></Field>
          <Field label="PIN"><Input value={form.ownerPin} onChange={set('ownerPin')} maxLength={6} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function EditShopModal({ tenant, onClose, onSaved }) {
  const { toast } = useToast();
  const [shopName, setShopName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant) { setShopName(tenant.shopName); setUsername(tenant.username); setPassword(''); }
  }, [tenant]);

  const save = async () => {
    if (!shopName || !username) { toast('Shop name and username are required', 'error'); return; }
    if (password && password.length < 6) { toast('New password must be at least 6 characters', 'error'); return; }
    setSaving(true);
    try {
      await adminApi.updateTenant(tenant.id, { shopName, username, password: password || undefined });
      toast(`"${shopName}" updated`);
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Could not save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!tenant} onClose={onClose} title="Edit shop"
      footer={<><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</PrimaryBtn></>}>
      <div className="space-y-3">
        <Field label="Shop name"><Input value={shopName} onChange={(e) => setShopName(e.target.value)} autoFocus /></Field>
        <Field label="Shop login username"><Input value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
        <Field label="New password" hint="Leave blank to keep their current password">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" />
        </Field>
        <div className="text-[11px] text-stone-400">Slug: <span className="font-mono">{tenant?.slug}</span> (fixed — this is their database/file path, not editable)</div>
      </div>
    </Modal>
  );
}

// Unlike Suspend (reversible — just locks them out), this permanently wipes
// the shop's database and uploaded photos. Typing the slug back — rather
// than a plain window.confirm() — is the guard against a stray click on
// real, paying-shop data; the server independently re-checks the same
// value, so this modal isn't the only thing standing between a click and
// data loss.
function DeleteShopModal({ tenant, onClose, onDeleted }) {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setConfirmText(''); }, [tenant]);

  const remove = async () => {
    if (confirmText !== tenant.slug) return;
    setDeleting(true);
    try {
      await adminApi.deleteTenant(tenant.id, confirmText);
      toast(`"${tenant.shopName}" deleted permanently`);
      onDeleted();
      onClose();
    } catch (e) {
      toast(e.message || 'Could not delete shop', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={!!tenant} onClose={onClose} title="Delete shop"
      footer={<>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button onClick={remove} disabled={deleting || confirmText !== tenant?.slug}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed">
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </button>
      </>}>
      <div className="space-y-3">
        <p className="text-sm text-stone-600">
          This permanently deletes <strong>{tenant?.shopName}</strong> — every product, sale, customer,
          and uploaded photo. There is no backup and this cannot be undone. If you just want to lock
          them out without losing their data, use <strong>Suspend</strong> instead.
        </p>
        <Field label={<>Type <span className="font-mono">{tenant?.slug}</span> to confirm</>}>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus placeholder={tenant?.slug} />
        </Field>
      </div>
    </Modal>
  );
}

function AddAdminModal({ open, onClose, onCreated }) {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setUsername(''); setPassword(''); } }, [open]);

  const save = async () => {
    if (!username.trim() || !password) { toast('Enter a username and password', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setSaving(true);
    try {
      await adminApi.createAdmin(username.trim(), password);
      toast(`"${username.trim()}" can now sign into this panel`);
      onCreated();
      onClose();
    } catch (e) {
      toast(e.message || 'Could not create admin', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New admin"
      footer={<><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create admin'}</PrimaryBtn></>}>
      <div className="space-y-3">
        <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></Field>
        <Field label="Password" hint="Share this with them yourself — it's only shown once">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" />
        </Field>
      </div>
    </Modal>
  );
}

function EditAdminModal({ admin, onClose, onSaved }) {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (admin) { setUsername(admin.username); setPassword(''); }
  }, [admin]);

  const save = async () => {
    if (!username) { toast('Username is required', 'error'); return; }
    if (password && password.length < 6) { toast('New password must be at least 6 characters', 'error'); return; }
    setSaving(true);
    try {
      const updated = await adminApi.updateAdmin(admin.id, { username, password: password || undefined });
      toast(`"${username}" updated`);
      onSaved(updated);
      onClose();
    } catch (e) {
      toast(e.message || 'Could not save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!admin} onClose={onClose} title="Edit admin"
      footer={<><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</PrimaryBtn></>}>
      <div className="space-y-3">
        <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></Field>
        <Field label="New password" hint="Leave blank to keep their current password">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" />
        </Field>
      </div>
    </Modal>
  );
}

function AdminsSection() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const me = getAdminIdentity();

  const load = () => adminApi.getAdmins().then(setAdmins).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const remove = async (a) => {
    if (!window.confirm(`Remove "${a.username}"'s access to this panel?`)) return;
    try {
      await adminApi.deleteAdmin(a.id);
      toast(`${a.username} removed`);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>Admins</h1>
          <p className="text-sm text-stone-500 mt-0.5">People who can sign into this panel — not shop staff, just this</p>
        </div>
        <PrimaryBtn onClick={() => setShowNew(true)}><span className="flex items-center gap-1.5"><Plus size={15} /> New admin</span></PrimaryBtn>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-100">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {admins === null ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
            ) : admins.map((a) => (
              <tr key={a.id} className="border-b border-stone-50 last:border-0">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {a.username}{me?.id === a.id && <span className="ml-2 text-[11px] text-stone-400 font-normal">(you)</span>}
                </td>
                <td className="px-4 py-3 text-stone-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => setEditing(a)} className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1">
                      <Pencil size={12} /> Edit
                    </button>
                    {me?.id !== a.id && (
                      <button onClick={() => remove(a)} className="text-xs font-medium text-rose-600 hover:text-rose-800 inline-flex items-center gap-1">
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddAdminModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
      <EditAdminModal admin={editing} onClose={() => setEditing(null)}
        onSaved={(updated) => { load(); if (me?.id === updated.id) setAdminIdentity({ id: updated.id, username: updated.username }); }} />
    </div>
  );
}

function AdminDashboard({ onLogout }) {
  const { toast } = useToast();
  const [tab, setTab] = useState('shops');
  const [tenants, setTenants] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = () => adminApi.getTenants().then(setTenants).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const toggleStatus = async (t) => {
    const next = t.status === 'active' ? 'suspended' : 'active';
    const verb = next === 'suspended' ? 'Suspend' : 'Reactivate';
    if (!window.confirm(`${verb} "${t.shopName}"? ${next === 'suspended' ? 'They will be signed out and unable to log in until reactivated.' : 'They will be able to log in again immediately.'}`)) return;
    try {
      await adminApi.setTenantStatus(t.id, next);
      toast(`${t.shopName} ${next === 'suspended' ? 'suspended' : 'reactivated'}`);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-stone-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center"><Building2 size={16} className="text-white" /></div>
          <span className="font-semibold text-stone-900">CamPOS Fashion <span className="font-normal text-stone-400">— Admin</span></span>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1 mb-5 w-fit">
          {[{ id: 'shops', label: 'Shops', icon: Building2 }, { id: 'admins', label: 'Admins', icon: Users }].map((o) => {
            const Icon = o.icon;
            return (
              <button key={o.id} onClick={() => setTab(o.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${tab === o.id ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}>
                <Icon size={14} /> {o.label}
              </button>
            );
          })}
        </div>

        {tab === 'shops' ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>Shops</h1>
                <p className="text-sm text-stone-500 mt-0.5">{tenants?.length ?? '…'} shop{tenants?.length === 1 ? '' : 's'} on this platform</p>
              </div>
              <PrimaryBtn onClick={() => setShowNew(true)}><span className="flex items-center gap-1.5"><Plus size={15} /> New shop</span></PrimaryBtn>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-stone-500 border-b border-stone-100">
                    <th className="px-4 py-3">Shop</th>
                    <th className="px-4 py-3">Login username</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants === null ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
                  ) : tenants.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No shops yet — create the first one.</td></tr>
                  ) : tenants.map((t) => (
                    <tr key={t.id} className="border-b border-stone-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-stone-900">{t.shopName}</td>
                      <td className="px-4 py-3 font-mono text-stone-600">{t.username}</td>
                      <td className="px-4 py-3 text-stone-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {t.status === 'active' ? <CheckCircle2 size={11} /> : <Ban size={11} />}
                          {t.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => setEditing(t)} className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => toggleStatus(t)}
                            className={`text-xs font-medium ${t.status === 'active' ? 'text-rose-600 hover:text-rose-800' : 'text-emerald-700 hover:text-emerald-900'}`}>
                            {t.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                          <button onClick={() => setDeleting(t)} title="Delete permanently"
                            className="text-stone-400 hover:text-rose-700 inline-flex items-center">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <AdminsSection />
        )}
      </div>

      <NewShopModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
      <EditShopModal tenant={editing} onClose={() => setEditing(null)} onSaved={load} />
      <DeleteShopModal tenant={deleting} onClose={() => setDeleting(null)} onDeleted={load} />
    </div>
  );
}

function AdminAppInner() {
  const [signedIn, setSignedIn] = useState(!!getAdminToken());
  if (!signedIn) return <AdminLogin onSuccess={() => setSignedIn(true)} />;
  return <AdminDashboard onLogout={() => { setAdminToken(null); setAdminIdentity(null); setSignedIn(false); }} />;
}

export default function AdminApp() {
  return (
    <ToastProvider>
      <AdminAppInner />
    </ToastProvider>
  );
}
