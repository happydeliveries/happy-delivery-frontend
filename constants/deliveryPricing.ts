// Happy Deliveries Radial Distance Delivery Pricing (ZAR)
// 0 - 5 km:    R20 - R25
// >5 - 10 km:  R25 - R40
// >10 km:      R45 - R50

export const DEFAULT_BASE_DELIVERY_FEE = 20;

export function calculateRadialDistanceKm(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null
): number | null {
  const aLat = Number(lat1);
  const aLng = Number(lng1);
  const bLat = Number(lat2);
  const bLng = Number(lng2);
  if (
    !Number.isFinite(aLat) ||
    !Number.isFinite(aLng) ||
    !Number.isFinite(bLat) ||
    !Number.isFinite(bLng) ||
    (aLat === 0 && aLng === 0) ||
    (bLat === 0 && bLng === 0)
  ) {
    return null;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return +(R * c).toFixed(2);
}

export function calculateRadialDeliveryFee(
  distanceKm: number,
  deliveryRadiusKm: number = 15
): number {
  const d = Math.max(0, Number(distanceKm) || 0);

  if (d <= 5) {
    return Math.min(25, Math.max(20, Math.round(20 + (d / 5) * 5)));
  }

  if (d <= 10) {
    return Math.min(40, Math.max(25, Math.round(25 + ((d - 5) / 5) * 15)));
  }

  const upperKm = Math.max(Number(deliveryRadiusKm) || 15, 11);
  const spanKm = Math.max(1, upperKm - 10);
  const ratio = Math.min(1, Math.max(0, (d - 10) / spanKm));
  return Math.min(50, Math.max(45, Math.round(45 + ratio * 5)));
}

export function getDeliveryTierLabel(distanceKm?: number | null): string {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(Number(distanceKm))) {
    return 'Calculated by distance (R20–R50)';
  }
  const d = Math.max(0, Number(distanceKm));
  if (d <= 5) return `${d.toFixed(1)} km • 0–5 km tier`;
  if (d <= 10) return `${d.toFixed(1)} km • 5–10 km tier`;
  return `${d.toFixed(1)} km • 10+ km tier`;
}
