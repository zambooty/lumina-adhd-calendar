# Published Android artifacts

Debug APKs are **not** stored in this folder (they must stay out of the Cursor web publish package).

**Also excluded from web publish:** `android/gradle/wrapper/gradle-wrapper.jar` (gitignored; restore via `npm run android:ensure-wrapper`). APKs and the Gradle wrapper jar are Android build artifacts — not part of the shipped web app.

**Download:** GitHub Release asset  
https://github.com/zambooty/lumina-adhd-calendar/releases/download/android-debug-2026-11-24-1.1.2/lumina-debug.apk

| | |
|---|---|
| Built from | Cap debug keystore (local/agent only; not in web package) |
| versionCode | `4` (`1.1.2-debug`) |
| SHA-256 | `c852cc612589a0991a6f4f140e2bdf0bee04bf5e4691441faee83b7101e3e44f` |

Rebuild locally with `npm run android:debug` (wrapper + optional keystore restore + Cap sync + `assembleDebug`). Keep the debug keystore and passwords in gitignored `android/local.properties` — never commit them.

When publishing a new APK: bump `versionCode` in `android/app/build.gradle`, put `versionCode: N` in the GitHub Release body, update `public/android-latest.json`, and republish the web app so in-app update check sees it (`docs/android-in-app-updates.md`).
