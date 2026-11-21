# Published Android artifacts

Debug APKs are **not** stored in this folder (they must stay out of the Cursor web publish package).

**Also excluded from web publish:** `android/gradle/wrapper/gradle-wrapper.jar` (gitignored; restore via `npm run android:ensure-wrapper`). APKs and the Gradle wrapper jar are Android build artifacts — not part of the shipped web app.

**Download:** GitHub Release asset  
https://github.com/zambooty/lumina-adhd-calendar/releases/download/android-debug-2026-11-21-mix/lumina-debug.apk

| | |
|---|---|
| Built from | `main` @ `f264917` (Helvetica + Unified Mix glass UI) |
| SHA-256 | `072a41a28e364c4c1b2dac6ed4d2159400dfbe6515495d5799719a9ab689276f` |

Rebuild locally with `npm run android:debug` (runs `android:ensure-wrapper`, then Cap sync + `assembleDebug`; APK under `android/app/build/outputs/apk/`).
