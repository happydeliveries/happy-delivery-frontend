import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { userService } from '../services/auth';

export type DeliveryAddressItem = {
  id?: string;
  label?: string;
  street: string;
  address?: string;
  city?: string;
  postal_code?: string;
  instructions?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
};

export type AddressSelectionMode = 'gps' | 'address';

export const SA_DEFAULT_COORDS = {
  latitude: -26.2041,
  longitude: 28.0473,
};

export function hasValidCoords(addr?: { latitude?: unknown; longitude?: unknown } | null): addr is { latitude: number; longitude: number } {
  if (!addr) return false;
  const lat = Number(addr.latitude);
  const lng = Number(addr.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function isValidSACoords(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  return Number.isFinite(lat) && Number.isFinite(lng) && lat < 0 && lng >= 10 && lng <= 40;
}

/**
 * Resolves coordinates for any South African address via Expo Location geocoding first,
 * falling back to the backend's Google Maps / Nominatim geocoder endpoint.
 */
export async function resolveCoordsForAddress(addr: {
  street?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ latitude: number; longitude: number } | null> {
  if (hasValidCoords(addr)) {
    return { latitude: Number(addr.latitude), longitude: Number(addr.longitude) };
  }

  const streetText = String(addr.street || addr.address || '').trim();
  const cityText = String(addr.city || '').trim();
  const postalText = String(addr.postal_code || '').trim();

  if (!streetText && !cityText && !postalText) return null;

  // 1. Try device geocoder first (fast when available)
  try {
    const query = [streetText, cityText, postalText, 'South Africa'].filter(Boolean).join(', ');
    const results = await Location.geocodeAsync(query);
    if (Array.isArray(results) && results.length > 0 && hasValidCoords(results[0])) {
      return {
        latitude: Number(results[0].latitude),
        longitude: Number(results[0].longitude),
      };
    }
  } catch {
    // Device geocoder unavailable; fall back to backend geocoder
  }

  // 2. Fallback to backend geocoder (works reliably even across provinces or on simulators)
  try {
    const res: any = await userService.geocodeAddress({
      street: streetText,
      city: cityText,
      postal_code: postalText,
    });
    const coords = res?.data ?? res;
    if (hasValidCoords(coords)) {
      return {
        latitude: Number(coords.latitude),
        longitude: Number(coords.longitude),
      };
    }
  } catch {
    // Non-fatal; caller can handle null gracefully
  }

  return null;
}

export function formatAddressSummary(addr?: DeliveryAddressItem | null): string {
  if (!addr) return '';
  const street = String(addr.street || addr.address || '').trim();
  const city = String(addr.city || '').trim();
  if (street && city && street.toLowerCase() !== city.toLowerCase()) {
    return `${street}, ${city}`;
  }
  return street || city || addr.label || '';
}

export interface EffectiveDiscoveryLocation {
  latitude: number;
  longitude: number;
  source: 'selected' | 'gps' | 'saved_default' | 'default_city';
  label: string;
  subtitle: string;
  addressId?: string;
}

export function resolveEffectiveDiscoveryLocation(params: {
  mode: AddressSelectionMode;
  selectedAddress: DeliveryAddressItem | null;
  savedAddresses: DeliveryAddressItem[];
  gpsCoords?: { latitude: number; longitude: number } | null;
  gpsLabel?: string | null;
  gpsStatus?: string;
}): EffectiveDiscoveryLocation {
  const { mode, selectedAddress, savedAddresses, gpsCoords, gpsLabel, gpsStatus } = params;

  if (mode === 'address' && hasValidCoords(selectedAddress)) {
    const label = selectedAddress.label?.trim() || selectedAddress.city?.trim() || selectedAddress.street;
    return {
      latitude: Number(selectedAddress.latitude),
      longitude: Number(selectedAddress.longitude),
      source: 'selected',
      label: label || 'Selected Address',
      subtitle: formatAddressSummary(selectedAddress),
      addressId: selectedAddress.id,
    };
  }

  if (gpsCoords && isValidSACoords(gpsCoords.latitude, gpsCoords.longitude)) {
    return {
      latitude: gpsCoords.latitude,
      longitude: gpsCoords.longitude,
      source: 'gps',
      label: 'Current Location',
      subtitle: gpsLabel?.trim() || 'Using live GPS',
    };
  }

  const savedFallback =
    savedAddresses.find((a) => a.is_default && hasValidCoords(a)) ||
    savedAddresses.find((a) => hasValidCoords(a));

  if (savedFallback && hasValidCoords(savedFallback)) {
    return {
      latitude: Number(savedFallback.latitude),
      longitude: Number(savedFallback.longitude),
      source: 'saved_default',
      label: savedFallback.label?.trim() || savedFallback.city?.trim() || 'Saved Address',
      subtitle: formatAddressSummary(savedFallback),
      addressId: savedFallback.id,
    };
  }

  const locationOff = gpsStatus === 'disabled' || gpsStatus === 'denied';
  return {
    latitude: SA_DEFAULT_COORDS.latitude,
    longitude: SA_DEFAULT_COORDS.longitude,
    source: 'default_city',
    label: locationOff ? 'Set Delivery Area' : 'Johannesburg',
    subtitle: locationOff ? 'Location is off · Tap to pick an address' : 'Default delivery area',
  };
}

let inFlightAddressSync: Promise<DeliveryAddressItem[]> | null = null;

function addressEquals(a?: DeliveryAddressItem | null, b?: DeliveryAddressItem | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.street === b.street &&
    a.address === b.address &&
    a.city === b.city &&
    a.postal_code === b.postal_code &&
    a.instructions === b.instructions &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    Boolean(a.is_default) === Boolean(b.is_default)
  );
}

interface AddressState {
  mode: AddressSelectionMode;
  selectedAddress: DeliveryAddressItem | null;
  savedAddresses: DeliveryAddressItem[];
  loadingSaved: boolean;

  useGpsLocation: () => void;
  selectAddress: (address: DeliveryAddressItem) => Promise<DeliveryAddressItem | null>;
  syncSavedAddresses: () => Promise<DeliveryAddressItem[]>;
  saveNewAddress: (
    address: DeliveryAddressItem,
    options?: { selectAfterSave?: boolean }
  ) => Promise<{ list: DeliveryAddressItem[]; saved: DeliveryAddressItem | null }>;
  removeSavedAddress: (identifier: string) => Promise<DeliveryAddressItem[]>;
  setDefaultSavedAddress: (identifier: string) => Promise<DeliveryAddressItem[]>;
  resetForLogout: () => void;
}

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => ({
      mode: 'gps',
      selectedAddress: null,
      savedAddresses: [],
      loadingSaved: false,

      useGpsLocation: () => {
        set({ mode: 'gps' });
      },

      selectAddress: async (rawAddr) => {
        const street = String(rawAddr.street || rawAddr.address || rawAddr.city || '').trim();
        const coords = await resolveCoordsForAddress(rawAddr);
        if (!coords) {
          return null;
        }
        const normalized: DeliveryAddressItem = {
          ...rawAddr,
          label: rawAddr.label || rawAddr.city || street || 'Selected Area',
          street,
          city: rawAddr.city || street,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        set({
          mode: 'address',
          selectedAddress: normalized,
        });
        return normalized;
      },

      syncSavedAddresses: async () => {
        if (inFlightAddressSync) {
          return inFlightAddressSync;
        }
        set({ loadingSaved: true });
        inFlightAddressSync = (async () => {
          try {
            const res: any = await userService.getAddresses();
            const list: DeliveryAddressItem[] = Array.isArray(res) ? res : res?.data ?? [];
            const cleanList = Array.isArray(list) ? list : [];

            const currentSelected = get().selectedAddress;
            let refreshedSelected = currentSelected;
            if (currentSelected?.id) {
              const match = cleanList.find((a) => a.id === currentSelected.id);
              if (match) {
                const merged = { ...currentSelected, ...match };
                if (!addressEquals(currentSelected, merged)) {
                  refreshedSelected = merged;
                }
              }
            }

            set({
              savedAddresses: cleanList,
              ...(refreshedSelected !== currentSelected ? { selectedAddress: refreshedSelected } : {}),
            });
            return cleanList;
          } catch {
            return get().savedAddresses;
          } finally {
            set({ loadingSaved: false });
            inFlightAddressSync = null;
          }
        })();
        return inFlightAddressSync;
      },

      saveNewAddress: async (addrInput, options) => {
        const coords = await resolveCoordsForAddress(addrInput);
        const res: any = await userService.addAddress({
          label: addrInput.label?.trim() || 'Home',
          street: String(addrInput.street || addrInput.address || '').trim(),
          city: addrInput.city?.trim() || '',
          postal_code: addrInput.postal_code?.trim() || '',
          instructions: addrInput.instructions?.trim() || '',
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          is_default: addrInput.is_default,
        });
        const list: DeliveryAddressItem[] = Array.isArray(res) ? res : res?.data ?? [];
        const newest = list[list.length - 1] || null;
        set({ savedAddresses: list });

        if (options?.selectAfterSave && newest) {
          if (hasValidCoords(newest)) {
            set({ mode: 'address', selectedAddress: newest });
          } else if (coords) {
            set({
              mode: 'address',
              selectedAddress: { ...newest, latitude: coords.latitude, longitude: coords.longitude },
            });
          }
        }
        return { list, saved: newest };
      },

      removeSavedAddress: async (identifier) => {
        const res: any = await userService.removeAddress(identifier);
        const list: DeliveryAddressItem[] = Array.isArray(res) ? res : res?.data ?? [];
        const cleanList = Array.isArray(list) ? list : [];
        const currentSelected = get().selectedAddress;

        const removedActive =
          currentSelected &&
          ((currentSelected.id && String(currentSelected.id) === String(identifier)) ||
            (!currentSelected.id && cleanList.length === 0));

        set({
          savedAddresses: cleanList,
          ...(removedActive ? { selectedAddress: null, mode: 'gps' as const } : {}),
        });
        return cleanList;
      },

      setDefaultSavedAddress: async (identifier) => {
        const res: any = await userService.setDefaultAddress(identifier);
        const list: DeliveryAddressItem[] = Array.isArray(res) ? res : res?.data ?? [];
        const cleanList = Array.isArray(list) ? list : [];
        set({ savedAddresses: cleanList });
        return cleanList;
      },

      resetForLogout: () => {
        inFlightAddressSync = null;
        set({
          mode: 'gps',
          selectedAddress: null,
          savedAddresses: [],
          loadingSaved: false,
        });
      },
    }),
    {
      name: 'happy-delivery-address-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
        selectedAddress: state.selectedAddress,
        savedAddresses: state.savedAddresses,
      }),
    }
  )
);
