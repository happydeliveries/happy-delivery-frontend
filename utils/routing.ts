import type { Ionicons } from '@expo/vector-icons';

export type LatLngCoord = {
  latitude: number;
  longitude: number;
};

export type RouteStep = {
  instruction: string;
  streetName?: string | null;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType?: string;
  modifier?: string | null;
  coordinate?: LatLngCoord | null;
};

export type PreviewRouteLeg = {
  leg: string;
  reactNativeCoords: LatLngCoord[];
  leafletCoords?: [number, number][];
  distanceKm: number | null;
  durationMinutes: number | null;
  source?: string;
  fallback?: boolean;
};

export type OrderRouteData = {
  orderId?: string;
  status?: string;
  leg?: 'to_restaurant' | 'to_customer' | 'preview_to_customer';
  origin?: LatLngCoord | null;
  destination?: LatLngCoord | null;
  driverCoords?: LatLngCoord | null;
  restaurantCoords?: LatLngCoord | null;
  customerCoords?: LatLngCoord | null;
  reactNativeCoords: LatLngCoord[];
  leafletCoords?: [number, number][];
  distanceKm: number | null;
  durationMinutes: number | null;
  steps: RouteStep[];
  source?: string;
  fallback?: boolean;
  fetchedAt?: number;
  previewRoute?: PreviewRouteLeg | null;
};

/**
 * Parse coordinates from GeoJSON, Postgres point, socket payload, or address object.
 */
export function parseCoordinates(location: any): LatLngCoord | null {
  if (!location) return null;

  let raw = location;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;

  if (Array.isArray(raw) && raw.length >= 2) {
    lng = Number(raw[0]);
    lat = Number(raw[1]);
  } else if (typeof raw === 'object') {
    if (raw.latitude !== undefined && raw.longitude !== undefined) {
      lat = Number(raw.latitude);
      lng = Number(raw.longitude);
    } else if (raw.lat !== undefined && raw.lng !== undefined) {
      lat = Number(raw.lat);
      lng = Number(raw.lng);
    } else if (raw.x !== undefined && raw.y !== undefined) {
      lng = Number(raw.x);
      lat = Number(raw.y);
    } else if (Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) {
      lng = Number(raw.coordinates[0]);
      lat = Number(raw.coordinates[1]);
    }
  }

  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat === 0 && lng === 0) return null;

  // Recover swapped South African coordinates safely
  if (
    (Math.abs(lat) > 90 && Math.abs(lng) <= 90) ||
    (lat >= 15 && lat <= 35 && lng <= -15 && lng >= -38)
  ) {
    const tmp = lat;
    lat = lng;
    lng = tmp;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { latitude: lat, longitude: lng };
}

export function getDistanceMeters(a: LatLngCoord | null, b: LatLngCoord | null): number | null {
  if (!a || !b) return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getDistanceKm(a: LatLngCoord | null, b: LatLngCoord | null): number | null {
  const meters = getDistanceMeters(a, b);
  return meters === null ? null : meters / 1000;
}

export function computeBearingDegrees(from: LatLngCoord | null, to: LatLngCoord | null): number | null {
  if (!from || !to) return null;
  const dist = getDistanceMeters(from, to);
  if (!dist || dist < 2) return null;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function interpolateHeading(currentHeading: number, targetHeading: number, t: number): number {
  const delta = (((targetHeading - currentHeading) % 360) + 540) % 360 - 180;
  return (currentHeading + delta * t + 360) % 360;
}

export function trimRouteFromDriver(
  coords: LatLngCoord[],
  driverPos: LatLngCoord | null,
  maxSnapMeters = 180
): LatLngCoord[] {
  if (!Array.isArray(coords) || coords.length < 2 || !driverPos) {
    return coords || [];
  }

  const refLatRad = (driverPos.latitude * Math.PI) / 180;
  const cosLat = Math.max(0.01, Math.cos(refLatRad));
  const mLat = 111320;
  const mLng = 111320 * cosLat;

  let bestIndex = 0;
  let bestDist = Infinity;
  let bestPoint = coords[0];

  for (let i = 0; i < coords.length - 1; i += 1) {
    const segA = coords[i];
    const segB = coords[i + 1];
    const ax = (segA.longitude - driverPos.longitude) * mLng;
    const ay = (segA.latitude - driverPos.latitude) * mLat;
    const bx = (segB.longitude - driverPos.longitude) * mLng;
    const by = (segB.latitude - driverPos.latitude) * mLat;
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;

    if (lenSq <= 1e-6) {
      const dist = Math.hypot(ax, ay);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
        bestPoint = segA;
      }
      continue;
    }

    const t = Math.max(0, Math.min(1, -(ax * abx + ay * aby) / lenSq));
    const px = ax + t * abx;
    const py = ay + t * aby;
    const dist = Math.hypot(px, py);

    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
      bestPoint = {
        latitude: segA.latitude + t * (segB.latitude - segA.latitude),
        longitude: segA.longitude + t * (segB.longitude - segA.longitude),
      };
    }
  }

  if (bestDist > maxSnapMeters) {
    return coords;
  }

  const trimmed = [bestPoint, ...coords.slice(bestIndex + 1)];
  if (trimmed.length === 1) {
    trimmed.push(coords[coords.length - 1]);
  }
  return trimmed;
}

export function pickNextTurnStep(steps: RouteStep[] | undefined, driverPos: LatLngCoord | null): RouteStep | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  // Skip immediate <30m depart step when a real maneuver follows right away
  if (
    steps.length > 1 &&
    steps[0].maneuverType === 'depart' &&
    steps[0].distanceMeters < 30
  ) {
    return steps[1];
  }

  if (driverPos) {
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      if (!step.coordinate) continue;
      const dist = getDistanceMeters(driverPos, step.coordinate);
      if (dist !== null && dist > 20) {
        return step;
      }
    }
  }

  return steps[0];
}

export function getManeuverIconName(
  maneuverType?: string,
  modifier?: string | null
): keyof typeof Ionicons.glyphMap {
  if (maneuverType === 'arrive') return 'flag';
  if (maneuverType === 'roundabout' || maneuverType === 'rotary') return 'refresh-circle';
  if (modifier === 'uturn') return 'return-down-back';
  if (modifier === 'left' || modifier === 'sharp left' || modifier === 'slight left') {
    return 'arrow-back';
  }
  if (modifier === 'right' || modifier === 'sharp right' || modifier === 'slight right') {
    return 'arrow-forward';
  }
  return 'arrow-up';
}

export function formatStepMeters(meters?: number | null): string {
  if (meters === undefined || meters === null || !Number.isFinite(meters)) return '';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
}

export function formatDistanceCompact(distanceKm?: number | null): string {
  if (distanceKm === undefined || distanceKm === null || !Number.isFinite(distanceKm)) return '--';
  if (distanceKm < 1) return `${Math.max(10, Math.round(distanceKm * 1000))} m`;
  return `${distanceKm.toFixed(1)} km`;
}
