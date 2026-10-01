#include <Arduino.h>
#include <NimBLEDevice.h>

namespace {
constexpr uint8_t kMagic = 0x4B;
constexpr uint8_t kVersion = 1;
constexpr size_t kPacketBytes = 21;
constexpr size_t kPacketTextLength = 28;
constexpr uint16_t kPrototypeManufacturerId = 0xFFFF;
constexpr uint32_t kSerialBaud = 115200;
constexpr uint32_t kPacketWatchdogMs = 35000UL;
constexpr size_t kMaxSerialLine = 96;

NimBLEAdvertising* advertising = nullptr;
String serialLine;
uint32_t lastPacketAt = 0;
bool broadcasting = false;

int8_t base64UrlValue(char character) {
  if (character >= 'A' && character <= 'Z') return character - 'A';
  if (character >= 'a' && character <= 'z') return character - 'a' + 26;
  if (character >= '0' && character <= '9') return character - '0' + 52;
  if (character == '-') return 62;
  if (character == '_') return 63;
  return -1;
}

bool decodePacket(const String& encoded, uint8_t output[kPacketBytes]) {
  if (encoded.length() != kPacketTextLength) return false;
  uint32_t accumulator = 0;
  uint8_t bitCount = 0;
  size_t outputOffset = 0;
  for (size_t index = 0; index < encoded.length(); ++index) {
    const int8_t value = base64UrlValue(encoded[index]);
    if (value < 0) return false;
    accumulator = (accumulator << 6) | static_cast<uint8_t>(value);
    bitCount += 6;
    while (bitCount >= 8) {
      bitCount -= 8;
      if (outputOffset >= kPacketBytes) return false;
      output[outputOffset++] = static_cast<uint8_t>((accumulator >> bitCount) & 0xFF);
    }
  }
  return outputOffset == kPacketBytes && output[0] == kMagic && output[1] == kVersion;
}

void stopBroadcast() {
  if (!broadcasting) return;
  advertising->stop();
  broadcasting = false;
}

void broadcastPacket(const uint8_t packet[kPacketBytes]) {
  stopBroadcast();
  std::string manufacturerData;
  manufacturerData.reserve(2 + kPacketBytes);
  manufacturerData.push_back(static_cast<char>(kPrototypeManufacturerId & 0xFF));
  manufacturerData.push_back(static_cast<char>(kPrototypeManufacturerId >> 8));
  manufacturerData.append(reinterpret_cast<const char*>(packet), kPacketBytes);

  NimBLEAdvertisementData advertisementData;
  advertisementData.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
  advertisementData.setManufacturerData(manufacturerData);
  advertising->setAdvertisementData(advertisementData);
  // BLE units are 0.625 ms: 160 = 100 ms. Fast repetition lets phones obtain
  // three stable observations without opening a connection to the ESP32.
  advertising->setMinInterval(160);
  advertising->setMaxInterval(240);
  advertising->start();
  broadcasting = true;
  lastPacketAt = millis();
}

void handleSerialLine(String line) {
  line.trim();
  if (line == "PING") {
    Serial.println("PONG:KGS1");
    return;
  }
  if (line == "STOP") {
    stopBroadcast();
    Serial.println("ACK:STOP");
    return;
  }
  if (!line.startsWith("KGS1:")) {
    Serial.println("ERR:FRAME");
    return;
  }

  uint8_t packet[kPacketBytes]{};
  if (!decodePacket(line.substring(5), packet)) {
    Serial.println("ERR:PACKET");
    return;
  }
  broadcastPacket(packet);
  // Never echo the bearer packet back into logs.
  Serial.println("ACK:KGS1");
}
}

void setup() {
  Serial.begin(kSerialBaud);
  serialLine.reserve(kMaxSerialLine);
  NimBLEDevice::init("KGISL-BEACON");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  advertising = NimBLEDevice::getAdvertising();
  Serial.println("READY:KGS1");
}

void loop() {
  while (Serial.available() > 0) {
    const char character = static_cast<char>(Serial.read());
    if (character == '\n') {
      handleSerialLine(serialLine);
      serialLine = "";
    } else if (character != '\r') {
      if (serialLine.length() < kMaxSerialLine) serialLine += character;
      else { serialLine = ""; Serial.println("ERR:OVERFLOW"); }
    }
  }

  // Fail closed: if the helper crashes or USB is unplugged, the old valid-looking
  // classroom token is no longer advertised indefinitely.
  if (broadcasting && millis() - lastPacketAt > kPacketWatchdogMs) {
    stopBroadcast();
    Serial.println("EXPIRED:KGS1");
  }
  delay(2);
}
