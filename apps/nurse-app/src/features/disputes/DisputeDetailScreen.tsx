import React, { useCallback, useEffect, useState } from 'react';
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
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react-native';
import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_DESCRIPTION_MIN_LENGTH,
  DISPUTE_STATUS_LABELS,
  DisputeStatus,
  type DisputeDto,
} from '@healthcare-system/shared';
import { AppButton } from '../../components/AppButton';
import { StateView } from '../../components/StateView';
import { env } from '../../lib/env';
import { formatDateTime, formatVND } from '../../lib/formatters';
import { putFileToPresignedUrl } from '../../lib/upload';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { DisputeTimeline } from './components/DisputeTimeline';
import { EvidenceGallery } from './components/EvidenceGallery';
import {
  EvidencePicker,
  type SelectedEvidenceItem,
} from './components/EvidencePicker';
import {
  getDispute,
  getEvidenceUploadUrls,
  submitDisputeRebuttal,
} from './disputes.api';

type Props = NativeStackScreenProps<ActiveStackParamList, 'DisputeDetail'>;

export const DisputeDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { disputeId } = route.params;

  const [dispute, setDispute] = useState<DisputeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rebuttal form state (preserved across upload retry)
  const [rebuttalText, setRebuttalText] = useState('');
  const [files, setFiles] = useState<SelectedEvidenceItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadDispute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDispute(disputeId);
      if (res.success && res.data) {
        setDispute(res.data);
      } else {
        setError(res.error?.message || 'Không thể tải chi tiết khiếu nại.');
      }
    } catch {
      setError('Lỗi kết nối khi tải chi tiết khiếu nại.');
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    void loadDispute();
  }, [loadDispute]);

  const handleSubmitRebuttal = async () => {
    if (!dispute) return;
    const trimmed = rebuttalText.trim();
    if (trimmed.length < DISPUTE_DESCRIPTION_MIN_LENGTH) {
      setSubmitError(
        `Nội dung giải trình phải có tối thiểu ${DISPUTE_DESCRIPTION_MIN_LENGTH} ký tự.`
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setUploadProgress(null);

    try {
      const uploadedUrls: string[] = [];

      if (files.length > 0) {
        setUploadProgress(`Đang xin liên kết tải ${files.length} tệp...`);
        const urlRes = await getEvidenceUploadUrls(
          dispute.id,
          files.map((f) => f.fileName)
        );
        if (!urlRes.success || urlRes.data.length !== files.length) {
          setSubmitError(
            urlRes.error?.message ||
              'Không thể tạo liên kết tải bằng chứng. Nội dung đã được giữ lại, vui lòng thử lại.'
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
            setSubmitError(
              `Lỗi tải lên tệp thứ ${i + 1} (${files[i].fileName}). Nội dung đã được giữ lại, vui lòng thử lại.`
            );
            return;
          }
          uploadedUrls.push(urlRes.data[i].publicUrl);
        }
      }

      setUploadProgress('Đang gửi phản hồi...');
      const rebRes = await submitDisputeRebuttal(
        dispute.id,
        trimmed,
        uploadedUrls
      );
      if (!rebRes.success) {
        setSubmitError(
          rebRes.error?.message ||
            'Gửi phản hồi thất bại. Nội dung đã được giữ lại, vui lòng thử lại.'
        );
        return;
      }

      setSuccessToast('Đã gửi phản hồi và bằng chứng thành công.');
      setRebuttalText('');
      setFiles([]);
      await loadDispute();
    } catch {
      setSubmitError(
        'Mất kết nối trong quá trình gửi. Nội dung đã được giữ lại, vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const isPenaltyAppeal = dispute?.kind === 'PENALTY_APPEAL';
  const canRebut =
    dispute !== null &&
    dispute.openedBy === 'PATIENT' &&
    dispute.status === DisputeStatus.OPEN &&
    !dispute.nurseRebuttal;

  const isResolved =
    dispute !== null &&
    (dispute.status === DisputeStatus.RESOLVED_NURSE ||
      dispute.status === DisputeStatus.RESOLVED_CUSTOMER ||
      dispute.status === DisputeStatus.RESOLVED_PARTIAL);

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isPenaltyAppeal
              ? 'Khiếu nại khoản trừ ký quỹ'
              : `Khiếu nại · ${dispute?.bookingCode || ''}`}
          </Text>
          <Text style={styles.headerSub}>
            {dispute
              ? DISPUTE_STATUS_LABELS[dispute.status] || dispute.status
              : 'Đang tải...'}
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
          {successToast ? (
            <View style={styles.toastBox} accessibilityRole="alert">
              <CheckCircle2 size={20} color={tokens.colors.brandJade} />
              <Text style={styles.toastText}>{successToast}</Text>
            </View>
          ) : null}

          {loading ? (
            <StateView
              kind="loading"
              title="Đang tải chi tiết khiếu nại..."
              message="Vui lòng chờ trong giây lát."
            />
          ) : error || !dispute ? (
            <StateView
              kind="error"
              title="Không thể tải chi tiết"
              message={error || 'Không tìm thấy khiếu nại.'}
              actionLabel="Thử lại"
              onAction={() => void loadDispute()}
            />
          ) : (
            <>
              {/* Penalty Appeal Info Card (ADR-0004 D3) */}
              {isPenaltyAppeal ? (
                <View style={styles.penaltyCard}>
                  <Text style={styles.sectionLabel}>
                    KHOẢN TRỪ KÝ QUỸ BỊ KHIẾU NẠI (ADR-0004)
                  </Text>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvKey}>Số tiền bị trừ:</Text>
                    <Text style={styles.kvValCrimson}>
                      {dispute.penaltyAmount
                        ? formatVND(dispute.penaltyAmount)
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvKey}>Mã ca liên quan:</Text>
                    <Text style={styles.kvVal}>{dispute.bookingCode}</Text>
                  </View>
                  {dispute.penaltyReason ? (
                    <View style={styles.kvBlock}>
                      <Text style={styles.kvKey}>Lý do trừ:</Text>
                      <Text style={styles.kvVal}>{dispute.penaltyReason}</Text>
                    </View>
                  ) : null}
                  {dispute.slaRule ? (
                    <View style={styles.kvBlock}>
                      <Text style={styles.kvKey}>Điều khoản SLA:</Text>
                      <Text style={styles.kvVal}>{dispute.slaRule}</Text>
                    </View>
                  ) : null}
                  <View style={styles.kvRow}>
                    <Text style={styles.kvKey}>Ngày gửi:</Text>
                    <Text style={styles.kvVal}>
                      {formatDateTime(dispute.createdAt)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Dispute Content & Opener Evidences */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {isPenaltyAppeal
                    ? 'Lý do khiếu nại của bạn'
                    : dispute.openedBy === 'PATIENT'
                      ? 'Nội dung khiếu nại từ khách hàng'
                      : 'Nội dung khiếu nại của bạn'}
                </Text>
                {!isPenaltyAppeal ? (
                  <Text style={styles.categoryTag}>
                    {DISPUTE_CATEGORY_LABELS[dispute.category]?.title ||
                      dispute.category}
                  </Text>
                ) : null}
                <Text style={styles.bodyText}>{dispute.description}</Text>

                <Text style={styles.subHeading}>Bằng chứng đính kèm</Text>
                <EvidenceGallery evidences={dispute.evidences} />
              </View>

              {/* Existing Nurse Rebuttal */}
              {dispute.nurseRebuttal ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Phản hồi bạn đã gửi</Text>
                  <Text style={styles.metaDate}>
                    Gửi lúc {formatDateTime(dispute.nurseRebuttal.submittedAt)}
                  </Text>
                  <Text style={styles.bodyText}>
                    {dispute.nurseRebuttal.content}
                  </Text>
                  {dispute.nurseRebuttal.evidences &&
                  dispute.nurseRebuttal.evidences.length > 0 ? (
                    <>
                      <Text style={styles.subHeading}>
                        Bằng chứng phản hồi
                      </Text>
                      <EvidenceGallery
                        evidences={dispute.nurseRebuttal.evidences}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}

              {/* Rebuttal Submission Form (when OPEN & due) */}
              {canRebut ? (
                <View style={styles.rebuttalCard}>
                  <Text style={styles.cardTitle}>Gửi phản hồi &amp; bằng chứng</Text>
                  {dispute.rebuttalDueAt ? (
                    <View style={styles.dueRow}>
                      <Clock size={15} color={tokens.colors.accentOchre} />
                      <Text style={styles.dueText}>
                        Hạn chót: {formatDateTime(dispute.rebuttalDueAt)}
                      </Text>
                    </View>
                  ) : null}

                  {submitError ? (
                    <View style={styles.errorBox} accessibilityRole="alert">
                      <AlertCircle size={18} color={tokens.colors.alertCrimson} />
                      <Text style={styles.errorText}>{submitError}</Text>
                    </View>
                  ) : null}

                  <TextInput
                    style={styles.textArea}
                    value={rebuttalText}
                    onChangeText={setRebuttalText}
                    placeholder="Trình bày chi tiết sự việc và đối chiếu quy trình (tối thiểu 20 ký tự)..."
                    placeholderTextColor={tokens.colors.inkMuted}
                    multiline
                    editable={!submitting}
                    textAlignVertical="top"
                  />

                  <EvidencePicker
                    files={files}
                    onChange={setFiles}
                    disabled={submitting}
                  />

                  {uploadProgress ? (
                    <Text style={styles.progressText}>{uploadProgress}</Text>
                  ) : null}

                  <AppButton
                    label={submitError ? 'Thử gửi lại' : 'Gửi phản hồi'}
                    variant="primary"
                    onPress={() => void handleSubmitRebuttal()}
                    loading={submitting}
                    disabled={submitting}
                  />
                </View>
              ) : null}

              {/* Resolution Card */}
              {isResolved && dispute.resolution ? (
                <View
                  style={[
                    styles.resolutionCard,
                    dispute.status === DisputeStatus.RESOLVED_NURSE
                      ? styles.resolutionNurse
                      : styles.resolutionCustomer,
                  ]}
                >
                  <View style={styles.resHead}>
                    {dispute.status === DisputeStatus.RESOLVED_NURSE ? (
                      <ShieldCheck size={22} color={tokens.colors.brandJade} />
                    ) : (
                      <ShieldAlert size={22} color={tokens.colors.alertCrimson} />
                    )}
                    <Text style={styles.resTitle}>
                      {dispute.status === DisputeStatus.RESOLVED_NURSE
                        ? isPenaltyAppeal
                          ? `Đã hoàn lại ${
                              dispute.penaltyAmount
                                ? formatVND(dispute.penaltyAmount)
                                : 'khoản trừ'
                            } vào ký quỹ (PENALTY_REVERSAL)`
                          : '85% thù lao đã vào ví'
                        : isPenaltyAppeal
                          ? 'Khiếu nại bị bác — Khoản trừ giữ nguyên'
                          : 'Phán quyết: Khách hàng thắng khiếu nại'}
                    </Text>
                  </View>

                  <Text style={styles.bodyText}>{dispute.resolution.note}</Text>

                  {dispute.resolution.trustScoreDelta ? (
                    <Text style={styles.impactText}>
                      • Điểm TrustScore: {dispute.resolution.trustScoreDelta} điểm
                    </Text>
                  ) : null}
                  {dispute.resolution.depositDeducted ? (
                    <Text style={styles.impactText}>
                      • Trừ ký quỹ: {formatVND(dispute.resolution.depositDeducted)}
                    </Text>
                  ) : null}
                  {dispute.status === DisputeStatus.RESOLVED_CUSTOMER &&
                  !isPenaltyAppeal ? (
                    <Text style={styles.noReappealNote}>
                      Lưu ý: Khoản trừ ký quỹ từ phán quyết khiếu nại của khách (DISPUTE_UPHELD) không thể khiếu nại lại.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Timeline */}
              <DisputeTimeline dispute={dispute} />
            </>
          )}
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
    fontSize: 19,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  headerSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 36,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.md,
    padding: 14,
  },
  toastText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  penaltyCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.accentOchre,
    padding: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.colors.accentOchre,
    letterSpacing: 0.4,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  kvBlock: {
    gap: 2,
  },
  kvKey: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
  },
  kvVal: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  kvValCrimson: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
  },
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.subtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  metaDate: {
    fontSize: 13,
    color: tokens.colors.inkMuted,
  },
  bodyText: {
    fontSize: 15,
    color: tokens.colors.inkPrimary,
    lineHeight: 22,
  },
  subHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
    marginTop: 4,
  },
  rebuttalCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    padding: 16,
    gap: 12,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.accentOchreSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radii.sm,
  },
  dueText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
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
    lineHeight: 19,
  },
  textArea: {
    minHeight: 110,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.canvas,
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
  resolutionCard: {
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
  },
  resolutionNurse: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderColor: tokens.colors.brandJade,
  },
  resolutionCustomer: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderColor: tokens.colors.alertCrimson,
  },
  resHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  impactText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },
  noReappealNote: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
    lineHeight: 19,
    marginTop: 4,
  },
});
