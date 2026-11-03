/**
 * Geo helpers (moved from services/api core/database in Phase 0).
 * Used by check-in (≤ CHECKIN_MAX_RADIUS_METERS) and Radar dispatch.
 * Pure functions only — radius thresholds come from system_configs, not from here.
 */

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance in meters between two WGS-84 points (Haversine). */
export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  for (const [name, v] of [['lat1', lat1], ['lon1', lon1], ['lat2', lat2], ['lon2', lon2]] as const) {
    if (!Number.isFinite(v)) throw new Error(`haversineDistanceMeters: ${name} is not a finite number`);
  }
  if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90) throw new Error('haversineDistanceMeters: latitude out of range');
  if (Math.abs(lon1) > 180 || Math.abs(lon2) > 180) throw new Error('haversineDistanceMeters: longitude out of range');

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
