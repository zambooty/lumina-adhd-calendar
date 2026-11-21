# Published Android artifacts

Debug APKs are **not** stored in this folder (they must stay out of the Cursor web publish package).

**Also excluded from web publish:** `android/gradle/wrapper/gradle-wrapper.jar` (gitignored; restore via `npm run android:ensure-wrapper`). APKs and the Gradle wrapper jar are Android build artifacts — not part of the shipped web app.

**Download:** GitHub Release asset  
https://github.com/zambooty/lumina-adhd-calendar/releases/download/android-debug-2026-11-21-sms/lumina-debug.apk

| | |
|---|---|
| Built from | `main` @ `685f0e0` (SMS Pull fix, PR #25) |
| SHA-256 | `c97985b9094af8572c913f474d077d1b154673a80aec39de261e6c7fe5590628` |

Rebuild locally with `npm run android:debug` (runs `android:ensure-wrapper`, then Cap sync + `assembleDebug`; APK under `android/app/build/outputs/apk/`).

When publishing a new APK: bump `versionCode` in `android/app/build.gradle`, put `versionCode: N` in the GitHub Release body, update `public/android-latest.json`, and republish the web app so in-app update check sees it (`docs/android-in-app-updates.md`).
