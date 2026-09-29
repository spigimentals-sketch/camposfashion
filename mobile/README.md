# CamPOS Fashion — Android app

A locked WebView pointed at `https://camposfashion.onrender.com` (see
`capacitor.config.json`'s `server.url`) — same model as `desktop/`: this
folder contains no POS logic of its own. The actual app lives on the
server; this is just a native shell for it on Android.

## Building

This machine has no Java/Android SDK, so building happens on GitHub
Actions (`.github/workflows/android-build.yml` at the repo root) —
either push a change under `mobile/`, or trigger it manually from the
Actions tab (`Build Android app` → `Run workflow`). Download the
`campos-fashion-debug-apk` artifact from the finished run and install it
on a device (`Settings → allow installs from this source` may be needed
the first time).

If you ever do have Android tooling installed locally:
```
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
```
produces the same APK at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Changing the server it points to

Edit `server.url` in `capacitor.config.json`, then `npm run sync` and
rebuild — same idea as `desktop/main.js`'s `SERVER_URL` constant. There's
no in-app way to change it, deliberately (see the desktop app's own
README/commit history for why).

## Regenerating icons

`npm run icons` regenerates every density's launcher icon + splash screen
from `assets/icon.png` (currently a copy of `web/public/icon-512.png`).
Re-run this if the brand icon ever changes.

## Camera permission (clock-in photo)

The staff clock-in feature uses a plain browser
`navigator.mediaDevices.getUserMedia` call, not a Capacitor plugin — the
`android.permission.CAMERA` entry in `AndroidManifest.xml` is what makes
the WebView's permission prompt for it actually work. Don't remove it.
