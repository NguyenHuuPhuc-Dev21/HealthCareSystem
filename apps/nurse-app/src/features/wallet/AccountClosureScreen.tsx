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
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  LogOut,
  ShieldCheck,
  XCircle,
} from 'lucide-react-native';
import {
  DEFAULT_DEPOSIT_REFUND_HOLD_DAYS,
  DEFAULT_DEPOSIT_REFUND_SLA_WORKING_DAYS,
  DepositRefundStatus,
  PENDING_REASON_LABELS,
  REFUND_STATUS_LABELS,
  type BankAccountDto,
  type DepositRefundPendingReason,
  type DepositRefundRequestDto,
  type DepositStatusDto,
} from '@healthcare-system/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import {
  cancelRefundRequest,
  getDepositStatus,
  getRefundRequest,
  requestAccountClosure,
} from './deposit.api';
import { getBankAccount } from './wallet.api';

type Props = NativeStackScreenProps<ActiveStackParamList, 'AccountClosure'>;

function formatDate(iso: string | null): string {
  if (!iso) return 'Chưa xác định';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${d.getFullYear()}`;
}

export const AccountClosureScreen: React.FC<Props> = ({ navigation }) => {
  const [refundRequest, setRefundRequest] = useState<DepositRefundRequestDto | null>(null);
  const [depositStatus, setDepositStatus] = useState<DepositStatusDto | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccountDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [refRes, stRes, bankRes] = await Promise.all([
        getRefundRequest(),
        getDepositStatus(),
        getBankAccount(),
      ]);

      if (refRes.success) setRefundRequest(refRes.data);
      if (stRes.success && stRes.data) setDepositStatus(stRes.data);
      if (bankRes.success) setBankAccount(bankRes.data);
    } catch {
      Alert.alert('Lỗi', 'Không thể tải thông tin ngừng hợp tác lúc này.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasActiveRequest =
    refundRequest && refundRequest.status !== DepositRefundStatus.CANCELLED;

  // Xử lý 2-bước Alert khi gửi yêu cầu ngừng hợp tác theo plan A10
  const handleSubmitClosureRequest = () => {
    // Bước 1: Trình bày 5 điểm cốt lõi ADR-0004
    Alert.alert(
      'Quy trình ngừng hợp tác & hoàn ký quỹ',
      '1. Quyền nhận ca mới sẽ tạm dừng ngay khi bạn gửi yêu cầu.\n\n' +
        `2. Ký quỹ được bảo lưu an toàn ${DEFAULT_DEPOSIT_REFUND_HOLD_DAYS} ngày sau ca trực cuối cùng không tranh chấp.\n\n` +
        '3. Tiền hoàn tự động chuyển về tài khoản ngân hàng chính chủ đã đăng ký.\n\n' +
        '4. Bạn cần hoàn thành các ca đã nhận và tất toán hoa hồng trước khi nhận tiền.\n\n' +
        '5. Bạn có thể hủy yêu cầu bất kỳ lúc nào trước khi lệnh hoàn tiền được chi trả.',
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'Tiếp tục',
          onPress: showSecondStepConfirmation,
        },
      ]
    );
  };

  const showSecondStepConfirmation = () => {
    Alert.alert(
      'Xác nhận gửi yêu cầu',
      'Bạn có chắc chắn muốn gửi yêu cầu ngừng hợp tác và tất toán hoàn ký quỹ ngay bây giờ?',
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Xác nhận gửi',
          style: 'destructive',
          onPress: executeSubmitClosure,
        },
      ]
    );
  };

  const executeSubmitClosure = async () => {
    setSubmitting(true);
    try {
      const res = await requestAccountClosure();
      if (res.success && res.data) {
        setRefundRequest(res.data);
        Alert.alert(
          'Đã gửi yêu cầu thành công',
          'Yêu cầu ngừng hợp tác của bạn đã được tiếp nhận. Hệ thống đang tiến hành rà soát các điều kiện để hoàn ký quỹ.'
        );
        void loadData();
      } else {
        Alert.alert('Không thể gửi yêu cầu', res.error?.message || 'Vui lòng thử lại sau.');
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo yêu cầu lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý hủy yêu cầu
  const handleCancelRequest = () => {
    if (!refundRequest) return;
    if (refundRequest.status === DepositRefundStatus.READY) {
      Alert.alert(
        'Không thể hủy',
        'Yêu cầu đã ở trạng thái Sẵn sàng hoàn tiền, không thể hủy bỏ lúc này.'
      );
      return;
    }

    Alert.alert(
      'Hủy yêu cầu ngừng hợp tác',
      'Bạn có chắc chắn muốn hủy yêu cầu ngừng hợp tác và tiếp tục nhận ca trên nền tảng CareNest?',
      [
        { text: 'Đóng', style: 'cancel' },
        {
          text: 'Xác nhận hủy',
          onPress: async () => {
            setCancelling(true);
            try {
              const res = await cancelRefundRequest(refundRequest.id);
              if (res.success) {
                setRefundRequest(null);
                Alert.alert(
                  'Đã hủy yêu cầu',
                  'Yêu cầu ngừng hợp tác đã được hủy thành công. Bạn có thể tiếp tục nhận ca bình thường.'
                );
                void loadData();
              } else {
                Alert.alert('Lỗi', res.error?.message || 'Không thể hủy yêu cầu.');
              }
            } catch (err: any) {
              Alert.alert('Lỗi', err.message || 'Không thể hủy yêu cầu lúc này.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const depositBalance = depositStatus?.depositBalance ?? 0;
  const refundAmount = Math.max(0, depositBalance);
  const debtAmount = depositBalance < 0 ? Math.abs(depositBalance) : 0;

  const conditionsList: { key: DepositRefundPendingReason; label: string }[] = [
    { key: 'ACTIVE_BOOKING', label: 'Không còn ca đã nhận hoặc đang thực hiện' },
    {
      key: 'HOLD_DAYS',
      label: `Đã qua ${DEFAULT_DEPOSIT_REFUND_HOLD_DAYS} ngày kể từ ca hoàn thành cuối cùng`,
    },
    { key: 'OPEN_DISPUTE', label: 'Không còn khiếu nại đang mở hoặc đang phân xử' },
    { key: 'UNPAID_COMMISSION', label: 'Không còn nợ hoa hồng ca tiền mặt' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={24} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Ngừng hợp tác & Hoàn ký quỹ</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={tokens.colors.brandJade} />
            <Text style={styles.loadingText}>Đang tải thông tin hoàn ký quỹ...</Text>
          </View>
        ) : (
          <>
            {/* Banner trạng thái yêu cầu nếu đang mở */}
            {hasActiveRequest ? (
              <View style={styles.statusBoxActive}>
                <View style={styles.statusRow}>
                  <Clock size={20} color="#0284C7" />
                  <Text style={styles.statusTitle}>
                    {REFUND_STATUS_LABELS[refundRequest.status] || refundRequest.status}
                  </Text>
                </View>
                <Text style={styles.statusDesc}>
                  Yêu cầu #{refundRequest.id} tạo lúc {formatDate(refundRequest.requestedAt)}.
                  Hệ thống đang theo dõi các điều kiện để chi trả hoàn tiền.
                </Text>
                {refundRequest.dueBy && (
                  <Text style={styles.slaText}>
                    Hạn chót chi trả: {formatDate(refundRequest.dueBy)} (SLA{' '}
                    {DEFAULT_DEPOSIT_REFUND_SLA_WORKING_DAYS} ngày làm việc).
                  </Text>
                )}
              </View>
            ) : null}

            {/* Thẻ tiền hoàn dự tính */}
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>SỐ TIỀN DỰ KIẾN HOÀN LẠI</Text>
              <Text style={styles.amountLarge}>{refundAmount.toLocaleString('vi-VN')}đ</Text>
              {debtAmount > 0 ? (
                <View style={styles.debtBox}>
                  <AlertCircle size={16} color={tokens.colors.alertCrimson} />
                  <Text style={styles.debtText}>
                    Bạn đang có khoản nợ phạt {debtAmount.toLocaleString('vi-VN')}đ cần thanh toán
                    trước khi hoàn tất thủ tục.
                  </Text>
                </View>
              ) : (
                <Text style={styles.cardSub}>
                  Số dư ký quỹ hiện tại sẽ được hoàn 100% khi đủ 4 điều kiện.
                </Text>
              )}
            </View>

            {/* Bảng 4 Điều kiện tiên quyết */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>4 Điều kiện hoàn ký quỹ (ADR-0004)</Text>
              <Text style={styles.cardSubtitle}>
                Tất cả điều kiện cần được thỏa mãn trước khi lệnh hoàn tiền được phê duyệt:
              </Text>

              <View style={styles.conditionsList}>
                {conditionsList.map((cond) => {
                  const isPending =
                    hasActiveRequest && refundRequest.pendingReasons.includes(cond.key);
                  return (
                    <View key={cond.key} style={styles.conditionRow}>
                      <View style={styles.conditionIcon}>
                        {isPending ? (
                          <AlertTriangle size={18} color={tokens.colors.accentOchre} />
                        ) : (
                          <CheckCircle2 size={18} color="#16A34A" />
                        )}
                      </View>
                      <View style={styles.conditionTextWrap}>
                        <Text style={styles.conditionLabel}>{cond.label}</Text>
                        {isPending && (
                          <Text style={styles.pendingTag}>
                            ⏳ {PENDING_REASON_LABELS[cond.key]}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {hasActiveRequest && refundRequest.eligibleAt ? (
                <View style={styles.eligibleRow}>
                  <Calendar size={16} color="#0284C7" />
                  <Text style={styles.eligibleText}>
                    Ngày dự kiến đủ điều kiện:{' '}
                    <Text style={styles.boldText}>{formatDate(refundRequest.eligibleAt)}</Text>
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Tài khoản nhận tiền hoàn */}
            <View style={styles.card}>
              <View style={styles.bankHeaderRow}>
                <Building size={18} color={tokens.colors.brandJade} />
                <Text style={styles.cardTitle}>Tài khoản thụ hưởng</Text>
              </View>
              <View style={styles.bankInfoBox}>
                {bankAccount || refundRequest?.bankAccount ? (
                  <>
                    <Text style={styles.bankName}>
                      {bankAccount?.bankName || refundRequest?.bankAccount.bankName}
                    </Text>
                    <Text style={styles.bankAccountNum}>
                      {bankAccount?.accountMasked || refundRequest?.bankAccount.accountMasked}
                    </Text>
                    <Text style={styles.bankHolder}>
                      Chủ TK:{' '}
                      {bankAccount?.accountHolder || refundRequest?.bankAccount.accountHolder}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.bankHolder}>Chưa liên kết tài khoản ngân hàng</Text>
                )}
              </View>
              <Text style={styles.bankNotice}>
                Tiền hoàn sẽ chuyển vào tài khoản ngân hàng chính chủ của bạn qua chuyển khoản nhanh
                24/7.
              </Text>
            </View>

            {/* Các nút hành động */}
            {hasActiveRequest ? (
              <TouchableOpacity
                style={[
                  styles.btnCancelRequest,
                  refundRequest.status === DepositRefundStatus.READY && styles.btnDisabled,
                ]}
                onPress={handleCancelRequest}
                disabled={cancelling || refundRequest.status === DepositRefundStatus.READY}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Hủy yêu cầu ngừng hợp tác"
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color={tokens.colors.inkPrimary} />
                ) : (
                  <>
                    <XCircle size={18} color={tokens.colors.inkPrimary} />
                    <Text style={styles.btnCancelRequestText}>Hủy yêu cầu ngừng hợp tác</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.btnSubmitRequest}
                onPress={handleSubmitClosureRequest}
                disabled={submitting}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Gửi yêu cầu ngừng hợp tác và hoàn ký quỹ"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <LogOut size={18} color="#FFFFFF" />
                    <Text style={styles.btnSubmitRequestText}>
                      Gửi yêu cầu ngừng hợp tác & Hoàn ký quỹ
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backBtn: {
    padding: 6,
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: tokens.colors.inkSecondary,
  },
  statusBoxActive: {
    backgroundColor: '#F0F9FF',
    borderRadius: tokens.radii.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#0284C7',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0369A1',
  },
  statusDesc: {
    fontSize: 13.5,
    color: '#0C4A6E',
    lineHeight: 19,
  },
  slaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#075985',
    marginTop: 6,
  },
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  cardSectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: tokens.colors.inkSecondary,
    marginBottom: 4,
  },
  amountLarge: {
    fontSize: 32,
    fontWeight: '900',
    color: tokens.colors.brandJadeDark,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
  },
  debtBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    padding: 8,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderRadius: 8,
  },
  debtText: {
    fontSize: 12.5,
    color: tokens.colors.alertCrimson,
    fontWeight: '700',
    flex: 1,
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  conditionsList: {
    gap: 12,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  conditionIcon: {
    marginTop: 2,
  },
  conditionTextWrap: {
    flex: 1,
  },
  conditionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
  },
  pendingTag: {
    fontSize: 12.5,
    color: '#B45309',
    fontWeight: '700',
    marginTop: 2,
  },
  eligibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.subtle,
  },
  eligibleText: {
    fontSize: 13.5,
    color: '#0369A1',
  },
  boldText: {
    fontWeight: '800',
  },
  bankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  bankInfoBox: {
    backgroundColor: tokens.colors.canvas,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  bankName: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  bankAccountNum: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
    marginTop: 2,
  },
  bankHolder: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  bankNotice: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    marginTop: 8,
    lineHeight: 17,
  },
  btnSubmitRequest: {
    backgroundColor: tokens.colors.alertCrimson,
    borderRadius: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnSubmitRequestText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  btnCancelRequest: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnCancelRequestText: {
    color: tokens.colors.inkPrimary,
    fontSize: 15.5,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
