# Android signing material — do not commit

This directory must stay empty of keystore files in git and in the Cursor web
publish package.

**Default:** `npm run android:debug` uses the Android SDK debug keystore
(`~/.android/debug.keystore`). No passwords belong in the repo.

**Optional shared Cap keystore** (in-place sideload updates across machines):

1. Place `lumina-debug.keystore` here (gitignored) — never commit it.
2. Set credentials only in gitignored `android/local.properties`:

```
lumina.debug.storeFile=keystore/lumina-debug.keystore
lumina.debug.storePassword=…
lumina.debug.keyAlias=…
lumina.debug.keyPassword=…
```

If install says “package conflicts,” uninstall once, then install the new APK.
