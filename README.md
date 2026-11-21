# LUMINA — ADHD Calendar Companion

Dark-mode web MVP for ADHD / neurodivergent brains: auto-capture appointment-like items from multiple sources, attach customizable reminder stacks, and grow an interactive companion pet from successful pulls + schedules.

Wrapped for **Android** with [Capacitor](https://capacitorjs.com/) (`com.makesoft.lumina`). The native shell loads the same dark-only web UI in a WebView.

## Run locally (web)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

```bash
npm run build
npm run preview
```

Without Google secrets, Calendar + Gmail run in **demo mode** (sample appointment candidates). Notes + Texts stay mock.

## Android (Capacitor) — build & run on device

**Requirements on your machine**

- Node.js + npm
- [Android Studio](https://developer.android.com/studio) (SDK Platform 35+, Build-Tools, a device or emulator API 24+)
- USB debugging enabled on a physical phone, **or** an AVD

### 1. Install & build web → sync into Android

```bash
npm install
npm run cap:sync
```

`cap:sync` runs `npm run build` then `npx cap sync android` (copies `dist/` into the Android project).

### 2. Open in Android Studio

```bash
npm run cap:open
```

Or open the `android/` folder in Android Studio. Wait for Gradle sync, pick a device/emulator, press **Run**.

### 3. Debug APK from the CLI (optional)

With `ANDROID_HOME` / SDK installed:

```bash
npm run android:debug
```

APK path: `android/app/build/outputs/apk/debug/app-debug.apk`

Install on a connected device:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### After web UI changes

Always rebuild + sync before re-running on device:

```bash
npm run cap:sync
```

Then Run again in Android Studio (or reinstall the debug APK).

The WebView content is the production Vite build — same dark-only LUMINA UI as the web app (no light theme).

### App identity

| Field   | Value                 |
|---------|-----------------------|
| appId   | `com.makesoft.lumina` |
| appName | LUMINA                |
| webDir  | `dist`                |
| Scheme  | `https` → WebView origin `https://localhost` |

## Google Calendar + Gmail

Real connectors live in `src/connectors/googleCalendar.ts` and `src/connectors/gmail.ts`.

1. Create a Google Cloud OAuth **Web** client.
2. Bind Cursor app secrets (never paste values into chat):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
3. Register the **exact** Authorized JavaScript origins and redirect URIs below (byte-for-byte).
4. In the app, **Connect Google**, then **Pull from sources**.

### Exact Google Cloud Console URIs (McKale)

Published app: `https://lumina-calendar-f5eb.apps.grok.bot`

McKale’s OAuth Web client already has the required published + local entries. Keep these exact strings (Google is byte-for-byte):

**Authorized JavaScript origins** (no trailing slash):

```
https://lumina-calendar-f5eb.apps.grok.bot
http://127.0.0.1:5173
http://127.0.0.1:4173
```

Optional extras if you use hostname local instead of `127.0.0.1`: `http://localhost:5173`, `http://localhost:4173`.

**Authorized redirect URIs** (bare + trailing slash — mobile sends bare `window.location.origin`):

```
https://lumina-calendar-f5eb.apps.grok.bot
https://lumina-calendar-f5eb.apps.grok.bot/
http://127.0.0.1:5173
http://127.0.0.1:5173/
http://127.0.0.1:4173
http://127.0.0.1:4173/
```

Optional server env (comma-separated) if the published slug changes: `PUBLIC_APP_ORIGIN` or `ALLOWED_ORIGINS`.

Server routes (Cursor host + Vite dev middleware):

- `GET /api/google/status` — configured vs demo; returns client id for GIS when set
- `POST /api/google/exchange` — auth-code → token exchange (required for mobile redirect flow)
- `POST /api/google/refresh` — refresh_token → access_token

Origin gate: `/api/google/exchange` and `/api/google/refresh` allow only the published app origin, local Vite origins, `Host` / `X-Forwarded-*` public host, and (when Origin/Referer are omitted on some mobile browsers) `Sec-Fetch-Site: same-origin` against that host. Arbitrary origins are rejected.

Scopes: `calendar.readonly` + `gmail.readonly`. Access tokens persist in `localStorage` (and mirror to `sessionStorage`).

Mobile notes: GIS popups often blank the page on iOS/Android browsers, so Connect Google uses a redirect + `/api/google/exchange` path on coarse/narrow viewports. Pull shows honest empty/error status instead of silent demo fallback when live.

Pulled / scheduled items attach the default **ADHD reminder stack**; pet XP still counts every pull + schedule.

### Android OAuth origins (later — not blocking this wrap)

Capacitor Android uses `server.androidScheme: 'https'`, so the WebView origin is typically:

- **`https://localhost`** (current config)

If you change scheme or Capacitor version, you may also need:

- `http://localhost`
- `capacitor://localhost`

Add the active origin(s) under **Authorized JavaScript origins** on the same OAuth Web client. Live Google Connect on-device also needs the `/api/google/*` backend reachable from the app (or a future Capacitor-friendly auth path). Until then, demo mode works offline inside the APK.

## What’s in the app

- **Calendar** — Upcoming events with vivid source colors and per-event reminder stack selection.
- **Source inbox** — Google Calendar + Gmail (live when secrets + OAuth). Mock Notes / Texts only when Google is not live. “Pull from sources” can **auto-add** high-confidence (≥90%) items.
- **Reminder stacks** — Editable default templates (1d / 2h / 30m / 5m / leave-now and more).
- **Companion pet (Blink)** — XP = events pulled + events scheduled.
- **Persistence** — `localStorage` key `lumen_adhd_companion_v2` (empty start; legacy v1 wiped once). **Reset** clears to empty — does not re-inject fake appointments.
- **PWA-ready** — `manifest.webmanifest` + theme color.
- **Android** — Capacitor WebView shell (`android/`).

## Connectors

| Source   | Status                                              |
|----------|-----------------------------------------------------|
| Calendar | **Google Calendar** (OAuth); demo only if secrets unset |
| Email    | **Gmail** (OAuth); demo only if secrets unset         |
| Notes    | Mock only in demo mode; empty when Google is live   |
| Texts    | Mock only in demo mode; empty when Google is live   |

## Design notes

Dark-only atmospheric UI (no light theme). Brand **LUMINA** is the hero signal. Fonts: Syne + Outfit. Accents: cyan / lime / coral / amber on deep navy-black.
