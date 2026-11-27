import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react';
import { TxStatus } from '@healthcare-system/shared';
import type { DepositTopupLinkDto } from '@healthcare-system/shared';
import { formatVND } from '../../../lib/formatters';
import { getTopupStatus } from '../deposit.api';

export interface GenericVietQrLink {
  id?: string;
  amount: number;
  qrImageUrl?: string;
  bankName: string;
  accountNumber: string;
  transferContent: string;
  expiresAt: string;
}

export interface VietQrPanelProps {
  topupLink?: DepositTopupLinkDto;
  paymentLink?: GenericVietQrLink;
  title?: string;
  successTitle?: string;
  successMessage?: string;
  onSuccess: () => void;
  onClose: () => void;
  onRecreate?: () => void;
  onPollStatus?: () => Promise<boolean>;
  onManualConfirm?: () => Promise<void>;
}

function formatCountdown(expiresAt: string): { text: string; isExpired: boolean } {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return { text: '00:00', isExpired: true };

  const totalSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return {
    text: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
    isExpired: false,
  };
}

export const VietQrPanel: React.FC<VietQrPanelProps> = ({
  topupLink,
  paymentLink,
  title,
  successTitle,
  successMessage,
  onSuccess,
  onClose,
  onRecreate,
  onPollStatus,
  onManualConfirm,
}) => {
  const data: GenericVietQrLink = paymentLink || {
    id: topupLink?.topupId,
    amount: topupLink?.amount || 0,
    qrImageUrl: topupLink?.qrImageUrl,
    bankName: topupLink?.bankName || 'Ngân hàng TMCP Quân Đội (MB Bank)',
    accountNumber: topupLink?.accountNumber || '0388998899',
    transferContent: topupLink?.transferContent || '',
    expiresAt: topupLink?.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ text: string; isExpired: boolean }>(() =>
    formatCountdown(data.expiresAt)
  );
  const [status, setStatus] = useState<TxStatus>(TxStatus.PENDING);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Copy helper
  const handleCopy = (field: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Timer đếm ngược
  useEffect(() => {
    const timer = setInterval(() => {
      const res = formatCountdown(data.expiresAt);
      setCountdown(res);
      if (res.isExpired) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [data.expiresAt]);

  // Polling trạng thái nạp mỗi 5 giây
  useEffect(() => {
    if (countdown.isExpired || status === TxStatus.COMPLETED || status === TxStatus.FAILED) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        if (onPollStatus) {
          const isDone = await onPollStatus();
          if (isDone) {
            setStatus(TxStatus.COMPLETED);
            clearInterval(interval);
            setTimeout(() => {
              onSuccess();
            }, 1200);
          }
        } else if (topupLink) {
          const res = await getTopupStatus(topupLink.topupId);
          if (res.success && res.data) {
            if (res.data.status === TxStatus.COMPLETED) {
              setStatus(TxStatus.COMPLETED);
              clearInterval(interval);
              setTimeout(() => {
                onSuccess();
              }, 1200);
            } else if (res.data.status === TxStatus.FAILED) {
              setStatus(TxStatus.FAILED);
              clearInterval(interval);
            }
          }
        }
      } catch {
        // ignore network jitter
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [topupLink, data.id, countdown.isExpired, status, onSuccess, onPollStatus]);

  const handleSimulatePayment = async () => {
    setIsConfirming(true);
    try {
      if (onManualConfirm) {
        await onManualConfirm();
      }
      setStatus(TxStatus.COMPLETED);
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } finally {
      setIsConfirming(false);
    }
  };


  return (
    <div
      className="card"
      style={{
        padding: '24px 26px',
        border: '2px solid var(--brand-jade, #166B58)',
        background: '#ffffff',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
        borderRadius: 16,
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          color: 'var(--text-secondary, #64748B)',
        }}
        aria-label="Đóng"
      >
        <X size={22} />
      </button>

      {/* Header Panel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <QrCode size={24} color="var(--brand-jade, #166B58)" />
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy, #0F172A)', margin: 0 }}>
          {title || (topupLink ? 'Mã VietQR nạp ký quỹ' : 'Mã VietQR nộp hoa hồng ca tiền mặt')}
        </h3>
        <span
          style={{
            marginLeft: 'auto',
            marginRight: 28,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: countdown.isExpired ? '#FEE2E2' : '#FEF3C7',
            color: countdown.isExpired ? '#DC2626' : '#92400E',
            fontSize: '13.5px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 8,
          }}
        >
          <Clock size={15} />
          {countdown.isExpired ? 'Đã hết hạn' : `Hết hạn sau: ${countdown.text}`}
        </span>
      </div>

      {/* Trạng thái thành công */}
      {status === TxStatus.COMPLETED ? (
        <div
          style={{
            padding: '30px 20px',
            textAlign: 'center',
            background: '#F0FDF4',
            borderRadius: 14,
            border: '1px solid #BBF7D0',
          }}
        >
          <CheckCircle2 size={48} color="#16A34A" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '19px', fontWeight: 900, color: '#166534', margin: '0 0 6px' }}>
            {successTitle || (topupLink ? 'Nạp ký quỹ thành công!' : 'Nộp hoa hồng thành công!')}
          </h4>
          <p style={{ fontSize: '15px', color: '#15803D', margin: 0 }}>
            {successMessage || (topupLink
              ? `Hệ thống đã nhận ${formatVND(data.amount)} và cập nhật số dư ký quỹ của bạn.`
              : `Hệ thống đã nhận ${formatVND(data.amount)} và gạch nợ hoa hồng cho ca.`)}
          </p>
        </div>
      ) : countdown.isExpired ? (
        <div
          style={{
            padding: '24px 20px',
            textAlign: 'center',
            background: '#FEF2F2',
            borderRadius: 14,
            border: '1px solid #FECACA',
          }}
        >
          <AlertCircle size={40} color="#DC2626" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '17.5px', fontWeight: 800, color: '#991B1B', margin: '0 0 6px' }}>
            Mã nạp VietQR đã hết hạn
          </h4>
          <p style={{ fontSize: '14.5px', color: '#B91C1C', margin: '0 0 16px' }}>
            Vui lòng không chuyển khoản vào mã này để tránh giao dịch bị treo.
          </p>
          {onRecreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRecreate}
              style={{ padding: '8px 20px', fontSize: '14.5px', borderRadius: 8 }}
            >
              <RefreshCw size={16} />
              <span>Tạo lại mã nạp</span>
            </button>
          )}
        </div>
      ) : (
        /* Nội dung mã QR và thông tin chuyển khoản */
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 24,
              alignItems: 'center',
            }}
          >
            {/* Cột QR Code (Elder-friendly, độ tương phản cao) */}
            <div style={{ textAlign: 'center' }}>
              {data.qrImageUrl ? (
                <img
                  src={data.qrImageUrl}
                  alt={`Mã QR chuyển khoản VietQR ${data.amount.toLocaleString('vi-VN')}đ`}
                  style={{
                    width: 196,
                    height: 196,
                    margin: '0 auto',
                    display: 'block',
                    borderRadius: 12,
                    border: '6px solid #ffffff',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    objectFit: 'contain',
                    background: '#ffffff',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 196,
                    height: 196,
                    margin: '0 auto',
                    borderRadius: 12,
                    border: '6px solid #ffffff',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    background:
                      'repeating-conic-gradient(#12211C 0% 25%, #ffffff 0% 50%) 0 0 / 24px 24px',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <span
                    style={{
                      background: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: '12px',
                      fontWeight: 800,
                      color: 'var(--navy, #0F172A)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                    }}
                  >
                    VietQR · CareNest
                  </span>
                </div>
              )}
              <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', marginTop: 8 }}>
                Quét bằng ứng dụng ngân hàng bất kỳ
              </div>
            </div>

            {/* Cột thông tin chuyển khoản */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Ngân hàng */}
              <div style={{ padding: '8px 12px', background: 'var(--surface-subtle, #F8FAFC)', borderRadius: 10 }}>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>
                  Ngân hàng thụ hưởng {topupLink ? '(Đối tác lưu ký)' : '(Tài khoản CareNest)'}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy, #0F172A)', marginTop: 2 }}>
                  {data.bankName}
                </div>
              </div>

              {/* Số tài khoản */}
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-subtle, #F8FAFC)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>
                    Số tài khoản
                  </div>
                  <div style={{ fontSize: '16.5px', fontWeight: 900, color: 'var(--navy, #0F172A)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                    {data.accountNumber}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleCopy('acc', data.accountNumber)}
                  style={{ padding: '6px 12px', fontSize: '13px', borderRadius: 6 }}
                >
                  {copiedField === 'acc' ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                  <span>{copiedField === 'acc' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>

              {/* Số tiền */}
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-subtle, #F8FAFC)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>
                    Số tiền nộp chính xác
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--brand-jade, #166B58)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                    {formatVND(data.amount)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleCopy('amt', String(data.amount))}
                  style={{ padding: '6px 12px', fontSize: '13px', borderRadius: 6 }}
                >
                  {copiedField === 'amt' ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                  <span>{copiedField === 'amt' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>

              {/* Nội dung chuyển khoản */}
              <div
                style={{
                  padding: '8px 12px',
                  background: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', color: '#92400E', fontWeight: 700 }}>
                    Nội dung chuyển khoản (Bắt buộc đúng)
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#78350F', marginTop: 2 }}>
                    {data.transferContent}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleCopy('content', data.transferContent)}
                  style={{ padding: '6px 12px', fontSize: '13px', borderRadius: 6, borderColor: '#F59E0B' }}
                >
                  {copiedField === 'content' ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                  <span>{copiedField === 'content' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Nút mô phỏng thanh toán (Test / Demo) */}
          {onManualConfirm && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                background: '#F8FAFC',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px dashed #CBD5E1',
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)' }}>
                ⚡ Kiểm thử: Bấm để giả lập ngân hàng xác nhận chuyển khoản ngay.
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSimulatePayment}
                disabled={isConfirming}
                style={{ padding: '6px 14px', fontSize: '13px', borderRadius: 6 }}
              >
                {isConfirming ? 'Đang xử lý...' : 'Xác nhận nộp ngay (Demo)'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
