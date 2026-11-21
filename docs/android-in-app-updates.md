# Android in-app updates (GitHub Releases)

Cap Android can check for a newer APK, download it, and open the system installer — without Play Store.

## How it works (McKale)

1. Install a Cap build that includes the **AppUpdate** plugin (`versionCode` ≥ 2).
2. On launch (throttled) or **Menu → Check for updates**, LUMINA asks the published host for the latest build:
   - `GET /api/android/update` (GitHub Releases first, then `public/android-latest.json`)
3. If `latest.versionCode > installed.versionCode`, a dark glass sheet shows **Update available**.
4. **Download & install** → APK lands in app cache → system package installer.
5. First time: Android may ask to **allow installs from LUMINA** (`REQUEST_INSTALL_PACKAGES` / unknown apps). Allow, then tap Install again.

Silent download uses the **public** GitHub Releases asset URL (`browser_download_url`) — **no `GITHUB_TOKEN` required** while the repo stays public.

Pull / SMS / Google Connect are unchanged.

## Versioning

| Field | Where | Rule |
|-------|--------|------|
| `versionCode` | `android/app/build.gradle` | Integer; **bump every published APK** |
| `versionName` | same | Human label (e.g. `1.1.0-debug`) |
| Release body | GitHub Release | Include `versionCode: N` so the API can parse it |
| Manifest | `public/android-latest.json` | Keep in sync when publishing an APK |

Comparison is **integer `versionCode` only** (not tag date strings).

## Downloads (public repo)

| Path | Needs |
|------|--------|
| Update **check** | Public GitHub Releases API, or `android-latest.json` fallback |
| In-app **download** | Public release asset URL (no token) |
| Fallback | Sheet → **Open GitHub release**; optional `GITHUB_TOKEN` only if the repo is private again or GitHub rate-limits anonymous API |

Do not embed a PAT inside the APK.

## Debug sideload (current path)

- Works with the usual **debug-signed** APK from `npm run android:debug`.
- In-place upgrade requires the **same debug keystore** that signed the installed app. If install fails with a signature mismatch, uninstall LUMINA once, then install the new APK.
- Tag pattern: `android-debug-*` with asset `lumina-debug.apk`.

## Signed release path (when you want it)

1. Create a release keystore (keep it out of git; store the passwords in a password manager / CI secrets — not chat).
2. Configure `android/app/build.gradle` `signingConfigs.release` + `buildTypes.release.signingConfig`.
3. `cd android && ./gradlew assembleRelease`
4. Publish GitHub Release tag `android-release-YYYY-MM-DD` with asset `lumina-release.apk` and `versionCode: N` in the body.
5. Update `public/android-latest.json` (`channel: "release"`) and republish the web app so the check endpoint sees it.
6. Testers on debug builds cannot upgrade to release-signed APKs in place — uninstall first (different signing keys).

Play Store later would use Play in-app updates instead of this sideload flow.

## After merging this feature

**Yes — rebuild and ship a new debug APK** so McKale gets the native plugin + `versionCode` 2. Then:

1. Merge PR → republish web app (API + `android-latest.json`).
2. `npm run android:debug` → upload `lumina-debug.apk` to a new `android-debug-*` Release.
3. Put `versionCode: 2` (or higher) in the release body and update `public/android-latest.json`.

Until McKale installs that first updater APK, he still updates the old way (download from GitHub / Project media).

## API

| Route | Purpose |
|-------|---------|
| `GET /api/android/update` | Latest metadata + public download URL |
| `GET /api/android/apk?tag=&asset=` | Optional proxy stream (public OK; token optional) |
| `GET /android-latest.json` | Static fallback manifest |

## Native plugin

- Android: `com.makesoft.lumina.AppUpdatePlugin`
- JS: `src/lib/appUpdate.ts` (`registerPlugin('AppUpdate')`)

Methods: `getInstalledVersion`, `canRequestPackageInstalls`, `openInstallPermissionSettings`, `downloadAndInstall`, `installDownloadedApk`.
