import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  GraduationCap,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react-native';
import {
  DocType,
  NurseTier,
  VerificationStatus,
  type NurseCredential,
} from '@healthcare-system/shared';
import { AppButton, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { IS_DEV } from '../../lib/hardware-providers';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';
import {
  calculateGphnDaysRemaining,
  getGphnAlertInfo,
  getMyCredentials,
  mockAdminApproveGphn,
} from './credentials.api';
import { mockSetGphnExpiryForTesting } from './credentials.mock';

type CredentialsScreenProps = NativeStackScreenProps<ActiveStackParamList, 'Credentials'>;

export const CredentialsScreen: React.FC<CredentialsScreenProps> = ({ navigation }) => {
  const { session, updateProfile } = useAuth();
  const profile = session?.profile;
  const user = session?.user;

  const [credentials, setCredentials] = useState<NurseCredential[]>(session?.credentials ?? []);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getMyCredentials();
      if (res.success) {
        setCredentials(res.data);
      } else {
        setLoadError(res.error?.message || 'Không thể tải danh mục văn bằng.');
      }
    } catch {
      setLoadError('Lỗi kết nối khi tải danh mục văn bằng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCredentials();
  }, [fetchCredentials]);

  const gphnCred = credentials.find((c) => c.doc_type === DocType.GPHN);
  const pendingGphn = credentials.find(
    (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING
  );
  const hasPendingGphn = Boolean(pendingGphn);

  const expiryDate = profile?.gphn_expiry_date || gphnCred?.expiry_date;
  const alertInfo = getGphnAlertInfo(expiryDate, hasPendingGphn);
  const daysRemaining = calculateGphnDaysRemaining(expiryDate);
  const isTier2 = profile?.tier === NurseTier.TIER_2_SPECIALIST;

  const handleAdminApproveSimulation = async () => {
    try {
      const res = await mockAdminApproveGphn();
      if (res.success) {
        setActionMessage('Đã duyệt GPHN mới! Tài khoản đã được nâng lại Cấp 2.');
        await fetchCredentials();
        if (res.data.profile) {
          await updateProfile(res.data.profile, [
            ...credentials.filter((c) => c.doc_type !== DocType.GPHN),
            res.data.credential,
          ]);
        }
      } else {
        Alert.alert('Lỗi', res.error?.message || 'Duyệt GPHN thất bại.');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mô phỏng duyệt GPHN.');
    }
  };

  const handleDevSetExpiry = (days: number) => {
    if (!user?.phone) return;
    const target = new Date();
    target.setDate(target.getDate() + days);
    const dateStr = target.toISOString().slice(0, 10);
    const updated = mockSetGphnExpiryForTesting(user.phone, dateStr, true);
    if (updated) {
      void updateProfile(updated);
      void fetchCredentials();
      setActionMessage(
        days <= 0
          ? `[DEV] Đã đổi GPHN sang hết hạn (${dateStr}). Bạn đã bị hạ về Tầng 1.`
          : `[DEV] Đã đổi GPHN còn ${days} ngày (${dateStr}).`
      );
    }
  };

  const renderDocStatus = (status?: VerificationStatus) => {
    if (status === VerificationStatus.APPROVED) {
      return (
        <View style={styles.statusRow}>
          <CheckCircle2 color={tokens.colors.brandJade} size={16} />
          <Text style={styles.statusApproved}>Đã duyệt</Text>
        </View>
      );
    }
    if (status === VerificationStatus.REJECTED) {
      return (
        <View style={styles.statusRow}>
          <AlertTriangle color={tokens.colors.alertCrimson} size={16} />
          <Text style={styles.statusRejected}>Bị từ chối</Text>
        </View>
      );
    }
    return (
      <View style={styles.statusRow}>
        <Clock color={tokens.colors.accentOchre} size={16} />
        <Text style={styles.statusPending}>Chờ duyệt</Text>
      </View>
    );
  };

  const cccdDoc = credentials.find((c) => c.doc_type === DocType.CCCD);
  const degreeDoc = credentials.find((c) => c.doc_type === DocType.DEGREE);
  const retirementDoc = credentials.find((c) => c.doc_type === DocType.RETIREMENT_DECISION);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft color={tokens.colors.inkPrimary} size={22} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Giấy tờ &amp; GPHN</Text>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Tier Header Card */}
        <View style={styles.tierHeroCard}>
          <View style={styles.tierHeroTop}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>
                {user?.full_name
                  ? user.full_name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(-2)
                      .join('')
                      .toUpperCase()
                  : 'DD'}
              </Text>
            </View>
            <View style={styles.tierHeroInfo}>
              <View style={styles.tierBadgeRow}>
                <StatusBadge
                  label={isTier2 ? 'Điều dưỡng Cấp 2 — Chuyên môn' : 'Điều dưỡng Cấp 1 — Cơ bản'}
                  tone={isTier2 ? 'jade' : 'neutral'}
                />
              </View>
              <Text style={styles.tierHeroTitle}>
                {isTier2 ? 'Đang ở Tầng 2 chuyên môn' : 'Đang ở Tầng 1 cơ bản'}
              </Text>
            </View>
          </View>
          <Text style={styles.tierHeroDesc}>
            {isTier2
              ? 'Cấp 2 mở khóa toàn bộ dịch vụ Nhóm 1 và các thủ thuật xâm lấn Nhóm 2 theo y lệnh. GPHN hết hạn sẽ tự động hạ về Cấp 1; nộp GPHN mới được duyệt là tự nâng lại Cấp 2.'
              : 'Cấp 1 cho phép nhận dịch vụ chăm sóc người bệnh cơ bản. Nộp GPHN hợp lệ để được xét duyệt nâng lên Cấp 2 (thủ thuật xâm lấn có y lệnh).'}
          </Text>

          <View style={styles.heroActionRow}>
            <AppButton
              label={hasPendingGphn ? 'GPHN đang chờ thẩm định' : '📜 Cập nhật GPHN mới'}
              variant={hasPendingGphn ? 'secondary' : 'primary'}
              onPress={() => navigation.navigate('RenewGphn')}
              style={styles.renewBtn}
            />
          </View>
        </View>

        {/* Action / Success Banner */}
        {actionMessage ? (
          <View style={styles.msgBanner}>
            <CheckCircle2 color={tokens.colors.brandJade} size={18} />
            <Text style={styles.msgBannerText}>{actionMessage}</Text>
          </View>
        ) : null}

        {/* Dynamic GPHN Alert Box */}
        {alertInfo.status === 'EXPIRED' ? (
          <View style={styles.alertExpiredBox}>
            <ShieldAlert color={tokens.colors.alertCrimson} size={22} style={styles.alertIcon} />
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertExpiredTitle}>Giấy phép hành nghề đã hết hạn</Text>
              <Text style={styles.alertExpiredDesc}>
                {alertInfo.description} Vui lòng cập nhật bản GPHN mới để khôi phục quyền nhận các ca
                Cấp 2.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RenewGphn')}
                style={styles.alertActionBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.alertActionBtnText}>Nộp GPHN mới ngay →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : alertInfo.status === 'EXPIRING_SOON' ? (
          <View style={styles.alertExpiringBox}>
            <AlertTriangle color={tokens.colors.accentOchre} size={22} style={styles.alertIcon} />
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertExpiringTitle}>{alertInfo.label}</Text>
              <Text style={styles.alertExpiringDesc}>{alertInfo.description}</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RenewGphn')}
                style={styles.alertActionBtnOchre}
                activeOpacity={0.8}
              >
                <Text style={styles.alertActionBtnOchreText}>Gia hạn ngay trước khi hết hạn →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : alertInfo.status === 'PENDING' ? (
          <View style={styles.alertPendingBox}>
            <Clock color={tokens.colors.accentOchre} size={22} style={styles.alertIcon} />
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertPendingTitle}>GPHN mới vừa nộp</Text>
              <Text style={styles.alertPendingDesc}>{alertInfo.description}</Text>
              {IS_DEV ? (
                <TouchableOpacity
                  onPress={() => void handleAdminApproveSimulation()}
                  style={styles.simApproveBtn}
                  activeOpacity={0.8}
                >
                  <Sparkles color={tokens.colors.brandJade} size={16} />
                  <Text style={styles.simApproveBtnText}>
                    [DEV] Mô phỏng Admin duyệt GPHN ngay
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Section: Documents List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh mục hồ sơ đã thẩm định</Text>
          {loading ? <ActivityIndicator size="small" color={tokens.colors.brandJade} /> : null}
        </View>

        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={() => void fetchCredentials()} style={styles.retryBtn}>
              <RotateCcw color={tokens.colors.alertCrimson} size={15} />
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.docsList}>
          {/* 1. CCCD */}
          <View style={styles.docRow}>
            <View style={styles.docIconBox}>
              <FileCheck2 color={tokens.colors.brandJade} size={24} />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docName}>Căn cước công dân (2 mặt)</Text>
              <Text style={styles.docSub}>
                Ảnh chân dung trực tiếp và dữ liệu eKYC đã đối soát
              </Text>
            </View>
            <View style={styles.docStatusCol}>
              {renderDocStatus(cccdDoc?.verification_status ?? VerificationStatus.APPROVED)}
            </View>
          </View>

          {/* 2. DEGREE */}
          <View style={styles.docRow}>
            <View style={styles.docIconBox}>
              <GraduationCap color={tokens.colors.brandJade} size={24} />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docName}>Bằng tốt nghiệp Điều dưỡng</Text>
              <Text style={styles.docSub}>Văn bằng chuyên môn điều dưỡng được công nhận</Text>
            </View>
            <View style={styles.docStatusCol}>
              {renderDocStatus(degreeDoc?.verification_status ?? VerificationStatus.APPROVED)}
            </View>
          </View>

          {/* 3. GPHN Card Row */}
          <View
            style={[
              styles.docRow,
              styles.gphnRowHighlight,
              alertInfo.status === 'EXPIRED' && styles.gphnRowExpired,
              alertInfo.status === 'EXPIRING_SOON' && styles.gphnRowExpiring,
            ]}
          >
            <View style={styles.docIconBox}>
              <FileText
                color={
                  alertInfo.status === 'EXPIRED'
                    ? tokens.colors.alertCrimson
                    : alertInfo.status === 'EXPIRING_SOON'
                    ? tokens.colors.accentOchre
                    : tokens.colors.brandJade
                }
                size={24}
              />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docName}>Giấy phép hành nghề (GPHN)</Text>
              <Text style={styles.docSub}>
                Số: <Text style={styles.boldText}>{profile?.gphn_number || '00123/GPHN-ĐN'}</Text>
                {'\n'}Phạm vi: {profile?.scope_of_practice || 'Điều dưỡng đa khoa'}
                {expiryDate ? `\nHết hạn: ${expiryDate}` : ''}
              </Text>

              {daysRemaining !== null ? (
                <View style={styles.chipTagRow}>
                  <Text
                    style={[
                      styles.daysChip,
                      daysRemaining <= 0
                        ? styles.daysChipRed
                        : daysRemaining <= 30
                        ? styles.daysChipAmber
                        : styles.daysChipJade,
                    ]}
                  >
                    {daysRemaining <= 0
                      ? 'Đã hết hạn'
                      : daysRemaining <= 30
                      ? `Còn ${daysRemaining} ngày`
                      : `Còn ${daysRemaining} ngày`}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.docStatusCol}>
              {renderDocStatus(gphnCred?.verification_status ?? VerificationStatus.APPROVED)}
            </View>
          </View>

          {/* 4. Retirement Decision (Badge) */}
          {(profile?.is_retired_medical_staff || retirementDoc) ? (
            <View style={styles.docRow}>
              <View style={styles.docIconBox}>
                <Award color={tokens.colors.brandJade} size={24} />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docName}>Quyết định nghỉ hưu ngành Y</Text>
                <Text style={styles.docSub}>
                  Gắn huy hiệu “Cán bộ y tế nghỉ hưu” trên hồ sơ — không thay thế GPHN
                </Text>
              </View>
              <View style={styles.docStatusCol}>
                <View style={styles.statusRow}>
                  <CheckCircle2 color={tokens.colors.brandJade} size={16} />
                  <Text style={styles.statusApproved}>Đã gắn huy hiệu</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* DEV Quick Testing Shortcuts (FR-AUTH-02 Test scenarios) */}
        {IS_DEV ? (
          <View style={styles.devCard}>
            <Text style={styles.devCardTitle}>[DEV] Kịch bản kiểm thử GPHN</Text>
            <Text style={styles.devCardDesc}>
              Bấm để chuyển nhanh trạng thái ngày hết hạn và kiểm tra khung cảnh báo theo yêu cầu:
            </Text>
            <View style={styles.devBtnRow}>
              <TouchableOpacity
                onPress={() => handleDevSetExpiry(20)}
                style={styles.devSmallBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.devSmallBtnText}>Mock còn 20 ngày (vàng)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDevSetExpiry(-1)}
                style={[styles.devSmallBtn, styles.devSmallBtnDanger]}
                activeOpacity={0.8}
              >
                <Text style={[styles.devSmallBtnText, styles.devSmallBtnDangerText]}>
                  Mock hết hạn (đỏ + hạ Tầng 1)
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.devBtnRow}>
              <TouchableOpacity
                onPress={() => handleDevSetExpiry(90)}
                style={styles.devSmallBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.devSmallBtnText}>Mock còn 90 ngày (bình thường)</Text>
              </TouchableOpacity>
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
    padding: 16,
    paddingBottom: 36,
  },
  tierHeroCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    padding: 18,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    marginBottom: 16,
  },
  tierHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  avatarBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierHeroInfo: {
    flex: 1,
  },
  tierBadgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  tierHeroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  tierHeroDesc: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  heroActionRow: {
    marginTop: 4,
  },
  renewBtn: {
    width: '100%',
  },
  msgBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.sm,
    padding: 12,
    marginBottom: 14,
  },
  msgBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.brandJadeDark,
  },
  alertExpiredBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1.5,
    borderColor: tokens.colors.alertCrimson,
    borderRadius: tokens.radii.md,
    padding: 16,
    marginBottom: 16,
  },
  alertExpiringBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: tokens.colors.accentOchreSoft,
    borderWidth: 1.5,
    borderColor: tokens.colors.accentOchre,
    borderRadius: tokens.radii.md,
    padding: 16,
    marginBottom: 16,
  },
  alertPendingBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colors.accentOchre,
    borderRadius: tokens.radii.md,
    padding: 16,
    marginBottom: 16,
  },
  alertIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  alertTextWrap: {
    flex: 1,
  },
  alertExpiredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
    marginBottom: 4,
  },
  alertExpiredDesc: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },
  alertExpiringTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
    marginBottom: 4,
  },
  alertExpiringDesc: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },
  alertPendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
    marginBottom: 4,
  },
  alertPendingDesc: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },
  alertActionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.alertCrimson,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: tokens.radii.sm,
  },
  alertActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  alertActionBtnOchre: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.accentOchre,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: tokens.radii.sm,
  },
  alertActionBtnOchreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  simApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.radii.sm,
    marginTop: 6,
  },
  simApproveBtnText: {
    color: tokens.colors.brandJadeDark,
    fontSize: 13.5,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  docsList: {
    gap: 12,
  },
  docRow: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  gphnRowHighlight: {
    borderColor: tokens.colors.brandJade,
    borderWidth: 1.5,
  },
  gphnRowExpired: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: '#FFFDFD',
  },
  gphnRowExpiring: {
    borderColor: tokens.colors.accentOchre,
    backgroundColor: '#FFFDF8',
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  docSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 19,
  },
  boldText: {
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  chipTagRow: {
    marginTop: 6,
    flexDirection: 'row',
  },
  daysChip: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.pill,
    overflow: 'hidden',
  },
  daysChipRed: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    color: tokens.colors.alertCrimson,
  },
  daysChipAmber: {
    backgroundColor: tokens.colors.accentOchreSoft,
    color: tokens.colors.accentOchre,
  },
  daysChipJade: {
    backgroundColor: tokens.colors.brandJadeSoft,
    color: tokens.colors.brandJade,
  },
  docStatusCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusApproved: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  statusRejected: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },
  statusPending: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
  },
  errorBox: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderRadius: tokens.radii.sm,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: tokens.colors.alertCrimson,
    fontSize: 13.5,
    flex: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
  },
  retryBtnText: {
    color: tokens.colors.alertCrimson,
    fontSize: 13.5,
    fontWeight: '700',
  },
  devCard: {
    marginTop: 24,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    padding: 16,
  },
  devCardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
    marginBottom: 4,
  },
  devCardDesc: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  devBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  devSmallBtn: {
    backgroundColor: tokens.colors.canvas,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  devSmallBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  devSmallBtnDanger: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  devSmallBtnDangerText: {
    color: tokens.colors.alertCrimson,
  },
});
