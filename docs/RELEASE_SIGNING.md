# Release signing

The production workflow never publishes a Debug or unsigned APK.

Configure these encrypted GitHub Actions secrets in **Settings → Secrets and variables → Actions**:

- `ANDROID_KEYSTORE`: base64 of the release `.jks`/`.p12` file (`base64 -w0 release.jks`)
- `KEY_ALIAS`: key alias
- `KEY_PASSWORD`: private-key password
- `STORE_PASSWORD`: keystore password

The private key and passwords must never be committed. The workflow stops before publishing if any secret is absent, verifies the resulting APK with `apksigner`, then reads `versionName` and `versionCode` from the built APK with `aapt` before generating `apk-info.json`.

Keep the keystore backed up securely: losing it prevents updates to installed copies of the app.
