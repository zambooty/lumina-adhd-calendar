# Published Android artifacts

Debug APKs are **not** stored in this folder (they must stay out of the Cursor web publish package).

**Also excluded from web publish:** `android/gradle/wrapper/gradle-wrapper.jar` (gitignored; restore via `npm run android:ensure-wrapper`). APKs and the Gradle wrapper jar are Android build artifacts — not part of the shipped web app.

**Download:** GitHub Release asset  
https://github.com/zambooty/lumina-adhd-calendar/releases/download/android-debug-2026-11-21-sec/lumina-debug.apk

| | |
|---|---|
| Built from | `main` @ `2269ad3` (soft security: allowBackup=false, FileProvider, ensure-wrapper) |
| SHA-256 | `026d96e2ea90b15f31a4d930ef66818a60223c55d0129bc049e661f36a77ec7c` |

Rebuild locally with `npm run android:debug` (runs `android:ensure-wrapper`, then Cap sync + `assembleDebug`; APK under `android/app/build/outputs/apk/`).
