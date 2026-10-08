// USB-serial adapters commonly fitted to ESP32 dev boards.
const ESP_USB_VENDORS = new Set([
  '10c4', // Silicon Labs CP210x
  '1a86', // WCH CH340/CH9102
  '0403', // FTDI
  '303a', // Espressif native USB
]);

export function isLikelyEspPort(info) {
  return ESP_USB_VENDORS.has(String(info?.vendorId ?? '').toLowerCase());
}

/** Likely ESP32 ports first, then any other port, so a clone with an unknown chip still works. */
export function rankPorts(ports) {
  const likely = ports.filter(isLikelyEspPort);
  const others = ports.filter((port) => !isLikelyEspPort(port));
  return [...likely, ...others].map((port) => port.path);
}

export async function listCandidatePorts() {
  const { SerialPort } = await import('serialport');
  return rankPorts(await SerialPort.list());
}
