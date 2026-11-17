import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFeedbackStore, FeedbackType } from '../../store/feedbackStore';
import { colors } from '../../constants/colors';

const ICON_CONFIG: Record<
  FeedbackType,
  { name: keyof typeof Ionicons.glyphMap; bg: string; tint: string }
> = {
  info: { name: 'information-circle-outline', bg: '#EFF6FF', tint: '#2563EB' },
  warning: { name: 'location-outline', bg: '#FFF7ED', tint: '#EA580C' },
  error: { name: 'alert-circle-outline', bg: '#FFF1F2', tint: '#E11D48' },
  success: { name: 'checkmark-circle-outline', bg: '#ECFDF5', tint: '#16A34A' },
};

export default function AppFeedbackHost() {
  const insets = useSafeAreaInsets();
  const popup = useFeedbackStore((s) => s.popup);
  const toast = useFeedbackStore((s) => s.toast);
  const hidePopup = useFeedbackStore((s) => s.hidePopup);
  const hideToast = useFeedbackStore((s) => s.hideToast);

  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(toastAnim, {
      toValue: toast ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [toast, toastAnim]);

  const popupStyle = ICON_CONFIG[popup?.type || 'info'];
  const toastStyle = ICON_CONFIG[toast?.type || 'info'];

  return (
    <>
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrapper,
            {
              top: Math.max(insets.top + 8, 16),
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.toastCard}>
            <View style={[styles.toastIconBadge, { backgroundColor: toastStyle.bg }]}>
              <Ionicons name={toastStyle.name} size={18} color={toastStyle.tint} />
            </View>
            <Text style={styles.toastMessage} numberOfLines={3}>
              {toast.message}
            </Text>
            {toast.actionLabel && toast.onAction ? (
              <TouchableOpacity
                style={styles.toastActionBtn}
                onPress={() => {
                  const cb = toast.onAction;
                  hideToast();
                  cb?.();
                }}
              >
                <Text style={styles.toastActionText}>{toast.actionLabel}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.toastCloseBtn} onPress={hideToast}>
                <Ionicons name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      <Modal
        visible={Boolean(popup)}
        transparent
        animationType="fade"
        onRequestClose={hidePopup}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.iconCircle, { backgroundColor: popupStyle.bg }]}>
              <Ionicons name={popupStyle.name} size={32} color={popupStyle.tint} />
            </View>

            <Text style={styles.modalTitle}>{popup?.title}</Text>
            <Text style={styles.modalMessage}>{popup?.message}</Text>

            <View style={styles.buttonsRow}>
              {popup?.secondaryLabel && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    const cb = popup.onSecondary;
                    hidePopup();
                    cb?.();
                  }}
                >
                  <Text style={styles.secondaryBtnText}>{popup.secondaryLabel}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  const cb = popup?.onPrimary;
                  hidePopup();
                  cb?.();
                }}
              >
                <Text style={styles.primaryBtnText}>{popup?.primaryLabel || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  toastIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastMessage: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#1E293B',
    fontWeight: '600',
  },
  toastActionBtn: {
    backgroundColor: '#FFF3E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  toastActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  toastCloseBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
