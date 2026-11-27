import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Send,
  Trash2,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { createCameraProvider } from '../../lib/hardware-providers';
import { appealPenalty } from './deposit.api';

type Props = NativeStackScreenProps<ActiveStackParamList, 'AppealPenalty'>;

export const AppealPenaltyScreen: React.FC<Props> = ({ route, navigation }) => {
  const { transactionId } = route.params;

  const [reason, setReason] = useState<string>('');
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const trimmedLength = reason.trim().length;
  const isMinLengthMet = trimmedLength >= 20;

  const handleCapturePhoto = async () => {
    try {
      const provider = createCameraProvider(undefined, {
        facing: 'back',
        instruction: 'Chụp hình ảnh giấy xác nhận y tế, tai nạn, sự cố xe hoặc bằng chứng bất khả kháng.',
        mode: 'document',
      });
      const uri = await provider();
      if (uri) {
        setEvidenceUris((prev) => [...prev, uri]);
      }
    } catch (err: any) {
      Alert.alert('Không thể mở camera', err?.message || 'Vui lòng kiểm tra quyền truy cập camera.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setEvidenceUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitAppeal = async () => {
    if (!isMinLengthMet) {
      Alert.alert(
        'Lý do quá ngắn',
        `Lý do khiếu nại phải có ít nhất 20 ký tự (hiện tại có ${trimmedLength} ký tự). Vui lòng diễn giải chi tiết nguyên nhân bất khả kháng.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await appealPenalty(transactionId, {
        reason: reason.trim(),
        evidenceKeys: evidenceUris.map((_, i) => `evidence-appeal-${transactionId}-${i + 1}.jpg`),
      });

      if (res.success && res.data) {
        Alert.alert(
          'Gửi khiếu nại thành công',
          `Mã khiếu nại của bạn: ${res.data.disputeId}.\nBộ phận kiểm soát chất lượng CareNest sẽ xem xét bằng chứng và phản hồi trong vòng 24–48 giờ.`,
          [
            {
              text: 'Đã hiểu',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Không thể gửi khiếu nại', res.error?.message || 'Vui lòng thử lại sau.');
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể gửi khiếu nại lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={24} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Khiếu nại khoản trừ</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Thông tin khoản trừ đang khiếu nại */}
          <View style={styles.bannerInfo}>
            <AlertCircle size={20} color="#0284C7" />
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>Giao dịch #{transactionId}</Text>
              <Text style={styles.bannerDesc}>
                Khiếu nại sẽ được gửi tới Ban Kiểm Soát SLA CareNest để đối soát lại nguyên nhân và
                hoàn trả ký quỹ nếu được chấp thuận.
              </Text>
            </View>
          </View>

          {/* Form lý do */}
          <View style={styles.formSection}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Lý do khiếu nại (bắt buộc)</Text>
              <Text
                style={[
                  styles.counterText,
                  isMinLengthMet ? styles.counterValid : styles.counterInvalid,
                ]}
              >
                {trimmedLength}/20 ký tự {isMinLengthMet ? '✓' : '(tối thiểu 20)'}
              </Text>
            </View>

            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={reason}
              onChangeText={setReason}
              placeholder="Vui lòng giải trình rõ ràng lý do bất khả kháng (hỏng xe trên đường, cấp cứu đột xuất có giấy tờ xác nhận, v.v.)..."
              placeholderTextColor={tokens.colors.inkMuted}
            />
          </View>

          {/* Đính kèm hình ảnh bằng chứng */}
          <View style={styles.formSection}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Ảnh bằng chứng minh chứng (nếu có)</Text>
              <Text style={styles.counterText}>{evidenceUris.length} ảnh</Text>
            </View>

            <TouchableOpacity
              style={styles.btnCapture}
              onPress={handleCapturePhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh bằng chứng"
            >
              <Camera size={20} color={tokens.colors.brandJade} />
              <Text style={styles.btnCaptureText}>Chụp ảnh bằng chứng trực tiếp</Text>
            </TouchableOpacity>

            {evidenceUris.length > 0 && (
              <View style={styles.photosGrid}>
                {evidenceUris.map((uri, idx) => (
                  <View key={idx} style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => handleRemovePhoto(idx)}
                      accessibilityRole="button"
                      accessibilityLabel="Xóa ảnh này"
                    >
                      <X size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Nút gửi khiếu nại */}
          <TouchableOpacity
            style={[
              styles.btnSubmit,
              (!isMinLengthMet || submitting) && styles.btnSubmitDisabled,
            ]}
            onPress={handleSubmitAppeal}
            disabled={!isMinLengthMet || submitting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Gửi khiếu nại khoản trừ"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Send size={18} color="#FFFFFF" />
                <Text style={styles.btnSubmitText}>Gửi khiếu nại khoản trừ</Text>
              </>
            )}
          </TouchableOpacity>
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
  flex: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backBtn: {
    padding: 6,
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: tokens.radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0369A1',
    marginBottom: 2,
  },
  bannerDesc: {
    fontSize: 13,
    color: '#0C4A6E',
    lineHeight: 18,
  },
  formSection: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14.5,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  counterValid: {
    color: '#15803D',
  },
  counterInvalid: {
    color: tokens.colors.alertCrimson,
  },
  textArea: {
    backgroundColor: tokens.colors.canvas,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.inkPrimary,
    minHeight: 130,
  },
  btnCapture: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  btnCaptureText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  photoThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubmit: {
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnSubmitDisabled: {
    backgroundColor: '#CBD5E1',
  },
  btnSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
