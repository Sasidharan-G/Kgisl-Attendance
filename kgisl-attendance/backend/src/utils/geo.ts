/** Haversine distance between two lat/lng points, in meters. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Point-in-polygon test using ray-casting algorithm. */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: { lat: number; lng: number }[]
): boolean {
  let inside = false;
  const x = lng;
  const y = lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;

    const intersect = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Shortest distance from a point to a line segment (in meters). */
export function distanceToSegmentMeters(
  lat: number,
  lng: number,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Use flat-earth projection centered around segment start
  const latRad = toRad((lat1 + lat2) / 2);
  const cosLat = Math.cos(latRad);

  const x1 = 0, y1 = 0;
  const x2 = (lng2 - lng1) * cosLat * R * Math.PI / 180;
  const y2 = (lat2 - lat1) * R * Math.PI / 180;

  const px = (lng - lng1) * cosLat * R * Math.PI / 180;
  const py = (lat - lat1) * R * Math.PI / 180;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  const distSq = (px - projX) ** 2 + (py - projY) ** 2;
  return Math.sqrt(distSq);
}

/** Shortest distance from a point to any edge of the polygon (in meters). */
export function minDistanceToPolygonMeters(
  lat: number,
  lng: number,
  polygon: { lat: number; lng: number }[]
): number {
  let minDist = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const dist = distanceToSegmentMeters(
      lat,
      lng,
      polygon[j].lat,
      polygon[j].lng,
      polygon[i].lat,
      polygon[i].lng
    );
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}
