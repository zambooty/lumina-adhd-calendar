# Published Android artifacts

Debug APKs are **not** stored in this folder (they must stay out of the Cursor web publish package).

**Also excluded from web publish:** `android/gradle/wrapper/gradle-wrapper.jar` (gitignored; restore via `npm run android:ensure-wrapper`). APKs and the Gradle wrapper jar are Android build artifacts — not part of the shipped web app.

**Download:** GitHub Release asset  
https://github.com/zambooty/lumina-adhd-calendar/releases/download/android-debug-2026-11-21-pullfix/lumina-debug.apk

| | |
|---|---|
| Built from | `main` @ `dff91a0` (PR #23 Android Pull hang fix) |
| SHA-256 | `48acc38b4c4134e4842a4d9cd439920bd166820fb44f10356faa82a27b52be17` |

Rebuild locally with `npm run android:debug` (runs `android:ensure-wrapper`, then Cap sync + `assembleDebug`; APK under `android/app/build/outputs/apk/`).
