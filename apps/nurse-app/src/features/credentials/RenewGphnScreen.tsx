import React, { useState } from 'react';
import {
  Alert,
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
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { AppButton } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { DocumentCaptureCard } from '../onboarding/components/DocumentCaptureCard';
import { createCameraProvider } from '../../lib/hardware-providers';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';
import { uploadRenewedGphn } from './credentials.api';

type RenewGphnScreenProps = NativeStackScreenProps<ActiveStackParamList, 'RenewGphn'>;

export const RenewGphnScreen: React.FC<RenewGphnScreenProps> = ({ navigation }) => {
  const { session, updateProfile } = useAuth();
  const profile = session?.profile;

  const [gphnUri, setGphnUri] = useState<string | null>(null);
  const [gphnNumber, setGphnNumber] = useState(profile?.gphn_number ?? '');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [scopeOfPractice, setScopeOfPractice] = useState(
    profile?.scope_of_practice || 'Điều dưỡng đa khoa'
  );
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isExpired = Boolean(expiryDate && expiryDate <= todayStr);
  const isInvalidDateOrder = Boolean(issuedDate && expiryDate && expiryDate <= issuedDate);

  const handleCapture = async () => {
    try {
      const provider = createCameraProvider(undefined, {
        mode: 'document',
        facing: 'back',
        instruction: 'Căn chỉnh toàn bộ mặt trước GPHN vào khung hình và chụp rõ nét.',
      });
      const uri = await provider();
      if (uri) {
        setGphnUri(uri);
        setErrorMessage(null);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể kích hoạt camera chụp GPHN.'
      );
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!gphnUri) {
      setErrorMessage('Vui lòng chụp ảnh bản gốc Giấy phép hành nghề mới.');
      return;
    }
    if (!gphnNumber.trim()) {
      setErrorMessage('Vui lòng nhập số Giấy phép hành nghề mới.');
      return;
    }
    if (!issuingAuthority.trim()) {
      setErrorMessage('Vui lòng nhập cơ quan cấp GPHN.');
      return;
    }
    if (!scopeOfPractice.trim()) {
      setErrorMessage('Vui lòng nhập phạm vi hoạt động chuyên môn.');
      return;
    }
    if (!issuedDate.trim()) {
      setErrorMessage('Vui lòng nhập ngày cấp GPHN (định dạng YYYY-MM-DD).');
      return;
    }
    if (!expiryDate.trim()) {
      setErrorMessage('Vui lòng nhập ngày hết hạn GPHN (định dạng YYYY-MM-DD).');
      return;
    }
    if (expiryDate <= todayStr) {
      setErrorMessage('Ngày hết hạn của GPHN mới phải sau ngày hôm nay.');
      return;
    }
    if (issuedDate && expiryDate <= issuedDate) {
      setErrorMessage('Ngày hết hạn phải sau ngày cấp GPHN.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await uploadRenewedGphn({
        fileUri: gphnUri,
        number: gphnNumber.trim(),
        issuedDate: issuedDate.trim(),
        expiryDate: expiryDate.trim(),
        issuingAuthority: issuingAuthority.trim(),
        scopeOfPractice: scopeOfPractice.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error?.message || 'Không thể gửi hồ sơ GPHN mới. Vui lòng thử lại.');
        return;
      }

      // Cập nhật profile và credential trong context
      await updateProfile(res.data.profile, [
        ...(session?.credentials?.filter((c) => c.doc_type !== 'GPHN') ?? []),
        res.data.credential,
      ]);

      Alert.alert(
        'Đã gửi hồ sơ thành công',
        'GPHN mới đã được gửi lên hệ thống và chuyển sang trạng thái chờ Admin duyệt. Hạng Cấp 2 sẽ tự động khôi phục sau khi được duyệt.',
        [
          {
            text: 'Đồng ý',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <ArrowLeft color={tokens.colors.inkPrimary} size={22} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Cập nhật GPHN mới</Text>
          <View style={styles.topBarRight} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headIntro}>
            <Text style={styles.title}>Gia hạn Giấy phép hành nghề</Text>
            <Text style={styles.subtitle}>
              Chụp trực tiếp bản gốc GPHN đã gia hạn và nhập thông tin mới để Admin thẩm định
              (FR-AUTH-01). Sau khi duyệt, bạn sẽ tự động được nâng lại Cấp 2.
            </Text>
          </View>

          <DocumentCaptureCard
            title="Ảnh chụp Giấy phép hành nghề mới"
            description="Chụp trực tiếp bằng camera, rõ 4 góc, rõ số giấy phép và thời hạn hiệu lực."
            required
            imageUri={gphnUri}
            onCapture={() => void handleCapture()}
            onRemove={() => setGphnUri(null)}
          />

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Số GPHN mới <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={gphnNumber}
              onChangeText={setGphnNumber}
              placeholder="Ví dụ: 01284/GPHN-ĐN"
              placeholderTextColor={tokens.colors.inkMuted}
              autoCapitalize="characters"
              accessibilityLabel="Số GPHN mới"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Cơ quan cấp <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={issuingAuthority}
              onChangeText={setIssuingAuthority}
              placeholder="Ví dụ: Sở Y tế TP. Đà Nẵng"
              placeholderTextColor={tokens.colors.inkMuted}
              accessibilityLabel="Cơ quan cấp"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Phạm vi hoạt động chuyên môn <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={scopeOfPractice}
              onChangeText={setScopeOfPractice}
              placeholder="Ví dụ: Điều dưỡng đa khoa"
              placeholderTextColor={tokens.colors.inkMuted}
              accessibilityLabel="Phạm vi hoạt động chuyên môn"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Ngày cấp (YYYY-MM-DD) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={issuedDate}
              onChangeText={setIssuedDate}
              placeholder="2026-10-01"
              placeholderTextColor={tokens.colors.inkMuted}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Ngày cấp"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Ngày hết hạn mới (YYYY-MM-DD) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, isExpired && styles.inputError]}
              value={expiryDate}
              onChangeText={setExpiryDate}
              placeholder="2031-10-01"
              placeholderTextColor={tokens.colors.inkMuted}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Ngày hết hạn mới"
            />
            {isExpired ? (
              <View style={styles.errorAlert}>
                <AlertTriangle color={tokens.colors.alertCrimson} size={18} />
                <Text style={styles.errorAlertText}>
                  Ngày hết hạn của GPHN mới bắt buộc phải sau ngày hôm nay ({todayStr}).
                </Text>
              </View>
            ) : isInvalidDateOrder ? (
              <View style={styles.errorAlert}>
                <AlertTriangle color={tokens.colors.alertCrimson} size={18} />
                <Text style={styles.errorAlertText}>Ngày hết hạn phải sau ngày cấp GPHN.</Text>
              </View>
            ) : null}
          </View>

          {errorMessage ? (
            <View style={styles.bannerError}>
              <AlertTriangle color={tokens.colors.alertCrimson} size={18} />
              <Text style={styles.bannerErrorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.actionWrap}>
            <AppButton
              label={submitting ? 'Đang gửi hồ sơ...' : 'Gửi thẩm định GPHN mới'}
              onPress={() => void handleSubmit()}
              disabled={submitting}
              loading={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  keyboardWrap: {
    flex: 1,
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  topBarRight: {
    width: 40,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  headIntro: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
  },
  fieldBox: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  requiredStar: {
    color: tokens.colors.alertCrimson,
  },
  input: {
    minHeight: tokens.spacing.touchTargetMin,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 14,
    fontSize: tokens.typography.fontSizeBase,
    color: tokens.colors.inkPrimary,
  },
  inputError: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
    padding: 10,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  errorAlertText: {
    flex: 1,
    color: tokens.colors.alertCrimson,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  bannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: tokens.radii.sm,
    marginBottom: 16,
  },
  bannerErrorText: {
    flex: 1,
    color: tokens.colors.alertCrimson,
    fontSize: 14,
    fontWeight: '600',
  },
  actionWrap: {
    marginTop: 10,
  },
});
