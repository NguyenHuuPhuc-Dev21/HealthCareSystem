import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CHECKIN_MAX_RADIUS_METERS,
  DocType,
  VerificationStatus,
  type MobileShiftSummary,
} from '@healthcare-system/shared';
import {
  AlertTriangle,
  Bell,
  Calendar,
  ChevronRight,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { AppButton, CareNestLogoMark, StateView, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { useOptionalNotifications } from '../notifications/NotificationContext';
import { NOTIFICATION_LABELS } from '../notifications/notification-labels';
import { getGphnAlertInfo } from '../credentials/credentials.api';
import { getMyShifts } from '../active-shift/active-shift.api';
import { DEV_SAMPLE_SHIFT } from '../shifts/shifts.mock';
import { useRadar } from '../radar/RadarContext';
import { createSimulatedRadarOffer } from '../radar/radar.mock';
import { useWalletSummary } from '../wallet/useWalletSummary';
import { getScoreTierMeta } from '../trust-score/trust-score-labels';

export { DEV_SAMPLE_SHIFT };
import {
  getHardwareCapabilityStatus,
  IS_DEV,
  type DeviceGeoCoords,
} from '../../lib/hardware-providers';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList, MainTabParamList } from '../../navigation/types';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<ActiveStackParamList>
>;

interface HomeScreenProps {
  navigation: HomeNavProp;
  initialShift?: MobileShiftSummary;
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  navigation,
  initialShift,
  onRequestCurrentPosition,
  onCaptureLivePhoto,
}) => {
  const { session } = useAuth();
  const { isOnline, toggleOnline, triggerRadarOffer } = useRadar();
  const { summary: walletSummary } = useWalletSummary();
  const notificationCtx = useOptionalNotifications();
  const unreadNotificationCount = notificationCtx?.unreadCount ?? 0;
  const trustScore = session?.profile?.trust_score ?? 92;
  const trustScoreMeta = getScoreTierMeta(trustScore);

  const [activeShift, setActiveShift] = useState<MobileShiftSummary | null>(
    initialShift ?? (IS_DEV ? DEV_SAMPLE_SHIFT : null)
  );
  const [loadingShift, setLoadingShift] = useState<boolean>(!initialShift);
  const [shiftLoadError, setShiftLoadError] = useState<string | null>(null);

  const gphnCred = session?.credentials?.find((c) => c.doc_type === DocType.GPHN);
  const hasPendingGphn = Boolean(
    session?.credentials?.some(
      (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING
    )
  );
  const expiryDate = session?.profile?.gphn_expiry_date || gphnCred?.expiry_date;
  const alertInfo = useMemo(
    () => getGphnAlertInfo(expiryDate, hasPendingGphn),
    [expiryDate, hasPendingGphn]
  );

  const hardwareStatus = useMemo(
    () => getHardwareCapabilityStatus({ onRequestCurrentPosition, onCaptureLivePhoto }),
    [onRequestCurrentPosition, onCaptureLivePhoto]
  );

  const loadAssignedShift = useCallback(async () => {
    if (initialShift) return;
    setLoadingShift(true);
    setShiftLoadError(null);
    try {
      const res = await getMyShifts();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setActiveShift(res.data[0]);
      } else if (!res.success && !IS_DEV) {
        setShiftLoadError(res.error?.message || 'Không thể tải danh sách ca trực hôm nay.');
      }
    } catch {
      if (!IS_DEV) {
        setShiftLoadError('Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.');
      }
    } finally {
      setLoadingShift(false);
    }
  }, [initialShift]);

  useEffect(() => {
    void loadAssignedShift();
  }, [loadAssignedShift]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.homeHead}>
          <View style={styles.brandRowWrap}>
            <View style={styles.brandRow}>
              <CareNestLogoMark size={24} />
              <Text style={styles.brandMark}>CareNest</Text>
            </View>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate('Notifications')}
              accessibilityRole="button"
              accessibilityLabel={NOTIFICATION_LABELS.bellAccessibility}
            >
              <Bell size={22} color={tokens.colors.inkPrimary} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Lịch trực hôm nay</Text>
          <Text style={styles.subtitle}>
            Kiểm tra hồ sơ người bệnh, điểm danh tại nhà và ghi nhận chăm sóc lâm sàng.
          </Text>
        </View>

        {/* Công tắc Sẵn sàng nhận ca (Online / Offline) */}
        <View style={styles.onlineCard}>
          <View style={styles.onlineLeft}>
            <View style={styles.onlineHeaderRow}>
              <Text style={styles.onlineTitle}>Sẵn sàng nhận ca</Text>
              <View
                style={[
                  styles.statusPill,
                  isOnline ? styles.statusPillOnline : styles.statusPillOffline,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                  ]}
                >
                  {isOnline ? '● Sẵn sàng' : '○ Đang nghỉ'}
                </Text>
              </View>
            </View>
            <Text style={styles.onlineDesc}>
              {isOnline
                ? 'Bật để Radar và khách hàng thấy bạn đang rảnh.'
                : 'Đã tắt nhận ca. Bạn sẽ không nhận thông báo ca gấp Radar.'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={() => void toggleOnline()}
            trackColor={{ false: '#CBD5E1', true: tokens.colors.brandJade }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Công tắc sẵn sàng nhận ca"
          />
        </View>

        {/* [DEV] Nút giả lập ca gấp cho kiểm thử không cần Firebase */}
        {IS_DEV && (
          <View style={styles.devCard}>
            <TouchableOpacity
              style={styles.devBtnRadar}
              onPress={() => {
                if (!isOnline) {
                  Alert.alert(
                    'Chế độ nghỉ',
                    'Bạn đang ở chế độ nghỉ (Offline). Hãy bật "Sẵn sàng nhận ca" để nhận Radar!'
                  );
                  return;
                }
                const simulatedOffer = createSimulatedRadarOffer();
                triggerRadarOffer(simulatedOffer);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="[DEV] Giả lập ca gấp Radar"
            >
              <Zap size={16} color="#DC2626" />
              <Text style={styles.devBtnRadarText}>[DEV] Giả lập ca gấp Radar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Thẻ GPHN trên trang chủ — Bấm vào mở Credentials */}
        <TouchableOpacity
          style={[
            styles.gphnCard,
            alertInfo.status === 'EXPIRED' && styles.gphnCardExpired,
            alertInfo.status === 'EXPIRING_SOON' && styles.gphnCardExpiring,
            alertInfo.status === 'PENDING' && styles.gphnCardPending,
          ]}
          onPress={() => navigation.navigate('Credentials')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Trạng thái Giấy phép hành nghề"
        >
          <View style={styles.gphnCardLeft}>
            {alertInfo.status === 'EXPIRED' ? (
              <ShieldAlert color={tokens.colors.alertCrimson} size={22} />
            ) : alertInfo.status === 'EXPIRING_SOON' ? (
              <AlertTriangle color={tokens.colors.accentOchre} size={22} />
            ) : (
              <FileText color={tokens.colors.brandJade} size={22} />
            )}
          </View>
          <View style={styles.gphnCardBody}>
            <View style={styles.gphnCardTitleRow}>
              <Text
                style={[
                  styles.gphnCardTitle,
                  alertInfo.status === 'EXPIRED' && styles.gphnTextRed,
                  alertInfo.status === 'EXPIRING_SOON' && styles.gphnTextAmber,
                ]}
              >
                {alertInfo.label}
              </Text>
              {alertInfo.status === 'EXPIRED' ? (
                <View style={styles.badgeDanger}>
                  <Text style={styles.badgeDangerText}>Hạ Tầng 1</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.gphnCardDesc}>{alertInfo.description}</Text>
            {alertInfo.status === 'EXPIRED' ? (
              <View style={styles.gphnActionRow}>
                <TouchableOpacity
                  style={styles.gphnBtnRed}
                  onPress={() => navigation.navigate('RenewGphn')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.gphnBtnRedText}>Nộp GPHN mới</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          <ChevronRight
            color={
              alertInfo.status === 'EXPIRED'
                ? tokens.colors.alertCrimson
                : alertInfo.status === 'EXPIRING_SOON'
                  ? tokens.colors.accentOchre
                  : tokens.colors.inkSecondary
            }
            size={20}
          />
        </TouchableOpacity>

        {/* Bento Tóm tắt Ví & Ký quỹ (APP-N4 & W01/A09) */}
        <View style={styles.walletBentoRow}>
          {/* Thẻ Thu nhập & Số dư khả dụng */}
          <TouchableOpacity
            style={styles.walletTile}
            onPress={() => navigation.navigate('WalletTab')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mở ví của tôi"
          >
            <View style={styles.tileHead}>
              <Wallet size={17} color={tokens.colors.brandJade} />
              <Text style={styles.tileTitle}>Khả dụng</Text>
            </View>
            <Text style={styles.tileAmount}>
              {(walletSummary?.availableBalance ?? 3850000).toLocaleString('vi-VN')}đ
            </Text>
            <Text style={styles.tileSub}>Xem chi tiết ví →</Text>
          </TouchableOpacity>

          {/* Thẻ Ký quỹ */}
          <TouchableOpacity
            style={[
              styles.walletTile,
              walletSummary &&
                walletSummary.depositBalance < walletSummary.minDeposit &&
                !walletSummary.depositGraceActive &&
                styles.walletTileWarning,
            ]}
            onPress={() => navigation.navigate('WalletTab')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ví ký quỹ"
          >
            <View style={styles.tileHead}>
              <ShieldAlert
                size={17}
                color={
                  walletSummary &&
                  walletSummary.depositBalance < walletSummary.minDeposit &&
                  !walletSummary.depositGraceActive
                    ? tokens.colors.alertCrimson
                    : tokens.colors.brandJade
                }
              />
              <Text style={styles.tileTitle}>Ví ký quỹ</Text>
            </View>
            <Text
              style={[
                styles.tileAmount,
                walletSummary &&
                  walletSummary.depositBalance < walletSummary.minDeposit &&
                  !walletSummary.depositGraceActive &&
                  styles.tileAmountWarning,
              ]}
            >
              {(walletSummary?.depositBalance ?? 300000).toLocaleString('vi-VN')}đ
            </Text>
            <Text style={styles.tileSub}>
              {walletSummary?.depositGraceActive
                ? 'Đang ân hạn'
                : walletSummary && walletSummary.depositBalance < walletSummary.minDeposit
                ? 'Cần nạp thêm'
                : 'Đã đủ mức chuẩn'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nút TrustScore trên Trang chủ */}
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => navigation.navigate('TrustScore')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Xem điểm TrustScore và đánh giá"
        >
          <View style={styles.scheduleLeft}>
            <View
              style={[
                styles.scheduleIconWrap,
                { backgroundColor: trustScoreMeta.softColor },
              ]}
            >
              <ShieldCheck size={20} color={trustScoreMeta.color} />
            </View>
            <View style={styles.scheduleTextBox}>
              <Text style={styles.scheduleTitle}>
                TrustScore · {trustScore}/100 ({trustScoreMeta.label})
              </Text>
              <Text style={styles.scheduleSub} numberOfLines={1}>
                {trustScoreMeta.summary}
              </Text>
            </View>
          </View>
          <ChevronRight color={tokens.colors.inkSecondary} size={20} />
        </TouchableOpacity>

        {/* Nút TrustScore trên Trang chủ */}
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => navigation.navigate('TrustScore')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Xem điểm TrustScore và đánh giá"
        >
          <View style={styles.scheduleLeft}>
            <View
              style={[
                styles.scheduleIconWrap,
                { backgroundColor: trustScoreMeta.softColor },
              ]}
            >
              <ShieldCheck size={20} color={trustScoreMeta.color} />
            </View>
            <View style={styles.scheduleTextBox}>
              <Text style={styles.scheduleTitle}>
                TrustScore · {trustScore}/100 ({trustScoreMeta.label})
              </Text>
              <Text style={styles.scheduleSub} numberOfLines={1}>
                {trustScoreMeta.summary}
              </Text>
            </View>
          </View>
          <ChevronRight color={tokens.colors.inkSecondary} size={20} />
        </TouchableOpacity>

        {/* Nút TrustScore trên Trang chủ (A13) */}
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => navigation.navigate('TrustScore')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Đánh giá và điểm TrustScore"
        >
          <View style={styles.scheduleLeft}>
            <View style={styles.scheduleIconWrap}>
              <ShieldCheck
                size={20}
                color={getScoreTierMeta(session?.profile?.trust_score ?? 92).color}
              />
            </View>
            <View style={styles.scheduleTextBox}>
              <Text style={styles.scheduleTitle}>
                TrustScore · {session?.profile?.trust_score ?? 92}/100
              </Text>
              <Text style={styles.scheduleSub}>
                {getScoreTierMeta(session?.profile?.trust_score ?? 92).label} — Xem lịch sử điểm &amp; đánh giá
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={tokens.colors.inkSecondary} />
        </TouchableOpacity>

        {/* Nút Lịch rảnh trên Trang chủ */}
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => navigation.navigate('Availability')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Đăng ký lịch rảnh"
        >
          <View style={styles.scheduleLeft}>
            <View style={styles.scheduleIconWrap}>
              <Calendar size={20} color={tokens.colors.brandJade} />
            </View>
            <View style={styles.scheduleTextBox}>
              <Text style={styles.scheduleTitle}>Lịch rảnh &amp; Ngày nghỉ</Text>
              <Text style={styles.scheduleSub}>
                Đăng ký khung giờ trực để hệ thống điều phối ca phù hợp
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={tokens.colors.inkSecondary} />
        </TouchableOpacity>

        {!IS_DEV && !hardwareStatus.isReadyForRelease && (
          <View style={styles.hardwareWarnBox}>
            <Text style={styles.hardwareWarnText}>
              {!hardwareStatus.hasCameraProvider && !hardwareStatus.hasLocationProvider
                ? 'Thiếu kết nối Camera và GPS phần cứng cho thao tác điểm danh thực tế.'
                : !hardwareStatus.hasCameraProvider
                  ? 'Thiếu kết nối Camera phần cứng để chụp ảnh selfie điểm danh.'
                  : 'Thiếu kết nối cảm biến GPS thiết bị.'}
            </Text>
          </View>
        )}

        {loadingShift && !activeShift ? (
          <StateView kind="loading" title="Đang tải ca trực hôm nay" />
        ) : shiftLoadError ? (
          <StateView
            kind="error"
            title="Không thể tải lịch trực"
            message={shiftLoadError}
            actionLabel="Thử lại"
            onAction={() => void loadAssignedShift()}
          />
        ) : !activeShift ? (
          <StateView
            kind="empty"
            title="Hôm nay bạn chưa có ca trực nào"
            message="Vui lòng nhận ca trên Bảng việc làm để bắt đầu thực hiện chăm sóc tại nhà."
            actionLabel="Mở Bảng việc làm"
            onAction={() => navigation.navigate('JobsTab')}
          />
        ) : (
          <View style={styles.anchorCard}>
            <View style={styles.badgeRow}>
              <StatusBadge
                label={IS_DEV ? '[DEV] Đã xác nhận' : 'Đã xác nhận'}
                tone="jade"
              />
              <Text style={styles.timeText}>{activeShift.timeRange}</Text>
            </View>

            <Text style={styles.serviceName}>{activeShift.serviceName}</Text>
            <Text style={styles.patientInfo}>
              Người bệnh: {activeShift.patientName} ({activeShift.patientAge} tuổi)
            </Text>
            <Text style={styles.addressInfo}>{activeShift.patientAddress}</Text>

            <View style={styles.cardActions}>
              <AppButton
                label="Xem hồ sơ ca"
                variant="secondary"
                onPress={() => navigation.navigate('ShiftBriefing', { shift: activeShift })}
                style={styles.briefingBtn}
              />
              <AppButton
                label="Điểm danh vào ca"
                disabled={!IS_DEV && !hardwareStatus.isReadyForRelease}
                onPress={() => navigation.navigate('CheckIn', { shift: activeShift })}
                style={styles.checkInBtn}
              />
            </View>
          </View>
        )}

        <View style={styles.ledgerCard}>
          <Text style={styles.ledgerTitle}>Quy trình thực hiện tại nhà người bệnh</Text>
          {[
            '1. Xem trước hồ sơ dị ứng, vận động và chỉ đường GPS',
            `2. Điểm danh trong phạm vi ${CHECKIN_MAX_RADIUS_METERS}m bằng ảnh selfie trực tiếp`,
            '3. Đánh giá thể trạng 30 phút đầu và đo sinh tồn định kỳ',
            '4. Đối chiếu y lệnh gốc hoặc gọi SOS 115 khi khẩn cấp',
            '5. Lưu báo cáo tối thiểu và bàn giao ra về',
          ].map((step, idx, arr) => (
            <View
              key={step}
              style={[
                styles.stepRow,
                idx === arr.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
              ]}
            >
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  homeHead: {
    marginBottom: 18,
  },
  brandRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: tokens.spacing.touchTargetMin,
    height: tokens.spacing.touchTargetMin,
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: tokens.colors.alertCrimson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: tokens.colors.paper,
  },
  brandMark: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.brandJade,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
  },
  anchorCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  serviceName: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 26,
    marginBottom: 6,
  },
  patientInfo: {
    fontSize: 15.5,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  addressInfo: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  briefingBtn: {
    flex: 1,
  },
  checkInBtn: {
    flex: 1.2,
  },
  ledgerCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  ledgerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
  },
  stepRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  stepText: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
  },
  hardwareWarnBox: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  hardwareWarnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
    lineHeight: 19,
  },
  gphnCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    padding: 14,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  gphnCardExpired: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderColor: tokens.colors.alertCrimson,
  },
  gphnCardExpiring: {
    backgroundColor: tokens.colors.accentOchreSoft,
    borderColor: tokens.colors.accentOchre,
  },
  gphnCardPending: {
    backgroundColor: '#FFFBEB',
    borderColor: tokens.colors.accentOchre,
    borderStyle: 'dashed',
  },
  gphnCardLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gphnCardBody: {
    flex: 1,
  },
  gphnCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  gphnCardTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  gphnTextRed: {
    color: tokens.colors.alertCrimson,
  },
  gphnTextAmber: {
    color: tokens.colors.accentOchre,
  },
  badgeDanger: {
    backgroundColor: tokens.colors.alertCrimson,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radii.pill,
  },
  badgeDangerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  gphnCardDesc: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
  },
  gphnActionRow: {
    marginTop: 8,
  },
  gphnBtnRed: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.alertCrimson,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: tokens.radii.sm,
  },
  gphnBtnRedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 12,
  },
  onlineLeft: {
    flex: 1,
    marginRight: 12,
  },
  onlineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  onlineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  onlineDesc: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillOnline: {
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  statusPillOffline: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPillTextOnline: {
    color: tokens.colors.brandJade,
  },
  statusPillTextOffline: {
    color: tokens.colors.inkSecondary,
  },
  devCard: {
    marginBottom: 12,
  },
  devBtnRadar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  devBtnRadarText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  walletBentoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  walletTile: {
    flex: 1,
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  walletTileWarning: {
    backgroundColor: '#FFF9F9',
    borderColor: tokens.colors.alertCrimson,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  tileAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  tileAmountWarning: {
    color: tokens.colors.alertCrimson,
  },
  tileSub: {
    fontSize: 12,
    color: tokens.colors.brandJade,
    fontWeight: '600',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 14,
  },
  scheduleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandJadeSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleTextBox: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  scheduleSub: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
});

