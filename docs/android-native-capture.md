# Android-native capture (Capacitor)

On **Capacitor Android**, **Pull** is one button: Google Calendar + Gmail (when connected) plus automatic native collection into the same import queue / `pullFilter` / Blink XP path as the web paste MVP.

## What Pull does on device

1. **Share-target drain** — any text/audio shared into LUMINA since last consume.
2. **SMS inbox** — requests `READ_SMS`, scans recent messages with appointment heuristics, ingests hits via `smsConnector.ingestText`.
3. **Voicemail** — OEM visual-voicemail APIs are **not** wired (fragmented). Shared `audio/*` → Whisper `/api/capture/transcribe` when Google-connected + Whisper key; otherwise paste transcript.
4. **Email** — Gmail via existing Google token; IMAP prefs / paste unchanged.
5. **Notes** — Android share-target (`text/plain`) + paste/upload fallback.
6. Then existing connectors `listCandidates` + `filterPulledCandidates` → inbox / auto-schedule → reminder stacks → pet XP.

## Permissions (debug / sideload)

| Permission | Why |
|------------|-----|
| `INTERNET` | Live `/api/*` + Google |
| `POST_NOTIFICATIONS` | ADHD reminder stacks → OS notifications (API 33+) |
| `SCHEDULE_EXACT_ALARM` | Fire reminder offsets on time |
| `READ_SMS` | Auto-pull appointment-like SMS on Pull |

### Play Store honesty

**`READ_SMS` is likely to be rejected** for a general productivity app on Play. This debug/sideload path **does not silently no-op** — if permission is denied, Pull surfaces an explicit hint (grant SMS, or paste/share a thread). Structure is ready to swap to **Notification Listener** or a Play-approved SMS path later without changing the JS ingest contract (`SourceConnector` / `ingestText` / `dismissedKeys`).

## Share targets

`MainActivity` accepts:

- `ACTION_SEND` / `SEND_MULTIPLE` + `text/plain`
- `ACTION_SEND` / `SEND_MULTIPLE` + `audio/*`

Payloads are stashed in `NativeCapturePlugin` and consumed on Pull (or cold start drain).

## Plugin

- Android: `com.makesoft.lumina.NativeCapturePlugin`
- JS: `src/lib/nativeCapture.ts` (`registerPlugin('NativeCapture')`)

Methods: `getCapabilities`, `checkSmsPermission`, `requestSmsPermission`, `readRecentSms`, `consumeSharedPayload`, `getVoicemailStatus`.

## Web unchanged

Paste / file upload in `CaptureImport` still works in browsers. Native paths only run when `Capacitor.getPlatform() === 'android'`.
