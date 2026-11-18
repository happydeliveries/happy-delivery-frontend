import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useFeedbackStore } from '../../store/feedbackStore';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import { colors } from '../../constants/colors';
import { API_CONFIG } from '../../constants/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const showPopup = useFeedbackStore((s) => s.showPopup);
  const showFriendlyError = useFeedbackStore((s) => s.showFriendlyError);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      showPopup({
        type: 'info',
        title: 'Almost Ready',
        message: 'Please enter both your email address and password to sign in.',
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email.trim(), password);
      // Navigation is handled in useAuth hook
    } catch (err: any) {
      if (err?.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        const cleanEmail = encodeURIComponent(err.response.data.email || email.trim().toLowerCase());
        const role = encodeURIComponent(err.response.data.role || 'customer');
        setError('Your email address is not verified yet.');
        showPopup({
          type: 'info',
          title: 'Email Verification Required',
          message: 'Please verify your email address before signing in. Would you like to enter your verification code or resend the email?',
          primaryLabel: 'Verify Email',
          onPrimary: () => router.push(`/(auth)/verify-email?email=${cleanEmail}&role=${role}`),
          secondaryLabel: 'Cancel',
        });
        return;
      }
      const friendlyMsg = getFriendlyErrorMessage(err, 'login');
      setError(friendlyMsg);
      showFriendlyError(err, { context: 'login' });
    } finally {
      setLoading(false);
    }
  };

  const openDriverPortal = () => {
    const baseUrl = API_CONFIG.API_URL.replace(/\/api\/?$/, '');
    Linking.openURL(`${baseUrl}/driver/register`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue to your account</Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Email Address"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() =>
                showPopup({
                  type: 'info',
                  title: 'Reset Password',
                  message:
                    'Please email support@happydeliveries.co.za from your registered email address so our support team can reset your password.',
                })
              }
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Continue as Guest"
              variant="outline"
              onPress={() => router.push('/(customer)/home')}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <TouchableOpacity style={styles.driverPortalCard} onPress={openDriverPortal}>
              <Text style={styles.driverPortalTitle}>Want to drive with Happy Delivery?</Text>
              <Text style={styles.driverPortalSubtitle}>
                Apply or check your driver application status on the Driver Registration Web Portal →
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  errorContainer: {
    backgroundColor: '#FFF7ED',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  errorText: {
    color: '#9A3412',
    fontSize: 13.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#666',
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  driverPortalCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
  },
  driverPortalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 4,
  },
  driverPortalSubtitle: {
    fontSize: 12.5,
    color: '#C2410C',
    textAlign: 'center',
  },
});