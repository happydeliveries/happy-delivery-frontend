import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { LOCATION_CONFIG } from '../constants/config';
import { API_BASE_URL } from '../constants/api';
import api from '../services/api';

type LocationType = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
};

export const useLocation = () => {
  const [location, setLocation] = useState<LocationType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Request permission
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setLoading(false);
          return;
        }

        // Get current location
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setLocation(currentLocation);
        setErrorMsg(null);
      } catch (error: any) {
        setErrorMsg(error.message);
        console.error('Error getting location:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    } catch (error) {
      console.error('Error getting address:', error);
      return null;
    }
  };

  // Function to update location and optionally sync with backend via pre-configured api instance
  const updateLocation = async (syncWithBackend: boolean = false, orderId?: string) => {
    try {
      setLoading(true);
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(currentLocation);

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
    } catch (error: any) {
      setErrorMsg(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Function to start watching location
  const startWatching = async (callback: (location: LocationType) => void) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services');
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
    } catch (error) {
      console.error('Error watching location:', error);
      return null;
    }
  };

  return {
    location,
    errorMsg,
    loading,
    updateLocation,
    getAddressFromCoords,
    startWatching,
  };
};