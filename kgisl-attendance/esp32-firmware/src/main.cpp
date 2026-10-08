// KGiSL classroom BLE beacon.
//
// The smart-board helper feeds backend-signed packets over USB serial; this
// board only relays them as BLE manufacturer data. It holds no secrets and
// never connects to Wi-Fi.
//
// Serial protocol (115200 8N1, newline terminated):
//   PING              -> PONG:KGS1
//   KGS1:<28 chars>   -> ACK:KGS1 | ERR:PACKET
//   STOP              -> ACK:STOP
//   (anything else)   -> ERR:FRAME
//   line too long     -> ERR:OVERFLOW
// Unsolicited: READY:KGS1 on boot, EXPIRED:KGS1 when the watchdog fires.
#include <Arduino.h>
#include <NimBLEDevice.h>

namespace {
constexpr uint8_t kMagic = 0x4B;  // 'K'
constexpr uint8_t kVersion = 1;
constexpr size_t kPacketBytes = 21;
constexpr size_t kPacketTextLength = 28;  // base64url of 21 bytes, no padding
constexpr uint16_t kManufacturerId = 0xFFFF;  // prototype ID; replace before release
constexpr uint32_t kSerialBaud = 115200;
constexpr uint32_t kWatchdogMs = 35000UL;
constexpr size_t kMaxLine = 96;
constexpr uint16_t kAdvMinInterval = 160;  // 100 ms (0.625 ms units)
constexpr uint16_t kAdvMaxInterval = 240;  // 150 ms
constexpr int8_t kLedPin = 2;              // on-board LED on most esp32dev boards

NimBLEAdvertising* advertising = nullptr;
String line;
uint32_t lastPacketAt = 0;
bool broadcasting = false;

int8_t base64UrlValue(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '-') return 62;
  if (c == '_') return 63;
  return -1;
}

bool decodePacket(const String& text, uint8_t out[kPacketBytes]) {
  if (text.length() != kPacketTextLength) return false;
  uint32_t acc = 0;
  uint8_t bits = 0;
  size_t n = 0;
  for (size_t i = 0; i < text.length(); ++i) {
    const int8_t v = base64UrlValue(text[i]);
    if (v < 0) return false;
    acc = (acc << 6) | static_cast<uint8_t>(v);
    bits += 6;
    while (bits >= 8) {
      bits -= 8;
      if (n >= kPacketBytes) return false;
      out[n++] = static_cast<uint8_t>((acc >> bits) & 0xFF);
    }
  }
  return n == kPacketBytes && out[0] == kMagic && out[1] == kVersion;
}

void stopBroadcast() {
  if (!broadcasting) return;
  advertising->stop();
  broadcasting = false;
  digitalWrite(kLedPin, LOW);
}

void startBroadcast(const uint8_t packet[kPacketBytes]) {
  stopBroadcast();

  std::string payload;
  payload.reserve(2 + kPacketBytes);
  payload.push_back(static_cast<char>(kManufacturerId & 0xFF));
  payload.push_back(static_cast<char>(kManufacturerId >> 8));
  payload.append(reinterpret_cast<const char*>(packet), kPacketBytes);

  NimBLEAdvertisementData data;
  data.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
  data.setManufacturerData(payload);
  advertising->setAdvertisementData(data);
  // The 31-byte advertisement is full, so the name rides in the scan response. Browsers (Web
  // Bluetooth) list the beacon as "KGISL-BEACON" instead of "Unknown device".
  NimBLEAdvertisementData scanResponse;
  scanResponse.setName("KGISL-BEACON");
  advertising->setScanResponseData(scanResponse);
  advertising->enableScanResponse(true);
  advertising->setMinInterval(kAdvMinInterval);
  advertising->setMaxInterval(kAdvMaxInterval);
  advertising->start();

  broadcasting = true;
  lastPacketAt = millis();
  digitalWrite(kLedPin, HIGH);
}

void handleLine(String cmd) {
  cmd.trim();
  if (cmd == "PING") {
    Serial.println("PONG:KGS1");
  } else if (cmd == "STOP") {
    stopBroadcast();
    Serial.println("ACK:STOP");
  } else if (cmd.startsWith("KGS1:")) {
    uint8_t packet[kPacketBytes]{};
    if (decodePacket(cmd.substring(5), packet)) {
      startBroadcast(packet);
      Serial.println("ACK:KGS1");  // never echo the bearer packet
    } else {
      Serial.println("ERR:PACKET");
    }
  } else {
    Serial.println("ERR:FRAME");
  }
}
}  // namespace

void setup() {
  pinMode(kLedPin, OUTPUT);
  digitalWrite(kLedPin, LOW);
  Serial.begin(kSerialBaud);
  line.reserve(kMaxLine);

  NimBLEDevice::init("KGISL-BEACON");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  advertising = NimBLEDevice::getAdvertising();

  Serial.println("READY:KGS1");
}

void loop() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\n') {
      handleLine(line);
      line = "";
    } else if (c != '\r') {
      if (line.length() < kMaxLine) {
        line += c;
      } else {
        line = "";
        Serial.println("ERR:OVERFLOW");
      }
    }
  }

  // Fail closed: if the helper dies or USB is unplugged, stop advertising the
  // last token instead of broadcasting it indefinitely.
  if (broadcasting && millis() - lastPacketAt > kWatchdogMs) {
    stopBroadcast();
    Serial.println("EXPIRED:KGS1");
  }
  delay(2);
}
