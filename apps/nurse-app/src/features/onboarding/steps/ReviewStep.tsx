import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  FileCheck2,
  Pencil,
  ShieldAlert,
  UserCheck,
} from 'lucide-react-native';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';
import { AppButton } from '../../../components';
import { tokens } from '../../../styles/tokens';
import {
  getUploadUrls,
  putFileToPresignedUrl,
  submitOnboarding,
} from '../onboarding.api';
import type { OnboardingDraftData } from '../onboarding-draft';
import type { SubmitOnboardingInput, UploadPurpose } from '../onboarding.types';

interface ReviewStepProps {
  draft: OnboardingDraftData;
  onGoToStep: (stepIndex: number) => void;
  onSubmitSuccess: (profile: NurseProfile, credentials: NurseCredential[]) => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  draft,
  onGoToStep,
  onSubmitSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitting(true);
    setProgressPercent(0);

    try {
      // 1. Chuẩn bị danh sách file cần xin presigned URL
      const fileEntries: Array<{ purpose: UploadPurpose; uri: string }> = [
        { purpose: 'CCCD_FRONT', uri: draft.cccdFrontUri! },
        { purpose: 'CCCD_BACK', uri: draft.cccdBackUri! },
        { purpose: 'PORTRAIT', uri: draft.portraitUri! },
        { purpose: 'DEGREE', uri: draft.degreeUri! },
      ];

      if (draft.hasGphn && draft.gphnUri) {
        fileEntries.push({ purpose: 'GPHN', uri: draft.gphnUri });
      }

      if (draft.isRetired && draft.retirementUri) {
        fileEntries.push({ purpose: 'RETIREMENT_DECISION', uri: draft.retirementUri });
      }

      setCurrentAction('Đang xin cấp quyền tải ảnh bảo mật...');
      const urlsRes = await getUploadUrls(fileEntries.map((f) => f.purpose));
      if (!urlsRes.success) {
        throw new Error(urlsRes.error?.message || 'Không thể xin URL tải ảnh. Vui lòng thử lại.');
      }

      const keyByPurpose = new Map<UploadPurpose, string>();
      const totalFiles = fileEntries.length;

      // 2. Tải lần lượt từng file lên URL ký trước (S3) và cập nhật thanh tiến độ
      for (let i = 0; i < totalFiles; i++) {
        const item = fileEntries[i];
        const urlItem = urlsRes.data.files.find((f) => f.purpose === item.purpose);
        if (!urlItem) {
          throw new Error(`Không tìm thấy URL tải cho ${item.purpose}.`);
        }

        setCurrentAction(`Đang tải ảnh (${i + 1}/${totalFiles})...`);
        const okPut = await putFileToPresignedUrl(urlItem.uploadUrl, item.uri, urlItem.contentType);
        if (!okPut) {
          throw new Error(`Tải tệp ${item.purpose} lên kho lưu trữ thất bại.`);
        }

        keyByPurpose.set(item.purpose, urlItem.objectKey);
        setProgressPercent(Math.round(((i + 1) / totalFiles) * 85));
      }

      // 3. Chuẩn bị payload nộp hồ sơ eKYC
      setCurrentAction('Đang nộp hồ sơ thẩm định...');
      const body: SubmitOnboardingInput = {
        cccdNumber: draft.cccdNumber.trim(),
        yearsOfExp: Math.max(0, Math.min(70, Number(draft.yearsOfExp || 0))),
        identity: {
          cccdFrontKey: keyByPurpose.get('CCCD_FRONT')!,
          cccdBackKey: keyByPurpose.get('CCCD_BACK')!,
          portraitKey: keyByPurpose.get('PORTRAIT')!,
        },
        degree: {
          fileKey: keyByPurpose.get('DEGREE')!,
        },
      };

      if (draft.hasGphn && keyByPurpose.has('GPHN')) {
        body.gphn = {
          fileKey: keyByPurpose.get('GPHN')!,
          number: draft.gphnNumber || '000123/GPHN',
          issuedDate: draft.gphnIssuedDate || '2020-01-01',
          expiryDate: draft.gphnExpiryDate || '2030-01-01',
          issuingAuthority: draft.gphnAuthority || 'Sở Y tế',
          scopeOfPractice: draft.scopeOfPractice || 'Điều dưỡng đa khoa',
        };
      }

      if (draft.isRetired && keyByPurpose.has('RETIREMENT_DECISION')) {
        body.retirementDecision = {
          fileKey: keyByPurpose.get('RETIREMENT_DECISION')!,
        };
      }

      const submitRes = await submitOnboarding(body);
      if (!submitRes.success) {
        throw new Error(submitRes.error?.message || 'Nộp hồ sơ thất bại. Vui lòng kiểm tra lại.');
      }

      setProgressPercent(100);
      onSubmitSuccess(submitRes.data.profile, submitRes.data.credentials);
    } catch (err: any) {
      setSubmitError(err?.message || 'Đã xảy ra lỗi không xác định khi nộp hồ sơ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 6 · Xem lại hồ sơ & nộp</Text>
      <Text style={styles.stepSubtitle}>
        Vui lòng kiểm tra kỹ các thông tin trước khi nộp. Quản trị viên sẽ thẩm định từng văn bằng trước khi cấp quyền nhận ca.
      </Text>

      {/* Row 1: CCCD */}
      <View style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <UserCheck color={tokens.colors.brandJade} size={20} />
            <Text style={styles.cardTitle}>1. Căn cước công dân</Text>
          </View>
          <TouchableOpacity
            onPress={() => onGoToStep(0)}
            style={styles.editBtn}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa CCCD"
          >
            <Pencil color={tokens.colors.brandJade} size={15} />
            <Text style={styles.editBtnText}>Sửa</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.infoLine}>
          Số CCCD: <Text style={styles.infoValue}>{draft.cccdNumber || 'Chưa nhập'}</Text>
        </Text>
        <Text style={styles.infoLine}>
          Ảnh 2 mặt:{' '}
          <Text style={styles.infoValue}>
            {draft.cccdFrontUri && draft.cccdBackUri ? 'Đã chụp đủ 2 mặt' : 'Thiếu ảnh'}
          </Text>
        </Text>
      </View>

      {/* Row 2: Portrait */}
      <View style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <CheckCircle2 color={tokens.colors.brandJade} size={20} />
            <Text style={styles.cardTitle}>2. Ảnh chân dung</Text>
          </View>
          <TouchableOpacity
            onPress={() => onGoToStep(1)}
            style={styles.editBtn}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa ảnh chân dung"
          >
            <Pencil color={tokens.colors.brandJade} size={15} />
            <Text style={styles.editBtnText}>Sửa</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.infoLine}>
          Selfie trực tiếp:{' '}
          <Text style={styles.infoValue}>{draft.portraitUri ? 'Đã chụp thành công' : 'Chưa chụp'}</Text>
        </Text>
      </View>

      {/* Row 3: Degree */}
      <View style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <FileCheck2 color={tokens.colors.brandJade} size={20} />
            <Text style={styles.cardTitle}>3. Bằng tốt nghiệp chuyên môn</Text>
          </View>
          <TouchableOpacity
            onPress={() => onGoToStep(2)}
            style={styles.editBtn}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa bằng cấp"
          >
            <Pencil color={tokens.colors.brandJade} size={15} />
            <Text style={styles.editBtnText}>Sửa</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.infoLine}>
          Ảnh bằng cấp:{' '}
          <Text style={styles.infoValue}>{draft.degreeUri ? 'Đã tải lên' : 'Chưa có ảnh'}</Text>
        </Text>
        <Text style={styles.infoLine}>
          Kinh nghiệm: <Text style={styles.infoValue}>{draft.yearsOfExp || '0'} năm</Text>
        </Text>
      </View>

      {/* Row 4: GPHN */}
      <View style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <Award color={tokens.colors.brandJade} size={20} />
            <Text style={styles.cardTitle}>4. Giấy phép hành nghề (GPHN)</Text>
          </View>
          <TouchableOpacity
            onPress={() => onGoToStep(3)}
            style={styles.editBtn}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa GPHN"
          >
            <Pencil color={tokens.colors.brandJade} size={15} />
            <Text style={styles.editBtnText}>Sửa</Text>
          </TouchableOpacity>
        </View>
        {draft.hasGphn ? (
          <>
            <Text style={styles.infoLine}>
              Số GPHN: <Text style={styles.infoValue}>{draft.gphnNumber || 'Chưa nhập'}</Text>
            </Text>
            <Text style={styles.infoLine}>
              Phạm vi: <Text style={styles.infoValue}>{draft.scopeOfPractice || 'Điều dưỡng đa khoa'}</Text>
            </Text>
            <Text style={styles.infoLine}>
              Ngày hết hạn: <Text style={styles.infoValue}>{draft.gphnExpiryDate || 'Chưa nhập'}</Text>
            </Text>
            <Text style={styles.infoLine}>
              Dự kiến phân cấp: <Text style={styles.tierHighlight}>Tầng 2 (Thủ thuật xâm lấn)</Text>
            </Text>
          </>
        ) : (
          <Text style={styles.infoLine}>
            Tùy chọn: <Text style={styles.infoValue}>Chưa có GPHN (Xét duyệt Tầng 1 - Chăm sóc cơ bản)</Text>
          </Text>
        )}
      </View>

      {/* Row 5: Supplement */}
      <View style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <Award color={tokens.colors.brandJade} size={20} />
            <Text style={styles.cardTitle}>5. Giấy tờ bổ trợ</Text>
          </View>
          <TouchableOpacity
            onPress={() => onGoToStep(4)}
            style={styles.editBtn}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa giấy bổ trợ"
          >
            <Pencil color={tokens.colors.brandJade} size={15} />
            <Text style={styles.editBtnText}>Sửa</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.infoLine}>
          Quyết định nghỉ hưu:{' '}
          <Text style={styles.infoValue}>
            {draft.isRetired
              ? draft.retirementUri
                ? 'Đã chụp quyết định nghỉ hưu'
                : 'Chưa có ảnh quyết định'
              : 'Không đăng ký'}
          </Text>
        </Text>
      </View>

      {/* Notice alert */}
      <View style={styles.noticeAlert}>
        <ShieldAlert color={tokens.colors.brandJade} size={22} style={styles.noticeIcon} />
        <Text style={styles.noticeText}>
          Hồ sơ sau khi nộp sẽ được chuyển sang vùng <Text style={styles.boldText}>Chờ duyệt</Text>. Bạn chỉ có thể nhận ca trực sau khi Quản trị viên CareNest thẩm định hồ sơ và phê duyệt.
        </Text>
      </View>

      {submitError ? (
        <View style={styles.errorBanner}>
          <AlertCircle color={tokens.colors.alertCrimson} size={20} />
          <Text style={styles.errorBannerText}>{submitError}</Text>
        </View>
      ) : null}

      {submitting ? (
        <View style={styles.submittingBox}>
          <ActivityIndicator color={tokens.colors.brandJade} size="large" />
          <Text style={styles.submittingText}>{currentAction}</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressPercentText}>{progressPercent}%</Text>
        </View>
      ) : (
        <AppButton
          label="Nộp hồ sơ để duyệt"
          onPress={handleSubmit}
          style={styles.submitBtn}
          testID="btn-submit-onboarding"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  stepTitle: {
    fontSize: tokens.typography.fontSizeLarge,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.paddingBase,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  infoLine: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
    marginTop: 2,
  },
  infoValue: {
    color: tokens.colors.inkPrimary,
    fontWeight: '600',
  },
  tierHighlight: {
    color: tokens.colors.brandJade,
    fontWeight: '700',
  },
  noticeAlert: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.sm,
    padding: 14,
    alignItems: 'flex-start',
    marginVertical: 14,
  },
  noticeIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 13.5,
    color: tokens.colors.brandJadeDark,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderRadius: tokens.radii.sm,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    color: tokens.colors.alertCrimson,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  submittingBox: {
    padding: 20,
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    gap: 10,
  },
  submittingText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: tokens.colors.subtle,
    borderRadius: tokens.radii.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.pill,
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  submitBtn: {
    marginTop: 8,
    minHeight: 52,
  },
});
