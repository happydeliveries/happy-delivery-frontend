import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { driverService } from '../../../../services/driver';

export default function ScanDeliveryCodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const verifyCode = async (code: string) => {
    setLoading(true);
    setMessage(null);
    let successful = false;

    try {
      await driverService.verifyDeliveryCode(id, code.trim());
      successful = true;
      Alert.alert('Success', 'Delivery verified successfully.', [
        { text: 'OK', onPress: () => router.replace(`/(driver)/orders/${id}`) },
      ]);
    } catch (error: any) {
      const errorText =
        error.response?.data?.error ||
        error.message ||
        'Delivery code verification failed';
      setMessage(errorText);
      setAttempts((prev) => prev + 1);
      if (attempts + 1 >= 3) {
        setManualMode(true);
      }
    } finally {
      setLoading(false);
      if (!successful) {
        setScanned(false);
      }
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    await verifyCode(data);
  };

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      setMessage('Please enter the fallback delivery code.');
      return;
    }
    await verifyCode(manualCode);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permissionText}>
          Camera access is required to scan the delivery QR code.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={requestPermission}>
          <Text style={styles.retryText}>Allow Camera Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Scan Delivery Code</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Scan the recipient's delivery QR code or enter the fallback code below.
        </Text>

        {!manualMode ? (
          <View style={styles.scannerWrapper}>
            <CameraView
              style={styles.scanner}
              onBarcodeScanned={scanned || loading ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
            />
            <View style={styles.scannerOverlay}>
              <Text style={styles.scanHint}>Hold the QR code inside the frame</Text>
            </View>
          </View>
        ) : (
          <View style={styles.manualContainer}>
            <Text style={styles.manualLabel}>Enter fallback code</Text>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              placeholder="ABCD-1234"
              style={styles.manualInput}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleManualSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Verify Code</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>Scan attempts</Text>
          <Text style={styles.hintText}>
            You have used {attempts} of 3 scan attempts. Manual entry becomes available
            after 3 failed scans.
          </Text>
        </View>

        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  backButton: { padding: 6 },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  content: { flex: 1, paddingHorizontal: 20 },
  subtitle: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 20,
    lineHeight: 20,
  },
  scannerWrapper: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  scanner: { flex: 1 },
  scannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
  },
  scanHint: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 10,
  },
  manualContainer: { marginTop: 10 },
  manualLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    color: colors.textPrimary,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hintBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.gray50,
    borderRadius: 16,
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  hintText: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
  },
  errorText: {
    marginTop: 16,
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});