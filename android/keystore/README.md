# LUMINA debug keystore (local only)

The Cap debug signing keystore is **not** shipped in the web app package and
**must not** be committed.

Android only allows in-place upgrades when the new APK uses the same signing
certificate as the installed app. Place the shared debug keystore on the build
machine (not in git), then point Gradle at it via `android/local.properties`
(also gitignored):

```
lumina.debug.storeFile=keystore/lumina-debug.keystore
lumina.debug.storePassword=…
lumina.debug.keyAlias=…
lumina.debug.keyPassword=…
```

Restore helpers: `npm run android:ensure-debug-keystore` (copies from the
project media signing folder when available on agent machines).

Release / Play signing stays elsewhere — never put release secrets in the repo.
