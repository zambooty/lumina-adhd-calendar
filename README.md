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
3. Authorized JavaScript origins must include your published app origin (and `http://127.0.0.1:5173` for local).
4. In the app, **Connect Google**, then **Pull from sources**.

Server routes (Cursor host + Vite dev middleware):

- `GET /api/google/status` — configured vs demo; returns client id for GIS when set
- `POST /api/google/exchange` — optional auth-code exchange when the client secret is bound

Scopes: `calendar.readonly` + `gmail.readonly`. Access tokens stay in `sessionStorage` for the browser session.

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
- **Source inbox** — Google Calendar + Gmail (live or demo) plus mock Notes / Texts. “Pull from sources” can **auto-add** high-confidence (≥90%) items.
- **Reminder stacks** — Editable default templates (1d / 2h / 30m / 5m / leave-now and more).
- **Companion pet (Blink)** — XP = events pulled + events scheduled.
- **Persistence** — `localStorage` key `lumen_adhd_companion_v1`. **Reset demo** restores seeded data.
- **PWA-ready** — `manifest.webmanifest` + theme color.
- **Android** — Capacitor WebView shell (`android/`).

## Connectors

| Source   | Status                                              |
|----------|-----------------------------------------------------|
| Calendar | **Google Calendar** (OAuth) + demo fallback         |
| Email    | **Gmail** (OAuth + appointment heuristics) + demo   |
| Notes    | Mock sticky / brain-dump parsing                    |
| Texts    | Mock SMS threads                                    |

## Design notes

Dark-only atmospheric UI (no light theme). Brand **LUMINA** is the hero signal. Fonts: Syne + Outfit. Accents: cyan / lime / coral / amber on deep navy-black.
