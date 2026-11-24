# Published Android artifacts

Debug APKs are **not** stored in this folder (they must stay out of the Cursor web publish package).

**Also excluded from web publish:** `android/gradle/wrapper/gradle-wrapper.jar` (gitignored; restore via `npm run android:ensure-wrapper`). APKs and the Gradle wrapper jar are Android build artifacts — not part of the shipped web app.

**Download:** GitHub Release asset  
https://github.com/zambooty/lumina-adhd-calendar/releases/download/android-debug-2026-11-24-1.1.4/lumina-debug.apk

| | |
|---|---|
| Built from | Shared Cap debug keystore via gitignored `local.properties` (no keystore/passwords in repo) |
| versionCode | `6` (`1.1.4-debug`) |
| SHA-256 | `fea502e34693492680807fbdc84011a7be417a6c5d5dee84692510c1e8c20cb5` |

Rebuild locally with `npm run android:debug`. Never commit `*.keystore` / `*.jks` or plaintext signing passwords.

When publishing a new APK: bump `versionCode` in `android/app/build.gradle`, put `versionCode: N` in the GitHub Release body, update `public/android-latest.json`, and republish the web app so in-app update check sees it (`docs/android-in-app-updates.md`).
