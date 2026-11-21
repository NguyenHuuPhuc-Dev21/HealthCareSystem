import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import {
  DEFAULT_DEPOSIT_REFUND_HOLD_DAYS,
  DEFAULT_DEPOSIT_REFUND_SLA_WORKING_DAYS,
  DEFAULT_PENALTY_APPEAL_DAYS,
} from '@healthcare-system/shared';
import type {
  BankAccountDto,
  DepositPenaltyDto,
  DepositRefundRequestDto,
  DepositStatusDto,
  DepositTopupLinkDto,
} from '@healthcare-system/shared';
import { formatVND } from '../../lib/formatters';
import { USE_MOCK_WALLET } from '../../lib/mock-flags';
import {
  appealPenalty,
  cancelRefundRequest,
  createDepositTopupLink,
  getDepositPenalties,
  getDepositStatus,
  getRefundRequest,
  requestAccountClosure,
} from './deposit.api';
import { mockSetDepositScenario, type MockDepositScenario } from './deposit.mock';
import { getBankAccount } from './wallet.api';
import { DepositSummaryCard } from './components/DepositSummaryCard';
import { GraceProgressCard } from './components/GraceProgressCard';
import { VietQrPanel } from './components/VietQrPanel';
import { PenaltyList } from './components/PenaltyList';
import { AccountClosureSection } from './components/AccountClosureSection';

export const DepositPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState<(DepositStatusDto & { totalWithheld?: number }) | null>(null);
  const [penalties, setPenalties] = useState<DepositPenaltyDto[]>([]);
  const [refundRequest, setRefundRequest] = useState<DepositRefundRequestDto | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccountDto | null>(null);

  // Topup state
  const [activeTopupLink, setActiveTopupLink] = useState<DepositTopupLinkDto | null>(null);
  const [creatingTopup, setCreatingTopup] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [stRes, penRes, refRes, bankRes] = await Promise.all([
        getDepositStatus(),
        getDepositPenalties(),
        getRefundRequest(),
        getBankAccount(),
      ]);

      if (stRes.success && stRes.data) {
        setStatus(stRes.data);
      } else {
        setPageError(stRes.error?.message || 'Không thể tải thông tin ký quỹ');
      }

      if (penRes.success && penRes.data) {
        setPenalties(penRes.data);
      }

      if (refRes.success) {
        setRefundRequest(refRes.data);
      }

      if (bankRes.success) {
        setBankAccount(bankRes.data);
      }
    } catch {
      setPageError('Lỗi kết nối khi tải dữ liệu ký quỹ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, searchParams]);

  // Tạo mã nạp VietQR
  const handleTopupClick = async (amount: number) => {
    setCreatingTopup(true);
    setSuccessNotice(null);
    try {
      const res = await createDepositTopupLink(amount);
      if (res.success && res.data) {
        setActiveTopupLink(res.data);
      } else {
        alert(res.error?.message || 'Không thể tạo mã nạp');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi tạo mã nạp');
    } finally {
      setCreatingTopup(false);
    }
  };

  // Nạp thành công từ VietQrPanel
  const handleTopupSuccess = async () => {
    setActiveTopupLink(null);
    setSuccessNotice('Nạp ký quỹ thành công! Số dư đã được cập nhật.');
    await loadData();
  };

  // Gửi khiếu nại khoản phạt
  const handleAppealSubmit = async (txId: string, reason: string, evidenceKeys?: string[]) => {
    const res = await appealPenalty(txId, { reason, evidenceKeys });
    if (res.success) {
      setSuccessNotice('Đã gửi khiếu nại thành công đến Admin.');
      await loadData();
    } else {
      throw new Error(res.error?.message || 'Không thể gửi khiếu nại');
    }
  };

  // Ngừng hợp tác
  const handleRequestClosure = async () => {
    const res = await requestAccountClosure();
    if (res.success && res.data) {
      setRefundRequest(res.data);
      setSuccessNotice('Đã gửi yêu cầu ngừng hợp tác. Hệ thống đang theo dõi các điều kiện hoàn ký quỹ.');
      await loadData();
    } else {
      throw new Error(res.error?.message || 'Lỗi gửi yêu cầu ngừng hợp tác');
    }
  };

  // Hủy yêu cầu ngừng hợp tác
  const handleCancelRefundRequest = async (id: string) => {
    const res = await cancelRefundRequest(id);
    if (res.success) {
      setRefundRequest(null);
      setSuccessNotice('Đã hủy yêu cầu ngừng hợp tác. Bạn có thể tiếp tục nhận ca.');
      await loadData();
    } else {
      throw new Error(res.error?.message || 'Lỗi hủy yêu cầu hoàn tiền');
    }
  };

  // Đổi mock scenario qua button test
  const handleSelectScenario = (sc: MockDepositScenario) => {
    mockSetDepositScenario(sc);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mockDeposit', sc);
    setSearchParams(newParams);
    setActiveTopupLink(null);
    loadData();
  };

  return (
    <div className="screen-body elder">
      <div className="page" style={{ maxWidth: 960 }}>
        {/* Page Head & Back link */}
        <div className="page-head" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ marginBottom: 8 }}>
              <Link
                to="/wallet"
                className="btn btn-secondary btn-sm"
                style={{
                  minHeight: 40,
                  padding: '6px 14px',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  borderRadius: 10,
                }}
              >
                <ArrowLeft size={16} />
                <span>Quay lại ví</span>
              </Link>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--navy, #0F172A)', margin: 0 }}>
              Ký quỹ điều dưỡng &amp; Quyền lợi
            </h1>
            <p style={{ fontSize: '15.5px', color: 'var(--text-secondary, #64748B)', margin: '6px 0 0' }}>
              Quy chuẩn ký quỹ 300.000đ theo ADR-0004 · Lưu ký độc lập · Giai đoạn ân hạn · Hoàn tiền minh bạch
            </p>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadData}
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
        </div>

        {/* Thanh test chọn 4 kịch bản mock */}
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
            <div style={{ color: '#166534', fontWeight: 700 }}>
              🧪 <b>Chọn kịch bản ký quỹ để kiểm thử (W02):</b>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSelectScenario('full')}
                style={{ padding: '4px 10px', fontSize: '13px', borderRadius: 8 }}
              >
                1. Đủ 300k (Full)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSelectScenario('grace')}
                style={{
                  padding: '4px 10px',
                  fontSize: '13px',
                  borderRadius: 8,
                  borderColor: '#0284C7',
                  color: '#0369A1',
                }}
              >
                2. Ân hạn 1/3 ca (Grace)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSelectScenario('expired')}
                style={{
                  padding: '4px 10px',
                  fontSize: '13px',
                  borderRadius: 8,
                  borderColor: '#F59E0B',
                  color: '#B45309',
                }}
              >
                3. Hết ân hạn thiếu 45k (Expired)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSelectScenario('closing')}
                style={{
                  padding: '4px 10px',
                  fontSize: '13px',
                  borderRadius: 8,
                  borderColor: '#DC2626',
                  color: '#DC2626',
                }}
              >
                4. Chờ hoàn tiền (Closing)
              </button>
            </div>
          </div>
        )}

        {/* Thông báo thành công */}
        {successNotice && (
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
            <span>{successNotice}</span>
          </div>
        )}

        {/* Lỗi nếu có */}
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
              onClick={loadData}
              style={{ padding: '6px 14px', fontSize: '13.5px' }}
            >
              Thử lại
            </button>
          </div>
        )}

        {status && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Khối 1: Tóm tắt ký quỹ & Nạp thêm */}
            <DepositSummaryCard
              status={status}
              onTopupClick={handleTopupClick}
              creatingTopup={creatingTopup}
            />

            {/* Khối 2: Panel VietQR (khi đang nạp) */}
            {activeTopupLink && (
              <VietQrPanel
                topupLink={activeTopupLink}
                onSuccess={handleTopupSuccess}
                onClose={() => setActiveTopupLink(null)}
                onRecreate={() => handleTopupClick(activeTopupLink.amount)}
              />
            )}

            {/* Khối 3: Giai đoạn ân hạn (Grace Period) */}
            <GraceProgressCard status={status} />

            {/* Khối 4: Lịch sử khoản trừ & Khiếu nại */}
            <PenaltyList penalties={penalties} onAppealSubmit={handleAppealSubmit} />

            {/* Khối 5: Ngừng hợp tác & Hoàn ký quỹ */}
            <AccountClosureSection
              refundRequest={refundRequest}
              depositBalance={status.depositBalance}
              bankAccount={bankAccount}
              onRequestClosure={handleRequestClosure}
              onCancelRequest={handleCancelRefundRequest}
            />

            {/* Khối 6: Quy tắc ký quỹ chuẩn hóa (ADR-0004) */}
            <div
              className="card"
              style={{
                padding: '22px 24px',
                background: 'var(--surface-subtle, #F8FAFC)',
                border: '1px solid var(--border-hairline, #E2E8F0)',
                borderRadius: 14,
              }}
            >
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: 'var(--navy, #0F172A)',
                  margin: '0 0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <HelpCircle size={18} color="var(--brand-jade, #166B58)" />
                <span>Quy tắc vận hành ký quỹ theo chuẩn ADR-0004</span>
              </h4>

              <ul
                style={{
                  margin: 0,
                  paddingLeft: 22,
                  fontSize: '14.5px',
                  color: 'var(--text-secondary, #64748B)',
                  lineHeight: 1.6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <li>
                  <b>Mục đích độc quyền:</b> Tiền ký quỹ ({formatVND(status.minDeposit)}) chỉ dùng để trừ phạt vi phạm
                  cam kết dịch vụ (SLA) như hủy ca gấp hoặc không đến ca. <i>Tuyệt đối không trừ hoa hồng ca tiền mặt.</i>
                </li>
                <li>
                  <b>Bảo đảm lưu ký:</b> Tiền ký quỹ được chuyển vào tài khoản lưu ký riêng biệt tại {status.custodyPartnerName || 'Ngân hàng đối tác'}, nền tảng không tự giữ tiền của điều dưỡng.
                </li>
                <li>
                  <b>Minh bạch trừ phạt:</b> Mọi khoản trừ đều có mã ca, căn cứ điều khoản SLA cụ thể và được bảo lưu{' '}
                  <b>{DEFAULT_PENALTY_APPEAL_DAYS} ngày làm việc</b> để điều dưỡng khiếu nại nếu có lý do chính đáng.
                </li>
                <li>
                  <b>Hoàn ký quỹ khi ngừng hợp tác:</b> Điều dưỡng được hoàn lại 100% số dư ký quỹ sau{' '}
                  <b>{DEFAULT_DEPOSIT_REFUND_HOLD_DAYS} ngày</b> không phát sinh khiếu nại kể từ ca trực cuối, với thời
                  gian chi trả trong vòng <b>{DEFAULT_DEPOSIT_REFUND_SLA_WORKING_DAYS} ngày làm việc</b>.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
