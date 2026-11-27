import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
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
  CheckCircle2,
  Clock,
  Landmark,
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import {
  WithdrawalStatus,
  type BankAccountDto,
  type WithdrawalDto,
} from '@healthcare-system/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime, formatVND } from '../../lib/formatters';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { AmountKeypadInput } from './components/AmountKeypadInput';
import { useWalletSummary } from './useWalletSummary';
import {
  generateUUID,
  getBankAccount,
  getWithdrawals,
  requestWithdrawal,
  validateWithdrawalAmount,
} from './withdrawal.api';

type Props = NativeStackScreenProps<ActiveStackParamList, 'Withdraw'>;

export const WithdrawScreen: React.FC<Props> = ({ navigation }) => {
  const { summary, refresh: refreshSummary } = useWalletSummary();

  const [bankAccount, setBankAccount] = useState<BankAccountDto | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Form input state
  const [amount, setAmount] = useState<number>(0);
  const [inputError, setInputError] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const availableBalance = summary?.availableBalance ?? 0;
  const escrowLockedBalance = summary?.escrowLockedBalance ?? 0;
  const depositBalance = summary?.depositBalance ?? 0;

  const loadData = useCallback(async () => {
    try {
      const [bankRes, withRes] = await Promise.all([
        getBankAccount(),
        getWithdrawals(),
      ]);

      if (bankRes.success) {
        setBankAccount(bankRes.data);
      }
      if (withRes.success && withRes.data) {
        setWithdrawals(withRes.data);
      }
    } catch {
      Alert.alert('Lỗi kết nối', 'Không thể tải thông tin rút tiền. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshSummary()]);
    setRefreshing(false);
  };

  const handleAmountChange = (newAmount: number) => {
    setAmount(newAmount);
    if (newAmount > 0) {
      setInputError(validateWithdrawalAmount(newAmount, availableBalance));
    } else {
      setInputError(null);
    }
  };

  const handleOpenConfirmModal = () => {
    if (!bankAccount) {
      Alert.alert(
        'Chưa có tài khoản nhận tiền',
        'Vui lòng liên hệ Admin để đăng ký tài khoản ngân hàng trước khi rút tiền.'
      );
      return;
    }

    if (amount <= 0) {
      setInputError('Vui lòng nhập số tiền muốn rút.');
      return;
    }

    const validation = validateWithdrawalAmount(amount, availableBalance);
    if (validation) {
      setInputError(validation);
      return;
    }

    setInputError(null);
    // Generate a fresh UUID idempotency key whenever the modal opens
    setIdempotencyKey(generateUUID());
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (submitting || !idempotencyKey || amount <= 0) return;

    setSubmitting(true);
    try {
      const res = await requestWithdrawal(amount, idempotencyKey);
      setSubmitting(false);

      if (res.success && res.data) {
        setConfirmModalOpen(false);
        const successMsg = `Đã gửi yêu cầu rút ${formatVND(amount)} thành công. Trạng thái: Đang chờ duyệt.`;
        setSuccessBanner(successMsg);

        // Prepend new pending record locally
        const newRecord: WithdrawalDto = {
          id: res.data.withdrawal_id,
          amount,
          status: WithdrawalStatus.WITHDRAW_REQUESTED,
          requestedAt: new Date().toISOString(),
        };
        setWithdrawals((prev) => [newRecord, ...prev]);

        // Reset amount
        setAmount(0);
        setInputError(null);

        // Refresh wallet summary to reconcile balance
        void refreshSummary();
      } else {
        const errCode = res.error?.code;
        const errMsg = res.error?.message || 'Có lỗi xảy ra khi tạo yêu cầu rút tiền.';

        if (errCode === 'INSUFFICIENT_BALANCE') {
          Alert.alert('Số dư không đủ', errMsg);
          void refreshSummary();
        } else {
          Alert.alert('Không thể rút tiền', errMsg);
        }
      }
    } catch {
      setSubmitting(false);
      Alert.alert('Lỗi kết nối', 'Không thể gửi yêu cầu rút tiền lúc này.');
    }
  };

  const isFormValid =
    amount > 0 &&
    amount <= availableBalance &&
    Number.isInteger(amount) &&
    !inputError &&
    bankAccount !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quay lại ví"
          testID="withdraw-back-btn"
        >
          <ArrowLeft size={22} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rút tiền về ngân hàng</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Làm mới trang"
        >
          <RefreshCw size={20} color={tokens.colors.brandJade} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[tokens.colors.brandJade]}
          />
        }
      >
        {/* Banner guidance (N12 Spec) */}
        <View style={styles.subHeaderCard}>
          <Text style={styles.subHeaderTitle}>Rút tiền từ ví khả dụng</Text>
          <Text style={styles.subHeaderDesc}>
            Tiền chỉ rút được từ ngăn Khả dụng — hai ngăn còn lại đang được bảo lưu theo quy định bảo đảm an toàn.
          </Text>
        </View>

        {/* Success Banner */}
        {successBanner && (
          <View style={styles.successBanner} testID="withdraw-success-banner">
            <CheckCircle2 size={20} color={tokens.colors.brandJade} style={styles.bannerIcon} />
            <Text style={styles.successBannerText}>{successBanner}</Text>
            <TouchableOpacity
              onPress={() => setSuccessBanner(null)}
              activeOpacity={0.7}
              style={styles.bannerCloseBtn}
            >
              <X size={18} color={tokens.colors.brandJade} />
            </TouchableOpacity>
          </View>
        )}

        {/* 1. Card Số dư khả dụng */}
        <View style={styles.balanceCard} testID="withdraw-balance-card">
          <Text style={styles.balanceCardLabel}>SỐ DƯ KHẢ DỤNG</Text>
          <Text style={styles.balanceValueText}>{formatVND(availableBalance)}</Text>
          <View style={styles.balanceMetaRow}>
            <View style={styles.balanceMetaItem}>
              <Lock size={14} color={tokens.colors.inkMuted} />
              <Text style={styles.balanceMetaText}>
                Ký quỹ: <Text style={styles.balanceMetaBold}>{formatVND(depositBalance)}</Text> (không rút được)
              </Text>
            </View>
            <View style={styles.balanceMetaItem}>
              <Clock size={14} color={tokens.colors.inkMuted} />
              <Text style={styles.balanceMetaText}>
                Tạm giữ: <Text style={styles.balanceMetaBold}>{formatVND(escrowLockedBalance)}</Text> (chờ quyết toán)
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Thẻ tài khoản nhận tiền */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tài khoản nhận tiền</Text>
          {bankAccount ? (
            <View style={styles.bankAccountRow} testID="withdraw-bank-account-card">
              <View style={styles.bankIconWrap}>
                <Landmark size={24} color={tokens.colors.brandJade} />
              </View>
              <View style={styles.bankInfoCol}>
                <View style={styles.bankHeaderRow}>
                  <Text style={styles.bankNameText}>
                    {bankAccount.bankName} {bankAccount.accountMasked}
                  </Text>
                </View>
                <Text style={styles.accountHolderText}>
                  Chủ tài khoản: {bankAccount.accountHolder} · Mặc định
                </Text>
              </View>
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>✓ Đang chọn</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyBankCard} testID="withdraw-no-bank-account">
              <AlertTriangle size={24} color={tokens.colors.accentOchre} />
              <View style={styles.emptyBankTextWrap}>
                <Text style={styles.emptyBankTitle}>Chưa có tài khoản nhận tiền</Text>
                <Text style={styles.emptyBankDesc}>
                  Liên hệ Admin để đăng ký tài khoản nhận tiền
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 3. Ô nhập số tiền muốn rút (AmountKeypadInput) */}
        <View style={styles.sectionCard}>
          <AmountKeypadInput
            value={amount}
            onChangeAmount={handleAmountChange}
            maxAmount={availableBalance}
            presets={[500000, 1000000, 2000000]}
            errorMessage={inputError}
            hintText={`Số tiền phải ≤ số dư khả dụng (${formatVND(availableBalance)})`}
            testID="withdraw-amount-input"
          />

          {/* Nút hành động tạo yêu cầu */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!isFormValid || submitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleOpenConfirmModal}
            disabled={!isFormValid || submitting}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Tạo yêu cầu rút tiền"
            testID="withdraw-submit-btn"
          >
            <Text style={styles.submitBtnText}>Tạo yêu cầu rút tiền</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Lịch sử rút tiền */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Lịch sử rút tiền</Text>

          {withdrawals.length === 0 ? (
            <View style={styles.emptyHistoryWrap}>
              <Text style={styles.emptyHistoryText}>Chưa có lịch sử rút tiền.</Text>
            </View>
          ) : (
            withdrawals.map((item) => {
              const isRequested = item.status === WithdrawalStatus.WITHDRAW_REQUESTED;
              const isWithdrawn = item.status === WithdrawalStatus.WITHDRAWN;
              const isRejected = item.status === WithdrawalStatus.REJECTED;

              const statusBadgeTone = isWithdrawn
                ? 'jade'
                : isRejected
                ? 'crimson'
                : 'ochre';

              const statusLabel = isWithdrawn
                ? 'Đã chuyển'
                : isRejected
                ? 'Từ chối'
                : 'Đang chờ duyệt';

              return (
                <View key={item.id} style={styles.historyRow} testID={`withdraw-history-item-${item.id}`}>
                  <View style={styles.historyIconWrap}>
                    {isRequested ? (
                      <Clock size={20} color={tokens.colors.accentOchre} />
                    ) : isWithdrawn ? (
                      <Landmark size={20} color={tokens.colors.brandJade} />
                    ) : (
                      <AlertCircle size={20} color={tokens.colors.alertCrimson} />
                    )}
                  </View>

                  <View style={styles.historyInfoCol}>
                    <Text style={styles.historyTitleText}>
                      Rút {formatVND(item.amount)}
                      {bankAccount ? ` · ${bankAccount.bankName} ${bankAccount.accountMasked}` : ''}
                    </Text>

                    <View style={styles.historyMetaRow}>
                      <Text style={styles.historyDateText}>
                        {formatDateTime(item.requestedAt)}
                      </Text>
                      <StatusBadge label={statusLabel} tone={statusBadgeTone} />
                    </View>

                    {isRejected && item.rejectReason && (
                      <Text style={styles.historyRejectText}>
                        Lý do: {item.rejectReason} — tiền đã hoàn về ví khả dụng
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.historyAmountText,
                      isRejected && styles.historyAmountRefundText,
                    ]}
                  >
                    {isRejected ? `+${formatVND(item.amount)}` : `-${formatVND(item.amount)}`}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submitting) setConfirmModalOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent} testID="withdraw-confirm-modal">
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xác nhận rút tiền</Text>
              {!submitting && (
                <TouchableOpacity
                  onPress={() => setConfirmModalOpen(false)}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.7}
                >
                  <X size={20} color={tokens.colors.inkSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Modal Body */}
            <View style={styles.modalBody}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Số tiền rút:</Text>
                <Text style={styles.confirmValueBold}>{formatVND(amount)}</Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Ngân hàng nhận:</Text>
                <Text style={styles.confirmValue}>{bankAccount?.bankName}</Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Số tài khoản:</Text>
                <Text style={styles.confirmValue}>{bankAccount?.accountMasked}</Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Người thụ hưởng:</Text>
                <Text style={styles.confirmValue}>{bankAccount?.accountHolder}</Text>
              </View>

              <View style={[styles.confirmRow, styles.confirmRowRemaining]}>
                <Text style={styles.confirmLabel}>Số dư khả dụng còn lại:</Text>
                <Text style={styles.confirmValueGreen}>
                  {formatVND(Math.max(0, availableBalance - amount))}
                </Text>
              </View>

              <View style={styles.noticeBox}>
                <ShieldCheck size={18} color={tokens.colors.brandJade} style={styles.noticeIcon} />
                <Text style={styles.noticeText}>
                  Yêu cầu rút tiền sẽ được gửi đến Admin để rà soát và phê duyệt theo quy trình đối soát CareNest.
                </Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmModalOpen(false)}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmSubmitBtn,
                  submitting && styles.confirmSubmitBtnDisabled,
                ]}
                onPress={handleConfirmSubmit}
                disabled={submitting}
                activeOpacity={0.8}
                testID="withdraw-confirm-submit-btn"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmSubmitBtnText}>Xác nhận gửi yêu cầu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: tokens.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: tokens.typography.fontSizeTitle,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: tokens.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  subHeaderCard: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderRadius: tokens.radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7E5DC',
  },
  subHeaderTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
    marginBottom: 4,
  },
  subHeaderDesc: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.brandJadeSoft,
    borderColor: tokens.colors.brandJade,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: 12,
  },
  bannerIcon: {
    marginRight: 10,
  },
  successBannerText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: tokens.colors.brandJadeDark,
  },
  bannerCloseBtn: {
    padding: 4,
  },
  balanceCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  balanceCardLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: tokens.colors.inkMuted,
    marginBottom: 4,
  },
  balanceValueText: {
    fontSize: 34,
    fontWeight: '900',
    color: tokens.colors.brandJadeDark,
    marginBottom: 12,
  },
  balanceMetaRow: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.subtle,
    paddingTop: 10,
    gap: 6,
  },
  balanceMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceMetaText: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
  },
  balanceMetaBold: {
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  sectionCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  sectionTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginBottom: 12,
  },
  bankAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.md,
    padding: 14,
  },
  bankIconWrap: {
    width: 44,
    height: 44,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.brandJadeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bankInfoCol: {
    flex: 1,
  },
  bankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  accountHolderText: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  selectedBadge: {
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  emptyBankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.accentOchreSoft,
    borderRadius: tokens.radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.accentOchre,
  },
  emptyBankTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  emptyBankTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
  },
  emptyBankDesc: {
    fontSize: 13.5,
    color: tokens.colors.inkPrimary,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitBtnDisabled: {
    backgroundColor: tokens.colors.inkMuted,
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyHistoryWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14.5,
    color: tokens.colors.inkMuted,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.subtle,
  },
  historyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyInfoCol: {
    flex: 1,
  },
  historyTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  historyDateText: {
    fontSize: 13,
    color: tokens.colors.inkMuted,
  },
  historyRejectText: {
    fontSize: 13,
    color: tokens.colors.alertCrimson,
    marginTop: 4,
    fontWeight: '500',
  },
  historyAmountText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
    marginLeft: 8,
  },
  historyAmountRefundText: {
    color: tokens.colors.brandJade,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 12,
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmRowRemaining: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.subtle,
    paddingTop: 10,
    marginTop: 4,
  },
  confirmLabel: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
  },
  confirmValue: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  confirmValueBold: {
    fontSize: 18,
    fontWeight: '900',
    color: tokens.colors.brandJadeDark,
  },
  confirmValueGreen: {
    fontSize: 15.5,
    fontWeight: '800',
    color: tokens.colors.brandJade,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tokens.colors.brandJadeSoft,
    padding: 12,
    borderRadius: tokens.radii.md,
    marginTop: 8,
  },
  noticeIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 13.5,
    color: tokens.colors.brandJadeDark,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  confirmSubmitBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSubmitBtnDisabled: {
    opacity: 0.6,
  },
  confirmSubmitBtnText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
