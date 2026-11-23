import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Coins,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react-native';
import type { CommissionDebtDto, CommissionPaymentLinkDto } from '@healthcare-system/shared';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';
import {
  clearCommissionDebtsMock,
  confirmCommissionPayment,
  getCommissionDebts,
  getCommissionPaymentLink,
  getCommissionPaymentStatus,
  resetCommissionDebtsMock,
} from './commission-payment.api';
import { CommissionDebtItem } from './components/CommissionDebtItem';
import { VietQrSheet, type GenericVietQrLink } from '../wallet/components/VietQrSheet';
import { cancelCommissionReminder, syncAllCommissionReminders } from '../../lib/local-reminders';
import { env } from '../../lib/env';

type Props = NativeStackScreenProps<ActiveStackParamList, 'CommissionPayment'>;

export const CommissionPaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const targetBookingId = route.params?.bookingId;

  const [debts, setDebts] = useState<CommissionDebtDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    bookingCode: string;
    amount: number;
  } | null>(null);

  // VietQR Modal state
  const [activePayingDebt, setActivePayingDebt] = useState<CommissionDebtDto | null>(null);
  const [activePaymentLink, setActivePaymentLink] = useState<GenericVietQrLink | null>(null);
  const [qrSheetVisible, setQrSheetVisible] = useState<boolean>(false);
  const [loadingLink, setLoadingLink] = useState<boolean>(false);

  const initialTargetHandledRef = useRef<boolean>(false);

  const loadDebts = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await getCommissionDebts();
      if (res.success && res.data) {
        setDebts(res.data);
        // Sync local reminders (2h before dueAt)
        void syncAllCommissionReminders(res.data);
      } else {
        setErrorMessage(res.error?.message || 'Không thể tải danh sách nợ hoa hồng.');
      }
    } catch {
      setErrorMessage('Lỗi kết nối khi tải danh sách nợ hoa hồng.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDebts();
  }, [loadDebts]);

  // Handle open VietQR for a debt
  const handleOpenPay = useCallback(async (debt: CommissionDebtDto) => {
    setLoadingLink(true);
    setActivePayingDebt(debt);
    try {
      const res = await getCommissionPaymentLink(debt.bookingId);
      if (res.success && res.data) {
        const linkData = res.data;
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        setActivePaymentLink({
          id: debt.bookingId,
          amount: linkData.amount || debt.commissionAmount,
          qrImageUrl: linkData.qrCode,
          bankName: linkData.bankName || 'Ngân hàng TMCP Quân Đội (MB Bank)',
          accountNumber: linkData.accountNumber || '0388998899',
          transferContent: linkData.transferContent || `HOAHONG ${debt.bookingCode}`,
          expiresAt,
        });
        setQrSheetVisible(true);
      } else {
        Alert.alert('Không thể tạo mã VietQR', res.error?.message || 'Vui lòng thử lại sau.');
        setActivePayingDebt(null);
      }
    } catch {
      Alert.alert('Lỗi kết nối', 'Không thể lấy thông tin thanh toán VietQR.');
      setActivePayingDebt(null);
    } finally {
      setLoadingLink(false);
    }
  }, []);

  // When navigated with bookingId, automatically open VietQR for that booking once loaded
  useEffect(() => {
    if (!loading && targetBookingId && debts.length > 0 && !initialTargetHandledRef.current) {
      initialTargetHandledRef.current = true;
      const match = debts.find(
        (d) => d.bookingId === targetBookingId || d.bookingCode === targetBookingId
      );
      if (match && match.status !== 'PAID') {
        void handleOpenPay(match);
      }
    }
  }, [loading, targetBookingId, debts, handleOpenPay]);

  // Handle successful payment
  const handlePaymentSuccess = async () => {
    if (!activePayingDebt) return;
    const paidDebt = activePayingDebt;

    // In mock mode, confirm immediately
    if (env.useMockWallet) {
      await confirmCommissionPayment(paidDebt.bookingId);
    }

    // Cancel local reminder for this booking
    await cancelCommissionReminder(paidDebt.bookingId);

    setQrSheetVisible(false);
    setActivePaymentLink(null);
    setActivePayingDebt(null);

    setSuccessBanner({
      bookingCode: paidDebt.bookingCode,
      amount: paidDebt.commissionAmount,
    });

    await loadDebts();
  };

  // Poll status handler passed to VietQrSheet
  const handleCheckStatus = async (): Promise<boolean> => {
    if (!activePayingDebt) return false;
    // In mock testing, we can simulate confirmation
    if (env.useMockWallet) {
      await confirmCommissionPayment(activePayingDebt.bookingId);
      return true;
    }
    const statusRes = await getCommissionPaymentStatus(activePayingDebt.bookingId);
    return statusRes.success && statusRes.data.status === 'PAID';
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void loadDebts();
  };

  // Quick mock demo helpers
  const handleResetMock = async () => {
    setLoading(true);
    await resetCommissionDebtsMock();
    setSuccessBanner(null);
    await loadDebts();
  };

  const handleClearMock = async () => {
    setLoading(true);
    await clearCommissionDebtsMock();
    setSuccessBanner(null);
    await loadDebts();
  };

  const overdueCount = debts.filter((d) => d.status === 'OVERDUE').length;
  const unpaidCount = debts.filter((d) => d.status === 'UNPAID').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nộp hoa hồng ca tiền mặt</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[tokens.colors.brandJade]}
          />
        }
      >
        {/* Subtitle explanation */}
        <Text style={styles.headerSubtitle}>
          Ca tiền mặt: khách trả bạn 100% — bạn tự nộp 15% hoa hồng cho nền tảng trong 24 giờ sau
          check-out.
        </Text>

        {/* Banner Overdue (Red Danger) */}
        {overdueCount > 0 && (
          <View style={styles.dangerBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={20} color="#FFFFFF" />
              <Text style={styles.dangerBannerTitle}>
                Quá hạn nộp hoa hồng — tài khoản tạm khóa nhận ca
              </Text>
            </View>
            <Text style={styles.dangerBannerMessage}>
              Tài khoản bị tạm khóa nhận ca mới cho tới khi nộp đủ. Nộp ngay bên dưới để mở khóa tự
              động. ({overdueCount} ca quá hạn 24h)
            </Text>
          </View>
        )}

        {/* Banner Success (Green Jade) */}
        {successBanner && (
          <View style={styles.successBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={20} color={tokens.colors.brandJadeDark} />
              <Text style={styles.successBannerTitle}>
                Đã xác nhận nộp {successBanner.amount.toLocaleString('vi-VN')} đ
              </Text>
            </View>
            <Text style={styles.successBannerMessage}>
              Đơn {successBanner.bookingCode} đã quyết toán thành công. Khóa nhận ca đã được gỡ tự
              động ngay khi hệ thống ghi nhận giao dịch.
            </Text>
          </View>
        )}

        {/* Error message */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <AlertCircle size={18} color={tokens.colors.alertCrimson} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Loading state */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={tokens.colors.brandJade} />
            <Text style={styles.loadingText}>Đang tải danh sách nộp hoa hồng...</Text>
          </View>
        ) : debts.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Coins size={36} color={tokens.colors.brandJade} />
            </View>
            <Text style={styles.emptyTitle}>
              Không có ca tiền mặt nào đang chờ nộp hoa hồng
            </Text>
            <Text style={styles.emptySub}>
              Tất cả các ca trực nhận tiền mặt của bạn đều đã được quyết toán hoa hồng đầy đủ.
            </Text>
          </View>
        ) : (
          /* List of commission debts */
          <View style={styles.debtsList}>
            {debts.map((debt) => (
              <CommissionDebtItem
                key={debt.bookingId}
                debt={debt}
                onPay={handleOpenPay}
                isPaying={loadingLink && activePayingDebt?.bookingId === debt.bookingId}
              />
            ))}
          </View>
        )}

        {/* Mock testing quick actions (in dev / demo mode) */}
        {env.useMockWallet && (
          <View style={styles.demoActionsBox}>
            <Text style={styles.demoActionsTitle}>Công cụ kiểm thử (Mock mode):</Text>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity style={styles.demoButton} onPress={handleResetMock}>
                <RefreshCw size={14} color={tokens.colors.inkSecondary} />
                <Text style={styles.demoButtonText}>Khôi phục 3 ca mẫu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.demoButton} onPress={handleClearMock}>
                <Text style={styles.demoButtonText}>Xóa hết (Test Empty)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* VietQR Bottom Sheet Modal */}
      <VietQrSheet
        visible={qrSheetVisible}
        paymentLink={activePaymentLink}
        title={
          activePayingDebt
            ? `Nộp hoa hồng ca ${activePayingDebt.bookingCode}`
            : 'Nộp hoa hồng qua VietQR'
        }
        onSuccess={handlePaymentSuccess}
        onClose={() => {
          setQrSheetVisible(false);
          setActivePaymentLink(null);
          setActivePayingDebt(null);
        }}
        onCheckStatus={handleCheckStatus}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  header: {
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 14,
  },
  headerSubtitle: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
  },
  dangerBanner: {
    backgroundColor: tokens.colors.alertCrimson,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  dangerBannerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
  },
  dangerBannerMessage: {
    color: '#FEE2E2',
    fontSize: 13.5,
    lineHeight: 19,
  },
  successBanner: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: '#BFE8DC',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  successBannerTitle: {
    flex: 1,
    color: tokens.colors.brandJadeDark,
    fontSize: 15.5,
    fontWeight: '800',
  },
  successBannerMessage: {
    color: tokens.colors.brandJadeDark,
    fontSize: 13.5,
    lineHeight: 19,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    flex: 1,
    color: tokens.colors.alertCrimson,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
  },
  emptyCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginTop: 12,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tokens.colors.brandJadeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  debtsList: {
    marginTop: 4,
  },
  demoActionsBox: {
    marginTop: 20,
    padding: 14,
    backgroundColor: tokens.colors.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    gap: 10,
  },
  demoActionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 8,
    backgroundColor: tokens.colors.canvas,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
});
