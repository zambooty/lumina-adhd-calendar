# LUMINA — ADHD Calendar Companion

Dark-mode web MVP for ADHD / neurodivergent brains: auto-capture appointment-like items from multiple sources, attach customizable reminder stacks, and grow an interactive companion pet from successful pulls + schedules.

## Run locally

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

## What’s in the app

- **Calendar** — Upcoming events with vivid source colors and per-event reminder stack selection.
- **Source inbox** — Google Calendar + Gmail (live when secrets + OAuth). Mock Notes / Texts only when Google is not live. “Pull from sources” can **auto-add** high-confidence (≥90%) items.
- **Reminder stacks** — Editable default templates (1d / 2h / 30m / 5m / leave-now and more).
- **Companion pet (Blink)** — XP = events pulled + events scheduled.
- **Persistence** — `localStorage` key `lumen_adhd_companion_v2` (empty start; legacy v1 wiped once). **Reset** clears to empty — does not re-inject fake appointments.
- **PWA-ready** — `manifest.webmanifest` + theme color.

## Connectors

| Source   | Status                                              |
|----------|-----------------------------------------------------|
| Calendar | **Google Calendar** (OAuth); demo only if secrets unset |
| Email    | **Gmail** (OAuth); demo only if secrets unset         |
| Notes    | Mock only in demo mode; empty when Google is live   |
| Texts    | Mock only in demo mode; empty when Google is live   |

## Android follow-up path

1. Lock UX on this web/PWA MVP.
2. Wrap with **Capacitor** (or similar) for Android.
3. Keep reminder stacks and pet XP shared; only connector + notification delivery go native.

## Design notes

Dark-only atmospheric UI (no light theme). Brand **LUMINA** is the hero signal. Fonts: Syne + Outfit. Accents: cyan / lime / coral / amber on deep navy-black.
