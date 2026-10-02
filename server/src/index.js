// index.js — the server entrypoint.
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import './platformDb.js'; // side-effect: opens platform.db, creates the tenants table
import platformRouter from './routes/platform.js';
import adminRouter from './routes/admin.js';
import catalogRouter from './routes/catalog.js';
import onlineOrderRouter from './routes/onlineOrder.js';
import { tenantResolve } from './middleware/tenantResolve.js';
import api from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());                              // allow the web app to call us
app.use(express.json({ limit: '15mb' }));     // parse JSON bodies (large enough for base64 photos)

// Serve uploaded product photos from /uploads/<shopSlug>/<file> — the slug
// is baked into the path itself (see routes/api.js's UPLOAD_ROOT), so this
// can stay a single plain static mount with no auth/tenant middleware:
// there's nothing to resolve, the URL already says which shop's folder.
const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadRoot));

// Health check (useful for hosting platforms).
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Shop login runs BEFORE a shop is known — it's what resolves one.
app.use('/api', platformRouter);

// The platform owner's own admin panel — never resolves a shop, only ever
// touches platform.db (see routes/admin.js).
app.use('/api', adminRouter);

// The public shop catalog — no login at all, resolves a shop by slug
// straight from the URL rather than a token (see routes/catalog.js).
app.use('/api', catalogRouter);

// The public self-service ordering page — same no-login, slug-based
// resolution as the catalog, but can actually take an order (see
// routes/onlineOrder.js for how that stays safe without a login).
app.use('/api', onlineOrderRouter);

// Every other /api/* route needs a shop resolved first (see tenantResolve.js).
app.use('/api', tenantResolve, api);

// --- Optional: serve the built front-end in production ---
// If you copy the web build into server/public, the API and UI run on one server.
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicDir, 'index.html'), (err) => { if (err) next(); });
});

app.listen(PORT, () => {
  console.log(`\n  CamPOS Fashion API running on http://localhost:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  API:     http://localhost:${PORT}/api/products\n`);
});
