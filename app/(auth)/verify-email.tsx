import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { useFeedbackStore } from '../../store/feedbackStore';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';

const BG = '#FFFBF2';
const ACCENT = '#FFCC00';
const INK = '#2B1B0E';
const MUTED = '#8A7B6D';
const LINE = '#E6DDCF';
const ERROR = '#C0392B';
const ERROR_BG = '#FDECEA';
const GOOD = '#15803D';
const GOOD_BG = '#ECFDF5';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    role?: string;
    pendingApproval?: string;
  }>();

  const { verifyEmail } = useAuth();
  const showToast = useFeedbackStore((s) => s.showToast);

  const [email, setEmail] = useState(String(params.email || '').trim().toLowerCase());
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [verifiedPendingAdmin, setVerifiedPendingAdmin] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.replace(/\s+/g, '').trim();

    if (!cleanEmail) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }
    if (cleanCode.length < 6) {
      setErrorMsg('Please enter the 6-digit verification code from your email.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await verifyEmail({ email: cleanEmail, code: cleanCode });
      if (result.pendingApproval) {
        setVerifiedPendingAdmin(true);
        showToast({
          type: 'success',
          message: 'Email verified! Your application is awaiting management approval.',
        });
      } else {
        showToast({
          type: 'success',
          message: 'Email verified! Welcome to Happy Deliveries.',
        });
      }
    } catch (err: any) {
      setErrorMsg(getFriendlyErrorMessage(err, 'general'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || resending || cooldown > 0) return;

    setResending(true);
    setErrorMsg('');
    try {
      await authService.resendVerification(cleanEmail);
      setCooldown(30);
      showToast({
        type: 'success',
        message: 'A fresh verification email has been sent.',
      });
    } catch (err: any) {
      setErrorMsg(getFriendlyErrorMessage(err, 'general'));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconCircle}>
            <Ionicons name={verifiedPendingAdmin ? 'checkmark-circle' : 'mail-open-outline'} size={34} color={INK} />
          </View>

          {verifiedPendingAdmin ? (
            <View style={styles.pendingBox}>
              <Text style={styles.title}>Email Verified!</Text>
              <Text style={styles.subtitle}>
                Thank you for confirming <Text style={{ fontWeight: '700', color: INK }}>{email}</Text>.
                Your {params.role === 'restaurant_manager' ? 'restaurant' : 'driver'} application is currently pending review by Happy Deliveries management. We will email you as soon as it is approved!
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Text style={styles.primaryText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit verification code we sent to{' '}
                <Text style={{ fontWeight: '700', color: INK }}>{email || 'your email address'}</Text>, or click the verification button inside the email.
              </Text>

              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={ERROR} />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>6-digit code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(txt) => setCode(txt.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={handleVerify}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={INK} />
                ) : (
                  <Text style={styles.primaryText}>Verify & Activate Account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResend}
                disabled={resending || cooldown > 0}
              >
                <Text style={styles.resendText}>
                  {resending
                    ? 'Sending verification email...'
                    : cooldown > 0
                    ? `Resend email in ${cooldown}s`
                    : "Didn't get the email? Resend verification"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.backLinkText}>Return to Sign In</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 32,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: ACCENT + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
    marginBottom: 22,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    color: INK,
    marginBottom: 6,
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: LINE,
    paddingHorizontal: 16,
    fontSize: 15.5,
    color: INK,
    marginBottom: 16,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ERROR_BG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13.5,
    color: ERROR,
    fontWeight: '600',
  },
  pendingBox: {
    backgroundColor: GOOD_BG,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 20,
  },
  primaryButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: INK,
  },
  resendBtn: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  backLink: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '600',
  },
});
