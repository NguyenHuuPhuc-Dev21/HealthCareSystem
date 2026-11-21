import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, ArrowLeft, KeyRound, RotateCw } from 'lucide-react-native';
import { AppButton } from '../../components';
import { IS_DEV } from '../../lib/hardware-providers';
import type { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { useAuth } from './AuthContext';
import { requestOtp, verifyOtp } from './auth.api';
import { OtpInput } from './components/OtpInput';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

function maskPhoneNumber(phone: string): string {
  if (phone.length === 10) {
    return `${phone.slice(0, 4)} ••• ${phone.slice(7)}`;
  }
  return phone;
}

export const OtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phone, resendAfterSeconds = 60, devOtp: initialDevOtp } = route.params;
  const { login } = useAuth();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(resendAfterSeconds);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | undefined>(initialDevOtp);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown]);

  const handleVerify = async (codeToVerify: string) => {
    if (codeToVerify.length !== 6 || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await verifyOtp(phone, codeToVerify);

      if (res.success && res.data) {
        if (res.data.status === 'AUTHENTICATED') {
          await login(res.data.session);
          // RootNavigator will automatically route to resolved zone
        } else if (res.data.status === 'REGISTRATION_REQUIRED') {
          navigation.navigate('CompleteRegistration', {
            registrationToken: res.data.registrationToken,
            phone,
          });
        }
      } else {
        const err = res.error;
        setOtp(''); // Xóa ô nhập để nhập lại
        setErrorMessage(
          err?.message || 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại.'
        );
      }
    } catch {
      setOtp('');
      setErrorMessage('Lỗi mạng khi xác thực mã OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Tự động gửi xác thực khi nhập đủ 6 chữ số
  const handleOtpChange = (newVal: string) => {
    setOtp(newVal);
    if (errorMessage) setErrorMessage(null);
    if (newVal.length === 6) {
      void handleVerify(newVal);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;

    setResending(true);
    setErrorMessage(null);
    setOtp('');

    try {
      const res = await requestOtp(phone);
      if (res.success && res.data) {
        setCountdown(res.data.resendAfterSeconds || 60);
        if (res.data.devOtp) {
          setDevOtp(res.data.devOtp);
        }
      } else {
        setErrorMessage(res.error?.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.');
      }
    } catch {
      setErrorMessage('Lỗi kết nối khi gửi lại mã OTP.');
    } finally {
      setResending(false);
    }
  };

  const formattedTimer = `00:${String(countdown).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Navigation Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại nhập số điện thoại khác"
          >
            <ArrowLeft size={20} color={tokens.colors.inkPrimary} />
            <Text style={styles.backButtonText}>Đổi số điện thoại</Text>
          </TouchableOpacity>

          {/* Main Card (SH2) */}
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <KeyRound size={26} color={tokens.colors.brandJade} />
            </View>

            <Text style={styles.title}>Nhập mã OTP</Text>
            <Text style={styles.subtitle}>
              Mã xác thực 6 chữ số đã được gửi tới số{'\n'}
              <Text style={styles.phoneNumberHighlight}>{maskPhoneNumber(phone)}</Text>
            </Text>

            {/* Dev Helper Pill */}
            {IS_DEV && devOtp ? (
              <Pressable
                style={styles.devPill}
                onPress={() => handleOtpChange(devOtp)}
                accessibilityRole="button"
                accessibilityLabel={`Điền nhanh mã OTP mẫu ${devOtp}`}
              >
                <Text style={styles.devPillText}>
                  [DEV] Mã OTP mẫu: <Text style={styles.devPillCode}>{devOtp}</Text> (Chạm để điền)
                </Text>
              </Pressable>
            ) : null}

            {/* 6-box OTP Input */}
            <OtpInput
              value={otp}
              onChange={handleOtpChange}
              length={6}
              disabled={loading}
              hasError={Boolean(errorMessage)}
              autoFocus
            />

            {/* Error Message Alert */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color={tokens.colors.alertCrimson} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Resend OTP Section */}
            <View style={styles.resendSection}>
              {countdown > 0 ? (
                <Text style={styles.resendTimerText}>
                  Chưa nhận được mã? Gửi lại sau{' '}
                  <Text style={styles.timerDigits}>{formattedTimer}</Text>
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resending}
                  style={styles.resendBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Gửi lại mã OTP"
                >
                  <RotateCw size={15} color={tokens.colors.brandJade} />
                  <Text style={styles.resendBtnText}>
                    {resending ? 'Đang gửi lại...' : 'Gửi lại mã OTP'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button (backup if auto-submit doesn't trigger) */}
            <AppButton
              label={loading ? 'Đang xác thực...' : 'Xác nhận OTP'}
              onPress={() => void handleVerify(otp)}
              disabled={otp.length !== 6 || loading}
              loading={loading}
              style={styles.confirmBtn}
              testID="verify-otp-btn"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.paddingBase,
    paddingBottom: 40,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.colors.brandJadeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: tokens.typography.fontSizeTitle,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  phoneNumberHighlight: {
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  devPill: {
    backgroundColor: tokens.colors.accentOchreSoft,
    borderWidth: 1,
    borderColor: tokens.colors.accentOchre,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  devPillText: {
    fontSize: 13,
    color: tokens.colors.accentOchre,
    fontWeight: '600',
  },
  devPillCode: {
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: tokens.colors.alertCrimson,
    borderRadius: tokens.radii.sm,
    padding: 10,
    gap: 8,
    marginTop: 6,
    marginBottom: 14,
    width: '100%',
  },
  errorBannerText: {
    fontSize: 13.5,
    color: tokens.colors.alertCrimson,
    fontWeight: '600',
    flex: 1,
  },
  resendSection: {
    marginTop: 18,
    marginBottom: 20,
    alignItems: 'center',
    minHeight: 32,
    justifyContent: 'center',
  },
  resendTimerText: {
    fontSize: 14.5,
    color: tokens.colors.inkMuted,
  },
  timerDigits: {
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  confirmBtn: {
    width: '100%',
    minHeight: 56,
    borderRadius: tokens.radii.md,
  },
});
