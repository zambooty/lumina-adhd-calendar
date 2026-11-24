# Android signing material — do not commit

This directory must stay empty of keystore files in git and in the Cursor web
publish package.

**Default:** `npm run android:debug` uses the Android SDK debug keystore
(`~/.android/debug.keystore`). No passwords belong in the repo.

**Optional shared Cap keystore** (in-place sideload updates across machines):
generate a keystore on your machine only, never commit it, and never put
passwords in tracked Gradle files. If install says “package conflicts,”
uninstall once, then install the new APK.
