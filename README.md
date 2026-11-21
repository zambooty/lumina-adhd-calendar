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

## What’s in the MVP

- **Calendar** — Upcoming events with vivid source colors and per-event reminder stack selection.
- **Source inbox** — Mock connectors for **Calendar**, **Notes**, **Email**, and **Texts**. “Pull from sources” scans them, parses appointment-like phrases into candidates, and can **auto-add** high-confidence (≥90%) items so capture feels automatic.
- **Reminder stacks** — Editable default templates (1d / 2h / 30m / 5m / leave-now and more) plus per-event override via stack picker.
- **Companion pet (Blink)** — XP = events pulled + events scheduled. Stages: egg → hatchling → cub → glowfox → legend. Tap/hover for reactions; idle glow animation.
- **Persistence** — `localStorage` key `lumen_adhd_companion_v1` (events, candidates, stacks, pet, prefs). **Reset demo** restores seeded data.
- **PWA-ready** — `manifest.webmanifest` + theme color for installable shell later.

## Mock vs real connectors

Connectors implement a small `SourceConnector` interface (`listCandidates()` → proposed events) in `src/connectors/index.ts`.

| Source   | MVP (this repo)                         | Next (real)                                      |
|----------|-----------------------------------------|--------------------------------------------------|
| Calendar | Seeded + mock shared-calendar phrases   | Google Calendar / device calendar APIs           |
| Notes    | Demo sticky / brain-dump parsing        | Notes apps or local note ingest                  |
| Email    | Mock confirmation emails                | Gmail API (OAuth) with appointment heuristics    |
| Texts    | Mock SMS threads                        | SMS / RCS where platform permissions allow       |

Swap a mock connector for a real one without rewriting the inbox UI — keep `listCandidates()` returning `EventCandidate` shapes.

## Android follow-up path

1. Lock UX on this web/PWA MVP (publishable demo).
2. Wrap with **Capacitor** (or similar) for Android WebView + native plugins.
3. Replace mock connectors with Android calendar / notification / (where allowed) SMS or account-linked email APIs.
4. Keep reminder stacks and pet XP logic shared; only the connector + notification delivery layers go native.

## Design notes

Dark-only atmospheric UI (no light theme). Brand **LUMINA** is the hero signal. Fonts: Syne + Outfit. Accents: cyan / lime / coral / amber on deep navy-black — not purple-default AI chrome.
