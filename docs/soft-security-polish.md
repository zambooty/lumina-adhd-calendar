# Soft security polish (ACA-40)

Non-blocking follow-ups from the last publish / security review.

## Token storage

| Surface | Access token | Refresh token |
|---------|--------------|---------------|
| Memory | yes (preferred) | yes |
| `sessionStorage` | yes (tab / Cap WebView) | yes |
| `localStorage` | **never** | web only, ≤24h bridge |
| Cap native `localStorage` | **never** | **never** (cleared on read/write) |

Connect Google / Cap Custom Tabs OAuth and CSRF `state` are unchanged. Tokens are not written to `console.*`.

## Android backup / FileProvider

- `android:allowBackup="false"`
- `@xml/backup_rules` + `@xml/data_extraction_rules` exclude app data domains
- FileProvider: `cache-path` + `files-path` only (no `external-path` root)

## Gradle wrapper jar

- `android/gradle/wrapper/gradle-wrapper.jar` is gitignored → excluded from Cursor web publish packing
- `gradle-wrapper.properties` stays tracked (pins Gradle 8.14.3)
- Restore: `npm run android:ensure-wrapper` (also wired into `android:debug`)

## Intentionally unchanged

- `CAPTURE_TRANSCRIBE_ALLOWED_EMAILS` / Whisper spend gate
- OAuth CSRF `state` requirement
- No APK in the web ship package
