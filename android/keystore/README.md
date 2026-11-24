# LUMINA debug keystore

`lumina-debug.keystore` is the **shared debug signing key** for Cap sideload APKs.

Android only allows in-place upgrades when the new APK is signed with the **same** certificate as the installed app. Agent/CI machines each generate a different `~/.android/debug.keystore`, which produces “App not installed as package conflicts with an existing package.”

This project keystore is intentional for debug sideload continuity — not a Play Store / release key. Keep release signing elsewhere (private secrets).

| | |
|---|---|
| Alias | `lumina-debug` |
| Store / key password | `android` |
| Used by | `android/app/build.gradle` `signingConfigs.debug` |
