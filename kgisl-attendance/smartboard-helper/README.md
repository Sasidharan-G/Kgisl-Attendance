# KGiSL Smart-board Beacon Helper

This localhost-only Windows helper relays a backend-issued BLE beacon packet
from the faculty web app to the ESP32 over USB serial. It never receives the
server HMAC key and cannot mint or modify valid attendance packets.

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
