# CamPOS Fashion — Full-Stack App

A multi-tenant point-of-sale platform for clothing/fashion shops — one
deployment hosts many shops, each with their own isolated data and their own
username+password login (see "Multi-tenant platform" below). Riskyc Fashion
is the first shop running on it, and its real data is what the seed/demo
content is modeled on. Real backing behind every button — including
size/color **variants**: each product is a "style" (e.g. a dress), sold as
one or more size/color combos, each tracked with its own SKU and stock count.

- **`server/`** — a real backend: Node + Express + a SQLite database, seeded
  with fashion demo data (products with variants, suppliers, customers), with
  REST endpoints and a real checkout that records sales, decrements the
  specific variant's stock, logs stock movements, and updates customer points.
- **`web/`** — the POS UI, connected to the backend. Every button does
  something real (checkout with a size/color picker, add/edit products and
  their variants, suppliers, users, purchase orders, CSV/PDF exports,
  settings save, clock in/out, notifications).

If the backend is not running, the web app still works in **offline demo mode**
using the seed data — it just won't persist changes.

---

## Part 1 — What you need installed (one time)

1. **Node.js 18 or newer.** Download the LTS version from <https://nodejs.org>,
   install it, then confirm in a terminal:
   ```bash
   node -v      # should print v18.x or higher
   npm -v
   ```
2. A code editor (VS Code is recommended) and a terminal.

---

## Part 2 — Run it on your computer (local development)

You will run **two** programs at once: the backend and the web app. Open two
terminal windows/tabs.

### Terminal 1 — backend
```bash
cd server
npm install          # installs express, node-sqlite3-wasm, cors
npm run dev          # starts the API on http://localhost:4000
```
You should see `Riskyc Fashion POS API running on http://localhost:4000`.

**This app is multi-tenant**: one deployment can host many separate shops,
each with their own fully isolated database and their own username+password
login (see `server/src/platformDb.js`). Nothing loads until a shop is
created. Two ways to create one:

- **Admin panel** — bootstrap your own login once:
  ```bash
  node scripts/create-admin.js --username you --password s3cretpass
  ```
  Then open <http://localhost:5173/admin> and sign in. From there, "New
  shop" creates one with a form — no coding needed. You can also suspend a
  shop's access from here (e.g. an unpaid monthly license) and reactivate
  it later; nothing about a shop's own sales/products/customers is ever
  visible from this panel.
- **CLI** — same result, useful for scripting or migrating an existing
  database in:
  ```bash
  node scripts/create-tenant.js --slug my-shop --shop-name "My Shop" \
    --username myshop --password s3cretpass \
    --owner-name "Shop Owner" --owner-username admin --owner-pin 1234
  ```

Either way you get a shop login for <http://localhost:5173> (shop
username+password first, then the staff PIN screen underneath it).

> **No compiler needed.** The database is `node-sqlite3-wasm`, a pure-JavaScript
> build of SQLite. It installs with plain `npm install` on any OS and any recent
> Node version (18, 20, 22, 24) — no Python and no C++ build tools required.

### Terminal 2 — web app
```bash
cd web
npm install          # installs react, vite, tailwind, recharts, lucide
npm run dev          # starts the UI on http://localhost:5173
```
Open <http://localhost:5173>. The Vite dev server automatically forwards
`/api` calls to the backend on port 4000, so no extra config is needed.

You now have a working POS:
- Add items to the cart, pick a customer, **Complete Payment** → the order is
  saved, stock drops, customer points rise, and a receipt prints.
- **Inventory** → add/edit products and suppliers, create/advance purchase
  orders, export CSVs.
- **Settings** → change values and **Save** (persists to the database).
- **Shifts** → clock employees in/out (persists); the POS requires an
  on-the-clock cashier before it accepts payment.

---

## Part 3 — Edit things

| You want to change… | Edit this file |
| --- | --- |
| The screens / layout / buttons / text | `web/src/DialloPOS.jsx` |
| Pop-up forms, toasts, the data loader | `web/src/shared.jsx` |
| Which API calls exist on the front-end | `web/src/api.js` |
| Database tables | `server/src/db.js` |
| Starting/demo data | `server/src/seed.js` |
| API endpoints / business logic | `server/src/routes/api.js` |

Changes hot-reload automatically while `npm run dev` is running.

To **wipe one shop back to nothing**: stop the backend, delete its file
under `server/tenants/<slug>/data.db` (and `-wal`/`-shm` if present), then
re-run `create-tenant.js` with the same `--slug` (this also needs a fresh
row in `server/platform.db`, so either delete that shop's row first or pick
a new slug). This never affects any other shop's data.

---

## Part 4 — Put it online (hosting)

There are two common ways. **Option A** is the simplest.

### Option A — One server hosts everything (recommended to start)

The backend is already set up to also serve the built web app from
`server/public`. So you build the front-end, drop it into the backend, and
deploy a single service.

1. **Build the web app** to talk to its own server (same origin):
   ```bash
   cd web
   # leave VITE_API_URL blank so the app calls /api on the same domain
   npm run build           # outputs to web/dist
   ```
2. **Copy the build into the backend:**
   ```bash
   rm -rf ../server/public
   cp -r dist ../server/public
   ```
3. **Deploy the `server/` folder** to any Node host. Using **Render**
   (free tier, no credit card to start) as the example:
   - Push this project to a GitHub repository.
   - On <https://render.com> → **New → Web Service** → connect the repo.
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - Add environment variables **`PLATFORM_DB_PATH`** = `/var/data/platform.db`
     and **`UPLOAD_DIR`** = `/var/data/uploads`, then attach a **Persistent
     Disk** mounted at `/var/data` (so shop databases and uploaded product
     photos survive restarts — without this, everything resets on every
     deploy). Each shop's own database file lives under
     `server/tenants/<slug>/data.db` relative to wherever the server runs
     from, which is also under `/var/data` once you set `--slug`-based paths
     accordingly, or simply run `create-tenant.js` on the deployed host with
     `cwd` set to `/var/data` so `tenants/` lands on the persistent disk.
   - Create the service, then create your first shop by running
     `node scripts/create-tenant.js ...` **on the deployed host** (e.g. via
     Render's Shell tab) — this is the same command as local dev, it just
     needs to run where the persistent disk is mounted.
   - Render gives you a URL like `https://riskyc-fashion.onrender.com` that
     serves both the UI and the API — every shop uses the same URL, logging
     in with their own username+password to reach their own data.

   The same steps work on **Railway**, **Fly.io**, or a plain VPS
   (`node src/index.js` behind a process manager like `pm2`).

### Option B — Front-end and backend hosted separately

Use this if you prefer Vercel/Netlify for the UI.

1. **Deploy the backend** (`server/`) exactly as in Option A, steps 3 — but you
   do **not** need to copy the web build into it. Note its public URL, e.g.
   `https://riskyc-fashion-api.onrender.com`.
2. **Deploy the web app** on **Vercel** or **Netlify**:
   - Import the repo, set **Root Directory** to `web`.
   - Build command `npm run build`, output directory `dist`.
   - Add an environment variable **`VITE_API_URL`** =
     `https://riskyc-fashion-api.onrender.com` (your backend URL, no trailing slash).
   - Deploy. The UI will call your backend across domains; the backend already
     sends permissive CORS headers, so it works out of the box. (For a real
     business, lock CORS down to your front-end domain in
     `server/src/index.js`.)

---

## Part 5 — Going from demo to a real business system (next steps)

This is a complete, honest starting point, not a finished commercial product.
Before real-world use you should add:

- **Login & authentication.** Right now the "View as admin/manager/cashier"
  switch only changes what's shown — there is no password protection. Add user
  login (e.g. email + password with JWT sessions) before exposing it publicly.
- **Move to PostgreSQL** if you need multiple stores writing at once. SQLite is
  excellent for a single location; for multi-store sync, swap the database
  layer in `server/src/db.js` for Postgres (the SQL is standard).
- **Real payment & mobile-money integration** (MTN MoMo, Orange Money) instead
  of the simulated payment step.
- **Real DGI e-invoicing** — the QR code on the receipt is currently
  decorative. Integrate the actual tax authority API when you have credentials.
- **Backups** of the database file (or managed Postgres backups).

---

## Project structure

```
├── server/                 # backend API
│   ├── package.json
│   ├── platform.db         # the directory of shops (git-ignored)
│   ├── tenants/<slug>/data.db  # one database per shop, created by create-tenant.js (git-ignored)
│   └── src/
│       ├── index.js        # express app + serves built UI
│       ├── db.js           # sqlite connection + schema
│       ├── seed.js         # demo data
│       └── routes/api.js   # all REST endpoints
└── web/                    # front-end (Vite + React + Tailwind)
    ├── package.json
    ├── vite.config.js      # dev proxy /api -> :4000
    ├── index.html
    └── src/
        ├── main.jsx        # entry
        ├── DialloPOS.jsx   # your UI, now wired up
        ├── shared.jsx      # data provider, toasts, modals, forms
        ├── api.js          # backend client
        └── index.css       # tailwind
```

## API reference (quick)

```
GET    /api/products            POST /api/products      PUT /api/products/:id   DELETE /api/products/:id
                                 # each product carries a .variants array (size/color, own SKU + stock)
POST   /api/product-variants/:id/adjust   # manual stock +/- on one variant
GET    /api/customers           POST /api/customers     PUT /api/customers/:id
GET    /api/suppliers           POST /api/suppliers     PUT /api/suppliers/:id
GET    /api/purchase-orders     POST /api/purchase-orders   PATCH /api/purchase-orders/:id
GET    /api/stock-movements     POST /api/stock-movements
GET    /api/users               POST /api/users         PUT /api/users/:id
GET    /api/employees           GET  /api/shifts
POST   /api/shifts/clock-in     POST /api/shifts/clock-out
POST   /api/orders              GET  /api/orders        # checkout + history
GET    /api/settings            PUT  /api/settings
GET    /api/reports/sales       GET  /api/reports/inventory
GET    /health
```
