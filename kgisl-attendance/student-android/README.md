# KGiSL Attendance — Student Android App

The student client for KGiSL attendance. Students sign in with their college
account and can:

- **Alpha · Bluetooth** (primary): scan the classroom ESP32 beacon. The app reads the
  manufacturer data, converts the 21-byte payload to the backend's 28-character
  base64url packet, waits for three stable observations, gets a precise GPS fix and
  submits to `POST /api/v1/scan/beacon`.
- **Beta · QR** (fallback): scan the faculty's rotating signed QR and submit to
  `POST /api/v1/scan`.
- **History**: per-subject attendance percentage and session-by-session record.
- **Leave**: submit leave / on-duty requests and track their status.

Both methods use the same one-device-per-student binding (Android ID).

## Build

Source targets Android 8+ (API 26) and Android 15 (API 35); requires Android SDK 36.

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
./gradlew testDebugUnitTest assembleDebug
```

The API origin defaults to the production Render URL; override with
`-PapiBaseUrl=https://your-host`. Debug builds also show an editable backend URL on the
login screen and a mock-beacon-packet field, so integration can be tested without
the ESP32. Release builds hide both.

## Release build (signed APK / Play AAB)

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
./gradlew testDebugUnitTest assembleRelease bundleRelease
# app/build/outputs/apk/release/app-release.apk   -> share with students
# app/build/outputs/bundle/release/app-release.aab -> upload to Play Console
```

Signing uses `keystore.properties` + `keystore/kgisl-release.jks` (both git-ignored). **Back them up
somewhere safe: every future update must be signed with the same key.** Without them the build
produces an unsigned release APK. Students download the latest APK from the GitHub release
`android-v*`; upload a new APK as `KGiSL-Attendance.apk` on a new release to update the web link.

Account note: web accounts protected with Face ID / Touch ID (passkey) cannot mark from this app;
ask faculty to reset the device if a student switches from web to the app.

## BLE identifier

The prototype scans manufacturer ID `0xFFFF`. This is suitable only for local
development. Before commercial distribution, replace it with an identifier
lawfully assigned for the product; do not ship the prototype identifier.
