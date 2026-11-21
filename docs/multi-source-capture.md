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
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` | `/api/capture/twilio-sms` accepts signed webhooks |
| `WHISPER_API_KEY` or `OPENAI_API_KEY` | Speech-to-text key (spend still needs allowlist) |
| `CAPTURE_TRANSCRIBE_ALLOWED_EMAILS` | Comma-separated Google emails allowed to spend Whisper |
| `CAPTURE_TRANSCRIBE_ALLOWED_SUBS` | Optional Google subject IDs (same allowlist) |
| `IMAP_LIVE_ENABLED=true` | Flags IMAP live path (fetch still stubbed; paste works) |

`GET /api/capture/status` — booleans only (`whisperConfigured` = key + allowlist; `sttRequiresGoogle` / `sttRequiresAllowlist`).

### Security
- **Transcribe** — fail-closed: Whisper key + allowlist required; caller must present a Google token for this app whose email/sub is allowlisted; per-subject + global rate limits; size cap; origin allowlist. Any signed-in Google user cannot spend the owner key. Paste always works without STT.
- **Twilio** — validates `X-Twilio-Signature` with auth token when configured; rejects unsigned.

## Demo-off when Google live
Notes/SMS demo samples are skipped when Google is configured + connected. Imports and Google pulls remain.

## Dismiss / no-repeat compatibility
Pull filters via `src/lib/pullFilter.ts` (`dismissedKeys`, external/series keys, hard cap). Multi-source imports share the same dismiss memory after Pull.

## Android
Capacitor **Pull** auto-collects SMS (sideload `READ_SMS`), share-target notes/audio, plus Gmail/Calendar when connected. Paste/upload remains the web + fallback path. See `docs/android-native-capture.md`.
