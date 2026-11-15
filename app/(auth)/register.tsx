import React, { forwardRef, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';

// ─── Palette (same as Welcome) ──────────────────────────────────────────────
const BG = '#FFFBF2';
const ACCENT = '#FFCC00';
const INK = '#2B1B0E';
const MUTED = '#8A7B6D';
const LINE = '#E6DDCF';
const PLACEHOLDER = '#B5A99B';
const ERROR = '#C0392B';
const ERROR_BG = '#FDECEA';
const GOOD = '#2E9E5B';

type UserRole = 'customer' | 'driver' | 'restaurant_manager';

type FieldKey =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'password'
  | 'driverLicense'
  | 'vehicleType'
  | 'vehicleModel'
  | 'vehicleColor'
  | 'vehicleRegistration'
  | 'restaurantName'
  | 'restaurantAddress';

type Values = Record<FieldKey, string>;

const ACCOUNT_FIELDS: FieldKey[] = ['firstName', 'lastName', 'email', 'phone', 'password'];
const DRIVER_FIELDS: FieldKey[] = [
  'driverLicense',
  'vehicleType',
  'vehicleModel',
  'vehicleColor',
  'vehicleRegistration',
];
const MANAGER_FIELDS: FieldKey[] = ['restaurantName', 'restaurantAddress'];

const INITIAL_VALUES: Values = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  driverLicense: '',
  vehicleType: '',
  vehicleModel: '',
  vehicleColor: '',
  vehicleRegistration: '',
  restaurantName: '',
  restaurantAddress: '',
};

// ─── Validation helpers ─────────────────────────────────────────────────────

/**
 * Normalises a phone number to international format.
 * Local South African numbers (0XXXXXXXXX) become +27XXXXXXXXX.
 * Returns null when the number is not plausible (9–15 digits).
 */
function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!hasPlus && digits.startsWith('0') && digits.length === 10) {
    digits = '27' + digits.slice(1);
  }
  if (digits.length < 9 || digits.length > 15) return null;
  return '+' + digits;
}

const required = (message: string) => (v: string) => (v.trim() ? '' : message);

const VALIDATORS: Record<FieldKey, (v: string) => string> = {
  firstName: required('Enter your first name'),
  lastName: required('Enter your last name'),
  email: (v) => {
    if (!v.trim()) return 'Enter your email address';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address';
  },
  phone: (v) => {
    if (!v.trim()) return 'Enter your phone number';
    return normalizePhone(v) ? '' : 'Enter a valid phone number';
  },
  password: (v) => {
    if (!v) return 'Create a password';
    if (v.length < 8) return 'Use at least 8 characters';
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Include at least one letter and one number';
    return '';
  },
  driverLicense: required("Enter your driver's license number"),
  vehicleType: required('Enter your vehicle type'),
  vehicleModel: required('Enter the vehicle model'),
  vehicleColor: required('Enter the vehicle color'),
  vehicleRegistration: required('Enter the registration number'),
  restaurantName: required('Enter the restaurant name'),
  restaurantAddress: required('Enter the restaurant address'),
};

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) score++;
  if (pw.length >= 12 || (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw))) score++;
  return { score, label: ['Too weak', 'Weak', 'Good', 'Strong'][score] };
}

// ─── Reusable text field ────────────────────────────────────────────────────

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
};

const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, hint, isPassword, containerStyle, onFocus, onBlur, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          rest.multiline && styles.inputWrapMultiline,
          focused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, rest.multiline && styles.inputMultiline, style]}
          placeholderTextColor={PLACEHOLDER}
          selectionColor={INK}
          secureTextEntry={isPassword && !visible}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={MUTED} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
});

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const params = useLocalSearchParams();
  const { register } = useAuth();

  const [role, setRole] = useState<UserRole>((params.role as UserRole) || 'customer');
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>(INITIAL_VALUES);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [emailTaken, setEmailTaken] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<Partial<Record<FieldKey, TextInput | null>>>({});

  useEffect(() => {
    if (params.role) setRole(params.role as UserRole);
  }, [params.role]);

  // Customers sign up on one screen. Drivers and restaurants need a second step.
  const roleFields = role === 'driver' ? DRIVER_FIELDS : role === 'restaurant_manager' ? MANAGER_FIELDS : [];
  const totalSteps = roleFields.length ? 2 : 1;
  const isFinalStep = step === totalSteps;
  const visibleFields: FieldKey[] = step === 1 ? ACCOUNT_FIELDS : roleFields;

  const setValue = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFormError('');
    if (key === 'email') setEmailTaken('');
  };

  const markTouched = (key: FieldKey) => setTouched((prev) => ({ ...prev, [key]: true }));

  const errorFor = (key: FieldKey) => {
    if (key === 'email' && emailTaken) return emailTaken;
    return touched[key] ? VALIDATORS[key](values[key]) : '';
  };

  const strength = useMemo(() => passwordStrength(values.password), [values.password]);

  // Focus the next field, or submit from the last one
  const focusNext = (key: FieldKey) => {
    const i = visibleFields.indexOf(key);
    const next = visibleFields[i + 1];
    if (next) inputRefs.current[next]?.focus();
    else handleContinue();
  };

  const handleContinue = async () => {
    if (loading) return;

    const firstInvalid = visibleFields.find((k) => VALIDATORS[k](values[k]));
    setTouched((prev) => ({
      ...prev,
      ...Object.fromEntries(visibleFields.map((k) => [k, true])),
    }));
    if (firstInvalid) {
      inputRefs.current[firstInvalid]?.focus();
      return;
    }

    if (!isFinalStep) {
      setStep(2);
      return;
    }

    if (!acceptedTerms) {
      setTermsError(true);
      return;
    }

    await submit();
  };

  const submit = async () => {
    setLoading(true);
    setFormError('');

    try {
      const registrationData = {
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role,
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        phone_number: normalizePhone(values.phone) as string,
        ...(role === 'driver' && {
          driverLicense: values.driverLicense.trim(),
          vehicleType: values.vehicleType.trim(),
          vehicleModel: values.vehicleModel.trim(),
          vehicleColor: values.vehicleColor.trim(),
          vehicleRegistration: values.vehicleRegistration.trim().toUpperCase(),
        }),
        ...(role === 'restaurant_manager' && {
          restaurantName: values.restaurantName.trim(),
          restaurantAddress: values.restaurantAddress.trim(),
        }),
      };

      await register(registrationData);
      // Navigation after success is handled in the useAuth hook
    } catch (err: any) {
      console.error('Registration error:', err);
      const message: string = err?.message || 'Something went wrong. Please try again.';

      // Surface "email already registered" next to the email field
      if (/email/i.test(message) && /(exist|taken|already|registered|in use)/i.test(message)) {
        setEmailTaken('An account with this email already exists');
        setStep(1);
        setTimeout(() => inputRefs.current.email?.focus(), 50);
      } else {
        setFormError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setFormError('');
    } else {
      router.back();
    }
  };

  const bindField = (key: FieldKey, extra: Partial<FieldProps> = {}): FieldProps => {
    const isLast = visibleFields[visibleFields.length - 1] === key;
    return {
      label: '',
      ref: (el: TextInput | null) => {
        inputRefs.current[key] = el;
      },
      value: values[key],
      onChangeText: (v: string) => setValue(key, v),
      onBlur: () => markTouched(key),
      onSubmitEditing: () => focusNext(key),
      returnKeyType: isLast ? 'done' : 'next',
      blurOnSubmit: false,
      error: errorFor(key),
      ...extra,
    } as FieldProps;
  };

  const roleBadge =
    role === 'driver' ? 'Driver account' : role === 'restaurant_manager' ? 'Restaurant account' : '';

  const header =
    step === 1
      ? { title: 'Create your account', subtitle: 'Order from local restaurants in minutes.' }
      : role === 'driver'
        ? { title: 'Your vehicle', subtitle: 'We use this to verify you before your first delivery.' }
        : { title: 'Your restaurant', subtitle: 'Tell us where customers can find you.' };

  const renderAccountFields = () => (
    <>
      <View style={styles.row}>
        <Field
          {...bindField('firstName', {
            label: 'First name',
            placeholder: 'John',
            autoCapitalize: 'words',
            autoComplete: 'name-given',
            textContentType: 'givenName',
            containerStyle: styles.half,
          })}
        />
        <Field
          {...bindField('lastName', {
            label: 'Last name',
            placeholder: 'Doe',
            autoCapitalize: 'words',
            autoComplete: 'name-family',
            textContentType: 'familyName',
            containerStyle: styles.half,
          })}
        />
      </View>

      <Field
        {...bindField('email', {
          label: 'Email',
          placeholder: 'you@example.com',
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          autoCorrect: false,
          autoComplete: 'email',
          textContentType: 'emailAddress',
        })}
      />

      <Field
        {...bindField('phone', {
          label: 'Phone number',
          placeholder: '082 123 4567',
          keyboardType: 'phone-pad',
          autoComplete: 'tel',
          textContentType: 'telephoneNumber',
          hint: 'We send order updates to this number.',
        })}
      />

      <View>
        <Field
          {...bindField('password', {
            label: 'Password',
            placeholder: 'At least 8 characters',
            isPassword: true,
            autoCapitalize: 'none',
            autoCorrect: false,
            autoComplete: 'password-new',
            textContentType: 'newPassword',
          })}
        />
        {values.password.length > 0 && !errorFor('password') ? (
          <View style={styles.strengthRow}>
            <View style={styles.strengthBars}>
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.strengthBar,
                    strength.score >= n && {
                      backgroundColor: strength.score === 3 ? GOOD : ACCENT,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.strengthLabel}>{strength.label}</Text>
          </View>
        ) : null}
      </View>
    </>
  );

  const renderRoleFields = () => {
    if (role === 'driver') {
      return (
        <>
          <Field
            {...bindField('driverLicense', {
              label: "Driver's license number",
              placeholder: 'License number',
              autoCapitalize: 'characters',
              autoCorrect: false,
            })}
          />
          <Field
            {...bindField('vehicleType', {
              label: 'Vehicle type',
              placeholder: 'Motorcycle, car, bicycle…',
              autoCapitalize: 'sentences',
            })}
          />
          <View style={styles.row}>
            <Field
              {...bindField('vehicleModel', {
                label: 'Model',
                placeholder: 'Honda Civic',
                autoCapitalize: 'words',
                containerStyle: styles.half,
              })}
            />
            <Field
              {...bindField('vehicleColor', {
                label: 'Color',
                placeholder: 'Red',
                autoCapitalize: 'words',
                containerStyle: styles.half,
              })}
            />
          </View>
          <Field
            {...bindField('vehicleRegistration', {
              label: 'Registration number',
              placeholder: 'AB 12 CD GP',
              autoCapitalize: 'characters',
              autoCorrect: false,
            })}
          />
        </>
      );
    }

    return (
      <>
        <Field
          {...bindField('restaurantName', {
            label: 'Restaurant name',
            placeholder: 'Pizza Palace',
            autoCapitalize: 'words',
          })}
        />
        <Field
          {...bindField('restaurantAddress', {
            label: 'Restaurant address',
            placeholder: 'Street, suburb, city',
            autoComplete: 'street-address',
            textContentType: 'fullStreetAddress',
            multiline: true,
            blurOnSubmit: true,
            returnKeyType: 'done',
          })}
        />
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={12}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>

          {totalSteps > 1 ? (
            <>
              <View style={styles.progress}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.progressSegment, i < step && styles.progressSegmentActive]}
                  />
                ))}
              </View>
              <Text style={styles.stepText}>
                {step}/{totalSteps}
              </Text>
            </>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{header.title}</Text>
            <Text style={styles.subtitle}>{header.subtitle}</Text>
            {step === 1 && roleBadge ? (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{roleBadge}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.form}>
            {formError ? (
              <View style={styles.errorBox} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color={ERROR} />
                <Text style={styles.errorBoxText}>{formError}</Text>
              </View>
            ) : null}

            {step === 1 ? renderAccountFields() : renderRoleFields()}

            {isFinalStep ? (
              <View>
                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => {
                    setAcceptedTerms((v) => !v);
                    setTermsError(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                >
                  <Ionicons
                    name={acceptedTerms ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={termsError ? ERROR : acceptedTerms ? INK : MUTED}
                  />
                  <Text style={styles.termsText}>
                    I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>
                {termsError ? (
                  <Text style={[styles.fieldError, styles.termsError]}>
                    Please accept to create your account
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleContinue}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={INK} />
            ) : (
              <Text style={styles.primaryText}>{isFinalStep ? 'Create account' : 'Continue'}</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.signIn} activeOpacity={0.7}>
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 16,
    minHeight: 52,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: LINE },
  progressSegmentActive: { backgroundColor: ACCENT },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    minWidth: 28,
    textAlign: 'right',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: { marginBottom: 24 },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: { fontSize: 16, color: MUTED, lineHeight: 24 },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: ACCENT + '40',
  },
  rolePillText: { fontSize: 13, fontWeight: '700', color: INK },

  form: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  label: { fontSize: 14, fontWeight: '600', color: INK, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: LINE,
  },
  inputWrapMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  inputFocused: { borderColor: INK },
  inputError: { borderColor: ERROR },
  input: { flex: 1, fontSize: 16, color: INK, paddingVertical: 12 },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top', paddingVertical: 0 },
  fieldError: { fontSize: 13, color: ERROR, marginTop: 6 },
  fieldHint: { fontSize: 13, color: MUTED, marginTop: 6 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: LINE },
  strengthLabel: { fontSize: 12, fontWeight: '600', color: MUTED },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  termsText: { flex: 1, fontSize: 14, color: MUTED, lineHeight: 21, paddingTop: 2 },
  termsLink: { color: INK, fontWeight: '700' },
  termsError: { marginLeft: 34 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ERROR_BG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBoxText: { flex: 1, fontSize: 14, color: ERROR },

  footer: {
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryText: { fontSize: 17, fontWeight: '700', color: INK },
  signIn: { paddingVertical: 12 },
  signInText: { fontSize: 15, color: MUTED },
  signInLink: { color: INK, fontWeight: '700' },
});