import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { WithdrawalStatus } from '@healthcare-system/shared';
import type { BankAccountDto, WithdrawalDto } from '@healthcare-system/shared';
import { Button, StatusBadge } from '../../components';
import { formatDateTime, formatVND } from '../../lib/formatters';
import {
  getBankAccount,
  getWalletBalances,
  getWithdrawals,
  requestWithdrawal,
  type WalletBalancesDto,
} from './wallet.api';
import { WithdrawConfirmModal } from './components/WithdrawConfirmModal';

export const WithdrawPage: React.FC = () => {
  const [balances, setBalances] = useState<WalletBalancesDto>({
    available_balance: 0,
    escrow_locked_balance: 0,
    deposit_balance: 0,
  });
  const [bankAccount, setBankAccount] = useState<BankAccountDto | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalDto[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form state
  const [amountInput, setAmountInput] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [balRes, bankRes, withRes] = await Promise.all([
        getWalletBalances(),
        getBankAccount(),
        getWithdrawals(),
      ]);

      if (balRes.success && balRes.data) {
        setBalances(balRes.data);
      } else {
        setPageError(balRes.error?.message || 'Không thể tải thông tin số dư');
      }

      if (bankRes.success) {
        setBankAccount(bankRes.data);
      }

      if (withRes.success && withRes.data) {
        setWithdrawals(withRes.data);
      }
    } catch {
      setPageError('Lỗi kết nối khi tải dữ liệu ví');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Parse numeric amount
  const numericAmount = parseInt(amountInput.replace(/\D/g, ''), 10) || 0;

  // Validate amount
  const validateAmount = (value: number, currentAvailable: number): string | null => {
    if (value <= 0) {
      return 'Vui lòng nhập số tiền lớn hơn 0đ';
    }
    if (value > currentAvailable) {
      return `Số tiền rút vượt quá số dư khả dụng (${formatVND(currentAvailable)})`;
    }
    return null;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setAmountInput('');
      setInputError(null);
      return;
    }

    const num = parseInt(rawVal, 10);
    setAmountInput(num.toLocaleString('vi-VN'));
    setInputError(validateAmount(num, balances.available_balance));
  };

  const handleWithdrawAll = () => {
    if (balances.available_balance <= 0) return;
    setAmountInput(balances.available_balance.toLocaleString('vi-VN'));
    setInputError(validateAmount(balances.available_balance, balances.available_balance));
  };

  const handleOpenModal = () => {
    if (!numericAmount || numericAmount <= 0) {
      setInputError('Vui lòng nhập số tiền cần rút');
      return;
    }
    const error = validateAmount(numericAmount, balances.available_balance);
    if (error) {
      setInputError(error);
      return;
    }
    if (!bankAccount) {
      setInputError('Bạn cần liên hệ Admin để đăng ký tài khoản ngân hàng nhận tiền');
      return;
    }
    setModalError(null);
    setModalOpen(true);
  };

  const handleConfirmWithdrawal = async (idempotencyKey: string) => {
    setSubmitting(true);
    setModalError(null);

    const res = await requestWithdrawal(numericAmount, idempotencyKey);
    setSubmitting(false);

    if (res.success && res.data) {
      setModalOpen(false);
      setSuccessBanner(
        `Đã tạo yêu cầu rút ${formatVND(numericAmount)} thành công. Trạng thái: Đang chờ duyệt.`
      );

      // Optimistically update balance & withdrawal list
      setBalances((prev) => ({
        ...prev,
        available_balance: Math.max(0, prev.available_balance - numericAmount),
      }));

      const newRecord: WithdrawalDto = {
        id: res.data.withdrawal_id,
        amount: numericAmount,
        status: WithdrawalStatus.WITHDRAW_REQUESTED,
        requestedAt: new Date().toISOString(),
      };
      setWithdrawals((prev) => [newRecord, ...prev]);

      // Reset form
      setAmountInput('');
      setInputError(null);

      // Auto dismiss success banner after 8s
      setTimeout(() => setSuccessBanner(null), 8000);
    } else {
      const errCode = res.error?.code;
      const errMsg = res.error?.message || 'Có lỗi xảy ra khi tạo yêu cầu rút tiền';

      if (errCode === 'INSUFFICIENT_BALANCE') {
        setModalError(errMsg);
        // Refresh balance to reconcile
        getWalletBalances().then((b) => {
          if (b.success && b.data) setBalances(b.data);
        });
      } else {
        setModalError(errMsg);
      }
    }
  };

  const isFormValid =
    numericAmount > 0 &&
    numericAmount <= balances.available_balance &&
    !inputError &&
    bankAccount !== null;

  return (
    <div>
      {/* Standard CareNest Page Header */}
      <div className="page-head">
        <div>
          <h1>Rút tiền về ngân hàng</h1>
          <p>Tiền chỉ rút được từ ngăn Khả dụng — hai ngăn còn lại đang bị khóa theo quy tắc</p>
        </div>
        <Link
          to="/"
          className="btn btn-secondary btn-sm"
          style={{ minHeight: 44, padding: '8px 18px', fontSize: 14.5 }}
          aria-label="Về trang chủ"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Về trang chủ</span>
        </Link>
      </div>

      {/* Global Status Banners */}
      {successBanner && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'var(--brand-jade-soft)',
            color: 'var(--brand-jade)',
            border: '1px solid #A7F3D0',
            marginBottom: 20,
            fontSize: 15.5,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1 }}>{successBanner}</div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="btn btn-secondary btn-sm"
            style={{ minHeight: 32, padding: '4px 10px', fontSize: 13 }}
          >
            Đóng
          </button>
        </div>
      )}

      {pageError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'var(--alert-crimson-soft)',
            color: 'var(--alert-crimson)',
            border: '1px solid #FECACA',
            marginBottom: 20,
            fontSize: 15,
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1 }}>{pageError}</div>
          <Button type="button" variant="secondary" onClick={loadData} style={{ minHeight: 36 }}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* Balanced 2-column Grid */}
      <div className="cols-2" style={{ alignItems: 'start' }}>
        {/* Left Column: Balances & Withdrawal Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card 1: Số dư khả dụng (Compact Ledger Header) */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                  fontSize: 13,
                }}
              >
                Số dư khả dụng
              </span>
              <span
                className="chip teal"
                style={{ fontSize: 12.5, padding: '2px 10px', borderRadius: 999 }}
              >
                Sẵn sàng rút
              </span>
            </div>

            <div
              className="tabular-nums"
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: 'var(--ink-primary)',
                lineHeight: 1.15,
                marginBottom: 12,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {loading ? 'Đang tải...' : formatVND(balances.available_balance)}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                paddingTop: 12,
                borderTop: '1px dashed var(--border-hairline)',
                fontSize: 14,
                color: 'var(--ink-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={15} style={{ color: 'var(--accent-ochre)' }} aria-hidden="true" />
                <span>
                  Ký quỹ:{' '}
                  <b className="tabular-nums" style={{ color: 'var(--ink-primary)' }}>
                    {loading ? '—' : formatVND(balances.deposit_balance)}
                  </b>{' '}
                  <span style={{ color: 'var(--ink-muted)' }}>— không rút được</span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} style={{ color: 'var(--brand-jade)' }} aria-hidden="true" />
                <span>
                  Tạm giữ:{' '}
                  <b className="tabular-nums" style={{ color: 'var(--ink-primary)' }}>
                    {loading ? '—' : formatVND(balances.escrow_locked_balance)}
                  </b>{' '}
                  <span style={{ color: 'var(--ink-muted)' }}>— chờ quyết toán</span>
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Form rút tiền */}
          <form
            className="card"
            style={{ padding: '22px 24px' }}
            onSubmit={(e) => {
              e.preventDefault();
              handleOpenModal();
            }}
          >
            {/* Input số tiền */}
            <div className="field" style={{ marginBottom: 18 }}>
              <label
                htmlFor="withdraw-amount-input"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 600,
                  fontSize: 15,
                  marginBottom: 8,
                }}
              >
                <span>
                  Số tiền muốn rút <span style={{ color: 'var(--alert-crimson)' }}>*</span>
                </span>
                <button
                  type="button"
                  onClick={handleWithdrawAll}
                  disabled={balances.available_balance <= 0 || loading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '6px 14px',
                    minHeight: 40,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--brand-jade)',
                  }}
                  title="Điền toàn bộ số dư khả dụng"
                >
                  Rút tất cả
                </button>
              </label>

              <div style={{ position: 'relative' }}>
                <input
                  id="withdraw-amount-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  className="input tabular-nums"
                  value={amountInput}
                  onChange={handleAmountChange}
                  placeholder="Ví dụ: 1.000.000"
                  aria-invalid={!!inputError}
                  aria-describedby="withdraw-amount-hint"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--ink-primary)',
                    paddingRight: 48,
                    height: 50,
                    borderColor: inputError ? 'var(--alert-crimson)' : undefined,
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: 'var(--ink-muted)',
                    fontSize: 18,
                    pointerEvents: 'none',
                  }}
                  aria-hidden="true"
                >
                  ₫
                </span>
              </div>

              {inputError ? (
                <div
                  id="withdraw-amount-hint"
                  role="alert"
                  style={{
                    color: 'var(--alert-crimson)',
                    fontSize: 13.5,
                    fontWeight: 500,
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>{inputError}</span>
                </div>
              ) : (
                <div
                  id="withdraw-amount-hint"
                  style={{
                    color: 'var(--ink-muted)',
                    fontSize: 13.5,
                    marginTop: 6,
                  }}
                >
                  Số tiền phải là số nguyên dương và ≤ số dư khả dụng (
                  <span className="tabular-nums">{formatVND(balances.available_balance)}</span>).
                </div>
              )}
            </div>

            {/* Tài khoản nhận tiền */}
            <div className="field" style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, display: 'block' }}>
                Tài khoản nhận tiền
              </label>

              {bankAccount ? (
                <div className="doc-row selected">
                  <div className="dic">
                    <Building2 size={24} aria-hidden="true" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        color: 'var(--ink-primary)',
                      }}
                    >
                      {bankAccount.bankName}{' '}
                      <span className="tabular-nums">{bankAccount.accountMasked}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-secondary)', marginTop: 2 }}>
                      Chủ tài khoản: <b>{bankAccount.accountHolder}</b> · Mặc định
                    </div>
                  </div>
                  <span
                    className="chip teal"
                    style={{
                      flexShrink: 0,
                      fontSize: 12.5,
                      padding: '3px 10px',
                      borderRadius: 999,
                    }}
                  >
                    ✓ Đang chọn
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    padding: '18px 20px',
                    borderRadius: 14,
                    border: '1px dashed var(--accent-ochre)',
                    background: 'var(--accent-ochre-soft)',
                    color: 'var(--ink-primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <ShieldAlert size={20} style={{ color: 'var(--accent-ochre)' }} aria-hidden="true" />
                    <b style={{ fontSize: 15 }}>Chưa có tài khoản ngân hàng nhận tiền</b>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5 }}>
                    Vui lòng liên hệ Admin để đăng ký tài khoản nhận tiền chính chủ. Tính năng tự
                    đăng ký tài khoản trên web hiện chưa mở.
                  </p>
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                    Hotline hỗ trợ: <b>0905 123 456</b> (8:00 – 18:00)
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              className="btn-block btn-lg"
              disabled={!isFormValid || submitting}
              style={{ height: 50, fontSize: 16.5 }}
            >
              Tạo yêu cầu rút tiền
            </Button>

            {/* Quy định rút tiền tinh gọn (Ngay dưới nút bấm) */}
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px dashed var(--border-hairline)',
                fontSize: 13,
                color: 'var(--ink-muted)',
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <Info size={15} style={{ flexShrink: 0, marginTop: 2, color: 'var(--brand-jade)' }} aria-hidden="true" />
              <div>
                Yêu cầu rút tiền được kế toán xét duyệt theo kỳ làm việc (không áp dụng rút tức thì). Tiền chỉ chuyển về đúng tài khoản chính chủ đã xác thực hồ sơ.
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Withdrawal History */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              borderBottom: '1px solid var(--border-hairline)',
              paddingBottom: 10,
            }}
          >
            <h2
              style={{
                color: 'var(--ink-primary)',
                fontSize: 17.5,
                fontWeight: 700,
                margin: 0,
              }}
            >
              Lịch sử rút tiền
            </h2>
            <span
              className="chip grey tabular-nums"
              style={{ fontSize: 12.5, padding: '2px 8px', borderRadius: 999 }}
            >
              {loading ? 'Đang tải...' : `${withdrawals.length} giao dịch`}
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--ink-muted)' }}>
              Đang tải lịch sử rút tiền...
            </div>
          ) : withdrawals.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 16px',
                color: 'var(--ink-muted)',
              }}
            >
              <Wallet size={36} style={{ opacity: 0.35, marginBottom: 10 }} aria-hidden="true" />
              <div style={{ fontWeight: 600, fontSize: 15.5 }}>Chưa có yêu cầu rút tiền nào</div>
              <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>
                Khi bạn gửi yêu cầu rút tiền, lịch sử và trạng thái xử lý sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div>
              {withdrawals.map((item) => {
                const isPending = item.status === WithdrawalStatus.WITHDRAW_REQUESTED;
                const isWithdrawn = item.status === WithdrawalStatus.WITHDRAWN;
                const isRejected = item.status === WithdrawalStatus.REJECTED;

                return (
                  <div key={item.id} className="tx-row">
                    <span
                      className={`tic ${
                        isPending ? 'pending' : isRejected ? 'rejected' : ''
                      }`}
                      aria-hidden="true"
                    >
                      {isPending ? (
                        <Clock size={19} />
                      ) : isWithdrawn ? (
                        <Building2 size={19} />
                      ) : (
                        <AlertCircle size={19} />
                      )}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: 'var(--ink-primary)',
                          fontSize: 15,
                          lineHeight: 1.35,
                        }}
                      >
                        {isRejected
                          ? 'Yêu cầu rút tiền bị từ chối'
                          : `Rút về ${bankAccount?.bankName ?? 'Ngân hàng'} ${bankAccount?.accountMasked ?? ''}`}
                      </div>

                      <div
                        style={{
                          color: 'var(--ink-muted)',
                          fontSize: 13,
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span className="tabular-nums">{formatDateTime(item.requestedAt)}</span>
                        <span>•</span>
                        <StatusBadge status={item.status} />
                      </div>

                      {isRejected && item.rejectReason && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: 'var(--alert-crimson-soft)',
                            color: 'var(--alert-crimson)',
                            fontSize: 13,
                            lineHeight: 1.45,
                            border: '1px solid #FECACA',
                          }}
                        >
                          <b>Lý do:</b> {item.rejectReason}
                        </div>
                      )}
                    </div>

                    <div
                      className={`amt ${isRejected ? 'pos' : 'neg'}`}
                      style={{ fontSize: 15.5 }}
                    >
                      {isRejected ? `+${formatVND(item.amount)}` : `−${formatVND(item.amount)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <WithdrawConfirmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmWithdrawal}
        amount={numericAmount}
        bankAccount={bankAccount}
        availableBalance={balances.available_balance}
        loading={submitting}
        errorMessage={modalError}
      />
    </div>
  );
};
