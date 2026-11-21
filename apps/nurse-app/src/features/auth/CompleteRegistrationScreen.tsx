import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, ArrowLeft, ArrowRight, UserCheck } from 'lucide-react-native';
import { AppButton } from '../../components';
import type { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { useAuth } from './AuthContext';
import { completeRegistration } from './auth.api';

type Props = NativeStackScreenProps<AuthStackParamList, 'CompleteRegistration'>;

export const CompleteRegistrationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { registrationToken, phone } = route.params;
  const { login } = useAuth();

  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Kiểm tra họ tên: bắt buộc tối thiểu 2 từ, chỉ gồm chữ cái
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const isValidFullName = words.length >= 2;

  const handleSubmit = async () => {
    if (!isValidFullName || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await completeRegistration(registrationToken, fullName);

      if (res.success && res.data) {
        await login(res.data);
        // RootNavigator tự động nhận diện profile: null -> chuyển tới vùng 'onboarding'
      } else {
        setErrorMessage(
          res.error?.message || 'Không thể hoàn tất đăng ký. Vui lòng thử lại.'
        );
      }
    } catch {
      setErrorMessage('Lỗi mạng khi đăng ký tài khoản. Vui lòng kiểm tra lại.');
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
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <ArrowLeft size={20} color={tokens.colors.inkPrimary} />
            <Text style={styles.backButtonText}>Quay lại</Text>
          </TouchableOpacity>

          {/* Main Card */}
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <UserCheck size={28} color={tokens.colors.brandJade} />
            </View>

            <Text style={styles.title}>Hoàn tất đăng ký</Text>
            <Text style={styles.subtitle}>
              Chào mừng bạn tham gia mạng lưới điều dưỡng CareNest. Vui lòng nhập họ và tên đúng như trên thẻ CCCD.
            </Text>

            {/* Phone Info Display */}
            <View style={styles.phoneBadge}>
              <Text style={styles.phoneBadgeLabel}>Số điện thoại:</Text>
              <Text style={styles.phoneBadgeValue}>{phone}</Text>
            </View>

            {/* Full Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Họ và tên đầy đủ</Text>
              <TextInput
                style={[
                  styles.textInput,
                  errorMessage ? styles.textInputError : null,
                ]}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Ví dụ: Nguyễn Thị Mai"
                placeholderTextColor={tokens.colors.inkMuted}
                autoCapitalize="words"
                autoComplete="name"
                accessibilityLabel="Nhập họ và tên đầy đủ"
                testID="full-name-input"
              />

              {errorMessage ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={15} color={tokens.colors.alertCrimson} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : fullName.length > 0 && !isValidFullName ? (
                <Text style={styles.helperTextWarning}>
                  Vui lòng nhập đầy đủ cả họ và tên (tối thiểu 2 từ).
                </Text>
              ) : (
                <Text style={styles.hintText}>
                  Tên sẽ được đối soát tự động khi bạn tải lên Căn cước công dân và Chứng chỉ hành nghề ở bước tiếp theo.
                </Text>
              )}
            </View>

            {/* Submit Button */}
            <AppButton
              label={loading ? 'Đang tạo tài khoản...' : 'Bắt đầu thiết lập hồ sơ'}
              icon={!loading ? <ArrowRight size={18} color="#FFFFFF" /> : undefined}
              iconPosition="right"
              onPress={handleSubmit}
              disabled={!isValidFullName || loading}
              loading={loading}
              style={styles.submitBtn}
              testID="submit-registration-btn"
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
    marginBottom: 20,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.subtle,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 20,
    width: '100%',
  },
  phoneBadgeLabel: {
    fontSize: 14,
    color: tokens.colors.inkMuted,
    fontWeight: '600',
  },
  phoneBadgeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  inputGroup: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
  },
  textInput: {
    height: 56,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.paper,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  textInputError: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
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
    fontWeight: '600',
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
    width: '100%',
    minHeight: 56,
    borderRadius: tokens.radii.md,
  },
});
