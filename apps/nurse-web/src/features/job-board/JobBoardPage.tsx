import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ShieldCheck,
  UserCheck,
  Zap,
  Wallet,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { JobItem, DirectInvitation, RadarJob, JobBoardFilter } from './job-board.types';
import {
  getJobBoard,
  getDirectInvitation,
  getRadarJob,
  acceptJob,
  acceptDirectInvite,
  declineDirectInvite,
  acceptRadarJob,
  dismissRadarJob,
} from './job-board.api';
import { JobCard } from './components/JobCard';
import { DirectInviteCard } from './components/DirectInviteCard';
import { RadarModal } from './components/RadarModal';
import { JobDetailModal } from './components/JobDetailModal';
import { useAuth } from '../auth/AuthContext';
import { DEFAULT_MIN_NURSE_DEPOSIT_VND } from '@healthcare-system/shared';

export const JobBoardPage: React.FC = () => {
  const { session } = useAuth();
  const initialDeposit = (session?.profile as any)?.deposit_balance ?? DEFAULT_MIN_NURSE_DEPOSIT_VND;
  const initialTier: 1 | 2 = session?.profile?.tier === 'TIER_1_BASIC' ? 1 : 2;

  const [filter, setFilter] = useState<JobBoardFilter>('all');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<JobItem | null>(null);
  const [directInvite, setDirectInvite] = useState<DirectInvitation | null>(null);
  const [radarJob, setRadarJob] = useState<RadarJob | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(initialDeposit);
  const [userTier, setUserTier] = useState<1 | 2>(initialTier);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [sandboxOpen, setSandboxOpen] = useState<boolean>(false);

  const tierCode = userTier === 2 ? 'TIER_2_SPECIALIST' : 'TIER_1_BASIC';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [boardRes, inviteRes] = await Promise.all([
        getJobBoard(),
        getDirectInvitation(),
      ]);

      if (boardRes.success) {
        let list = boardRes.data.map((job) => ({
          ...job,
          isLockedForTier1: userTier === 1 && job.isInvasive,
        }));

        if (filter === 'shift') {
          list = list.filter((j) => j.serviceType === 'shift');
        } else if (filter === 'task') {
          list = list.filter((j) => j.serviceType === 'procedure');
        } else if (filter === 'near') {
          list = list.filter((j) => j.distanceKm <= 3);
        } else if (filter === 'bonus') {
          list = list.filter((j) => (j.urgentBonus ?? 0) > 0);
        }

        setJobs(list);
      }

      setDirectInvite(inviteRes.data ?? null);
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Không thể tải danh sách việc làm. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  }, [filter, userTier]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleAcceptJob = async (jobId: string) => {
    setIsProcessing(true);
    const result = await acceptJob(jobId, tierCode, depositAmount);
    setIsProcessing(false);
    if (result.success) {
      showToast('success', result.message ?? 'Đã nhận ca thành công!');
      await loadData();
    } else {
      showToast('error', result.message ?? 'Không thể nhận ca. Vui lòng thử lại.');
    }
  };

  const handleAcceptDirectInvite = async (bookingId: string) => {
    setIsProcessing(true);
    const result = await acceptDirectInvite(bookingId, tierCode, depositAmount);
    setIsProcessing(false);
    if (result.success) {
      showToast('success', result.message ?? 'Đã chấp nhận lời mời thành công!');
      setDirectInvite(null);
      await loadData();
    } else {
      showToast('error', result.message ?? 'Không thể chấp nhận lời mời.');
    }
  };

  const handleDeclineDirectInvite = async (bookingId: string) => {
    setIsProcessing(true);
    const result = await declineDirectInvite(bookingId);
    setIsProcessing(false);
    if (result.success) {
      showToast('success', 'Đã từ chối lời mời trực tiếp.');
      setDirectInvite(null);
    } else {
      showToast('error', 'Không thể từ chối lời mời lúc này.');
    }
  };

  const handleTriggerRadar = async () => {
    const res = await getRadarJob();
    if (res.success && res.data) {
      setRadarJob(res.data);
      setSandboxOpen(false);
    } else {
      showToast('error', 'Hiện không có ca phát sóng khẩn cấp nào.');
    }
  };

  const handleAcceptRadar = async (jobId: string) => {
    setIsProcessing(true);
    const result = await acceptRadarJob(jobId, tierCode, depositAmount);
    setIsProcessing(false);
    setRadarJob(null);
    if (result.success) {
      showToast('success', result.message ?? 'Đã nhận ca khẩn cấp thành công!');
      await loadData();
    } else {
      showToast('error', result.message ?? 'Không thể nhận ca.');
    }
  };

  const handleDismissRadar = async () => {
    await dismissRadarJob();
    setRadarJob(null);
    showToast('success', 'Đã bỏ qua ca khẩn cấp. Ca sẽ chuyển tới điều dưỡng khác.');
  };

  const isDepositSufficient = depositAmount >= DEFAULT_MIN_NURSE_DEPOSIT_VND;

  return (
    <div>
      {/* Page Header thuần khiết cho Điều dưỡng */}
      <div className="page-head">
        <div>
          <h1>Bảng việc làm</h1>
          <p>Các ca chăm sóc đang tìm điều dưỡng, lọc theo cấp bậc chuyên môn và lịch rảnh của bạn.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="status-pill status-pill--jade">
            {userTier === 2 ? 'Chuyên môn Cấp 2' : 'Chăm sóc Cấp 1'}
          </span>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 12,
            background: feedbackMessage.type === 'success' ? 'var(--brand-jade-soft)' : 'var(--alert-crimson-soft)',
            color: feedbackMessage.type === 'success' ? 'var(--brand-jade)' : 'var(--alert-crimson)',
            border: `1px solid ${feedbackMessage.type === 'success' ? '#A7D7C5' : '#FECACA'}`,
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {feedbackMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Cảnh báo thiếu ký quỹ (Ngôn ngữ tự nhiên, bỏ mã kỹ thuật) */}
      {!isDepositSufficient && (
        <div
          className="ledger-panel"
          style={{
            background: 'var(--accent-ochre-soft)',
            borderColor: '#FCD34D',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertTriangle size={22} color="var(--accent-ochre)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--ink-primary)', fontSize: 16.5 }}>
                Số dư ký quỹ hiện tại: <span className="tabular-nums">{depositAmount.toLocaleString('vi-VN')} đ</span>
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--ink-secondary)' }}>
                Bạn cần duy trì ký quỹ tối thiểu <span className="tabular-nums">{DEFAULT_MIN_NURSE_DEPOSIT_VND.toLocaleString('vi-VN')} đ</span> để nhận ca chăm sóc mới.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setDepositAmount(DEFAULT_MIN_NURSE_DEPOSIT_VND);
              showToast(
                'success',
                `Đã bổ sung ký quỹ thành công. Số dư hiện tại: ${DEFAULT_MIN_NURSE_DEPOSIT_VND.toLocaleString('vi-VN')} đ`
              );
            }}
          >
            Bổ sung ký quỹ ngay
          </button>
        </div>
      )}

      {/* Lời mời trực tiếp từ gia đình */}
      {directInvite && (
        <DirectInviteCard
          invite={directInvite}
          onAccept={handleAcceptDirectInvite}
          onDecline={handleDeclineDirectInvite}
          isProcessing={isProcessing}
        />
      )}

      {/* Thanh bộ lọc gọn gàng */}
      <div className="toolbar" style={{ borderTop: 0, paddingTop: 0 }}>
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          <Filter size={15} />
          Tất cả
        </button>
        <button type="button" className={filter === 'shift' ? 'active' : ''} onClick={() => setFilter('shift')}>
          Theo ca dài
        </button>
        <button type="button" className={filter === 'task' ? 'active' : ''} onClick={() => setFilter('task')}>
          Thủ thuật lẻ
        </button>
        <button type="button" className={filter === 'near' ? 'active' : ''} onClick={() => setFilter('near')}>
          Gần khu vực (≤ 3 km)
        </button>
        <button type="button" className={filter === 'bonus' ? 'active' : ''} onClick={() => setFilter('bonus')}>
          <Zap size={14} />
          Có thưởng thêm
        </button>
      </div>

      {/* Danh sách ca */}
      {loading ? (
        <div className="ledger-panel" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-secondary)' }}>
          Đang tải danh sách việc làm phù hợp...
        </div>
      ) : jobs.length === 0 ? (
        <div className="ledger-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p className="prose-limit" style={{ fontSize: 17, color: 'var(--ink-secondary)', margin: '0 auto' }}>
            Hiện chưa có ca nào khớp bộ lọc trong bán kính 10 km. Hãy thử mở rộng lịch rảnh hoặc chuyển sang bộ lọc Tất cả.
          </p>
        </div>
      ) : (
        <div>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onAccept={handleAcceptJob}
              onViewDetails={(j) => setSelectedJobForDetail(j)}
              isAccepting={isProcessing}
            />
          ))}
        </div>
      )}

      {/* Ghi chú quy chế chuyên môn gọn nhẹ */}
      <div className="ledger-panel" style={{ marginTop: 28, background: 'var(--surface-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--ink-primary)', marginBottom: 8 }}>
          <ShieldCheck size={18} color="var(--brand-jade)" />
          <span>Phân quyền chuyên môn theo Giấy phép hành nghề</span>
        </div>
        <p className="prose-limit" style={{ margin: 0, fontSize: 15, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
          Điều dưỡng Cấp 2 (đã xác thực GPHN) nhận được cả ca chăm sóc cơ bản và thủ thuật xâm lấn có y lệnh. Điều dưỡng Cấp 1 tập trung vào nhóm chăm sóc sinh hoạt và theo dõi sinh hiệu cơ bản để bảo đảm an toàn người bệnh.
        </p>
      </div>

      {/* Job Detail Modal */}
      {selectedJobForDetail && (
        <JobDetailModal
          job={selectedJobForDetail}
          onClose={() => setSelectedJobForDetail(null)}
          onAccept={handleAcceptJob}
          isAccepting={isProcessing}
        />
      )}

      {/* Radar Modal Popup */}
      {radarJob && (
        <RadarModal
          radarJob={radarJob}
          onAccept={handleAcceptRadar}
          onDismiss={handleDismissRadar}
          isProcessing={isProcessing}
        />
      )}

      {/* Thanh công cụ kiểm thử thu gọn ở góc màn hình (không làm nhiễu UI thật) */}
      <div className="dev-sandbox-dock">
        {sandboxOpen && (
          <div className="dev-sandbox-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 14, color: 'var(--ink-primary)' }}>Công cụ mô phỏng kiểm thử</strong>
              <button
                type="button"
                className="btn-close-sm"
                onClick={() => setSandboxOpen(false)}
                aria-label="Đóng công cụ mô phỏng"
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', fontSize: 13.5 }}
                onClick={() => setUserTier(userTier === 2 ? 1 : 2)}
              >
                <UserCheck size={15} />
                Đổi góc nhìn: {userTier === 2 ? 'Cấp 2 (Đang bật)' : 'Cấp 1 (Khóa xâm lấn)'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', fontSize: 13.5 }}
                onClick={() =>
                  setDepositAmount((prev) =>
                    prev >= DEFAULT_MIN_NURSE_DEPOSIT_VND
                      ? Math.round(DEFAULT_MIN_NURSE_DEPOSIT_VND / 2)
                      : DEFAULT_MIN_NURSE_DEPOSIT_VND
                  )
                }
              >
                <Wallet size={15} />
                Ký quỹ: {depositAmount >= DEFAULT_MIN_NURSE_DEPOSIT_VND ? 'Đủ chuẩn' : 'Giả lập thiếu'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ justifyContent: 'flex-start', fontSize: 13.5 }}
                onClick={handleTriggerRadar}
              >
                <Radio size={15} />
                Phát ca khẩn cấp qua Radar
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ borderRadius: 999, boxShadow: '0 6px 18px rgba(16, 42, 36, 0.14)' }}
          onClick={() => setSandboxOpen((v) => !v)}
        >
          <SlidersHorizontal size={15} />
          Mô phỏng kiểm thử
        </button>
      </div>
    </div>
  );
};

export default JobBoardPage;
