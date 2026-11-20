import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  Check,
  Clock,
  CreditCard,
  MapPin,
  Radio,
  X,
  Zap,
} from 'lucide-react-native';
import type { MobileShiftSummary, RadarJob } from '@healthcare-system/shared';
import { DEFAULT_MIN_NURSE_DEPOSIT_VND } from '@healthcare-system/shared';
import { useAuth } from '../auth/AuthContext';
import { getDepositStatus } from '../job-board/job-board.api';
import { jobItemToMobileShiftSummary } from '../job-board/job-board.mock';
import { mockGetShiftById } from '../shifts/shifts.mock';
import { ackNotification, claimRadar, declineRadar, getRadarOffers } from './radar.api';
import { computeRemainingSeconds } from '../../lib/push';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';

type RadarScreenRouteProp = RouteProp<ActiveStackParamList, 'Radar'>;
type RadarScreenNavigationProp = NativeStackNavigationProp<ActiveStackParamList, 'Radar'>;

interface RadarScreenProps {
  navigation: RadarScreenNavigationProp;
  route: RadarScreenRouteProp;
  initialOffer?: RadarJob;
}

export const RadarScreen: React.FC<RadarScreenProps> = ({
  navigation,
  route,
  initialOffer,
}) => {
  const { session } = useAuth();
  const routeOffer = route.params?.offer;
  const offerId = route.params?.offerId;
  const notificationId = route.params?.notificationId;

  const [radarOffer, setRadarOffer] = useState<RadarJob | null>(
    initialOffer ?? routeOffer ?? null
  );
  const [loadingOffer, setLoadingOffer] = useState<boolean>(!initialOffer && !routeOffer);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    computeRemainingSeconds(radarOffer?.radarExpiresAt, radarOffer?.expiresInSeconds)
  );
  const totalSecondsRef = useRef<number>(
    Math.max(1, computeRemainingSeconds(radarOffer?.radarExpiresAt, radarOffer?.expiresInSeconds))
  );
  const dismissedRef = useRef<boolean>(false);

  // Acknowledge notification on screen open
  useEffect(() => {
    const idToAck = notificationId || offerId || radarOffer?.id;
    if (idToAck) {
      void ackNotification(idToAck);
    }
  }, [notificationId, offerId, radarOffer?.id]);

  // Load offer from API if not provided in route params
  useEffect(() => {
    if (radarOffer) return;

    let isMounted = true;
    void (async () => {
      setLoadingOffer(true);
      try {
        const res = await getRadarOffers();
        if (isMounted && res.success && res.data) {
          setRadarOffer(res.data);
          const initialSecs = computeRemainingSeconds(
            res.data.radarExpiresAt,
            res.data.expiresInSeconds
          );
          totalSecondsRef.current = Math.max(1, initialSecs);
          setSecondsLeft(initialSecs);
        } else if (isMounted) {
          Alert.alert(
            'Thông báo',
            'Ca đã được nhận bởi người khác hoặc hết hạn.',
            [{ text: 'Đóng', onPress: () => navigation.goBack() }]
          );
        }
      } catch {
        if (isMounted) {
          Alert.alert('Lỗi', 'Không thể tải thông tin ca khẩn cấp.', [
            { text: 'Đóng', onPress: () => navigation.goBack() },
          ]);
        }
      } finally {
        if (isMounted) {
          setLoadingOffer(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [radarOffer, navigation]);

  const triggerDismiss = useCallback(
    async (showTimeoutAlert = false) => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;

      if (radarOffer?.id) {
        try {
          await declineRadar(radarOffer.id);
        } catch {
          // Ignore decline error
        }
      }

      if (showTimeoutAlert) {
        Alert.alert(
          'Hết thời gian phản hồi',
          'Ca đã được nhận bởi người khác hoặc hết hạn.',
          [{ text: 'Đóng', onPress: () => navigation.goBack() }]
        );
      } else {
        navigation.goBack();
      }
    },
    [radarOffer?.id, navigation]
  );

  // Countdown timer
  useEffect(() => {
    if (!radarOffer) return;

    const initial = computeRemainingSeconds(
      radarOffer.radarExpiresAt,
      radarOffer.expiresInSeconds
    );
    totalSecondsRef.current = Math.max(1, initial);
    setSecondsLeft(initial);

    if (initial <= 0) {
      void triggerDismiss(true);
      return;
    }

    const interval = setInterval(() => {
      if (radarOffer.radarExpiresAt && !Number.isNaN(Date.parse(radarOffer.radarExpiresAt))) {
        const next = Math.max(
          0,
          Math.floor((Date.parse(radarOffer.radarExpiresAt) - Date.now()) / 1000)
        );
        setSecondsLeft(next);
        if (next <= 0) {
          clearInterval(interval);
          void triggerDismiss(true);
        }
      } else {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            void triggerDismiss(true);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [radarOffer, triggerDismiss]);

  const handleAccept = async () => {
    if (!radarOffer || isProcessing) return;
    setIsProcessing(true);

    try {
      const nurseTier = session?.profile?.tier || 'TIER_1_BASIC';

      // Check deposit status for ADR-0004
      const depRes = await getDepositStatus();
      const depositBalance = depRes.data?.depositBalance ?? DEFAULT_MIN_NURSE_DEPOSIT_VND;

      const claimResult = await claimRadar(radarOffer.id, nurseTier, depositBalance);

      if (claimResult.success) {
        dismissedRef.current = true;
        // Build MobileShiftSummary or fetch from store
        let shift: MobileShiftSummary | undefined = mockGetShiftById(radarOffer.id) ?? undefined;
        if (!shift) {
          shift = jobItemToMobileShiftSummary(radarOffer);
        }

        Alert.alert(
          'Nhận ca thành công!',
          `Đã xác nhận nhận ca ${radarOffer.code}. Vui lòng xem tóm tắt lâm sàng trước khi di chuyển.`,
          [
            {
              text: 'Xem chi tiết ca',
              onPress: () => {
                navigation.replace('ShiftBriefing', { shift: shift! });
              },
            },
          ]
        );
      } else {
        const code = claimResult.errorCode;

        if (code === 'OFFER_EXPIRED' || code === 'JOB_ALREADY_TAKEN' || code === 'ALREADY_CLAIMED') {
          Alert.alert(
            'Ca không còn khả dụng',
            'Ca đã được nhận bởi người khác hoặc hết hạn.',
            [{ text: 'Đóng', onPress: () => navigation.goBack() }]
          );
        } else if (
          code === 'DEPOSIT_BELOW_MIN' ||
          code === 'DEPOSIT_GRACE_CASH_NOT_ALLOWED' ||
          code === 'DEPOSIT_GRACE_EXHAUSTED'
        ) {
          Alert.alert('Yêu cầu ký quỹ', claimResult.message || 'Số dư ký quỹ không đủ điều kiện.', [
            { text: 'Đóng', style: 'cancel', onPress: () => navigation.goBack() },
            {
              text: 'Nạp ký quỹ',
              onPress: () => {
                navigation.goBack();
                // User can navigate to wallet/deposit from tab or account
              },
            },
          ]);
        } else {
          Alert.alert('Không thể nhận ca', claimResult.message || 'Vui lòng thử lại sau.', [
            { text: 'Đóng' },
          ]);
        }
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loadingOffer) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.brandJade} />
        <Text style={styles.loadingText}>Đang quét ca khẩn cấp...</Text>
      </SafeAreaView>
    );
  }

  if (!radarOffer) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Không tìm thấy thông tin ca khẩn cấp.</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Text style={styles.closeButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const urgentBonus = radarOffer.urgentBonus ?? 0;
  const isUrgent = urgentBonus > 0 || radarOffer.isUrgent;
  const netEarnings =
    radarOffer.netAmount ||
    Math.round(radarOffer.totalAmount * 0.85); // fallback net if commission 15%

  const progressPercent = Math.max(
    0,
    Math.min(100, (secondsLeft / Math.max(1, totalSecondsRef.current)) * 100)
  );

  return (
    <View style={styles.fullScreenOverlay}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Radar Map Graphic Zone */}
        <View style={styles.radarZone}>
          {/* Animated concentric rings */}
          <View style={[styles.ring, styles.ringOuter]} />
          <View style={[styles.ring, styles.ringMiddle]} />
          <View style={[styles.ring, styles.ringInner]} />

          {/* Central Nurse Dot */}
          <View style={styles.centerDot} />

          {/* Target Job Pin */}
          <View style={styles.jobPin}>
            <MapPin size={26} color={tokens.colors.alertCrimson} fill={tokens.colors.alertCrimson} />
          </View>

          {/* Top Floating Badge */}
          <View style={styles.topBadge}>
            <Radio size={16} color={tokens.colors.brandJade} />
            <Text style={styles.topBadgeText}>Radar · Ca mới gần bạn</Text>
          </View>
        </View>

        {/* Job Details Card */}
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Tag Chips */}
          <View style={styles.tagChipsRow}>
            <View style={styles.chipNeutral}>
              <Text style={styles.chipNeutralText}>
                {radarOffer.isInvasive ? 'Xâm lấn · Cấp 2' : 'Không xâm lấn · Cấp 1 & 2'}
              </Text>
            </View>

            {radarOffer.hasPrescription && (
              <View style={styles.chipJade}>
                <Text style={styles.chipJadeText}>Có y lệnh</Text>
              </View>
            )}

            {isUrgent && (
              <View style={styles.chipCrimson}>
                <Zap size={13} color={tokens.colors.alertCrimson} />
                <Text style={styles.chipCrimsonText}>Ca gấp thay thế</Text>
              </View>
            )}
          </View>

          {/* Service Name */}
          <Text style={styles.serviceTitle}>{radarOffer.serviceName}</Text>

          {/* Main Price */}
          <Text style={styles.totalAmount}>
            {radarOffer.totalAmount.toLocaleString('vi-VN')}đ
          </Text>

          {/* Urgent Bonus Badge (Ca gấp thay thế) */}
          {urgentBonus > 0 && (
            <View style={styles.bonusBanner}>
              <Zap size={15} color={tokens.colors.alertCrimson} />
              <Text style={styles.bonusText}>
                🔥 Thưởng nóng +{urgentBonus.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}

          {/* Net Amount */}
          <Text style={styles.netAmountText}>
            Thực nhận dự kiến: {netEarnings.toLocaleString('vi-VN')}đ
          </Text>

          {/* Patient & Location info */}
          <View style={styles.infoCard}>
            <Text style={styles.patientInfo}>
              {radarOffer.patientName}, {radarOffer.patientAge} tuổi — {radarOffer.district} · cách{' '}
              {radarOffer.distanceKm} km
            </Text>

            <View style={styles.infoRow}>
              <Clock size={16} color={tokens.colors.brandJade} />
              <Text style={styles.timeText}>
                {radarOffer.date} · {radarOffer.startTime} – {radarOffer.endTime}
              </Text>
            </View>

            <View style={styles.paymentBadge}>
              <CreditCard size={14} color={tokens.colors.brandJade} />
              <Text style={styles.paymentBadgeText}>
                {radarOffer.paymentStatus === 'ESCROW_HELD' ||
                radarOffer.paymentMethod === 'BANK_TRANSFER'
                  ? 'Chuyển khoản · Đã tạm giữ'
                  : 'Tiền mặt'}
              </Text>
            </View>
          </View>

          {/* 45s Countdown Circular Indicator */}
          <View style={styles.countdownContainer}>
            <View
              style={[
                styles.countdownRing,
                progressPercent < 25 && styles.countdownRingUrgent,
              ]}
            >
              <View style={styles.countdownInner}>
                <Text
                  style={[
                    styles.countdownText,
                    progressPercent < 25 && styles.countdownTextUrgent,
                  ]}
                >
                  00:{secondsLeft.toString().padStart(2, '0')}
                </Text>
              </View>
            </View>
            <Text style={styles.countdownSub}>
              Thời gian phản hồi còn lại ({secondsLeft}s)
            </Text>
          </View>

          {/* Action Buttons (Elder-friendly) */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btnAccept, isProcessing && styles.btnDisabled]}
              onPress={handleAccept}
              disabled={isProcessing}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Nhận ca khẩn cấp"
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Check size={24} color="#FFFFFF" />
                  <Text style={styles.btnAcceptText}>✓ NHẬN CA</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnDecline}
              onPress={() => triggerDismiss(false)}
              disabled={isProcessing}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Bỏ qua ca này"
            >
              <X size={20} color={tokens.colors.inkSecondary} />
              <Text style={styles.btnDeclineText}>Bỏ qua</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.canvas,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: tokens.colors.alertCrimson,
    textAlign: 'center',
    marginBottom: 16,
  },
  closeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 12,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

  /* Radar visual zone */
  radarZone: {
    height: 200,
    backgroundColor: '#123B66',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  ringOuter: {
    width: 250,
    height: 250,
  },
  ringMiddle: {
    width: 170,
    height: 170,
  },
  ringInner: {
    width: 90,
    height: 90,
  },
  centerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#38BDF8',
  },
  jobPin: {
    position: 'absolute',
    top: 35,
    right: width * 0.3,
  },
  topBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  topBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },

  /* Content area */
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  chipNeutral: {
    backgroundColor: '#E7EFF8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipNeutralText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B2440',
  },
  chipJade: {
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipJadeText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.brandJade,
  },
  chipCrimson: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipCrimsonText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },

  serviceTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 38,
    fontWeight: '900',
    color: tokens.colors.inkPrimary,
    textAlign: 'center',
    lineHeight: 44,
  },
  bonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 6,
  },
  bonusText: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
  },
  netAmountText: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
    marginTop: 4,
  },

  /* Info card */
  infoCard: {
    width: '100%',
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
  },
  patientInfo: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  timeText: {
    fontSize: 14,
    color: tokens.colors.brandJade,
    fontWeight: '600',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  paymentBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.brandJade,
  },

  /* 45s Countdown Indicator */
  countdownContainer: {
    marginVertical: 14,
    alignItems: 'center',
  },
  countdownRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#DCEBE3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: tokens.colors.alertCrimson,
  },
  countdownRingUrgent: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  countdownInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 20,
    fontWeight: '900',
    color: tokens.colors.alertCrimson,
  },
  countdownTextUrgent: {
    color: '#DC2626',
  },
  countdownSub: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 6,
  },

  /* Action Buttons */
  actionRow: {
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  btnAccept: {
    height: 64, // >= 64dp per SRS / A08 requirement
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 3,
    shadowColor: tokens.colors.brandJade,
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  btnAcceptText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  btnDecline: {
    height: 50, // >= 48dp
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.paper,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  btnDeclineText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  btnDisabled: {
    opacity: 0.65,
  },
});
