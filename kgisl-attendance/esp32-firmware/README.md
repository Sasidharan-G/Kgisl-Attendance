# KGiSL ESP32 Classroom Beacon Firmware

Target: classic ESP32-WROOM-32 development board (`esp32dev`). The board does
not join college Wi-Fi. It receives authenticated packets from the smart-board
helper over USB serial and broadcasts them as BLE manufacturer data.

## Serial contract

- Baud: `115200`
- Health: helper sends `PING`, board returns `PONG:KGS1`
- Update: `KGS1:<28-character-packet>`, board returns `ACK:KGS1`
- Stop: `STOP`, board returns `ACK:STOP`
- Safety: advertising automatically stops 35 seconds after the last update

The prototype manufacturer ID is `0xFFFF`, matching the Android debug app. It
must be replaced with a lawfully assigned product identifier before release.

## Build / upload

```powershell
pio run
pio run --target upload --upload-port COM3
pio device monitor --port COM3 --baud 115200
```
