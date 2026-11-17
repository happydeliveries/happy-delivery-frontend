import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { LOCATION_CONFIG } from '../constants/config';
import api from '../services/api';
import { useFeedbackStore } from '../store/feedbackStore';

type LocationType = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
};

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'disabled' | 'unavailable';

export type StructuredAddress = {
  street: string;
  name: string;
  city: string;
  district: string;
  region: string;
  postalCode: string;
  country: string;
  formattedAddress: string;
};

export const useLocation = () => {
  const [location, setLocation] = useState<LocationType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');
  const [loading, setLoading] = useState(true);

  const openLocationSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const readCurrentPositionSafely = useCallback(async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesEnabled) {
        setLocationStatus('disabled');
        setErrorMsg('Turn on device location or choose a saved address.');
        return null;
      }

      let currentPerm = await Location.getForegroundPermissionsAsync();
      if (currentPerm.status !== 'granted') {
        currentPerm = await Location.requestForegroundPermissionsAsync();
      }
      if (currentPerm.status !== 'granted') {
        setLocationStatus('denied');
        setErrorMsg('Location access is turned off. Choose a saved address or enable location.');
        return null;
      }

      const timedPosition = await Promise.race<LocationType | null>([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000)),
      ]);

      const resolved =
        timedPosition ||
        (await Location.getLastKnownPositionAsync({ maxAge: 1000 * 60 * 30 }).catch(() => null));

      if (resolved) {
        setLocation(resolved);
        setLocationStatus('granted');
        setErrorMsg(null);
        return resolved;
      }

      setLocationStatus('unavailable');
      setErrorMsg('Could not get your GPS signal right now. Choose a saved address instead.');
      return null;
    } catch {
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 1000 * 60 * 60 }).catch(
        () => null
      );
      if (lastKnown) {
        setLocation(lastKnown);
        setLocationStatus('granted');
        setErrorMsg(null);
        return lastKnown;
      }
      setLocationStatus('unavailable');
      setErrorMsg('Location is currently unavailable. Choose a saved address or try again.');
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await readCurrentPositionSafely();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [readCurrentPositionSafely]);

  // Function to get address from coordinates
  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (address) {
        const parts = [];
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.region) parts.push(address.region);
        if (address.country) parts.push(address.country);

        return parts.join(', ');
      }
      return null;
    } catch {
      return null;
    }
  };

  // Function to get structured address details from coordinates
  const getAddressDetailsFromCoords = async (
    lat: number,
    lng: number
  ): Promise<StructuredAddress | null> => {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (address) {
        const streetLine = [address.streetNumber, address.street].filter(Boolean).join(' ').trim();
        const parts = [
          streetLine || address.name || '',
          address.city || address.subregion || '',
          address.region || '',
          address.country || '',
        ].filter(Boolean);

        return {
          street: streetLine || address.street || '',
          name: address.name || '',
          city: address.city || address.subregion || '',
          district: address.district || address.subregion || '',
          region: address.region || '',
          postalCode: address.postalCode || '',
          country: address.country || '',
          formattedAddress: parts.join(', '),
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Function to update location and optionally sync with backend via pre-configured api instance
  const updateLocation = async (syncWithBackend: boolean = false, orderId?: string) => {
    try {
      setLoading(true);
      const currentLocation = await readCurrentPositionSafely();

      if (syncWithBackend && currentLocation?.coords) {
        await api.put('/drivers/location', {
          lat: currentLocation.coords.latitude,
          lng: currentLocation.coords.longitude,
          accuracy: currentLocation.coords.accuracy,
          speed: currentLocation.coords.speed,
          ...(orderId ? { orderId } : {}),
        });
      }

      return currentLocation;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Function to start watching location
  const startWatching = async (callback: (location: LocationType) => void) => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesEnabled) {
        useFeedbackStore.getState().showPopup({
          type: 'warning',
          title: 'Location Is Turned Off',
          message: 'Please enable location services to allow live delivery tracking.',
          primaryLabel: 'Open Settings',
          onPrimary: openLocationSettings,
          secondaryLabel: 'Later',
        });
        return null;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        useFeedbackStore.getState().showPopup({
          type: 'warning',
          title: 'Location Permission Needed',
          message: 'Allow location access in settings so live tracking stays up to date.',
          primaryLabel: 'Open Settings',
          onPrimary: openLocationSettings,
          secondaryLabel: 'Later',
        });
        return null;
      }

      return await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: LOCATION_CONFIG.TRACKING_INTERVAL,
          timeInterval: LOCATION_CONFIG.TRACKING_INTERVAL,
        },
        callback
      );
    } catch {
      return null;
    }
  };

  return {
    location,
    errorMsg,
    locationStatus,
    loading,
    updateLocation,
    getCurrentLocation: () => updateLocation(false),
    getAddressFromCoords,
    getAddressDetailsFromCoords,
    startWatching,
    openLocationSettings,
  };
};