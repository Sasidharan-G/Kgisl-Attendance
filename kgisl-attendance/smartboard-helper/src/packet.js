export const PACKET_TEXT_LENGTH = 28;
export const PACKET_BINARY_LENGTH = 21;

export function validateBeaconPacketShape(packet) {
  if (typeof packet !== 'string' || !/^[A-Za-z0-9_-]{28}$/.test(packet)) {
    throw new Error('packet must be a 28-character base64url BLE beacon packet');
  }
  const bytes = Buffer.from(packet, 'base64url');
  if (bytes.length !== PACKET_BINARY_LENGTH || bytes[0] !== 0x4b || bytes[1] !== 1) {
    throw new Error('packet has an unsupported magic byte, version, or length');
  }
  return packet;
}

export function serialFrame(packet) {
  return `KGS1:${validateBeaconPacketShape(packet)}\n`;
}

export function packetIssuedAt(packet) {
  const bytes = Buffer.from(validateBeaconPacketShape(packet), 'base64url');
  return bytes.readUInt32BE(4) * 1000;
}
