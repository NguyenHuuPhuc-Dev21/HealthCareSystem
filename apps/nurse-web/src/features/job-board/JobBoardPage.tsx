import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ShieldCheck,
  UserCheck,
  Zap,
  Wallet,
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

export const JobBoardPage: React.FC = () => {
  const [filter, setFilter] = useState<JobBoardFilter>('all');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<JobItem | null>(null);
  const [directInvite, setDirectInvite] = useState<DirectInvitation | null>(null);
  const [radarJob, setRadarJob] = useState<RadarJob | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(300000);
  const [userTier, setUserTier] = useState<1 | 2>(2);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const tierCode = userTier === 2 ? 'TIER_2_SPECIALIST' : 'TIER_1_BASIC';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [boardRes, inviteRes] = await Promise.all([
        getJobBoard(),
        getDirectInvitation(),
      ]);

      if (boardRes.success) {
        let list = boardRes.data;
        // Compute tier-locked status
        list = list.map((job) => ({
          ...job,
          isLockedForTier1: userTier === 1 && job.isInvasive,
        }));

        // Apply tab filters
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
      showToast('success', result.message ?? 'Đã nhận ca Radar thành công!');
      await loadData();
    } else {
      showToast('error', result.message ?? 'Không thể nhận ca Radar.');
    }
  };

  const handleDismissRadar = async () => {
    await dismissRadarJob();
    setRadarJob(null);
    showToast('success', 'Đã bỏ qua ca Radar. Ca sẽ chuyển đến điều dưỡng tiếp theo.');
  };

  const isDepositSufficient = depositAmount >= 300000;

  return (
    <div className="screen-body elder">
      <div className="page">
        {/* Page Header */}
        <div className="page-head" style={{ marginBottom: 16 }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Briefcase size={30} color="var(--blue-dark)" />
              Bảng việc làm
            </h1>
            <p>Việc phù hợp với cấp bậc, chuyên môn và lịch rảnh của bạn</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Tier View Switcher for Testing N2 Specs */}
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              style={{ fontSize: 14, height: 40 }}
              onClick={() => setUserTier(userTier === 2 ? 1 : 2)}
              title="Chuyển đổi góc nhìn giữa Cấp 2 và Cấp 1"
            >
              <UserCheck size={16} style={{ marginRight: 6 }} />
              Góc nhìn: {userTier === 2 ? 'Cấp 2 (Hiện tại)' : 'Cấp 1 (Demo khóa xâm lấn)'}
            </button>

            {/* Deposit Balance Switcher for Testing BR-14 Shortfall */}
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              style={{ fontSize: 14, height: 40 }}
              onClick={() => setDepositAmount((prev) => (prev >= 300000 ? 150000 : 300000))}
              title="Chuyển đổi số dư ký quỹ để kiểm thử quy chế BR-14"
            >
              <Wallet size={16} style={{ marginRight: 6 }} />
              Ký quỹ: {depositAmount >= 300000 ? '300.000đ (Đủ)' : '150.000đ (Thiếu BR-14)'}
            </button>

            {/* Radar Simulation Trigger */}
            <button
              className="btn btn-primary btn-sm"
              type="button"
              style={{ fontSize: 14, height: 40, background: 'var(--teal)' }}
              onClick={handleTriggerRadar}
            >
              <Radio size={16} style={{ marginRight: 6 }} />
              Bật Radar N3 (Phát ca gần)
            </button>
          </div>
        </div>

        {/* Toast Feedback */}
        {feedbackMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              background: feedbackMessage.type === 'success' ? '#DEF7EC' : '#FDE8E8',
              color: feedbackMessage.type === 'success' ? '#03543F' : '#9B1C1C',
              border: `1px solid ${feedbackMessage.type === 'success' ? '#84E1BC' : '#F8B4B4'}`,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 16,
              fontWeight: 600,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Deposit Warning Banner (BR-14) */}
        {!isDepositSufficient && (
          <div
            className="card"
            style={{
              background: '#FFF8E1',
              borderColor: '#FFE082',
              color: '#8D6E63',
              marginBottom: 20,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <AlertTriangle size={24} color="#D97706" />
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#92400E', fontSize: 16 }}>
                Số dư ký quỹ hiện tại: {depositAmount.toLocaleString('vi-VN')}đ (Yêu cầu tối thiểu 300.000đ)
              </strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 14.5, color: '#78350F' }}>
                Theo quy chế BR-14, bạn cần bổ sung ký quỹ để có thể nhận ca chăm sóc.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                setDepositAmount(300000);
                showToast('success', 'Đã nạp bổ sung ký quỹ thành công! Số dư hiện tại: 300.000đ');
              }}
            >
              Nạp ký quỹ ngay (+150k)
            </button>
          </div>
        )}

        {/* Direct Invitation Banner if Available */}
        {directInvite && (
          <DirectInviteCard
            invite={directInvite}
            onAccept={handleAcceptDirectInvite}
            onDecline={handleDeclineDirectInvite}
            isProcessing={isProcessing}
          />
        )}

        {/* Filter Toolbar */}
        <div className="toolbar" style={{ borderTop: 0, paddingTop: 4 }}>
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            <Filter size={15} />
            Tất cả
          </button>
          <button
            type="button"
            className={filter === 'shift' ? 'active' : ''}
            onClick={() => setFilter('shift')}
          >
            Theo ca
          </button>
          <button
            type="button"
            className={filter === 'task' ? 'active' : ''}
            onClick={() => setFilter('task')}
          >
            Thủ thuật lẻ
          </button>
          <button
            type="button"
            className={filter === 'near' ? 'active' : ''}
            onClick={() => setFilter('near')}
          >
            Gần tôi (≤ 3 km)
          </button>
          <button
            type="button"
            className={filter === 'bonus' ? 'active' : ''}
            onClick={() => setFilter('bonus')}
          >
            <Zap size={14} />
            Thưởng nóng
          </button>
        </div>

        {/* Jobs List */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--slate)', fontSize: 16 }}>
            Đang tải danh sách ca phù hợp...
          </div>
        ) : jobs.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: '#FAFCFB',
              marginTop: 10,
            }}
          >
            <p style={{ fontSize: 17, color: 'var(--slate)', margin: 0 }}>
              Chưa có việc trong bán kính 10 km — thử mở rộng lịch rảnh hoặc chọn bộ lọc khác.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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

        {/* Job Detail Modal */}
        {selectedJobForDetail && (
          <JobDetailModal
            job={selectedJobForDetail}
            onClose={() => setSelectedJobForDetail(null)}
            onAccept={handleAcceptJob}
            isAccepting={isProcessing}
          />
        )}

        {/* Tier Note Explanatory Box */}
        <div className="banner" style={{ background: '#F8FAFC', borderColor: 'var(--line)', color: 'var(--slate)', marginTop: 26 }}>
          <span className="variant-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} />
            Quy chế phân quyền Cấp bậc & GPHN
          </span>
          <h4 style={{ color: 'var(--navy)', marginTop: 8, marginBottom: 4 }}>
            Điều dưỡng Cấp 1 và Cấp 2 trên Bảng việc làm
          </h4>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            • <strong>Điều dưỡng Cấp 2:</strong> Đã xác thực GPHN, được quyền nhận tất cả các ca gồm thủ thuật xâm lấn (tiêm truyền, thay băng vết mổ, đặt ống thông) và ca theo dõi.
            <br />
            • <strong>Điều dưỡng Cấp 1:</strong> Chỉ nhận ca chăm sóc không xâm lấn (hỗ trợ sinh hoạt, nhắc thuốc, đo sinh hiệu cơ bản). Các ca xâm lấn sẽ tự động hiển thị khóa để đảm bảo an toàn y khoa.
          </p>
        </div>

        {/* Radar Modal Popup */}
        {radarJob && (
          <RadarModal
            radarJob={radarJob}
            onAccept={handleAcceptRadar}
            onDismiss={handleDismissRadar}
            isProcessing={isProcessing}
          />
        )}
      </div>
    </div>
  );
};
export default JobBoardPage;
