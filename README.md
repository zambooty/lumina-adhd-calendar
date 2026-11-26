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

### Download debug APK

**[Download `lumina-debug.apk`](https://github.com/zambooty/lumina-adhd-calendar/releases/download/android-debug-2026-11-26-1.1.5/lumina-debug.apk)** — sideloadable debug build with in-app GitHub updates (release [`android-debug-2026-11-26-1.1.5`](https://github.com/zambooty/lumina-adhd-calendar/releases/tag/android-debug-2026-11-26-1.1.5)).

| | |
|---|---|
| Size | ~4.3 MB |
| SHA-256 | `379859ac73f1a7db0028866cdd38fe8a26c1c8fce153a3f2ea00458f34ba7895` |
| Built from | `main` (Three.js companion pet + security harden; stable Cap debug signing) |
| versionCode | `7` (`1.1.5-debug`) |
| App ID | `com.makesoft.lumina` |

If install says **package conflicts**, uninstall LUMINA once, then install this APK (one-time signing change). Later Cap updates should install in place.

Install: download on your phone and open it, or `adb install -r lumina-debug.apk`.  
Prefer the **GitHub Release** link above (the APK is not shipped inside the web app package).

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
Capacitor Android WebView origin: `https://localhost` (same OAuth **Web** client — do not create a second client).

McKale’s OAuth Web client already has the published + local Vite entries. **Add the Capacitor lines below** (Google is byte-for-byte):

**Authorized JavaScript origins** (no trailing slash) — add if missing:

```
https://lumina-calendar-f5eb.apps.grok.bot
http://127.0.0.1:5173
http://127.0.0.1:4173
https://localhost
```

Optional extras if you use hostname local instead of `127.0.0.1`: `http://localhost:5173`, `http://localhost:4173`.

**Authorized redirect URIs** (bare + trailing slash — Cap / mobile send bare `window.location.origin`):

```
https://lumina-calendar-f5eb.apps.grok.bot
https://lumina-calendar-f5eb.apps.grok.bot/
http://127.0.0.1:5173
http://127.0.0.1:5173/
http://127.0.0.1:4173
http://127.0.0.1:4173/
https://localhost
https://localhost/
```

**McKale must click in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Web client:**

1. Under **Authorized JavaScript origins**, add `https://localhost` (Save).
2. Under **Authorized redirect URIs**, add `https://localhost` and `https://localhost/` (Save).
3. Wait a minute for propagation, then on the debug APK: **Connect Google** → approve Calendar + Gmail → **Pull**.

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

**Token storage tradeoff:** access + refresh live in memory + `sessionStorage` for the tab / Cap WebView (never logged). On **Capacitor native**, tokens stay out of `localStorage` entirely (Custom Tabs return keeps session). On **web**, `localStorage` keeps only a **refresh-token bridge** (no durable access token) for ≤24h so mobile Safari OAuth redirects that wipe session can still reconnect. After that window, or on **Disconnect / Reset**, refresh is cleared and the user must Connect Google again.

Mobile notes: GIS popups often blank the page on iOS/Android browsers, so Connect Google uses a redirect + `/api/google/exchange` path on coarse/narrow viewports. Pull shows honest empty/error status instead of silent demo fallback when live.

Pulled / scheduled items attach the default **ADHD reminder stack**; pet XP still counts every pull + schedule.

### Android live API + OAuth (Capacitor)

Capacitor uses `server.androidScheme: 'https'` → WebView origin **`https://localhost`**. Bundled `dist/` has no Node backend, so the app calls the **published** host for `/api/google/*` and `/api/capture/*` (CORS reflects allowlisted Cap origins). Server allowlist already includes `https://localhost` / `capacitor://localhost`.

**Connect Google on device**

1. Add Cap Console URIs above (`https://localhost` + `/`).
2. Build/install debug APK (`npm run android:debug` or Android Studio).
3. Grant any OS prompts; tap **Connect Google** — Cap opens Chrome Custom Tabs (`@capacitor/browser`); after consent, Android returns to LUMINA via `https://localhost` intent filter.
4. If Custom Tabs fail, Cap falls back to in-WebView navigation (`allowNavigation` for Google hosts).

Escape hatch: `CAP_SERVER_URL=https://lumina-calendar-f5eb.apps.grok.bot npm run cap:sync` loads UI+API remote (OAuth uses the published origin already in Console). Default remains bundled + Cap origins so one Web client covers phone + web.

### Android local notifications (reminder stacks)

When an event is scheduled (manual or auto-add) with a reminder stack, Capacitor schedules **one OS notification per offset** (`@capacitor/local-notifications`). API 33+ prompts for `POST_NOTIFICATIONS`. Tap opens/focuses that event on the calendar. Web builds no-op.

### Android auto-pull + share target

On Cap Android, **Pull** also:

1. Drains share-target text/audio queued into LUMINA  
2. Requests **SMS** access and scans recent messages for appointment heuristics  
3. Keeps Gmail/Calendar + paste paths  

See `docs/android-native-capture.md`. **Play note:** broad `READ_SMS` may be rejected — sideload/debug path works and surfaces an honest hint if denied (never silent no-op).

### Phone grants McKale will see

1. **Notifications** (API 33+) — allow so reminder stacks fire  
2. **SMS** — allow for auto-pull from inbox (or deny and use paste/share)  
3. **Google account consent** — Calendar + Gmail readonly after Connect Google  

### Build without local Android SDK

```bash
npm install
npm run build
npx cap sync android
```

`android/gradle/wrapper/gradle-wrapper.jar` is **gitignored** so it stays out of the Cursor web publish package (Android build tool only — not needed at web runtime). Properties still pin Gradle `8.14.3`. Restore the jar before `./gradlew`:

```bash
npm run android:ensure-wrapper
# or: node scripts/ensure-gradle-wrapper.mjs
```

Then open `android/` in Android Studio on a machine with the SDK and **Run**, or:

```bash
npm run android:debug
# or after ensure-wrapper:
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Android backup / FileProvider

- `allowBackup=false` plus exclude-all `backup_rules` / `data_extraction_rules` so WebView/prefs are not casually cloud-backed up or device-transferred.
- FileProvider paths are limited to app `cache/` + `files/` (no external storage root).

### In-app APK updates

On Cap Android, **Menu → Check for updates** (also auto-checks occasionally) compares `versionCode` to the latest `android-debug-*` / `android-release-*` GitHub Release (via `/api/android/update`, fallback `public/android-latest.json`), then downloads the **public** Release APK and opens the system installer (`REQUEST_INSTALL_PACKAGES`). No `GITHUB_TOKEN` required while the repo is public. Details: `docs/android-in-app-updates.md`.

## What’s in the app

- **Calendar** — Upcoming events with vivid source colors and per-event reminder stack selection.
- **Source inbox** — Google Calendar + Gmail (live when secrets + OAuth) plus **Capture import** (Notes / IMAP / SMS / Voicemail paste or upload). Mock Notes / SMS only when Google is not live. “Pull from sources” can **auto-add** high-confidence (≥90%) items.
- **Reminder stacks** — Editable default templates (1d / 2h / 30m / 5m / leave-now and more); **OS notifications on Android**.
- **Companion pet (Blink)** — XP = events pulled + events scheduled.
- **Persistence** — `localStorage` key `lumen_adhd_companion_v2` (empty start; legacy v1 wiped once). **Reset** clears to empty — does not re-inject fake appointments.
- **PWA-ready** — `manifest.webmanifest` + theme color.
- **Android** — Capacitor WebView shell (`android/`) with live API, Custom Tabs OAuth, local notifications, SMS + share-target capture.

## Connectors

| Source    | Status |
|-----------|--------|
| Calendar  | **Google Calendar** (OAuth); demo only if secrets unset |
| Email     | **Gmail** (OAuth) + **IMAP/other** paste + prefs stub |
| Notes     | Paste / `.txt`·`.md` upload; Android share-target; mock only in demo mode |
| SMS       | Cap Android inbox pull (`READ_SMS` sideload); paste import; Twilio when bound |
| Voicemail | Share audio / transcript paste; Whisper STT when key + Google |

Optional capture secrets (paste/upload works without them): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `WHISPER_API_KEY` or `OPENAI_API_KEY`, `IMAP_LIVE_ENABLED`. See `docs/multi-source-capture.md`.

Capture API: `GET /api/capture/status`, `POST /api/capture/transcribe`, `POST /api/capture/twilio-sms`.

| Variable | Default | Notes |
|----------|---------|-------|
| `CAPTURE_TRANSCRIBE_MAX_BYTES` | `10485760` (10MB) | Multipart upload cap |
| `CAPTURE_TRANSCRIBE_RATE_LIMIT_PER_MIN` | `10` | Per client IP |
| `CAPTURE_STATUS_RATE_LIMIT_PER_MIN` | `60` | Per client IP (nonce mint) |
| `CAPTURE_TWILIO_SMS_MAX_BYTES` | `16384` (16KB) | Webhook body byte cap |
| `CAPTURE_TWILIO_SMS_BODY_MAX_CHARS` | `2048` | Max `Body` field length |
| `CAPTURE_TWILIO_SMS_RATE_LIMIT_PER_MIN` | `30` | Per client IP |
| `PUBLIC_APP_ORIGIN` | published host | Also used as Twilio signature URL base |

Hardening on capture routes:

- **Transcribe** — **requires a live Google access token** for this app’s `GOOGLE_CLIENT_ID` (verified with Google tokeninfo; `Authorization: Bearer …`). Spoofed Origin alone cannot spend Whisper. Also: origin allowlist, size + rate limits; disabled when Whisper/OpenAI unbound; no key/upstream leakage. Paste transcript still works without Google.
- **Twilio SMS** — when configured, requires valid `X-Twilio-Signature` (HMAC-SHA1); unsigned requests → `403`. Body size + per-IP rate limits before signature verify.

Native Notes / SMS / voicemail hooks for the Capacitor wrap: `docs/android-native-capture.md`.

## Design notes

Dark-only atmospheric UI (no light theme). Brand **LUMINA** is the hero signal. Font: Helvetica (`"Helvetica Neue", Helvetica, Arial, sans-serif`). Accents: cyan / lime / coral / amber on deep navy-black.
