import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Briefcase, Calendar, Clock, MapPin, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { USE_MOCK_AUTH } from '../../lib/mock-flags';
import { DEFAULT_MIN_NURSE_DEPOSIT_VND, ExecutionStatus } from '@healthcare-system/shared';
import { getMyShifts } from '../shifts/shift.api';
import { ShiftExecutionState } from '../shifts/shift.types';
import { getJobBoard } from '../job-board/job-board.api';
import { JobItem } from '../job-board/job-board.types';

/**
 * N1 · Trang chủ điều dưỡng — Sổ tay Lâm sàng Chuẩn mực (Clinical Ledger).
 * Bố cục bất đối xứng:
 * - Cột trái (65%): Neo hành động chính (Ca trực hôm nay) + Gợi ý việc phù hợp.
 * - Cột phải (35%): Sổ trạng thái hành nghề dạng dòng kẻ mảnh (Ký quỹ, Lịch rảnh, GPHN, TrustScore).
 */
export const NurseHomePage: React.FC = () => {
  const { session } = useAuth();
  const profile = session?.profile;
  const user = session?.user;

  const [shifts, setShifts] = useState<ShiftExecutionState[]>([]);
  const [suggestedJobs, setSuggestedJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([getMyShifts(), getJobBoard()])
      .then(([shiftsRes, jobsRes]) => {
        if (cancelled) return;
        if (!shiftsRes.success && !jobsRes.success) {
          setLoadError('Không thể tải dữ liệu ca trực và việc làm mới. Vui lòng thử lại.');
        }
        if (shiftsRes.success) {
          setShifts(shiftsRes.data);
        }
        if (jobsRes.success) {
          setSuggestedJobs(jobsRes.data.slice(0, 2));
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

  if (!profile) return null;

  const fullName = user?.full_name ?? 'Điều dưỡng';
  const isTier2 = profile.tier === 'TIER_2_SPECIALIST';
  const gphnNumber = profile.gphn_number || 'Chưa cập nhật';
  const gphnExpiry = profile.gphn_expiry_date || 'Chưa xác định';
  const rawDeposit = (profile as any).deposit_balance;
  const depositBalance: number | null =
    typeof rawDeposit === 'number'
      ? rawDeposit
      : USE_MOCK_AUTH
      ? DEFAULT_MIN_NURSE_DEPOSIT_VND
      : null;
  const isDepositSufficient =
    depositBalance !== null && depositBalance >= DEFAULT_MIN_NURSE_DEPOSIT_VND;
  const trustScore: number | null =
    typeof profile.trust_score === 'number'
      ? profile.trust_score
      : USE_MOCK_AUTH
      ? 98
      : null;

  // Ưu tiên ca đang thực hiện, sau đó tới ca đã xác nhận
  const primaryShift =
    shifts.find((s) => s.executionStatus === ExecutionStatus.IN_PROGRESS) ??
    shifts.find((s) => s.executionStatus === ExecutionStatus.CONFIRMED) ??
    null;

  return (
    <div>
      {/* Header chào mừng (Lora Display Serif) */}
      <div className="page-head">
        <div>
          <h1>Chào điều dưỡng {fullName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <span className="status-pill status-pill--jade">Sẵn sàng nhận ca</span>
            <span style={{ color: 'var(--ink-secondary)', fontSize: 16 }}>
              {isTier2 ? 'Hạng chuyên môn Cấp 2 (Thủ thuật & Chăm sóc)' : 'Hạng cơ bản Cấp 1 (Chăm sóc tại nhà)'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/jobs" className="btn btn-primary btn-sm">
            <Briefcase size={16} />
            Tìm ca mới
          </Link>
        </div>
      </div>

      {/* Bố cục bất đối xứng 65 / 35 */}
      <div className="home-split">
        {/* CỘT TRÁI: Nhịp làm việc hôm nay */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loadError && (
            <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} aria-hidden="true" />
                {loadError}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboard}>
                Thử lại
              </button>
            </div>
          )}

          {loading ? (
            <section className="clinical-anchor" aria-busy="true" aria-label="Đang tải ca trực hôm nay">
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
                Mã đơn {primaryShift.bookingCode}
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

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {primaryShift.executionStatus === ExecutionStatus.IN_PROGRESS ? (
                  <Link to={`/shifts/${primaryShift.bookingId}/execute`} className="btn btn-primary">
                    Mở bảng điều hành ca trực
                  </Link>
                ) : (
                  <Link to={`/shifts/${primaryShift.bookingId}`} className="btn btn-primary">
                    Xem chi tiết và điểm danh
                  </Link>
                )}
                <Link to="/shifts" className="btn btn-secondary">
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
              <p className="prose-limit" style={{ color: 'var(--ink-secondary)', margin: '8px 0 20px' }}>
                Lịch rảnh và hồ sơ chuyên môn của bạn đã được kích hoạt. Xem danh sách các ca đang cần điều dưỡng gần khu vực của bạn.
              </p>
              <Link to="/jobs" className="btn btn-primary">
                Xem Bảng việc làm ngay
              </Link>
            </section>
          )}

          {/* Gợi ý ca mới gần khu vực */}
          <section className="ledger-panel">
            <div className="ledger-panel__head">
              <h3 className="ledger-panel__title">Việc mới phù hợp chuyên môn</h3>
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
                    <div style={{ fontWeight: 700, color: 'var(--ink-primary)', fontSize: 16.5 }}>
                      {job.serviceName}
                    </div>
                    <div style={{ fontSize: 14.5, color: 'var(--ink-secondary)', marginTop: 3 }}>
                      <span className="tabular-nums">{job.startTime} – {job.endTime}</span>
                      {' · '}
                      Cách khoảng {job.distanceKm} km
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="tabular-nums" style={{ fontWeight: 700, color: 'var(--brand-jade)', fontSize: 17 }}>
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

        {/* CỘT PHẢI: Sổ trạng thái hành nghề (Ledger kẻ nét) */}
        <aside className="ledger-panel" aria-label="Hồ sơ hành nghề">
          <div className="ledger-panel__head">
            <h3 className="ledger-panel__title">Hồ sơ hành nghề</h3>
            <ShieldCheck size={18} color="var(--brand-jade)" />
          </div>

          <div className="ledger-row">
            <div>
              <div className="ledger-row__label">Số dư ví ký quỹ</div>
              <div className="ledger-row__value">
                {depositBalance !== null ? `${depositBalance.toLocaleString('vi-VN')} đ` : 'Chưa cập nhật'}
              </div>
              <div style={{ marginTop: 6 }}>
                <span
                  className={`status-pill ${
                    depositBalance === null
                      ? 'status-pill--neutral'
                      : isDepositSufficient
                      ? 'status-pill--jade'
                      : 'status-pill--ochre'
                  }`}
                >
                  {depositBalance === null
                    ? 'Chưa đồng bộ số dư'
                    : isDepositSufficient
                    ? 'Đủ chuẩn nhận ca'
                    : 'Cần bổ sung ký quỹ'}
                </span>
              </div>
            </div>
            <Link to="/jobs" className="ledger-link">
              Kiểm tra
            </Link>
          </div>

          <div className="ledger-row">
            <div>
              <div className="ledger-row__label">Lịch rảnh mặc định</div>
              <div className="ledger-row__value">07:00 – 21:00</div>
              <div className="ledger-row__sub">Hệ thống ưu tiên gợi ý ca trong khung giờ này</div>
            </div>
            <Link to="/schedule" className="ledger-link">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={14} />
                Chỉnh sửa
              </span>
            </Link>
          </div>

          <div className="ledger-row">
            <div>
              <div className="ledger-row__label">Giấy phép hành nghề (GPHN)</div>
              <div className="ledger-row__value" style={{ fontSize: 16.5 }}>
                Số {gphnNumber}
              </div>
              <div className="ledger-row__sub">Hiệu lực đến {gphnExpiry}</div>
            </div>
            <Link to="/credentials" className="ledger-link">
              Chi tiết
            </Link>
          </div>

          <div className="ledger-row">
            <div>
              <div className="ledger-row__label">Điểm tin cậy nghề nghiệp</div>
              <div className="ledger-row__value">
                {trustScore !== null ? `${trustScore} / 100` : 'Chưa có dữ liệu'}
              </div>
              <div className="ledger-row__sub">
                {isTier2
                  ? 'Đủ điều kiện thực hiện thủ thuật có y lệnh'
                  : 'Phạm vi chăm sóc điều dưỡng cơ bản'}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
