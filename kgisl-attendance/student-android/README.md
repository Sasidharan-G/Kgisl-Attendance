# KGiSL Student Android BLE App

Native Android client for classroom beacon attendance. It logs students in,
scans ESP32 manufacturer data, converts the 21-byte payload to the backend's
28-character base64url packet, gets a precise GPS reading, and submits it to
`POST /api/v1/scan/beacon` with device binding.

## Development status

Source targets Android 8+ (API 26) and Android 15 (API 35). This workstation
currently has no Android SDK/ADB/Gradle installation, so APK compilation and
device execution must be performed after Android Studio installs SDK 35.

Debug builds expose a mock packet field so backend integration can be tested
before ESP32 firmware is available. Release builds hide this control.

## BLE identifier

The prototype scans manufacturer ID `0xFFFF`. This is suitable only for local
development. Before commercial distribution, replace it with an identifier
lawfully assigned for the product; do not ship the prototype identifier.
