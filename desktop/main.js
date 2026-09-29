// main.js — the desktop app's whole job is to be a native window pointed
// at a hosted CamPOS Fashion server. It never bundles its own backend or
// database — same multi-tenant server every browser user hits, just in an
// app-like window with a taskbar icon instead of a browser tab.
//
// Security note: this window loads REAL remote content (a live server
// someone logs into), so nodeIntegration is OFF and contextIsolation is ON
// — the loaded page gets zero Node/Electron API access. The only bridge is
// the narrow, explicit one in preload.js, used solely by the local
// setup.html screen (never by the remote server's own pages) to save/read
// which server address to use.
// If you're testing the PACKAGED .exe (not `npm start`) from a terminal
// that has ELECTRON_RUN_AS_NODE set (VS Code's integrated terminal does
// this — see run.js), the app silently runs as plain Node instead of a
// real window and exits immediately with no error. Not a bug in this file
// — clear that env var in the terminal, or launch the .exe from Explorer/
// the Start Menu, before assuming something's actually broken.
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}
function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function normalizeUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    return u.origin; // drop any path/query someone pastes by mistake
  } catch {
    return null;
  }
}

let win;

function showSetup(prefillUrl) {
  win.loadFile(path.join(__dirname, 'setup.html'), prefillUrl ? { query: { current: prefillUrl } } : undefined);
}

function goToServer(origin) {
  win.loadURL(origin);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Only ever navigate within the configured server's own origin (normal
  // in-app links/logins/redirects) — anything pointing elsewhere opens in
  // the person's regular browser instead of inside this app window.
  const isAllowedOrigin = (url) => {
    const { serverUrl } = loadConfig();
    if (!serverUrl) return true; // still on the local setup screen
    try { return new URL(url).origin === serverUrl; } catch { return false; }
  };
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file://')) return; // local setup.html itself
    if (!isAllowedOrigin(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedOrigin(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const { serverUrl } = loadConfig();
  if (serverUrl) goToServer(serverUrl);
  else showSetup(null);
}

// The setup screen (preload-exposed, see preload.js) asks the main process
// to save a new server address and switch to it.
ipcMain.handle('desktop:save-server-url', (event, raw) => {
  const origin = normalizeUrl(raw);
  if (!origin) return { ok: false, error: 'That doesn’t look like a valid web address.' };
  saveConfig({ serverUrl: origin });
  goToServer(origin);
  return { ok: true, origin };
});
ipcMain.handle('desktop:get-server-url', () => loadConfig().serverUrl || null);

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Change server…',
          click: () => { const { serverUrl } = loadConfig(); showSetup(serverUrl); },
        },
        { role: 'reload' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
