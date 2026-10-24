# KGiSL Smart-board Beacon Helper

This localhost-only Windows helper relays a backend-issued BLE beacon packet
from the faculty web app to the ESP32 over USB serial. It never receives the
server HMAC key and cannot mint or modify valid attendance packets.

## Zero-touch setup (recommended)

Use one shared classroom PC for the ESP32; individual faculty laptops do not need the helper or USB driver.
On that classroom PC, install the Node.js LTS version and the ESP32 USB adapter driver once. For a CP210x
adapter, use the official [Silicon Labs VCP driver](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers).
Then double-click `install-classroom-autostart.bat` in the project root once. It installs and starts the helper,
which starts automatically whenever someone signs in to Windows.

Every class after that is:

1. Faculty signs in and starts the session. The BLE beacon panel starts by itself.
2. Faculty signs in using the browser on that same classroom PC. Keep the ESP32 plugged into it and the PC
   powered on with network access; the beacon helper is local to that PC.
3. The helper detects the board, the panel turns **Live**, and student phones are marked automatically.

The helper creates its own `.env` on first start (secret key, `ESP32_SERIAL_PORT=auto`, allowed sites) and hands the
key to the attendance website by itself, so nothing has to be typed or pasted. If the cable is pulled and plugged
back in mid-class it reconnects automatically. Logs go to `helper.log`.

`start-classroom.bat` still works as a manual launcher. `ESP32_SERIAL_PORT=auto` finds the ESP32 USB adapter
(CP210x / CH340 / FTDI) by itself; set `COM5` to force a port. `HELPER_ALLOWED_ORIGIN` accepts a comma-separated
list of site origins. Chrome on the classroom PC may ask once to allow this site to reach local devices; choose
**Allow**. The project's `start-classroom.bat` launcher reports a missing CP210x driver (Device Manager Code 28)
and links to the official driver page.

Run the helper tests with `npm test` (they use a simulated ESP32, no hardware needed).

## Board-independent simulation

```powershell
$env:HELPER_API_KEY='replace-with-at-least-32-random-characters'
npm run start:virtual
```

The helper listens on `127.0.0.1:43821`. Virtual mode keeps the latest framed
packets in memory, allowing the faculty integration to be developed without an
ESP32.

## Serial mode (after the board firmware is ready)

Set `HELPER_TRANSPORT=serial`, `ESP32_SERIAL_PORT=COM3`, and start the helper.
Packets are sent as one ASCII line: `KGS1:<28-character-base64url-packet>`.
The helper performs a `PING`/`PONG:KGS1` handshake after opening the port and
requires `ACK:KGS1` for every packet; a missing acknowledgement triggers one
automatic reconnect and retry.

The service binds only to loopback, enforces an exact browser origin, requires
`x-helper-key`, rejects expired packets, and never logs packet contents.
