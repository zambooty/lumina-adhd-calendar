# Android-native capture paths (Capacitor follow-up)

Web MVP already supports **paste / file upload** for Notes, IMAP email, SMS, and voicemail transcripts. This doc lists native Android hooks for a later Capacitor wrap (`com.makesoft.lumina`) without blocking the web slice.

## Shared contract
Keep using `SourceConnector.listCandidates` + `ingestText` and the local import queue. Native plugins should call the same ingest helpers (or write into the same queue shape) so ADHD reminder stacks + pet XP stay unchanged.

Fingerprints for dismiss / no-repeat: `src/lib/pullFilter.ts` (`dismissedKeys` on `AppState`).

## Notes
| Approach | Permission / API | Notes |
|----------|------------------|-------|
| Share sheet → LUMINA | None beyond receive | Best MVP: user shares a note export into the WebView |
| SAF file pick | Storage Access Framework | Mirrors web “Upload file” |
| OEM Notes sync | Vendor-specific | Avoid; fragile across Pixel / Samsung |

## SMS
| Approach | Permission | Notes |
|----------|------------|-------|
| Paste / share thread | None | Matches web MVP |
| `READ_SMS` + inbox query | Dangerous permission; Play policy scrutiny | One-shot sync on user tap, not continuous listen |
| Twilio webhook | Server secrets | Works for a dedicated LUMINA number; same `/api/capture/twilio-sms` stub |

Prefer **user-initiated sync** over background SMS listeners.

## Voicemail
| Approach | API | Notes |
|----------|-----|-------|
| Share audio / transcript into app | Share intent | Best cross-OEM path |
| Visual voicemail providers | Carrier / OEM | Highly fragmented — do not hard-depend |
| On-device STT | SpeechRecognizer / ML Kit | Optional offline path when Whisper key absent |
| Whisper upload | `OPENAI_API_KEY` / `WHISPER_API_KEY` | Same `/api/capture/transcribe` as web |

## IMAP / non-Gmail email
- Web: paste + local IMAP prefs (host/user/port; session password).
- Android: same prefs UI in WebView; live IMAP fetch stays server-side when `IMAP_LIVE_ENABLED` is set.
- Outlook/Yahoo OAuth can be added later as Capacitor Browser + system WebView flows.

## Capacitor wiring sketch
1. `npm run cap:sync` after web build.
2. Add share-target intent filters for `text/plain` + `audio/*`.
3. Bridge shared payloads → `ingestCaptureText(kind, text)` or voicemail transcript ingest.
4. Keep Google Calendar + Gmail on existing GIS / redirect OAuth paths.

## Non-goals (now)
- Shipping Play-store SMS permission in this PR
- OEM voicemail deep integration
- Replacing the web paste/upload UX
