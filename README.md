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

Without Google secrets, Calendar + Gmail run in **demo mode** (sample appointment candidates). Notes + SMS demo samples only appear when Google is not live. Paste/upload capture for Notes, IMAP email, SMS, and voicemail always works.

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

### Server env (Google token routes)

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_CLIENT_ID` | for live Google | OAuth Web client id (GIS + exchange) |
| `GOOGLE_CLIENT_SECRET` | for mobile code exchange / refresh | Server-only secret; never shipped to the client |
| `PUBLIC_APP_ORIGIN` | optional | Extra allowlisted origin if the published slug changes (e.g. `https://new-slug.apps.grok.bot`) |
| `ALLOWED_ORIGINS` | optional | Comma-separated extra origins (same allowlist as above) |
| `GOOGLE_EXCHANGE_RATE_LIMIT_PER_MIN` | optional | Max `/api/google/exchange` attempts per client IP per minute (default `20`) |
| `GOOGLE_REFRESH_RATE_LIMIT_PER_MIN` | optional | Max `/api/google/refresh` attempts per client IP per minute (default `30`) |

Server routes (Cursor host + Vite dev middleware — same handlers):

- `GET /api/google/status` — configured vs demo; returns client id for GIS when set (rate-limited; no secrets)
- `POST /api/google/exchange` — auth-code → token exchange (required for mobile redirect flow)
- `POST /api/google/refresh` — refresh_token → access_token

Hardening on exchange/refresh:

- **Static origin allowlist** — published app, local Vite, Capacitor (`https://localhost`, `capacitor://localhost`, …), plus `PUBLIC_APP_ORIGIN` / `ALLOWED_ORIGINS`. Missing/invalid Origin (and Referer) is rejected; privacy browsers may pass with `Sec-Fetch-Site: same-origin` when Host is on that same static list. Client-controlled `Host` / `X-Forwarded-*` cannot expand the Origin allowlist.
- **`redirect_uri` allowlist** — must be an allowlisted origin (or the same with a trailing slash). Paths, query strings, and arbitrary hosts are rejected (`redirect_uri_forbidden`).
- **Grant type** — server-fixed (`authorization_code` / `refresh_token`); client overrides other than the expected value are rejected.
- **Rate limits** — per client IP (see env above); `429` + `Retry-After` when exceeded.
- **No token leakage** — error bodies only return safe OAuth error codes; success responses only forward expected token fields.

Scopes: `calendar.readonly` + `gmail.readonly`.

**Token storage tradeoff:** access + refresh live in memory + `sessionStorage` for the tab. `localStorage` keeps only a **refresh-token bridge** (no durable access token) for ≤24h so mobile Safari OAuth redirects that wipe session can still reconnect. After that window, or on **Disconnect / Reset**, refresh is cleared and the user must Connect Google again.

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
- **Source inbox** — Google Calendar + Gmail (live when secrets + OAuth) plus **Capture import** (Notes / IMAP / SMS / Voicemail paste or upload). Mock Notes / SMS only when Google is not live. “Pull from sources” can **auto-add** high-confidence (≥90%) items.
- **Reminder stacks** — Editable default templates (1d / 2h / 30m / 5m / leave-now and more).
- **Companion pet (Blink)** — XP = events pulled + events scheduled.
- **Persistence** — `localStorage` key `lumen_adhd_companion_v2` (empty start; legacy v1 wiped once). **Reset** clears to empty — does not re-inject fake appointments.
- **PWA-ready** — `manifest.webmanifest` + theme color.
- **Android** — Capacitor WebView shell (`android/`).

## Connectors

| Source    | Status |
|-----------|--------|
| Calendar  | **Google Calendar** (OAuth); demo only if secrets unset |
| Email     | **Gmail** (OAuth) + **IMAP/other** paste + prefs stub |
| Notes     | Paste / `.txt`·`.md` upload; mock only in demo mode |
| SMS       | Paste import; Twilio webhook when secrets bound |
| Voicemail | Transcript paste; Whisper STT when key bound |

Optional capture secrets (paste/upload works without them): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `WHISPER_API_KEY` or `OPENAI_API_KEY`, `IMAP_LIVE_ENABLED`. See `docs/multi-source-capture.md`.

Capture API: `GET /api/capture/status`, `POST /api/capture/transcribe`, `POST /api/capture/twilio-sms`.

| Variable | Default | Notes |
|----------|---------|-------|
| `CAPTURE_TRANSCRIBE_MAX_BYTES` | `10485760` (10MB) | Multipart upload cap |
| `CAPTURE_TRANSCRIBE_RATE_LIMIT_PER_MIN` | `10` | Per client IP |
| `CAPTURE_STATUS_RATE_LIMIT_PER_MIN` | `60` | Per client IP (nonce mint) |
| `PUBLIC_APP_ORIGIN` | published host | Also used as Twilio signature URL base |

Hardening on capture routes:

- **Transcribe** — static origin allowlist (no Host expansion); disabled when Whisper/OpenAI unbound; short-lived one-shot `captureToken` from origin-gated status (`X-Lumina-Capture-Token`); size + rate limits; no key/upstream leakage.
- **Twilio SMS** — when configured, requires valid `X-Twilio-Signature` (HMAC-SHA1); unsigned requests → `403`.

Native Notes / SMS / voicemail hooks for the Capacitor wrap: `docs/android-native-capture.md`.

## Design notes

Dark-only atmospheric UI (no light theme). Brand **LUMINA** is the hero signal. Fonts: Syne + Outfit. Accents: cyan / lime / coral / amber on deep navy-black.
