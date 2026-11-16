import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import type { CommissionDebtDto, CommissionPaymentLinkDto } from '@healthcare-system/shared';
import { formatVND } from '../../lib/formatters';
import { USE_MOCK_WALLET } from '../../lib/mock-flags';
import {
  clearCommissionDebtsMock,
  confirmCommissionPayment,
  getCommissionDebts,
  getCommissionPaymentLink,
  resetCommissionDebtsMock,
} from './commission-payment.api';
import { mockAddCashCommissionDebt } from './commission-payment.mock';
import { CommissionDebtCard } from './components/CommissionDebtCard';
import { VietQrPanel } from '../wallet/components/VietQrPanel';

export const CommissionPaymentPage: React.FC = () => {
  const [debts, setDebts] = useState<CommissionDebtDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active payment state
  const [payingDebt, setPayingDebt] = useState<CommissionDebtDto | null>(null);
  const [paymentLink, setPaymentLink] = useState<CommissionPaymentLinkDto | null>(null);
  const [loadingLink, setLoadingLink] = useState<boolean>(false);

  const loadDebts = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await getCommissionDebts();
      if (res.success && res.data) {
        setDebts(res.data);
      } else {
        setPageError(res.error?.message || 'Không thể tải danh sách hoa hồng ca tiền mặt.');
      }
    } catch {
      setPageError('Lỗi kết nối khi tải danh sách nộp hoa hồng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  // Handle open VietQR for a debt
  const handleOpenPay = async (debt: CommissionDebtDto) => {
    setLoadingLink(true);
    setPayingDebt(debt);
    setSuccessMessage(null);
    try {
      const res = await getCommissionPaymentLink(debt.bookingId);
      if (res.success && res.data) {
        setPaymentLink(res.data);
      } else {
        setPageError(res.error?.message || 'Không thể tạo mã VietQR cho ca này.');
        setPayingDebt(null);
      }
    } catch {
      setPageError('Lỗi kết nối khi lấy thông tin VietQR.');
      setPayingDebt(null);
    } finally {
      setLoadingLink(false);
    }
  };

  // Payment succeeded
  const handlePaymentSuccess = async () => {
    const paidAmount = payingDebt ? payingDebt.commissionAmount : 0;
    const bookingCode = payingDebt ? payingDebt.bookingCode : '';

    setPaymentLink(null);
    setPayingDebt(null);
    setSuccessMessage(
      `Đã xác nhận nộp ${formatVND(paidAmount)} hoa hồng cho ca ${bookingCode} thành công!`
    );

    await loadDebts();
  };

  // Manual confirmation in demo/mock
  const handleManualConfirm = async () => {
    if (!payingDebt) return;
    await confirmCommissionPayment(payingDebt.bookingId);
  };

  // Poll status handler
  const handlePollStatus = async (): Promise<boolean> => {
    if (!payingDebt) return false;
    const res = await getCommissionDebts();
    if (res.success && res.data) {
      const found = res.data.find(
        (d) => d.bookingId === payingDebt.bookingId || d.bookingCode === payingDebt.bookingCode
      );
      if (found && found.status === 'PAID') {
        return true;
      }
    }
    return false;
  };

  // Quick Mock Actions for testing
  const handleResetDefault = async () => {
    await resetCommissionDebtsMock();
    setSuccessMessage('Đã khôi phục dữ liệu mẫu: 1 quá hạn + 1 chưa nộp + 1 đã nộp.');
    await loadDebts();
  };

  const handleClearAll = async () => {
    await clearCommissionDebtsMock();
    setSuccessMessage('Đã xóa tất cả khoản nợ — kiểm thử trạng thái trống.');
    await loadDebts();
  };

  const handlePayOverdueQuick = async () => {
    const overdue = debts.find((d) => d.status === 'OVERDUE');
    if (!overdue) return;
    await confirmCommissionPayment(overdue.bookingId);
    setSuccessMessage(`Đã xác nhận nộp ${formatVND(overdue.commissionAmount)} (gỡ khóa tài khoản).`);
    await loadDebts();
  };

  const handleAddCashShift = async () => {
    mockAddCashCommissionDebt({
      bookingId: `bk-cash-${Date.now().toString().slice(-4)}`,
      bookingCode: `HC-2026-${Math.floor(1060 + Math.random() * 40)}`,
      serviceName: 'Chăm sóc người bệnh sau phẫu thuật tại nhà (4 giờ)',
      totalAmount: 500000,
    });
    setSuccessMessage('Đã thêm 1 ca tiền mặt mới: 500.000đ → hoa hồng 75.000đ (24h).');
    await loadDebts();
  };

  // Calculations
  const overdueDebts = debts.filter((d) => d.status === 'OVERDUE');
  const unpaidDebts = debts.filter((d) => d.status === 'UNPAID');
  const paidDebts = debts.filter((d) => d.status === 'PAID');

  const totalOwed = [...overdueDebts, ...unpaidDebts].reduce(
    (acc, cur) => acc + cur.commissionAmount,
    0
  );

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '16px 20px 48px' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/wallet"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '14.5px',
            fontWeight: 700,
            color: 'var(--brand-jade, #166B58)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          <span>Quay lại ví &amp; thu nhập</span>
        </Link>
      </div>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 900,
                color: '#166B58',
                background: '#E6F4F0',
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              MÀN HÌNH N11
            </span>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)' }}>
              Quy chuẩn FR-PAY-01 &amp; FR-PAY-02
            </span>
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 900,
              color: 'var(--navy, #0F172A)',
              margin: '6px 0 0',
            }}
          >
            Nộp hoa hồng ca tiền mặt
          </h1>
          <p
            style={{
              fontSize: '15.5px',
              color: 'var(--text-secondary, #64748B)',
              margin: '6px 0 0',
            }}
          >
            Ca thanh toán tiền mặt trực tiếp: điều dưỡng nhận 100% từ khách và tự nộp 15% hoa hồng nền tảng trong 24 giờ.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadDebts}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            fontSize: '15px',
            fontWeight: 700,
            borderRadius: 12,
          }}
        >
          <RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden="true" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Thanh Demo Mock Tool (khi bật USE_MOCK_WALLET) */}
      {USE_MOCK_WALLET && (
        <div
          style={{
            padding: '12px 18px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 14,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: '14px',
          }}
        >
          <div style={{ color: '#166534', fontWeight: 800 }}>
            🧪 <b>Thử nghiệm kịch bản nộp hoa hồng (W03):</b>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetDefault}
              style={{ padding: '4px 10px', fontSize: '13px', borderRadius: 8 }}
            >
              1. 3 khoản mẫu (1 quá hạn)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePayOverdueQuick}
              disabled={overdueDebts.length === 0}
              style={{
                padding: '4px 10px',
                fontSize: '13px',
                borderRadius: 8,
                borderColor: '#DC2626',
                color: '#DC2626',
              }}
            >
              2. Nộp nhanh ca quá hạn (Gỡ khóa)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAddCashShift}
              style={{ padding: '4px 10px', fontSize: '13px', borderRadius: 8 }}
            >
              3. Thêm ca tiền mặt 500k
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClearAll}
              style={{ padding: '4px 10px', fontSize: '13px', borderRadius: 8 }}
            >
              4. Xóa hết nợ (Trạng thái trống)
            </button>
          </div>
        </div>
      )}

      {/* Thông báo thành công */}
      {successMessage && (
        <div
          className="card"
          style={{
            padding: '14px 18px',
            background: '#F0FDF4',
            borderColor: '#BBF7D0',
            color: '#166534',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '15px',
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={20} color="#16A34A" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Lỗi tải trang nếu có */}
      {pageError && (
        <div
          className="card"
          style={{
            padding: '16px 20px',
            background: '#FEF2F2',
            borderColor: '#FECACA',
            color: '#DC2626',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={22} />
            <span style={{ fontWeight: 700 }}>{pageError}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={loadDebts}
            style={{ padding: '6px 14px', fontSize: '13.5px' }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Banner cảnh báo khóa tài khoản nếu có khoản quá hạn */}
      {overdueDebts.length > 0 && (
        <div
          role="alert"
          style={{
            padding: '16px 20px',
            background: '#FEF2F2',
            border: '2px solid #DC2626',
            borderRadius: 14,
            marginBottom: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.12)',
          }}
        >
          <ShieldAlert size={28} color="#DC2626" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h4
              style={{
                fontSize: '16.5px',
                fontWeight: 900,
                color: '#991B1B',
                margin: '0 0 3px',
              }}
            >
              Tài khoản đang bị tạm khóa nhận ca mới!
            </h4>
            <p style={{ fontSize: '14.5px', color: '#B91C1C', margin: 0 }}>
              Bạn có <b>{overdueDebts.length} khoản hoa hồng</b> đã quá hạn 24 giờ kể từ thời điểm kết thúc ca.
              Vui lòng chuyển khoản hoa hồng qua VietQR bên dưới để hệ thống tự động gỡ khóa.
            </p>
          </div>
        </div>
      )}

      {/* Box Nguyên tắc & Pháp lý (Elder-friendly, độ tương phản cao) */}
      <div
        className="card"
        style={{
          padding: '18px 22px',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Info size={19} color="var(--brand-jade, #166B58)" />
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 800,
              color: 'var(--navy, #0F172A)',
              margin: 0,
            }}
          >
            Nguyên tắc minh bạch hoa hồng ca tiền mặt (BR-05 &amp; FR-PAY-01/02)
          </h3>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 22,
            fontSize: '14.5px',
            color: 'var(--text-secondary, #475569)',
            lineHeight: 1.6,
          }}
        >
          <li>
            <b>Hoa hồng 15% tính trên giá niêm yết trong app:</b> Mọi khoản tiền tip/bồi dưỡng khách cho thêm ngoài giá thỏa thuận thuộc về điều dưỡng, <b>không tính hoa hồng</b>.
          </li>
          <li>
            <b>Tuyệt đối không trừ vào tiền ký quỹ:</b> Hoa hồng ca tiền mặt phải được tự nộp qua VietQR, hệ thống <b>không bao giờ</b> trích trừ từ số dư ký quỹ 300.000đ hay ví khả dụng.
          </li>
          <li>
            <b>Thời hạn nộp 24 giờ:</b> Đếm ngược tính từ lúc điều dưỡng bấm check-out. Quá 24 giờ, hệ thống tự động tạm khóa nhận ca mới cho tới khi nộp đủ.
          </li>
        </ul>
      </div>

      {/* 3 Thẻ thống kê nhanh */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Thẻ 1: Tổng nợ cần nộp */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderRadius: 14,
            background: totalOwed > 0 ? '#FFFBEB' : '#F8FAFC',
            border: totalOwed > 0 ? '1px solid #FDE68A' : '1px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#92400E' }}>
            Tổng hoa hồng cần nộp
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: totalOwed > 0 ? '#B45309' : 'var(--navy, #0F172A)',
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatVND(totalOwed)}
          </div>
          <div style={{ fontSize: '12.5px', color: '#B45309', marginTop: 4 }}>
            {overdueDebts.length + unpaidDebts.length} ca chờ thanh toán
          </div>
        </div>

        {/* Thẻ 2: Khoản quá hạn */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderRadius: 14,
            background: overdueDebts.length > 0 ? '#FEF2F2' : '#F8FAFC',
            border: overdueDebts.length > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0',
          }}
        >
          <div
            style={{
              fontSize: '13.5px',
              fontWeight: 600,
              color: overdueDebts.length > 0 ? '#991B1B' : 'var(--text-secondary, #64748B)',
            }}
          >
            Khoản quá hạn (&gt; 24h)
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: overdueDebts.length > 0 ? '#DC2626' : 'var(--navy, #0F172A)',
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {overdueDebts.length} ca
          </div>
          <div
            style={{
              fontSize: '12.5px',
              color: overdueDebts.length > 0 ? '#DC2626' : 'var(--text-secondary, #64748B)',
              marginTop: 4,
            }}
          >
            {overdueDebts.length > 0 ? 'Gây khóa nhận ca' : 'Không có khoản quá hạn'}
          </div>
        </div>

        {/* Thẻ 3: Đã hoàn tất nộp */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderRadius: 14,
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
          }}
        >
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#166534' }}>
            Đã nộp thành công
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: '#15803D',
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {paidDebts.length} ca
          </div>
          <div style={{ fontSize: '12.5px', color: '#166534', marginTop: 4 }}>
            Đã quyết toán &amp; tích lũy TrustScore
          </div>
        </div>
      </div>

      {/* Modal/Panel VietQR khi bấm Nộp */}
      {paymentLink && payingDebt && (
        <div style={{ marginBottom: 26 }}>
          <VietQrPanel
            paymentLink={{
              amount: paymentLink.amount || payingDebt.commissionAmount,
              transferContent: paymentLink.transferContent,
              bankName: paymentLink.bankName || 'Ngân hàng TMCP Quân Đội (MB Bank)',
              accountNumber: paymentLink.accountNumber || '0388998899',
              expiresAt: paymentLink.dueTime || payingDebt.dueAt,
              qrImageUrl: paymentLink.qrCode,
            }}
            title={`Mã VietQR nộp hoa hồng · Ca ${payingDebt.bookingCode}`}
            successTitle="Nộp hoa hồng thành công!"
            successMessage={`Hệ thống đã nhận ${formatVND(
              payingDebt.commissionAmount
            )} và gạch nợ hoa hồng cho ca ${payingDebt.bookingCode}.`}
            onSuccess={handlePaymentSuccess}
            onClose={() => {
              setPaymentLink(null);
              setPayingDebt(null);
            }}
            onRecreate={() => handleOpenPay(payingDebt)}
            onPollStatus={handlePollStatus}
            onManualConfirm={handleManualConfirm}
          />
        </div>
      )}

      {/* Danh sách các khoản nợ hoa hồng */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: '19px',
              fontWeight: 900,
              color: 'var(--navy, #0F172A)',
              margin: 0,
            }}
          >
            Danh sách khoản nộp ({debts.length})
          </h2>
          <span style={{ fontSize: '13.5px', color: 'var(--text-secondary, #64748B)' }}>
            Sắp xếp: Quá hạn → Sắp hết hạn → Đã hoàn tất
          </span>
        </div>

        {debts.length === 0 ? (
          /* Trạng thái trống (Test #5) */
          <div
            className="card"
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              borderRadius: 16,
              background: '#ffffff',
              border: '1px dashed #CBD5E1',
            }}
          >
            <CheckCircle2 size={54} color="#16A34A" style={{ margin: '0 auto 16px' }} />
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: 'var(--navy, #0F172A)',
                margin: '0 0 8px',
              }}
            >
              Không có khoản hoa hồng nào cần nộp!
            </h3>
            <p
              style={{
                fontSize: '15.5px',
                color: 'var(--text-secondary, #64748B)',
                maxWidth: 520,
                margin: '0 auto 20px',
                lineHeight: 1.5,
              }}
            >
              Bạn đã hoàn thành mọi nghĩa vụ hoa hồng ca tiền mặt. Tài khoản đang ở trạng thái tốt và sẵn sàng nhận mọi ca mới trên hệ thống.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <Link to="/jobs" className="btn btn-primary" style={{ padding: '10px 22px' }}>
                <span>Xem ca trực mới</span>
              </Link>
              <Link to="/wallet" className="btn btn-secondary" style={{ padding: '10px 22px' }}>
                <span>Về ví chính</span>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {debts.map((debt) => (
              <CommissionDebtCard
                key={debt.bookingId}
                debt={debt}
                onPay={handleOpenPay}
                isPaying={loadingLink && payingDebt?.bookingId === debt.bookingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
