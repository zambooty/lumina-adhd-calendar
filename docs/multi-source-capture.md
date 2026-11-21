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
| `WHISPER_API_KEY` or `OPENAI_API_KEY` | `/api/capture/transcribe` speech-to-text |
| `IMAP_LIVE_ENABLED=true` | Flags IMAP live path (fetch still stubbed; paste works) |

`GET /api/capture/status` — booleans only (`sttRequiresGoogle: true`).

### Security
- **Transcribe** — verified Google access token (aud/azp = `GOOGLE_CLIENT_ID`) required; origin allowlist + 10MB cap + rate limit as defense-in-depth; `503` when key unbound; never returns key material. Paste still works without Google.
- **Twilio** — validates `X-Twilio-Signature` with auth token when configured; rejects unsigned.

## Demo-off when Google live
Notes/SMS demo samples are skipped when Google is configured + connected. Imports and Google pulls remain.

## Dismiss / no-repeat compatibility
Pull filters via `src/lib/pullFilter.ts` (`dismissedKeys`, external/series keys, hard cap). Multi-source imports share the same dismiss memory after Pull.

## Android
See `docs/android-native-capture.md`.
