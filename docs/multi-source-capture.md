# Multi-source capture (shipped slice)

## What works without secrets
- **Notes** — paste or upload `.txt` / `.md`
- **IMAP / other email** — paste body / `.eml` text; save Outlook/Yahoo/iCloud/generic host prefs locally
- **SMS** — paste thread text
- **Voicemail** — paste transcript; audio upload prompts for Whisper when unbound

Import → local queue → **Pull from sources** → inbox → schedule (default ADHD reminder stack) → pet XP on pull + schedule.

## Optional secrets (honest empty / stub when missing)
| Secret | Effect |
|--------|--------|
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` | `/api/capture/twilio-sms` accepts webhooks |
| `WHISPER_API_KEY` or `OPENAI_API_KEY` | `/api/capture/transcribe` speech-to-text |
| `IMAP_LIVE_ENABLED=true` | Flags IMAP live path (fetch still stubbed; paste works) |

Status booleans only: `GET /api/capture/status`.

## Demo-off when Google live
Notes/SMS demo samples are skipped when Google is configured + connected. Imports and Google pulls remain.

## Dismiss / no-repeat compatibility
Pull dedupes with `candidateFingerprint` (`source|title|start`) plus legacy `title|start`. Dismiss records fingerprints on `AppState.dismissedFingerprints` for the sibling dismiss-memory PR.

## Android
See `docs/android-native-capture.md`.
