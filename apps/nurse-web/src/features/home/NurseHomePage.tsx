import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { USE_MOCK_AUTH } from '../../lib/mock-flags';
import { DEFAULT_MIN_NURSE_DEPOSIT_VND, ExecutionStatus } from '@healthcare-system/shared';
import type { TrustScoreDto } from '@healthcare-system/shared';
import { getMyShifts } from '../shifts/shift.api';
import type { ShiftExecutionState } from '../shifts/shift.types';
import { getJobBoard } from '../job-board/job-board.api';
import type { JobItem } from '../job-board/job-board.types';
import { getTrustScore } from '../trust-score/trust-score.api';
import { getWalletBalances, type WalletBalancesDto } from '../wallet/wallet.api';
import { DailyPulseBar } from './components/DailyPulseBar';
import { DailyTimeline } from './components/DailyTimeline';
import { ClinicalSafetyCard } from './components/ClinicalSafetyCard';
import { QuickActionsCard } from './components/QuickActionsCard';

/**
 * N1 · Trang chủ điều dưỡng — Sổ tay Lâm sàng Chuẩn mực (Clinical Ledger Dashboard).
 * Thiết kế theo chuẩn Elder-Friendly & Clinical Precision:
 * - Header cá nhân hóa theo buổi + Radar Toggle nhận ca tức thì.
 * - Daily Pulse Bar: 4 thẻ KPI tóm tắt (Thu nhập ví, Ca hôm nay, TrustScore, Đánh giá ★).
 * - Cột trái (65%): Ca trực trọng tâm + Timeline nhịp làm việc (có buffer di chuyển 60 phút) + Việc mới gần bạn.
 * - Cột phải (35%): Sổ trạng thái hành nghề + Túi y cụ lâm sàng + Thao tác nhanh 1 chạm.
 */
export const NurseHomePage: React.FC = () => {
  const { session } = useAuth();
  const profile = session?.profile;
  const user = session?.user;

  const [shifts, setShifts] = useState<ShiftExecutionState[]>([]);
  const [suggestedJobs, setSuggestedJobs] = useState<JobItem[]>([]);
  const [trustScoreData, setTrustScoreData] = useState<TrustScoreDto | null>(null);
  const [walletBalances, setWalletBalances] = useState<WalletBalancesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Radar nhận ca khẩn cấp state
  const [radarActive, setRadarActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('carenest_radar_active');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [radarToast, setRadarToast] = useState<string | null>(null);

  const handleToggleRadar = () => {
    const next = !radarActive;
    setRadarActive(next);
    try {
      localStorage.setItem('carenest_radar_active', JSON.stringify(next));
    } catch {
      // ignore
    }
    setRadarToast(
      next
        ? 'Đã BẬT Radar nhận ca — Hệ thống sẽ ưu tiên phân bổ ca khẩn cấp trong bán kính 5km.'
        : 'Đã TẮT Radar nhận ca — Bạn sẽ chỉ nhận ca khi chủ động ứng tuyển trên Job Board.'
    );
    setTimeout(() => setRadarToast(null), 4500);
  };

  const loadDashboard = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([getMyShifts(), getJobBoard(), getTrustScore(), getWalletBalances()])
      .then(([shiftsRes, jobsRes, tsRes, walletRes]) => {
        if (cancelled) return;
        if (!shiftsRes.success && !jobsRes.success) {
          setLoadError('Không thể tải dữ liệu ca trực và việc làm mới. Vui lòng thử lại.');
        }
        if (shiftsRes.success) {
          setShifts(shiftsRes.data);
        }
        if (jobsRes.success) {
          setSuggestedJobs(jobsRes.data.slice(0, 3));
        }
        if (tsRes.success && tsRes.data) {
          setTrustScoreData(tsRes.data);
        }
        if (walletRes.success && walletRes.data) {
          setWalletBalances(walletRes.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Lỗi kết nối máy chủ. Không thể cập nhật lịch trực hôm nay.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return loadDashboard();
  }, [loadDashboard]);

  // Greeting theo khung giờ thực tế
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { title: 'Chào buổi sáng', icon: '☀️' };
    } else if (hour >= 12 && hour < 18) {
      return { title: 'Chào buổi chiều', icon: '🌤️' };
    } else if (hour >= 18 && hour < 22) {
      return { title: 'Chào buổi tối', icon: '🌙' };
    } else {
      return { title: 'Chúc ca đêm an toàn', icon: '✨' };
    }
  }, []);

  if (!profile) return null;

  const fullName = user?.full_name ?? 'Điều dưỡng';
  const isTier2 = profile.tier === 'TIER_2_SPECIALIST';
  const gphnNumber = profile.gphn_number || 'Chưa cập nhật';
  const gphnExpiry = profile.gphn_expiry_date || 'Chưa xác định';

  // Số dư ví ký quỹ và khả dụng
  const depositBalance: number =
    walletBalances?.deposit_balance ??
    (typeof (profile as any).deposit_balance === 'number'
      ? (profile as any).deposit_balance
      : USE_MOCK_AUTH
      ? DEFAULT_MIN_NURSE_DEPOSIT_VND
      : 0);

  const availableBalance: number | null = walletBalances?.available_balance ?? null;
  const escrowBalance: number | null = walletBalances?.escrow_locked_balance ?? null;

  const isDepositSufficient = depositBalance >= DEFAULT_MIN_NURSE_DEPOSIT_VND;

  // Điểm TrustScore
  const trustScore: number =
    trustScoreData?.score ??
    (typeof profile.trust_score === 'number'
      ? profile.trust_score
      : USE_MOCK_AUTH
      ? 92
      : 92);

  const ratingAvg: number | null = trustScoreData?.ratingAvg ?? (USE_MOCK_AUTH ? 4.9 : null);
  const ratingCount: number = trustScoreData?.ratingCount ?? (USE_MOCK_AUTH ? 128 : 0);

  // Tính số giờ chăm sóc dự kiến hôm nay
  const totalScheduledHours = shifts.reduce((acc, s) => acc + (s.scheduledHours || 0), 0);

  // Ưu tiên ca đang thực hiện, sau đó tới ca đã xác nhận
  const primaryShift =
    shifts.find((s) => s.executionStatus === ExecutionStatus.IN_PROGRESS) ??
    shifts.find((s) => s.executionStatus === ExecutionStatus.CONFIRMED) ??
    null;

  return (
    <div>
      {/* Header chào mừng cá nhân hóa (Lora Display Serif) */}
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div>
          <h1>
            {timeGreeting.title}, điều dưỡng {fullName} {timeGreeting.icon}
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            {/* Radar Toggle Button */}
            <button
              type="button"
              className={`radar-pill ${
                radarActive ? 'radar-pill--active' : 'radar-pill--inactive'
              }`}
              onClick={handleToggleRadar}
              aria-pressed={radarActive}
              title="Bật/Tắt chế độ nhận ca khẩn cấp trong bán kính 5km"
            >
              <span className="radar-dot" aria-hidden="true" />
              <span>{radarActive ? 'Radar nhận ca: Đang BẬT' : 'Radar nhận ca: Đang TẮT'}</span>
            </button>

            {/* Chuyên môn badge */}
            <span
              className="status-pill status-pill--neutral"
              style={{ fontSize: 13.5, color: 'var(--ink-secondary)' }}
            >
              {isTier2
                ? 'Hạng chuyên môn Cấp 2 (Thủ thuật & Chăm sóc)'
                : 'Hạng cơ bản Cấp 1 (Chăm sóc tại nhà)'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/jobs" className="btn btn-primary btn-sm">
            <Briefcase size={16} />
            Tìm ca mới
          </Link>
        </div>
      </div>

      {/* Radar Toast Alert */}
      {radarToast && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 10,
            background: radarActive ? 'var(--brand-jade-soft)' : '#F3F4F6',
            border: `1px solid ${radarActive ? 'var(--brand-jade)' : '#D1D5DB'}`,
            color: radarActive ? 'var(--brand-jade)' : 'var(--ink-primary)',
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 20,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{radarToast}</span>
        </div>
      )}

      {/* 1. Daily Pulse Bar (KPIs tóm tắt đầu ngày) */}
      <DailyPulseBar
        availableBalance={availableBalance}
        escrowBalance={escrowBalance}
        shiftsCount={shifts.length}
        totalScheduledHours={totalScheduledHours}
        trustScore={trustScore}
        ratingAvg={ratingAvg}
        ratingCount={ratingCount}
        loading={loading}
      />

      {/* 2. Bố cục 2 cột bất đối xứng (65 / 35) */}
      <div className="home-split">
        {/* CỘT TRÁI (65%): Ca trọng tâm + Timeline nhịp ngày + Gợi ý việc mới */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {loadError && (
            <div
              className="alert-error"
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                margin: 0,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} aria-hidden="true" />
                {loadError}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboard}>
                Thử lại
              </button>
            </div>
          )}

          {/* Ca trực trọng tâm */}
          {loading ? (
            <section
              className="clinical-anchor"
              aria-busy="true"
              aria-label="Đang tải ca trực hôm nay"
            >
              <div className="clinical-anchor__eyebrow">
                <Clock size={16} aria-hidden="true" />
                <span>Đang đồng bộ lịch trực hôm nay...</span>
              </div>
              <h2 className="clinical-anchor__title">Đang tải thông tin ca chăm sóc</h2>
              <p style={{ color: 'var(--ink-secondary)', margin: '8px 0 0' }}>
                Vui lòng đợi trong giây lát.
              </p>
            </section>
          ) : primaryShift ? (
            <section className="clinical-anchor" aria-label="Ca trực trọng tâm">
              <div className="clinical-anchor__eyebrow">
                <Activity size={16} />
                <span>
                  {primaryShift.executionStatus === ExecutionStatus.IN_PROGRESS
                    ? 'Ca đang thực hiện tại nhà người bệnh'
                    : 'Ca trực sắp diễn ra hôm nay'}
                </span>
              </div>

              <h2 className="clinical-anchor__title">{primaryShift.serviceName}</h2>
              <p style={{ margin: 0, color: 'var(--ink-secondary)', fontSize: 16 }}>
                Mã đơn: <b className="tabular-nums">{primaryShift.bookingCode}</b>
              </p>

              <div className="clinical-anchor__meta">
                <div>
                  <span>Người bệnh</span>
                  <strong>
                    {primaryShift.patientName} ({primaryShift.patientAge} tuổi)
                  </strong>
                </div>
                <div>
                  <span>Khung giờ</span>
                  <strong className="tabular-nums">
                    {primaryShift.startTime} – {primaryShift.endTime}
                  </strong>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span>Địa chỉ thực hiện</span>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={16} color="var(--brand-jade)" style={{ flexShrink: 0 }} />
                    {primaryShift.patientAddress}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {primaryShift.executionStatus === ExecutionStatus.IN_PROGRESS ? (
                  <Link
                    to={`/shifts/${primaryShift.bookingId}/execute`}
                    className="btn btn-primary"
                  >
                    Mở bảng điều hành ca trực
                  </Link>
                ) : (
                  <Link to={`/shifts/${primaryShift.bookingId}`} className="btn btn-primary">
                    Điểm danh và vào ca
                  </Link>
                )}

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    primaryShift.patientAddress
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  <ExternalLink size={15} />
                  Chỉ đường Maps
                </a>

                <Link to="/shifts" className="ledger-link" style={{ marginLeft: 6 }}>
                  Tất cả ca của tôi
                </Link>
              </div>
            </section>
          ) : (
            <section className="clinical-anchor">
              <div className="clinical-anchor__eyebrow">
                <Clock size={16} />
                <span>Chưa có ca trực trong ngày</span>
              </div>
              <h2 className="clinical-anchor__title">Bạn đang rảnh để nhận ca chăm sóc mới</h2>
              <p
                className="prose-limit"
                style={{ color: 'var(--ink-secondary)', margin: '8px 0 20px' }}
              >
                Lịch rảnh và hồ sơ chuyên môn của bạn đã được kích hoạt. Hãy xem các ca đang cần điều
                dưỡng gần bạn hoặc giữ Radar luôn bật.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to="/jobs" className="btn btn-primary">
                  Xem Bảng việc làm ngay
                </Link>
                <Link to="/schedule" className="btn btn-secondary">
                  Cập nhật lịch rảnh
                </Link>
              </div>
            </section>
          )}

          {/* Timeline nhịp làm việc hôm nay (Kèm khoảng đệm 60 phút) */}
          <DailyTimeline shifts={shifts} loading={loading} />

          {/* Gợi ý ca mới gần khu vực */}
          <section className="ledger-panel" aria-label="Việc mới phù hợp chuyên môn">
            <div className="ledger-panel__head">
              <div>
                <h3 className="ledger-panel__title">Việc mới phù hợp chuyên môn</h3>
                <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 2 }}>
                  Ca gần bạn trong bán kính 10km đang cần điều dưỡng
                </div>
              </div>
              <Link to="/jobs" className="ledger-link">
                Xem toàn bộ
              </Link>
            </div>

            {loading ? (
              <p style={{ color: 'var(--ink-secondary)', margin: '16px 0 4px', fontSize: 15.5 }}>
                Đang tải danh sách ca phù hợp...
              </p>
            ) : suggestedJobs.length === 0 ? (
              <p style={{ color: 'var(--ink-secondary)', margin: '16px 0 4px', fontSize: 15.5 }}>
                Hiện chưa có ca mới phù hợp trong khu vực.
              </p>
            ) : (
              suggestedJobs.map((job) => (
                <div key={job.id} className="ledger-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: 'var(--ink-primary)',
                          fontSize: 16.5,
                        }}
                      >
                        {job.serviceName}
                      </span>
                      {job.isInvasive && (
                        <span
                          className="status-pill status-pill--ochre"
                          style={{ fontSize: 11.5, padding: '1px 6px' }}
                        >
                          Cấp 2 · Thủ thuật
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--ink-secondary)', marginTop: 4 }}>
                      <span className="tabular-nums">
                        {job.startTime} – {job.endTime}
                      </span>
                      {' · '}
                      <span style={{ color: 'var(--brand-jade)', fontWeight: 600 }}>
                        📍 Cách khoảng {job.distanceKm} km
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      className="tabular-nums"
                      style={{
                        fontWeight: 700,
                        color: 'var(--brand-jade)',
                        fontSize: 17,
                      }}
                    >
                      {job.totalAmount.toLocaleString('vi-VN')} đ
                    </div>
                    <Link to={`/jobs/${job.id}`} className="ledger-link" style={{ fontSize: 14 }}>
                      Xem ca
                    </Link>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        {/* CỘT PHẢI (35%): Sổ trạng thái hành nghề + Túi y cụ + Thao tác nhanh */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Sổ trạng thái hành nghề (Ledger kẻ nét) */}
          <aside className="ledger-panel" aria-label="Hồ sơ hành nghề">
            <div className="ledger-panel__head">
              <h3 className="ledger-panel__title">Hồ sơ hành nghề</h3>
              <ShieldCheck size={18} color="var(--brand-jade)" aria-hidden="true" />
            </div>

            {/* Dòng 1: Ký quỹ */}
            <div className="ledger-row">
              <div>
                <div className="ledger-row__label">Số dư ví ký quỹ</div>
                <div className="ledger-row__value tabular-nums">
                  {depositBalance.toLocaleString('vi-VN')} đ
                </div>
                <div style={{ marginTop: 6 }}>
                  <span
                    className={`status-pill ${
                      isDepositSufficient ? 'status-pill--jade' : 'status-pill--ochre'
                    }`}
                  >
                    {isDepositSufficient ? 'Đủ chuẩn nhận ca' : 'Cần bổ sung ký quỹ'}
                  </span>
                </div>
              </div>
              <Link to="/wallet" className="ledger-link">
                Chi tiết
              </Link>
            </div>

            {/* Dòng 2: Lịch rảnh */}
            <div className="ledger-row">
              <div>
                <div className="ledger-row__label">Lịch rảnh mặc định</div>
                <div className="ledger-row__value tabular-nums">07:00 – 21:00</div>
                <div className="ledger-row__sub">Hệ thống ưu tiên gợi ý ca trong khung giờ này</div>
              </div>
              <Link to="/schedule" className="ledger-link">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={14} />
                  Sửa
                </span>
              </Link>
            </div>

            {/* Dòng 3: GPHN */}
            <div className="ledger-row">
              <div>
                <div className="ledger-row__label">Giấy phép hành nghề (GPHN)</div>
                <div className="ledger-row__value tabular-nums" style={{ fontSize: 16 }}>
                  Số {gphnNumber}
                </div>
                <div className="ledger-row__sub">Hiệu lực đến {gphnExpiry}</div>
              </div>
              <Link to="/credentials" className="ledger-link">
                Xem
              </Link>
            </div>

            {/* Dòng 4: TrustScore */}
            <div className="ledger-row">
              <div>
                <div className="ledger-row__label">Điểm tin cậy nghề nghiệp</div>
                <div className="ledger-row__value tabular-nums">{trustScore} / 100</div>
                <div className="ledger-row__sub">
                  {trustScore < 60
                    ? 'Tài khoản đang bị tạm khóa nhận ca'
                    : trustScore < 70
                    ? 'Cảnh báo: điểm gần ngưỡng tạm khóa (60)'
                    : isTier2
                    ? 'Đủ điều kiện thủ thuật có y lệnh (Cấp 2)'
                    : 'Phạm vi chăm sóc điều dưỡng cơ bản (Cấp 1)'}
                </div>
              </div>
              <Link to="/trust-score" className="ledger-link">
                Chi tiết
              </Link>
            </div>
          </aside>

          {/* Túi y cụ & Chuẩn bị lâm sàng (Checklist tương tác) */}
          <ClinicalSafetyCard />

          {/* Thao tác nhanh (1 chạm) */}
          <QuickActionsCard />
        </div>
      </div>
    </div>
  );
};
