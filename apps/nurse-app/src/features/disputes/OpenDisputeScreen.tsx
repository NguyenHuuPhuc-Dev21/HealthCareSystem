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
import { AlertCircle, ArrowLeft, Check } from 'lucide-react-native';
import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_DESCRIPTION_MAX_LENGTH,
  DISPUTE_DESCRIPTION_MIN_LENGTH,
  type DisputeCategory,
} from '@healthcare-system/shared';
import { AppButton } from '../../components/AppButton';
import { env } from '../../lib/env';
import { putFileToPresignedUrl } from '../../lib/upload';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import {
  EvidencePicker,
  type SelectedEvidenceItem,
} from './components/EvidencePicker';
import { getEvidenceUploadUrls, openDispute } from './disputes.api';

type Props = NativeStackScreenProps<ActiveStackParamList, 'OpenDispute'>;

const CATEGORIES = Object.keys(DISPUTE_CATEGORY_LABELS) as DisputeCategory[];

export const OpenDisputeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { bookingId } = route.params;

  const [category, setCategory] = useState<DisputeCategory>(
    'UNPROFESSIONAL_CONDUCT'
  );
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<SelectedEvidenceItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (trimmed.length < DISPUTE_DESCRIPTION_MIN_LENGTH) {
      setError(
        `Mô tả khiếu nại phải có tối thiểu ${DISPUTE_DESCRIPTION_MIN_LENGTH} ký tự.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setUploadProgress(null);

    try {
      const uploadedUrls: string[] = [];

      if (files.length > 0) {
        setUploadProgress(`Đang chuẩn bị tải ${files.length} tệp...`);
        const urlRes = await getEvidenceUploadUrls(
          bookingId,
          files.map((f) => f.fileName)
        );
        if (!urlRes.success || urlRes.data.length !== files.length) {
          setError(
            urlRes.error?.message ||
              'Không thể tạo liên kết tải bằng chứng. Vui lòng thử lại.'
          );
          return;
        }

        for (let i = 0; i < files.length; i += 1) {
          setUploadProgress(`Đang tải tệp ${i + 1}/${files.length}...`);
          const ok = await putFileToPresignedUrl(
            urlRes.data[i].uploadUrl,
            files[i].uri,
            files[i].contentType,
            env.useMockDisputes
          );
          if (!ok) {
            setError(
              `Lỗi tải lên tệp ${files[i].fileName}. Nội dung đã được giữ lại, vui lòng thử lại.`
            );
            return;
          }
          uploadedUrls.push(urlRes.data[i].publicUrl);
        }
      }

      setUploadProgress('Đang gửi khiếu nại...');
      const res = await openDispute(bookingId, {
        category,
        description: trimmed,
        evidenceUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      });

      if (res.success && res.data?.dispute_id) {
        navigation.replace('DisputeDetail', {
          disputeId: res.data.dispute_id,
        });
      } else {
        setError(
          res.error?.message || 'Không thể mở khiếu nại. Vui lòng thử lại.'
        );
      }
    } catch {
      setError('Lỗi kết nối khi gửi khiếu nại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={22} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>Mở khiếu nại ca trực</Text>
          <Text style={styles.headerSub}>
            Gửi trong khi ca đang chạy hoặc trong 24 giờ sau check-out
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <AlertCircle size={18} color={tokens.colors.alertCrimson} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Category Selection */}
          <Text style={styles.sectionTitle}>Chọn lý do khiếu nại *</Text>
          <View style={styles.categoryList}>
            {CATEGORIES.map((cat) => {
              const selected = category === cat;
              const info = DISPUTE_CATEGORY_LABELS[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catCard,
                    selected && styles.catCardSelected,
                  ]}
                  onPress={() => setCategory(cat)}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.catHead}>
                    <Text
                      style={[
                        styles.catTitle,
                        selected && styles.catTitleSelected,
                      ]}
                    >
                      {info.title}
                    </Text>
                    {selected ? (
                      <Check size={18} color={tokens.colors.brandJade} />
                    ) : null}
                  </View>
                  <Text style={styles.catDesc}>{info.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <View style={styles.descHeader}>
            <Text style={styles.sectionTitle}>Mô tả chi tiết *</Text>
            <Text style={styles.counter}>
              {description.trim().length}/{DISPUTE_DESCRIPTION_MAX_LENGTH} (tối thiểu{' '}
              {DISPUTE_DESCRIPTION_MIN_LENGTH})
            </Text>
          </View>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Mô tả rõ sự việc, thời điểm và vấn đề cần hỗ trợ..."
            placeholderTextColor={tokens.colors.inkMuted}
            multiline
            maxLength={DISPUTE_DESCRIPTION_MAX_LENGTH}
            editable={!submitting}
            textAlignVertical="top"
          />

          {/* Optional Evidence */}
          <EvidencePicker
            files={files}
            onChange={setFiles}
            disabled={submitting}
          />

          {uploadProgress ? (
            <Text style={styles.progressText}>{uploadProgress}</Text>
          ) : null}

          <AppButton
            label="Gửi khiếu nại"
            variant="primary"
            onPress={() => void handleSubmit()}
            loading={submitting}
            disabled={submitting}
          />
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
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backBtn: {
    width: tokens.spacing.touchTargetMin,
    height: tokens.spacing.touchTargetMin,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19.5,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  headerSub: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 36,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: tokens.colors.alertCrimson,
    borderRadius: tokens.radii.sm,
    padding: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  categoryList: {
    gap: 10,
  },
  catCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 14,
    gap: 4,
  },
  catCardSelected: {
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  catHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  catTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  catTitleSelected: {
    color: tokens.colors.brandJadeDark,
  },
  catDesc: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 19,
  },
  descHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  counter: {
    fontSize: 12.5,
    color: tokens.colors.inkMuted,
  },
  textArea: {
    minHeight: 115,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.paper,
    padding: 12,
    fontSize: 15,
    color: tokens.colors.inkPrimary,
    lineHeight: 22,
  },
  progressText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
});
