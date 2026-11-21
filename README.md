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
3. Authorized JavaScript origins must include your published app origin (and `http://127.0.0.1:5173` for local).
4. Authorized **redirect URIs** must include the same origin with a trailing slash (e.g. `https://your-app.apps.grok.bot/`) — mobile uses redirect OAuth instead of GIS popups.
5. In the app, **Connect Google**, then **Pull from sources**.

Server routes (Cursor host + Vite dev middleware):

- `GET /api/google/status` — configured vs demo; returns client id for GIS when set
- `POST /api/google/exchange` — auth-code → token exchange (required for mobile redirect flow)

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
