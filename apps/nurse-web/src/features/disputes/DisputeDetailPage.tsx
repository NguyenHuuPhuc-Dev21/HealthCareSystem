import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Video,
  X,
} from 'lucide-react';
import { DisputeDto, DisputeEvidenceDto, DisputeStatus } from '@healthcare-system/shared';
import { getDispute } from './disputes.api';
import { DisputeTimeline } from './components/DisputeTimeline';
import { RebuttalForm } from './components/RebuttalForm';
import { formatDateTime } from '../../lib/formatters';

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [dispute, setDispute] = useState<DisputeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreviewMedia, setSelectedPreviewMedia] = useState<DisputeEvidenceDto | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadDispute = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getDispute(id);
      if (res.success && res.data) {
        setDispute(res.data);
      } else {
        setError(res.error?.message || 'Không thể tải chi tiết khiếu nại');
      }
    } catch {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDispute();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-muted)' }}>
        Đang tải thông tin chi tiết khiếu nại...
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div style={{ padding: '24px 0' }}>
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            borderRadius: 12,
            background: 'var(--alert-crimson-soft)',
            color: 'var(--alert-crimson)',
            border: '1px solid #FECACA',
            marginBottom: 20,
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1 }}>{error || 'Không tìm thấy thông tin khiếu nại.'}</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadDispute}>
            Thử lại
          </button>
        </div>
        <Link to="/disputes" className="btn btn-secondary">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Về danh sách khiếu nại</span>
        </Link>
      </div>
    );
  }

  const isPatientDispute = dispute.openedBy === 'PATIENT';
  const isPenaltyAppeal = dispute.kind === 'PENALTY_APPEAL';
  const canSubmitRebuttal =
    isPatientDispute && dispute.status === DisputeStatus.OPEN && !dispute.nurseRebuttal;

  const isResolved =
    dispute.status === DisputeStatus.RESOLVED_CUSTOMER ||
    dispute.status === DisputeStatus.RESOLVED_NURSE ||
    dispute.status === DisputeStatus.RESOLVED_PARTIAL;

  const renderStatusBadge = (status: DisputeStatus) => {
    switch (status) {
      case DisputeStatus.OPEN:
        return (
          <span className="status-pill status-pill--ochre" style={{ fontSize: 13, padding: '4px 10px' }}>
            <Clock size={14} aria-hidden="true" />
            Đang mở · Chờ phản hồi
          </span>
        );
      case DisputeStatus.UNDER_REVIEW:
        return (
          <span className="status-pill status-pill--neutral" style={{ fontSize: 13, padding: '4px 10px' }}>
            <Scale size={14} aria-hidden="true" />
            Đang thẩm tra
          </span>
        );
      case DisputeStatus.RESOLVED_NURSE:
        return (
          <span className="status-pill status-pill--jade" style={{ fontSize: 13, padding: '4px 10px' }}>
            <ShieldCheck size={14} aria-hidden="true" />
            Thắng khiếu nại (Đã giải phóng thù lao)
          </span>
        );
      case DisputeStatus.RESOLVED_CUSTOMER:
        return (
          <span className="status-pill status-pill--crimson" style={{ fontSize: 13, padding: '4px 10px' }}>
            <AlertCircle size={14} aria-hidden="true" />
            Khách thắng khiếu nại
          </span>
        );
      default:
        return <span className="status-pill">{status}</span>;
    }
  };

  return (
    <div>
      {/* Toast alert */}
      {toastMessage && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 10,
            background: 'var(--brand-jade-soft)',
            border: '1.5px solid var(--brand-jade)',
            color: 'var(--brand-jade)',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Link
          to="/disputes"
          className="btn btn-secondary btn-sm"
          style={{ minHeight: 38, padding: '0 12px' }}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Danh sách khiếu nại</span>
        </Link>

        <div>{renderStatusBadge(dispute.status)}</div>
      </div>

      {/* Page Title */}
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isPenaltyAppeal ? (
              <ShieldAlert size={28} color="var(--accent-ochre)" aria-hidden="true" />
            ) : (
              <Scale size={28} color="var(--brand-jade)" aria-hidden="true" />
            )}
            <h1 style={{ margin: 0, fontSize: 24 }}>
              {isPenaltyAppeal
                ? 'Khiếu nại khoản trừ ký quỹ (ADR-0004 D3)'
                : `Khiếu nại ca trực · Đơn ${dispute.bookingCode}`}
            </h1>
          </div>
          <p style={{ margin: '4px 0 0' }}>
            Mã khiếu nại: <b className="tabular-nums">{dispute.id}</b> · Mở lúc{' '}
            {formatDateTime(dispute.createdAt)} bởi{' '}
            <b>{dispute.openedBy === 'PATIENT' ? 'Khách hàng' : 'Điều dưỡng (Bạn)'}</b>
          </p>
        </div>

        {!isPenaltyAppeal && dispute.bookingId && (
          <Link
            to={`/shifts/${dispute.bookingId}`}
            className="btn btn-secondary btn-sm"
            style={{ minHeight: 40, padding: '0 14px' }}
          >
            <span>Xem ca trực</span>
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* 2-Column Main Layout */}
      <div className="cols-2" style={{ alignItems: 'start', gridTemplateColumns: '1.35fr 1fr', gap: 20 }}>
        {/* Left Column: Details, Evidences, Rebuttal, Resolution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 1. Chi tiết khiếu nại */}
          <div className="card" style={{ padding: '22px 24px', background: 'var(--surface-paper)' }}>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--ink-primary)',
                margin: '0 0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FileText size={18} color="var(--brand-jade)" aria-hidden="true" />
              <span>Nội dung khiếu nại từ {isPatientDispute ? 'Khách hàng' : 'Điều dưỡng'}</span>
            </h2>

            {/* Thông tin khoản trừ ký quỹ nếu là PENALTY_APPEAL */}
            {isPenaltyAppeal && (
              <div
                style={{
                  background: 'var(--surface-canvas)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  marginBottom: 16,
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                  Thông tin khoản phạt bị khiếu nại
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 14 }}>
                  <span>Số tiền bị trừ:</span>
                  <b style={{ color: 'var(--alert-crimson)' }}>
                    {dispute.penaltyAmount ? `${dispute.penaltyAmount.toLocaleString('vi-VN')} đ` : '—'}
                  </b>
                </div>
                {dispute.penaltyReason && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13.5 }}>
                    <span style={{ color: 'var(--ink-secondary)' }}>Lý do phạt:</span>
                    <span style={{ fontWeight: 600 }}>{dispute.penaltyReason}</span>
                  </div>
                )}
                {dispute.slaRule && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                    <span style={{ color: 'var(--ink-secondary)' }}>Căn cứ SLA:</span>
                    <span style={{ color: 'var(--ink-muted)' }}>{dispute.slaRule}</span>
                  </div>
                )}
              </div>
            )}

            <p style={{ fontSize: 15, color: 'var(--ink-primary)', lineHeight: 1.55, margin: '0 0 16px' }}>
              {dispute.description}
            </p>

            {/* Danh sách bằng chứng đính kèm */}
            {dispute.evidences.length > 0 && (
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                  Tệp bằng chứng kèm theo ({dispute.evidences.length} tệp):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {dispute.evidences.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedPreviewMedia(ev)}
                      style={{
                        borderRadius: 8,
                        border: '1px solid var(--border-hairline)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        background: 'var(--surface-canvas)',
                        position: 'relative',
                        aspectRatio: '1',
                      }}
                      title="Nhấn để phóng to"
                    >
                      {ev.kind === 'VIDEO' ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'grid',
                            placeItems: 'center',
                            background: '#1E293B',
                            color: '#fff',
                          }}
                        >
                          <Video size={28} aria-hidden="true" />
                          <span style={{ fontSize: 11, marginTop: 4 }}>Video</span>
                        </div>
                      ) : (
                        <img
                          src={ev.url}
                          alt={ev.fileName || 'Bằng chứng'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Ý kiến phản hồi của điều dưỡng (Rebuttal) đã nộp */}
          {dispute.nurseRebuttal && (
            <div className="card" style={{ padding: '22px 24px', background: '#F8FAF8', border: '1px solid #C6E2D8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <CheckCircle2 size={18} color="var(--brand-jade)" aria-hidden="true" />
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--ink-primary)' }}>
                  Văn bản phản hồi giải trình của Điều dưỡng
                </h3>
                {dispute.nurseRebuttal.submittedAt && (
                  <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                    · {formatDateTime(dispute.nurseRebuttal.submittedAt)}
                  </span>
                )}
              </div>

              <p style={{ fontSize: 14.5, color: 'var(--ink-primary)', lineHeight: 1.55, margin: '0 0 14px' }}>
                {dispute.nurseRebuttal.content}
              </p>

              {dispute.nurseRebuttal.evidences && dispute.nurseRebuttal.evidences.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                    Bằng chứng đối chứng của bạn ({dispute.nurseRebuttal.evidences.length} tệp):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                    {dispute.nurseRebuttal.evidences.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedPreviewMedia(ev)}
                        style={{
                          borderRadius: 8,
                          border: '1px solid var(--border-hairline)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          aspectRatio: '1',
                        }}
                      >
                        <img
                          src={ev.url}
                          alt="Bằng chứng phản hồi"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Form gửi phản hồi nếu đang OPEN và chưa phản hồi */}
          {canSubmitRebuttal && (
            <RebuttalForm
              disputeId={dispute.id}
              rebuttalDueAt={dispute.rebuttalDueAt}
              onSuccess={() => {
                setToastMessage('Văn bản phản hồi và bằng chứng đã được ghi nhận thành công!');
                loadDispute();
              }}
            />
          )}

          {/* 4. Kết quả phân xử (Resolution Outcome) */}
          {isResolved && dispute.resolution && (
            <div
              className="card"
              style={{
                padding: '24px 26px',
                borderRadius: 14,
                background:
                  dispute.status === DisputeStatus.RESOLVED_NURSE
                    ? 'var(--brand-jade-soft)'
                    : 'var(--alert-crimson-soft)',
                border:
                  dispute.status === DisputeStatus.RESOLVED_NURSE
                    ? '2px solid var(--brand-jade)'
                    : '2px solid var(--alert-crimson)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {dispute.status === DisputeStatus.RESOLVED_NURSE ? (
                  <ShieldCheck size={26} color="var(--brand-jade)" aria-hidden="true" />
                ) : (
                  <AlertCircle size={26} color="var(--alert-crimson)" aria-hidden="true" />
                )}
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      color:
                        dispute.status === DisputeStatus.RESOLVED_NURSE
                          ? 'var(--brand-jade)'
                          : 'var(--alert-crimson)',
                    }}
                  >
                    {dispute.status === DisputeStatus.RESOLVED_NURSE
                      ? isPenaltyAppeal
                        ? 'Chấp thuận khiếu nại: Đã hoàn lại tiền ký quỹ'
                        : 'Khiếu nại được giải quyết: Điều dưỡng thắng khiếu nại'
                      : isPenaltyAppeal
                      ? 'Bác bỏ khiếu nại: Giữ nguyên khoản phạt'
                      : 'Khiếu nại được chấp thuận cho Khách hàng'}
                  </h3>
                  <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 2 }}>
                    Phân xử bởi Ban Quản Trị CareNest · {formatDateTime(dispute.resolution.resolvedAt)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 10,
                  padding: '16px 18px',
                  marginBottom: 16,
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 6 }}>
                  Ghi chú kết luận từ Hội đồng thẩm tra:
                </div>
                <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink-primary)', lineHeight: 1.5 }}>
                  {dispute.resolution.note}
                </p>
              </div>

              {/* Tác động tài chính & TrustScore */}
              {dispute.status === DisputeStatus.RESOLVED_NURSE ? (
                <div style={{ fontSize: 14, color: 'var(--brand-jade)', fontWeight: 600 }}>
                  {isPenaltyAppeal
                    ? `✓ Khoản phạt ${dispute.penaltyAmount?.toLocaleString('vi-VN')} đ đã được hoàn trả lại vào ví ký quỹ (giao dịch PENALTY_REVERSAL).`
                    : '✓ Lệnh đóng băng thù lao đã được gỡ bỏ. 85% thù lao ca trực đã được giải phóng vào ví của bạn.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dispute.resolution.trustScoreDelta && (
                    <div style={{ fontSize: 14, color: 'var(--alert-crimson)', fontWeight: 700 }}>
                      ⚠️ Trừ {Math.abs(dispute.resolution.trustScoreDelta)} điểm TrustScore của bạn theo quy định FR-RATE-01.
                    </div>
                  )}
                  {dispute.resolution.depositDeducted && (
                    <div style={{ fontSize: 14, color: 'var(--alert-crimson)', fontWeight: 700 }}>
                      ⚠️ Khấu trừ {dispute.resolution.depositDeducted.toLocaleString('vi-VN')} đ từ tài khoản ký quỹ để bồi thường thiệt hại.
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12.5,
                      color: '#991B1B',
                      background: '#FEE2E2',
                      padding: '8px 12px',
                      borderRadius: 6,
                      marginTop: 6,
                    }}
                  >
                    <b>Quy định:</b> Khoản khấu trừ do phân xử khiếu nại của khách hàng (DISPUTE_UPHELD) là quyết định cuối cùng, không được quyền khiếu nại lại.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Timeline & Policy notice */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <DisputeTimeline dispute={dispute} />

          {/* Policy card */}
          <div
            className="card"
            style={{
              padding: '18px 20px',
              background: 'var(--surface-paper)',
              border: '1px solid var(--border-hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Lock size={16} color="var(--brand-jade)" aria-hidden="true" />
              <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--ink-primary)' }}>
                Quy định đóng băng quỹ (FR-DISP-01)
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.45 }}>
              Trong suốt thời gian khiếu nại ở trạng thái <b>Đang mở</b> hoặc <b>Đang thẩm tra</b>,
              toàn bộ số tiền thù lao ca trực sẽ được lưu giữ tại Escrow và không giải phóng cho bất
              kỳ bên nào. Quá trình thẩm tra sẽ hoàn tất trong vòng 48 giờ làm việc.
            </p>
          </div>
        </div>
      </div>

      {/* Media Lightbox Modal */}
      {selectedPreviewMedia && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setSelectedPreviewMedia(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPreviewMedia(null)}
              style={{
                position: 'absolute',
                top: -38,
                right: 0,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
              aria-label="Đóng xem trước"
            >
              <X size={28} />
            </button>
            {selectedPreviewMedia.kind === 'VIDEO' ? (
              <video
                src={selectedPreviewMedia.url}
                controls
                autoPlay
                style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }}
              />
            ) : (
              <img
                src={selectedPreviewMedia.url}
                alt="Bằng chứng phóng to"
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }}
              />
            )}
            {selectedPreviewMedia.fileName && (
              <div style={{ color: '#fff', textAlign: 'center', marginTop: 10, fontSize: 13 }}>
                {selectedPreviewMedia.fileName}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
