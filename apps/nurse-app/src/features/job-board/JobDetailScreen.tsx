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
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  HeartPulse,
  Lock,
  MapPin,
  ShieldAlert,
  Star,
  User,
} from 'lucide-react-native';
import {
  calculateJobNetAmount,
  NurseTier,
  type JobItem,
} from '@healthcare-system/shared';
import { AppButton, StateView, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';
import {
  acceptDirectInvite,
  acceptJob,
  declineDirectInvite,
  getDepositStatus,
  getJobDetail,
} from './job-board.api';
import { PrescriptionViewer } from './components/PrescriptionViewer';

type JobDetailScreenProps = NativeStackScreenProps<ActiveStackParamList, 'JobDetail'>;

export const JobDetailScreen: React.FC<JobDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { jobId, isDirectInvite } = route.params;
  const { session } = useAuth();
  const profile = session?.profile;
  const nurseTier = profile?.tier ?? NurseTier.TIER_1_BASIC;
  const isTier2 = nurseTier === NurseTier.TIER_2_SPECIALIST;

  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [accepting, setAccepting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prescriptionViewerOpen, setPrescriptionViewerOpen] = useState<boolean>(false);
  const [depositGraceActive, setDepositGraceActive] = useState<boolean>(false);
  const [depositBalance, setDepositBalance] = useState<number>(300000);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [jobRes, depositRes] = await Promise.all([
        getJobDetail(jobId),
        getDepositStatus(),
      ]);

      if (jobRes.success && jobRes.data) {
        setJob(jobRes.data);
      } else {
        setErrorMsg(jobRes.error?.message || 'Không tìm thấy ca làm việc.');
      }

      if (depositRes.success && depositRes.data) {
        setDepositGraceActive(depositRes.data.depositGraceActive);
        setDepositBalance(depositRes.data.depositBalance);
      }
    } catch {
      setErrorMsg('Không thể tải thông tin chi tiết ca làm việc.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StateView kind="loading" title="Đang tải chi tiết ca" message="Vui lòng chờ trong giây lát..." />
      </SafeAreaView>
    );
  }

  if (errorMsg || !job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <ArrowLeft size={24} color={tokens.colors.inkPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết ca</Text>
          <View style={{ width: 40 }} />
        </View>
        <StateView
          kind="empty"
          title="Không tìm thấy ca"
          message={errorMsg || 'Ca làm việc không khả dụng hoặc đã bị hủy.'}
        />
      </SafeAreaView>
    );
  }

  const isLocked = Boolean(job.isInvasive && !isTier2);
  const netAmount = job.netAmount ?? calculateJobNetAmount(job.totalAmount);
  const penaltyPercent = job.cancellationPenaltyPercent ?? 20;
  const penaltyAmount = Math.round((job.totalAmount * penaltyPercent) / 100);

  const handleConfirmAccept = async () => {
    setAccepting(true);
    try {
      const res = isDirectInvite
        ? await acceptDirectInvite(job.id, nurseTier, depositBalance)
        : await acceptJob(job.id, nurseTier, depositBalance);

      if (res.success) {
        Alert.alert(
          'Nhận ca thành công!',
          res.message || 'Ca trực đã được ghi nhận. Bạn có thể xem ngay ở mục Ca trực.',
          [
            {
              text: 'Xem Ca trực',
              onPress: () => {
                navigation.navigate('MainTabs' as any, { screen: 'ShiftsTab' });
              },
            },
          ]
        );
      } else {
        const code = res.errorCode;
        if (code === 'DEPOSIT_BELOW_MIN') {
          Alert.alert(
            'Số dư ký quỹ chưa đủ',
            res.message || 'Bạn cần ký quỹ tối thiểu 300.000đ để nhận ca.',
            [
              { text: 'Đóng', style: 'cancel' },
              {
                text: 'Nạp ký quỹ',
                onPress: () => {
                  navigation.navigate('Deposit');
                },
              },
            ]
          );
        } else if (code === 'DEPOSIT_GRACE_CASH_NOT_ALLOWED') {
          Alert.alert(
            'Không thể nhận ca tiền mặt',
            'Ca tiền mặt cần ký quỹ đủ 300.000đ. Trong giai đoạn làm quen bạn nhận được ca chuyển khoản.',
            [
              { text: 'Đóng', style: 'cancel' },
              {
                text: 'Nạp ký quỹ',
                onPress: () => {
                  navigation.navigate('Deposit');
                },
              },
            ]
          );
        } else if (code === 'DEPOSIT_GRACE_EXHAUSTED') {
          Alert.alert(
            'Hết hạn làm quen',
            'Đã dùng hết 3 ca làm quen / hết 30 ngày, nạp thêm để nhận tiếp.'
          );
        } else if (code === 'ACCOUNT_CLOSING') {
          Alert.alert('Ngừng hợp tác', 'Bạn đã yêu cầu ngừng hợp tác nên không thể nhận ca mới.');
        } else if (code === 'TIER_NOT_ALLOWED' || code === 'TIER_MISMATCH') {
          Alert.alert('Chưa đủ điều kiện', 'Dịch vụ xâm lấn yêu cầu Điều dưỡng Cấp 2 có GPHN còn hạn.');
        } else if (code === 'SCHEDULE_CONFLICT') {
          Alert.alert('Trùng lịch ca trực', 'Thời gian ca này trùng với ca trực hoặc lịch bận đã đăng ký.');
        } else if (code === 'JOB_ALREADY_TAKEN' || code === 'ALREADY_CLAIMED') {
          Alert.alert('Ca đã có người nhận', 'Ca làm việc này vừa được một điều dưỡng khác tiếp nhận (First-come claim)!');
        } else {
          Alert.alert('Không thể nhận ca', res.message || 'Vui lòng kiểm tra lại điều kiện nhận ca.');
        }
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối với máy chủ. Vui lòng thử lại sau.');
    } finally {
      setAccepting(false);
    }
  };

  const handlePressAccept = () => {
    if (isLocked) {
      Alert.alert(
        'Ca bị khóa theo cấp bậc',
        'Ca làm việc có thủ thuật xâm lấn, yêu cầu Điều dưỡng Cấp 2 có Giấy phép hành nghề còn hạn.'
      );
      return;
    }

    Alert.alert(
      'Xác nhận nhận ca trực',
      `Bạn có chắc chắn muốn nhận ca "${job.serviceName}"?\n\nLưu ý chính sách cam kết: Hủy ca sau khi nhận sẽ bị trừ phạt ${penaltyPercent}% (${penaltyAmount.toLocaleString('vi-VN')}đ) vào ví ký quỹ.`,
      [
        { text: 'Suy nghĩ thêm', style: 'cancel' },
        {
          text: 'Đồng ý nhận ca',
          style: 'default',
          onPress: () => void handleConfirmAccept(),
        },
      ]
    );
  };

  const handleDeclineDirectInvite = () => {
    Alert.alert(
      'Từ chối lời mời',
      'Bạn có chắc chắn muốn từ chối lời mời này? Hệ thống sẽ chuyển ca cho điều dưỡng khác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineDirectInvite(job.id, 'Điều dưỡng bận');
              Alert.alert('Đã từ chối', 'Bạn đã từ chối lời mời nhận ca.', [
                {
                  text: 'Đóng',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch {
              Alert.alert('Lỗi', 'Không thể từ chối lời mời lúc này.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={24} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết việc làm</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Direct Invite Banner */}
        {(isDirectInvite || job.isDirectInvite) && (
          <View style={styles.directInviteBanner}>
            <Star size={20} color="#D97706" fill="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.directInviteBannerTitle}>
                Khách chọn đích danh bạn
              </Text>
              <Text style={styles.directInviteBannerDesc}>
                Lời mời nhận ca trực tiếp từ {job.customerName || job.inviterName || 'khách hàng quen'}. Vui lòng xem kỹ thông tin người bệnh và y lệnh trước khi nhận ca.
              </Text>
            </View>
          </View>
        )}

        {/* Locked warning banner */}
        {isLocked && (
          <View style={styles.lockedBanner}>
            <Lock size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockedBannerTitle}>Ca bị khóa theo cấp bậc</Text>
              <Text style={styles.lockedBannerDesc}>
                Cần Tầng 2 (có GPHN còn hạn) để nhận ca có dịch vụ xâm lấn này.
              </Text>
            </View>
          </View>
        )}

        {/* Grace period banner */}
        {depositGraceActive && (
          <View style={styles.graceBanner}>
            <CheckCircle2 size={18} color={tokens.colors.brandJade} />
            <Text style={styles.graceBannerText}>
              Giai đoạn làm quen: Ca được thanh toán chuyển khoản an toàn qua Escrow.
            </Text>
          </View>
        )}

        {/* Main Service Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceName}>{job.serviceName}</Text>
              <Text style={styles.codeText}>Mã đơn: {job.code}</Text>
            </View>
            <StatusBadge
              label={job.serviceType === 'shift' ? 'Theo ca' : 'Thủ thuật'}
              tone={job.serviceType === 'shift' ? 'jade' : 'neutral'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.rowItem}>
            <Calendar size={18} color={tokens.colors.inkSecondary} />
            <Text style={styles.rowLabel}>Ngày thực hiện:</Text>
            <Text style={styles.rowValue}>{job.date}</Text>
          </View>

          <View style={styles.rowItem}>
            <Clock size={18} color={tokens.colors.inkSecondary} />
            <Text style={styles.rowLabel}>Thời gian:</Text>
            <Text style={styles.rowValue}>
              {job.startTime} – {job.endTime}
            </Text>
          </View>

          <View style={styles.rowItem}>
            <MapPin size={18} color={tokens.colors.inkSecondary} />
            <Text style={styles.rowLabel}>Khoảng cách:</Text>
            <Text style={styles.rowValue}>
              Quận {job.district} · Cách {job.distanceKm.toFixed(1)} km
            </Text>
          </View>

          {job.note && (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Ghi chú từ gia đình:</Text>
              <Text style={styles.noteContent}>{job.note}</Text>
            </View>
          )}
        </View>

        {/* Patient Profile Information */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <User size={20} color={tokens.colors.brandJade} />
            <Text style={styles.sectionTitle}>Thông tin người bệnh</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Họ và tên</Text>
              <Text style={styles.gridValue}>{job.patientName}</Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Tuổi & Giới tính</Text>
              <Text style={styles.gridValue}>
                {job.patientAge} tuổi · {job.patientGender || 'Chưa rõ'}
              </Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Cân nặng</Text>
              <Text style={styles.gridValue}>
                {job.patientWeight ? `${job.patientWeight} kg` : 'Chưa ghi nhận'}
              </Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Mức độ vận động</Text>
              <Text style={styles.gridValue}>
                {job.mobilityStatus || 'Tự đi lại nhẹ nhàng'}
              </Text>
            </View>
          </View>

          <View style={styles.rowBlock}>
            <Text style={styles.gridLabel}>Tình trạng / Bệnh nền:</Text>
            <Text style={styles.gridValue}>
              {job.medicalCondition || job.medicalHistory || 'Chưa có ghi chú đặc biệt'}
            </Text>
          </View>

          <View style={styles.rowBlock}>
            <Text style={styles.gridLabel}>Tiền sử dị ứng:</Text>
            <Text style={[styles.gridValue, job.allergies ? styles.textAmber : null]}>
              {job.allergies || 'Không ghi nhận dị ứng'}
            </Text>
          </View>

          <View style={styles.rowBlock}>
            <Text style={styles.gridLabel}>Nguy cơ lây nhiễm:</Text>
            <Text style={styles.gridValue}>
              {job.contagionRisk || 'Không có'}
            </Text>
          </View>
        </View>

        {/* Address card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={tokens.colors.brandJade} />
            <Text style={styles.sectionTitle}>Địa chỉ điểm hẹn</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.addressText}>
            {job.status === 'MATCHING'
              ? `Khu vực: Quận ${job.district}, TP. Đà Nẵng`
              : job.fullAddress || `Quận ${job.district}, TP. Đà Nẵng`}
          </Text>

          {job.status === 'MATCHING' && (
            <View style={styles.privacyNoteBox}>
              <Text style={styles.privacyNoteText}>
                🔒 Số nhà cụ thể và số điện thoại người nhà sẽ tự động mở khóa ngay sau khi bạn nhận ca thành công (Quy định bảo vệ riêng tư dữ liệu y tế).
              </Text>
            </View>
          )}
        </View>

        {/* Prescription Card */}
        {job.hasPrescription && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <FileCheck2 size={20} color="#D97706" />
              <Text style={styles.sectionTitle}>Y lệnh & Toa thuốc đính kèm</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.prescriptionInfoText}>
              Ca yêu cầu thực hiện theo đúng y lệnh bác sĩ: {job.prescriptionFileName || 'Toa thuốc gốc'}
            </Text>

            <TouchableOpacity
              style={styles.viewPrescriptionButton}
              onPress={() => setPrescriptionViewerOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Xem ảnh toa thuốc y lệnh"
            >
              <FileCheck2 size={18} color="#FFFFFF" />
              <Text style={styles.viewPrescriptionText}>Xem ảnh y lệnh điều trị</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pricing & Net Income Breakdown */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Banknote size={20} color={tokens.colors.brandJade} />
            <Text style={styles.sectionTitle}>Chi tiết tài chính</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceLine}>
            <Text style={styles.priceLineLabel}>Giá gốc dịch vụ:</Text>
            <Text style={styles.priceLineValue}>
              {job.baseAmount.toLocaleString('vi-VN')}đ
            </Text>
          </View>

          {Boolean(job.nightSurcharge) && (
            <View style={styles.priceLine}>
              <Text style={styles.priceLineLabel}>Phụ phí ca đêm:</Text>
              <Text style={styles.priceLineValue}>
                +{job.nightSurcharge!.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}

          {Boolean(job.urgentBonus) && (
            <View style={styles.priceLine}>
              <Text style={styles.priceLineLabel}>Thưởng nóng / khẩn cấp:</Text>
              <Text style={[styles.priceLineValue, { color: '#DC2626' }]}>
                +{job.urgentBonus!.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}

          <View style={styles.priceLine}>
            <Text style={styles.priceLineLabel}>Tổng giá trị ca:</Text>
            <Text style={styles.priceLineTotal}>
              {job.totalAmount.toLocaleString('vi-VN')}đ
            </Text>
          </View>

          <View style={styles.priceLine}>
            <Text style={styles.priceLineLabel}>Phí nền tảng (15%):</Text>
            <Text style={styles.priceLineDeduction}>
              -{(job.totalAmount - netAmount).toLocaleString('vi-VN')}đ
            </Text>
          </View>

          <View style={styles.netHighlightBox}>
            <Text style={styles.netHighlightLabel}>Thực nhận của bạn:</Text>
            <Text style={styles.netHighlightValue}>
              {netAmount.toLocaleString('vi-VN')}đ
            </Text>
          </View>

          <View style={styles.paymentMethodRow}>
            <Text style={styles.paymentMethodLabel}>Hình thức chi trả:</Text>
            <Text style={styles.paymentMethodValue}>
              {job.paymentMethod === 'BANK_TRANSFER'
                ? 'Chuyển khoản (Ví Escrow giữ tiền)'
                : 'Tiền mặt tại nhà'}
            </Text>
          </View>
        </View>

        {/* Cancellation Penalty Policy */}
        <View style={styles.penaltyCard}>
          <View style={styles.penaltyHeader}>
            <ShieldAlert size={18} color="#DC2626" />
            <Text style={styles.penaltyTitle}>Quy định hủy ca & Phạt cam kết</Text>
          </View>
          <Text style={styles.penaltyDesc}>
            Sau khi nhận ca, nếu bạn tự ý hủy mà không có lý do y khoa bất khả kháng, hệ thống sẽ trừ mức phạt cam kết {penaltyPercent}% ({penaltyAmount.toLocaleString('vi-VN')}đ) từ số dư ví ký quỹ để bồi hoàn cho người bệnh.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        {isLocked ? (
          <View style={styles.disabledActionBox}>
            <Lock size={18} color="#9CA3AF" />
            <Text style={styles.disabledActionText}>
              Cần Tầng 2 (có GPHN còn hạn) để nhận ca
            </Text>
          </View>
        ) : isDirectInvite || job.isDirectInvite ? (
          <View style={styles.directActionsRow}>
            <TouchableOpacity
              style={styles.directDeclineBtn}
              onPress={handleDeclineDirectInvite}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Từ chối lời mời"
            >
              <Text style={styles.directDeclineBtnText}>Từ chối</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.directAcceptBtn, accepting && styles.buttonDisabled]}
              onPress={handlePressAccept}
              disabled={accepting}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Đồng ý nhận ca, thu về ${netAmount.toLocaleString('vi-VN')} đồng`}
            >
              {accepting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.directAcceptBtnText}>
                  Đồng ý nhận ca · {netAmount.toLocaleString('vi-VN')}đ
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.acceptMainButton, accepting && styles.buttonDisabled]}
            onPress={handlePressAccept}
            disabled={accepting}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Nhận ca này, thu về ${netAmount.toLocaleString('vi-VN')} đồng`}
          >
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.acceptMainButtonText}>
                  Nhận ca này · Thu về {netAmount.toLocaleString('vi-VN')}đ
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Prescription Modal Viewer */}
      <PrescriptionViewer
        visible={prescriptionViewerOpen}
        imageUrl={job.prescriptionUrl}
        fileName={job.prescriptionFileName}
        prescribedDate={job.prescriptionPrescribedDate}
        expiryDays={job.prescriptionExpiryDays}
        onClose={() => setPrescriptionViewerOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  lockedBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 2,
  },
  lockedBannerDesc: {
    fontSize: 13.5,
    color: '#991B1B',
    lineHeight: 18,
  },
  graceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  graceBannerText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
  },
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  serviceName: {
    fontSize: 19,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    lineHeight: 25,
  },
  codeText: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.borderHairline,
    marginVertical: 14,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  rowLabel: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    flex: 1,
  },
  noteBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.brandJade,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
    marginBottom: 4,
  },
  noteContent: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  gridCol: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  rowBlock: {
    marginBottom: 10,
  },
  textAmber: {
    color: '#D97706',
    fontWeight: '700',
  },
  addressText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 22,
  },
  privacyNoteBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  privacyNoteText: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
  },
  prescriptionInfoText: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    marginBottom: 12,
  },
  viewPrescriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#D97706',
  },
  viewPrescriptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLineLabel: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
  },
  priceLineValue: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  priceLineTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  priceLineDeduction: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  netHighlightBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  netHighlightLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
  },
  netHighlightValue: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.brandJade,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  paymentMethodLabel: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
  },
  paymentMethodValue: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  penaltyCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  penaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  penaltyTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  penaltyDesc: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: tokens.colors.paper,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
  },
  acceptMainButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: tokens.colors.brandJade,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: tokens.colors.brandJade,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  acceptMainButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  disabledActionBox: {
    height: 54,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  directInviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F0C36D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  directInviteBannerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  directInviteBannerDesc: {
    fontSize: 13.5,
    color: '#78350F',
    lineHeight: 18,
  },
  directActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  directDeclineBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  directDeclineBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  directAcceptBtn: {
    flex: 2,
    height: 56,
    borderRadius: 14,
    backgroundColor: tokens.colors.brandJade,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: tokens.colors.brandJade,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  directAcceptBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
