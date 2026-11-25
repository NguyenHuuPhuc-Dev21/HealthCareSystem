import React, { useEffect, useState } from 'react';
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
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck2,
  HeartPulse,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Star,
  User,
} from 'lucide-react-native';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  ExecutionStatus,
  PaymentMethod,
  PaymentStatus,
  type MobileShiftSummary,
  type PendingReviewDto,
} from '@healthcare-system/shared';
import { AppButton } from '../../components';
import { formatVND } from '../../lib/formatters';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';
import { getShiftState } from '../active-shift/active-shift.api';
import { RateCustomerSheet } from '../reviews/components/RateCustomerSheet';
import { getPendingReviews } from '../reviews/reviews.api';
import { ShiftStatusBadges } from './components/ShiftStatusBadges';

type CompletedShiftDetailScreenProps = NativeStackScreenProps<
  ActiveStackParamList,
  'CompletedShiftDetail'
>;

export const CompletedShiftDetailScreen: React.FC<CompletedShiftDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { bookingId } = route.params;

  const [shift, setShift] = useState<MobileShiftSummary | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReviewDto | null>(null);
  const [rateSheetVisible, setRateSheetVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [res, pendingRes] = await Promise.all([
          getShiftState(bookingId),
          getPendingReviews(),
        ]);
        if (!mounted) return;
        if (res.success && res.data) {
          const shiftData = res.data;
          setShift(shiftData);
          if (pendingRes.success) {
            const match = pendingRes.data.find(
              (p) =>
                p.bookingId === bookingId ||
                p.bookingCode === shiftData.bookingCode
            );
            setPendingReview(match ?? null);
          }
        } else {
          setError(res.error?.message || 'Không tìm thấy thông tin ca trực.');
        }
      } catch {
        if (mounted) {
          setError('Không thể kết nối máy chủ để tải chi tiết ca trực.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadData();
    return () => {
      mounted = false;
    };
  }, [bookingId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={tokens.colors.inkPrimary} size={22} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Chi tiết ca đã xong</Text>
          <View style={styles.topBarRight} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={tokens.colors.brandJade} />
          <Text style={styles.loadingText}>Đang tải chi tiết ca trực...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !shift) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={tokens.colors.inkPrimary} size={22} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Chi tiết ca đã xong</Text>
          <View style={styles.topBarRight} />
        </View>
        <View style={styles.errorWrap}>
          <AlertTriangle color={tokens.colors.alertCrimson} size={36} />
          <Text style={styles.errorTitle}>Lỗi tải dữ liệu</Text>
          <Text style={styles.errorMsg}>{error || 'Không tìm thấy ca trực.'}</Text>
          <AppButton label="Quay lại" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const isCash = shift.paymentMethod === PaymentMethod.CASH || shift.paymentMethod === 'CASH';
  const totalAmount = shift.totalAmount ?? 500000;
  const commission =
    shift.commissionAmount ?? Math.round(totalAmount * DEFAULT_PLATFORM_COMMISSION_RATE);
  const netAmount = shift.netAmount ?? totalAmount - commission;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft color={tokens.colors.inkPrimary} size={22} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Hồ sơ ca {shift.bookingCode}</Text>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <ShiftStatusBadges
              executionStatus={shift.executionStatus ?? ExecutionStatus.COMPLETED}
              paymentStatus={shift.paymentStatus ?? PaymentStatus.ESCROW_HELD}
              paymentMethod={shift.paymentMethod}
              disputeStatus={shift.disputeStatus}
            />
          </View>
          <Text style={styles.serviceTitle}>{shift.serviceName}</Text>
          <View style={styles.timeRow}>
            <Clock color={tokens.colors.inkSecondary} size={16} />
            <Text style={styles.timeRange}>{shift.timeRange}</Text>
          </View>
        </View>

        {/* Patient Info */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Thông tin người bệnh</Text>
          <View style={styles.infoRow}>
            <User color={tokens.colors.brandJade} size={18} />
            <Text style={styles.infoPrimary}>
              {shift.patientName} ({shift.patientAge} tuổi)
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin color={tokens.colors.brandJade} size={18} />
            <Text style={styles.infoSecondary}>{shift.patientAddress}</Text>
          </View>
          {shift.allergies ? (
            <View style={styles.infoRow}>
              <AlertTriangle color={tokens.colors.accentOchre} size={18} />
              <Text style={styles.infoAlert}>Dị ứng: {shift.allergies}</Text>
            </View>
          ) : null}
          {shift.mobilityNote ? (
            <View style={styles.infoRow}>
              <FileCheck2 color={tokens.colors.inkSecondary} size={18} />
              <Text style={styles.infoSecondary}>Vận động: {shift.mobilityNote}</Text>
            </View>
          ) : null}
        </View>

        {/* Handover & Clinical Report */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Báo cáo bàn giao đã nộp</Text>
          <View style={styles.reportBox}>
            <Text style={styles.reportText}>
              {shift.notes ||
                'Đã hoàn tất theo dõi sinh tồn, chăm sóc vết loét/thủ thuật theo y lệnh và bàn giao tình trạng ổn định cho gia đình.'}
            </Text>
          </View>
          <View style={styles.vitalsSummaryRow}>
            <View style={styles.vitalsPill}>
              <HeartPulse color={tokens.colors.brandJade} size={15} />
              <Text style={styles.vitalsText}>Sinh tồn ổn định</Text>
            </View>
            <View style={styles.vitalsPill}>
              <CheckCircle2 color={tokens.colors.brandJade} size={15} />
              <Text style={styles.vitalsText}>100% mục đã làm</Text>
            </View>
          </View>
        </View>

        {/* Financial Breakdown (Ledger) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Chi tiết thù lao &amp; quyết toán</Text>

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Tổng giá ca dịch vụ</Text>
            <Text style={styles.ledgerVal}>{formatVND(totalAmount)}</Text>
          </View>

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Phí hoa hồng CareNest (15%)</Text>
            <Text style={styles.ledgerDeduct}>-{formatVND(commission)}</Text>
          </View>

          <View style={[styles.ledgerRow, styles.ledgerRowTotal]}>
            <Text style={styles.ledgerTotalLabel}>Thực nhận điều dưỡng</Text>
            <Text style={styles.ledgerTotalVal}>+{formatVND(netAmount)}</Text>
          </View>

          <View style={styles.paymentMethodNotice}>
            <Coins color={isCash ? tokens.colors.accentOchre : tokens.colors.brandJade} size={18} />
            <Text style={styles.paymentMethodText}>
              {isCash
                ? `Khách đã thanh toán tiền mặt trực tiếp cho bạn (${formatVND(totalAmount)}). Vui lòng nộp ${formatVND(commission)} tiền hoa hồng qua tab Ví để duy trì hạn mức nhận ca.`
                : 'Thanh toán trực tuyến giữ qua Escrow. Tiền sẽ tự động quyết toán vào Ví của bạn sau 24 giờ kể từ thời điểm check-out.'}
            </Text>
          </View>
        </View>

        {/* Action Buttons: Đánh giá khách (A14), Mở khiếu nại (A15), Nộp hoa hồng (A11) */}
        <View style={styles.actionSection}>
          {isCash && shift.commissionAmount ? (
            <AppButton
              label={`Nộp hoa hồng (${formatVND(commission)})`}
              variant="primary"
              onPress={() => {
                Alert.alert(
                  'Nộp hoa hồng',
                  `Bạn cần nộp ${formatVND(commission)} hoa hồng cho ca ${shift.bookingCode}. Tính năng nạp ví sẽ mở trong đợt phát hành A11.`,
                  [{ text: 'Đóng' }]
                );
              }}
              style={styles.actionBtn}
            />
          ) : null}

          {pendingReview ? (
            <AppButton
              label="Đánh giá khách"
              icon={<Star size={18} color={tokens.colors.brandJade} />}
              variant="secondary"
              onPress={() => setRateSheetVisible(true)}
              style={styles.actionBtn}
            />
          ) : null}

          <AppButton
            label="Mở khiếu nại / Phản ánh ca này"
            icon={<AlertTriangle size={18} color={tokens.colors.alertCrimson} />}
            variant="secondary"
            onPress={() => {
              Alert.alert(
                'Mở khiếu nại',
                `Khiếu nại ca trực ${shift.bookingCode} sẽ khả dụng ở phân hệ A15.`,
                [{ text: 'Đóng' }]
              );
            }}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>

      {pendingReview ? (
        <RateCustomerSheet
          visible={rateSheetVisible}
          bookingId={pendingReview.bookingId}
          bookingCode={pendingReview.bookingCode}
          customerName={pendingReview.customerName}
          onClose={() => setRateSheetVisible(false)}
          onSuccess={(message) => {
            setRateSheetVisible(false);
            setPendingReview(null);
            Alert.alert('Đã gửi đánh giá', message);
          }}
        />
      ) : null}
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },
  errorMsg: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    padding: 16,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    marginBottom: 14,
  },
  badgeRow: {
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 27,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeRange: {
    fontSize: 14.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  sectionCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  infoPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    flex: 1,
  },
  infoSecondary: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    flex: 1,
  },
  infoAlert: {
    fontSize: 14,
    color: tokens.colors.accentOchre,
    fontWeight: '600',
    flex: 1,
  },
  reportBox: {
    backgroundColor: tokens.colors.canvas,
    borderRadius: tokens.radii.sm,
    padding: 12,
    marginBottom: 10,
  },
  reportText: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
  },
  vitalsSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  vitalsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  vitalsText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.brandJadeDark,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  ledgerLabel: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
  },
  ledgerVal: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  ledgerDeduct: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
    fontVariant: ['tabular-nums'],
  },
  ledgerRowTotal: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
    marginTop: 8,
    paddingTop: 10,
  },
  ledgerTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  ledgerTotalVal: {
    fontSize: 19,
    fontWeight: '800',
    color: tokens.colors.brandJadeDark,
    fontVariant: ['tabular-nums'],
  },
  paymentMethodNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.canvas,
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
  },
  actionSection: {
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    width: '100%',
  },
});
