# Android APK Release & Rollback Runbook

## Release Metadata

- **Package ID:** `com.kaanirmak.stockmind`
- **Current Release Target:** `v1.5.1` (`versionCode: 12`)
- **Previous Baseline Build:** `v1.4.1` (`versionCode: 11`)
- **Baseline `public/StockMind.apk` SHA-256:** `72677be35a633c22b6d77de19156a1f31e916e319de082c7997293772e12d39f`

## Build & Signing (OPS-01)

1. Verify version parity across `package.json`, `android/app/build.gradle`, and `src/lib/app/releaseMetadata.ts`.
2. Run GitHub Actions workflow `.github/workflows/build-android-apk.yml` (with repository secrets `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) or run locally:
   ```bash
   npm run build:apk:release
   ```
3. Verify APK signature and record SHA-256:
   ```bash
   apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
   shasum -a 256 public/StockMind.apk
   ```

## Physical Device In-Place Upgrade Check (OPS-02)

1. Ensure the device already has `v1.4.1` (`versionCode 11`) installed with an active session and watchlist/portfolio records.
2. Install the updated APK signed with the same keystore (`adb install -r StockMind.apk` or via in-app updater `/api/download/apk`).
3. Confirm:
   - Installation succeeds over existing package (`com.kaanirmak.stockmind`).
   - User remains signed in (cookies preserved) and portfolio/watchlist entries + push settings remain intact.
   - `/api/app/version` reports matching `version: 1.5.1` and `versionCode: 12`.

## Distribution & Rollback Procedure (OPS-03)

- **Distribution Endpoint:** `GET /api/download/apk` serves `public/StockMind.apk` (with `X-StockMind-SHA256`, `X-StockMind-Version`, `X-StockMind-VersionCode`, and `ETag`) or redirects to CDN `/StockMind.apk`.
- **Version Manifest Endpoint:** `GET /api/app/version` exposes `version`, `versionCode`, `releaseNotes`, `previousVersion`, `previousSha256`, and `rollbackSteps`.
- **Rollback Steps:**
  1. Restore the prior known-good signed APK (`public/StockMind.apk`, baseline SHA-256 `72677be35a633c22b6d77de19156a1f31e916e319de082c7997293772e12d39f`) and verify checksum matches.
  2. Update `src/lib/app/releaseMetadata.ts` and `package.json` release notes / target metadata, then redeploy to Cloudflare Workers.
  3. Note for Android PackageManager: because Android forbids downgrading to a lower `versionCode` in-place, issue any forward fix with a strictly higher `versionCode` (`>= 13`) for devices that already upgraded.
