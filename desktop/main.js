// main.js — the desktop app's whole job is to be a native window pointed
// at CamPOS Fashion's hosted server. It never bundles its own backend or
// database — same multi-tenant server every browser user hits, just in an
// app-like window with a taskbar icon instead of a browser tab.
//
// Locked to one server address, on purpose — no setup screen, no way to
// change it from inside the app. If this ever needs to point somewhere
// else, that's a code change (this constant) and a rebuild, not a runtime
// setting.
//
// Security note: this window loads REAL remote content (a live server
// someone logs into), so nodeIntegration is OFF and contextIsolation is ON
// — the loaded page gets zero Node/Electron API access.
//
// If you're testing the PACKAGED .exe (not `npm start`) from a terminal
// that has ELECTRON_RUN_AS_NODE set (VS Code's integrated terminal does
// this — see run.js), the app silently runs as plain Node instead of a
// real window and exits immediately with no error. Not a bug in this file
// — clear that env var in the terminal, or launch the .exe from Explorer/
// the Start Menu, before assuming something's actually broken.
const SERVER_URL = 'https://camposfashion.onrender.com';

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Only ever navigate within the server's own origin (normal in-app
  // links/logins/redirects) — anything pointing elsewhere opens in the
  // person's regular browser instead of inside this app window.
  const isAllowedOrigin = (url) => {
    try { return new URL(url).origin === SERVER_URL; } catch { return false; }
  };
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAllowedOrigin(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedOrigin(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(SERVER_URL);
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
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
