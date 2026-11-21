# Published Android artifacts

Debug APKs are **not** stored in this folder (they must stay out of the Cursor web publish package).

**Also excluded from web publish:** `android/gradle/wrapper/gradle-wrapper.jar` (gitignored; restore via `npm run android:ensure-wrapper`). APKs and the Gradle wrapper jar are Android build artifacts — not part of the shipped web app.

**Download:** GitHub Release asset  
https://github.com/zambooty/lumina-adhd-calendar/releases/download/android-debug-2026-11-21-updates/lumina-debug.apk

| | |
|---|---|
| Built from | `main` @ `13a066e` (in-app updates, PR #27) |
| versionCode | `2` (`1.1.0-debug`) |
| SHA-256 | `47e35625db81dcc9a138c5ca3768283765315ae7336028ac7db02f05c78814dd` |

Rebuild locally with `npm run android:debug` (runs `android:ensure-wrapper`, then Cap sync + `assembleDebug`; APK under `android/app/build/outputs/apk/`).

When publishing a new APK: bump `versionCode` in `android/app/build.gradle`, put `versionCode: N` in the GitHub Release body, update `public/android-latest.json`, and republish the web app so in-app update check sees it (`docs/android-in-app-updates.md`).
