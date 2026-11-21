import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertCircle,
  Clock,
  FileText,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react-native';
import {
  DocType,
  ProfileStatus,
  VerificationStatus,
  mapCredentialView,
  mapStatusToProfile,
} from '@healthcare-system/shared';
import { AppButton, CareNestLogoMark, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { env } from '../../lib/env';
import { IS_DEV } from '../../lib/hardware-providers';
import { tokens } from '../../styles/tokens';
import type { OnboardingStackParamList } from '../../navigation/types';
import { getOnboardingStatus } from './onboarding.api';
import {
  mockAdminApproveProfile,
  mockSetDocumentReviewResult,
} from './onboarding.mock';
import type { CredentialViewDto } from './onboarding.types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PendingApproval'>;

const DOC_LABELS: Record<string, string> = {
  [DocType.CCCD]: 'Căn cước công dân (CCCD)',
  [DocType.DEGREE]: 'Bằng tốt nghiệp chuyên môn',
  [DocType.GPHN]: 'Giấy phép hành nghề (GPHN)',
  [DocType.RETIREMENT_DECISION]: 'Quyết định nghỉ hưu',
};

export const PendingApprovalScreen: React.FC<Props> = ({ navigation }) => {
  const { session, logout, updateProfile } = useAuth();
  const [credentials, setCredentials] = useState<CredentialViewDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getOnboardingStatus();
      if (res.success && res.data) {
        setCredentials(res.data.credentials || []);

        // Nếu Admin đã duyệt hồ sơ -> cập nhật profile thành ACTIVE
        if (res.data.profileStatus === ProfileStatus.ACTIVE) {
          const userId = session?.user?.id || 'nurse-me';
          const mappedProfile = mapStatusToProfile(res.data, userId);
          const mappedCreds = res.data.credentials.map((c) =>
            mapCredentialView(c, userId)
          );
          await updateProfile(mappedProfile, mappedCreds);
          return;
        }

        // Cập nhật profile nếu có thay đổi
        if (res.data.profileStatus) {
          const userId = session?.user?.id || 'nurse-me';
          const mappedProfile = mapStatusToProfile(res.data, userId);
          const mappedCreds = res.data.credentials.map((c) =>
            mapCredentialView(c, userId)
          );
          await updateProfile(mappedProfile, mappedCreds);
        }
      } else {
        setLoadError(res.error?.message || 'Không thể tải trạng thái hồ sơ mới nhất.');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Lỗi kết nối khi kiểm tra hồ sơ.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, updateProfile]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchStatus();
  };

  const handleFixDoc = (docType: DocType) => {
    navigation.navigate('OnboardingWizard', { fixDocType: docType });
  };

  const rejectedDocs = credentials.filter(
    (c) => c.verificationStatus === VerificationStatus.REJECTED
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerInfo}>
          <View style={styles.brandRow}>
            <CareNestLogoMark size={24} />
            <Text style={styles.headerTitle}>Hồ sơ chờ phê duyệt</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Xin chào {session?.user?.full_name || 'Điều dưỡng'} ({session?.user?.phone})
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void logout()}
          style={styles.logoutBtn}
          accessibilityRole="button"
          accessibilityLabel="Đăng xuất tài khoản"
        >
          <LogOut color={tokens.colors.inkSecondary} size={18} />
          <Text style={styles.logoutBtnText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.brandJade]}
            tintColor={tokens.colors.brandJade}
          />
        }
      >
        {/* Status card */}
        <View style={styles.mainStatusCard}>
          <View style={styles.statusBadgeRow}>
            <StatusBadge
              label="Hồ sơ đang chờ thẩm định"
              tone="ochre"
            />
          </View>
          <Text style={styles.statusTitle}>Hồ sơ của bạn đã được tiếp nhận</Text>
          <Text style={styles.statusDesc}>
            Quản trị viên CareNest đang kiểm tra CCCD, bằng chuyên môn và Giấy phép hành nghề của bạn. Quá trình thẩm định thường mất từ 1–2 ngày làm việc.
          </Text>

          <View style={styles.infoNotice}>
            <Clock color={tokens.colors.accentOchre} size={18} />
            <Text style={styles.infoNoticeText}>
              Trong thời gian chờ duyệt, tài khoản chưa xuất hiện ở danh sách tìm kiếm và chưa thể nhận ca trực. Kéo màn hình xuống để cập nhật trạng thái mới nhất.
            </Text>
          </View>
        </View>

        {loadError ? (
          <View style={styles.errorBox}>
            <AlertCircle color={tokens.colors.alertCrimson} size={20} />
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
              <RefreshCw color={tokens.colors.alertCrimson} size={16} />
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Cảnh báo các giấy tờ bị từ chối */}
        {rejectedDocs.length > 0 ? (
          <View style={styles.rejectedSection}>
            <Text style={styles.sectionHeaderTitle}>Giấy tờ cần nộp lại</Text>
            {rejectedDocs.map((doc) => (
              <View key={doc.id || doc.docType} style={styles.rejectedCard}>
                <View style={styles.rejectedCardHeader}>
                  <AlertCircle color={tokens.colors.alertCrimson} size={20} />
                  <Text style={styles.rejectedDocTitle}>
                    {DOC_LABELS[doc.docType] || doc.docType} bị từ chối
                  </Text>
                </View>

                <Text style={styles.rejectionReasonText}>
                  <Text style={styles.boldText}>Lý do:</Text>{' '}
                  {doc.rejectionReason || 'Văn bản không rõ nét hoặc không hợp lệ.'}
                </Text>

                <AppButton
                  label="Nộp lại giấy tờ này"
                  onPress={() => handleFixDoc(doc.docType)}
                  style={styles.fixDocBtn}
                />
              </View>
            ))}
          </View>
        ) : null}

        {/* Danh sách toàn bộ giấy tờ đã nộp */}
        <View style={styles.credentialsListSection}>
          <Text style={styles.sectionHeaderTitle}>Danh sách giấy tờ thẩm định</Text>
          {loading && credentials.length === 0 ? (
            <Text style={styles.loadingText}>Đang tải danh sách hồ sơ...</Text>
          ) : credentials.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Chưa có giấy tờ nào được ghi nhận.</Text>
            </View>
          ) : (
            credentials.map((cred) => {
              const isApproved = cred.verificationStatus === VerificationStatus.APPROVED;
              const isRejected = cred.verificationStatus === VerificationStatus.REJECTED;

              return (
                <View key={cred.id || cred.docType} style={styles.credentialRow}>
                  <View style={styles.credLeft}>
                    <FileText
                      color={
                        isApproved
                          ? tokens.colors.brandJade
                          : isRejected
                          ? tokens.colors.alertCrimson
                          : tokens.colors.inkSecondary
                      }
                      size={20}
                    />
                    <View style={styles.credTitleWrap}>
                      <Text style={styles.credName}>
                        {DOC_LABELS[cred.docType] || cred.docType}
                      </Text>
                      {cred.documentNumber ? (
                        <Text style={styles.credDetail}>Số: {cred.documentNumber}</Text>
                      ) : null}
                      {cred.expiryDate ? (
                        <Text style={styles.credDetail}>Hết hạn: {cred.expiryDate}</Text>
                      ) : null}
                    </View>
                  </View>

                  <StatusBadge
                    label={
                      isApproved
                        ? 'Đã duyệt'
                        : isRejected
                        ? 'Bị từ chối'
                        : 'Đang chờ'
                    }
                    tone={isApproved ? 'jade' : isRejected ? 'crimson' : 'ochre'}
                  />
                </View>
              );
            })
          )}
        </View>

        {/* Khối DEV giả lập dành cho kiểm thử thủ công */}
        {IS_DEV ? (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>[Dành cho Kiểm thử DEV]</Text>
            <View style={styles.devButtonsRow}>
              <AppButton
                label="Giả lập Admin duyệt (ACTIVE)"
                onPress={() => {
                  const phone = session?.user?.phone || '0903333333';
                  mockAdminApproveProfile(phone);
                  void fetchStatus();
                }}
                variant="secondary"
                style={styles.devBtn}
              />
              <AppButton
                label="Giả lập Từ chối GPHN"
                onPress={() => {
                  const phone = session?.user?.phone || '0903333333';
                  mockSetDocumentReviewResult(
                    phone,
                    DocType.GPHN,
                    VerificationStatus.REJECTED,
                    'Ảnh GPHN mờ, không đọc được số giấy phép. Vui lòng chụp lại rõ nét.'
                  );
                  void fetchStatus();
                }}
                variant="danger"
                style={styles.devBtn}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.paddingBase,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  headerInfo: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: tokens.typography.fontSizeLarge,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  headerSubtitle: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.paddingBase,
    paddingBottom: 32,
  },
  mainStatusCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    padding: tokens.spacing.paddingBase,
    marginBottom: 16,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statusTitle: {
    fontSize: tokens.typography.fontSizeLarge,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  statusDesc: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: tokens.colors.accentOchreSoft,
    padding: 12,
    borderRadius: tokens.radii.sm,
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 13.5,
    color: tokens.colors.accentOchre,
    lineHeight: 19,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderRadius: tokens.radii.sm,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: tokens.colors.alertCrimson,
    fontSize: 14,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryBtnText: {
    color: tokens.colors.alertCrimson,
    fontSize: 13.5,
    fontWeight: '700',
  },
  sectionHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 10,
  },
  rejectedSection: {
    marginBottom: 18,
  },
  rejectedCard: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1.5,
    borderColor: tokens.colors.alertCrimson,
    borderRadius: tokens.radii.md,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  rejectedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rejectedDocTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },
  rejectionReasonText: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
  },
  fixDocBtn: {
    marginTop: 4,
    minHeight: 44,
  },
  credentialsListSection: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.paddingBase,
    marginBottom: 18,
  },
  credentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    gap: 10,
  },
  credLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  credTitleWrap: {
    flex: 1,
  },
  credName: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  credDetail: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  loadingText: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    paddingVertical: 12,
  },
  emptyCard: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
  },
  devSection: {
    padding: 14,
    backgroundColor: tokens.colors.subtle,
    borderRadius: tokens.radii.md,
    gap: 10,
  },
  devSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  devButtonsRow: {
    gap: 8,
  },
  devBtn: {
    minHeight: 42,
  },
});
