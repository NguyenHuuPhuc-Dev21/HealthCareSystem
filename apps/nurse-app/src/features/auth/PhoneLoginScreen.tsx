import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { AppButton, StatusBadge } from '../../components';
import { env } from '../../lib/env';
import { IS_DEV } from '../../lib/hardware-providers';
import type { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { useAuth } from './AuthContext';
import { isValidVietnamesePhone, normalizePhoneNumber, requestOtp } from './auth.api';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

export const PhoneLoginScreen: React.FC<Props> = ({ navigation }) => {
  const { enterDevZone } = useAuth();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanDigits = phone.replace(/[^0-9+]/g, '');
  const isValid = isValidVietnamesePhone(cleanDigits);

  const handleRequestOtp = async () => {
    if (!isValid || loading) return;

    setLoading(true);
    setErrorMessage(null);

    const normalized = normalizePhoneNumber(cleanDigits);

    try {
      const res = await requestOtp(normalized);

      if (res.success && res.data) {
        navigation.navigate('Otp', {
          phone: normalized,
          requestId: res.data.requestId,
          resendAfterSeconds: res.data.resendAfterSeconds || 60,
          devOtp: res.data.devOtp,
        });
      } else {
        const err = res.error;
        if (err?.code === 'OTP_RESEND_TOO_SOON') {
          const retryAfter = (err.details as any)?.retryAfterSeconds || 60;
          setErrorMessage(`Bạn thao tác quá nhanh. Vui lòng chờ ${retryAfter} giây trước khi gửi lại mã.`);
        } else if (err?.code === 'OTP_RATE_LIMITED') {
          setErrorMessage('Số điện thoại này đã nhận quá giới hạn OTP cho phép trong giờ. Vui lòng thử lại sau.');
        } else {
          setErrorMessage(err?.message || 'Không thể gửi mã OTP. Vui lòng kiểm tra kết nối mạng.');
        }
      }
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

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
          {/* Header Brand */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <ShieldCheck size={28} color={tokens.colors.paper} />
            </View>
            <Text style={styles.brandTitle}>CareNest</Text>
            <Text style={styles.appRole}>CỔNG ĐIỀU DƯỠNG VIÊN</Text>
          </View>

          {/* Card Form (SH1) */}
          <View style={styles.card}>
            <Text style={styles.title}>Đăng nhập</Text>
            <Text style={styles.subtitle}>
              Nhập số điện thoại di động để nhận mã OTP xác thực qua tin nhắn SMS
            </Text>

            {/* Phone Input Box */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại di động</Text>
              <View
                style={[
                  styles.phoneInputRow,
                  errorMessage ? styles.phoneInputRowError : null,
                ]}
              >
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.flagIcon}>🇻🇳</Text>
                  <Text style={styles.countryCodeText}>+84</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="0905 123 456"
                  placeholderTextColor={tokens.colors.inkMuted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={14}
                  accessibilityLabel="Nhập số điện thoại"
                  testID="phone-input"
                />
              </View>

              {/* Validation or Error Text */}
              {errorMessage ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={15} color={tokens.colors.alertCrimson} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : phone.length > 0 && !isValid ? (
                <Text style={styles.helperTextWarning}>
                  Số điện thoại Việt Nam gồm 10 chữ số bắt đầu bằng 0 (03, 05, 07, 08, 09)
                </Text>
              ) : (
                <Text style={styles.hintText}>
                  Mã OTP 6 chữ số sẽ được gửi qua SMS hoặc Zalo ZNS.
                </Text>
              )}
            </View>

            {/* Submit Button */}
            <AppButton
              label={loading ? 'Đang gửi mã...' : 'Nhận mã OTP'}
              icon={!loading ? <ArrowRight size={18} color="#FFFFFF" /> : undefined}
              iconPosition="right"
              onPress={handleRequestOtp}
              disabled={!isValid || loading}
              loading={loading}
              style={styles.submitBtn}
              testID="submit-phone-btn"
            />

            {/* Small Print: Decree 13/2023 */}
            <Text style={styles.smallPrint}>
              Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và chấp thuận việc xử lý dữ liệu cá nhân theo{' '}
              <Text style={styles.smallPrintBold}>Nghị định 13/2023/NĐ-CP</Text>.
            </Text>
          </View>

          {/* Dev Quick Actions (IS_DEV only) */}
          {IS_DEV ? (
            <View style={styles.devCard}>
              <StatusBadge label="[DEV MODE] Chuyển nhanh vùng thử nghiệm" tone="neutral" />
              <Text style={styles.devNote}>API: {env.apiBaseUrl}</Text>
              <View style={styles.devStack}>
                <AppButton
                  label="[DEV] Vào thẳng ca mẫu (ACTIVE)"
                  variant="secondary"
                  onPress={() => void enterDevZone('active')}
                />
                <AppButton
                  label="[DEV] Kiểm thử vùng Onboarding"
                  variant="ghost"
                  onPress={() => void enterDevZone('onboarding')}
                />
                <AppButton
                  label="[DEV] Kiểm thử vùng Chờ duyệt"
                  variant="ghost"
                  onPress={() => void enterDevZone('pending')}
                />
                <AppButton
                  label="[DEV] Kiểm thử vùng Bị khóa"
                  variant="ghost"
                  onPress={() => void enterDevZone('locked')}
                />
              </View>
            </View>
          ) : null}
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
  brandHeader: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: tokens.colors.brandJade,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    letterSpacing: -0.5,
  },
  appRole: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.brandJade,
    letterSpacing: 1.2,
    marginTop: 2,
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
  },
  title: {
    fontSize: tokens.typography.fontSizeTitle,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
    marginBottom: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.paper,
    height: 56,
    overflow: 'hidden',
  },
  phoneInputRowError: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.subtle,
    gap: 4,
  },
  flagIcon: {
    fontSize: 16,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  hintText: {
    fontSize: 13,
    color: tokens.colors.inkMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  helperTextWarning: {
    fontSize: 13,
    color: tokens.colors.accentOchre,
    marginTop: 8,
    lineHeight: 18,
    fontWeight: '500',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 13.5,
    color: tokens.colors.alertCrimson,
    fontWeight: '600',
    flex: 1,
  },
  submitBtn: {
    minHeight: 56,
    borderRadius: tokens.radii.md,
    marginTop: 4,
  },
  smallPrint: {
    fontSize: 12.5,
    color: tokens.colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 20,
  },
  smallPrintBold: {
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  devCard: {
    width: '100%',
    maxWidth: 420,
    marginTop: 24,
    padding: 16,
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.borderHairline,
  },
  devNote: {
    fontSize: 12,
    color: tokens.colors.inkMuted,
    marginTop: 6,
    marginBottom: 10,
  },
  devStack: {
    gap: 8,
  },
});
