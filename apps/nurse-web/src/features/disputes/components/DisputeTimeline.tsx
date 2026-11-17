import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { DisputeDto, DisputeStatus } from '@healthcare-system/shared';
import { formatDateTime } from '../../../lib/formatters';

export interface DisputeTimelineProps {
  dispute: DisputeDto;
}

export const DisputeTimeline: React.FC<DisputeTimelineProps> = ({ dispute }) => {
  const isResolved =
    dispute.status === DisputeStatus.RESOLVED_CUSTOMER ||
    dispute.status === DisputeStatus.RESOLVED_NURSE ||
    dispute.status === DisputeStatus.RESOLVED_PARTIAL;

  const isUnderReview = dispute.status === DisputeStatus.UNDER_REVIEW;
  const isOpen = dispute.status === DisputeStatus.OPEN;

  const hasRebuttal = !!dispute.nurseRebuttal;

  return (
    <div
      style={{
        background: 'var(--surface-paper)',
        borderRadius: 14,
        padding: '20px 22px',
        border: '1px solid var(--border-hairline)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Scale size={18} color="var(--brand-jade)" aria-hidden="true" />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-primary)' }}>
          Tiến trình giải quyết khiếu nại
        </h3>
      </div>

      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {/* Vertical line connecting steps */}
        <div
          style={{
            position: 'absolute',
            left: 11,
            top: 8,
            bottom: 8,
            width: 2,
            background: 'var(--border-hairline)',
          }}
          aria-hidden="true"
        />

        {/* Step 1: Dispute Opened */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div
            style={{
              position: 'absolute',
              left: -28,
              top: 0,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--brand-jade)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <FileText size={13} aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink-primary)' }}>
              Khiếu nại được tạo bởi {dispute.openedBy === 'PATIENT' ? 'Khách hàng' : 'Điều dưỡng'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 2 }}>
              {formatDateTime(dispute.createdAt)}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--ink-secondary)',
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              Hệ thống tự động tạm dừng giải phóng quyết toán thù lao cho đơn {dispute.bookingCode} để
              đảm bảo nguyên tắc bảo toàn quỹ (FR-DISP-01).
            </div>
          </div>
        </div>

        {/* Step 2: Nurse Rebuttal */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div
            style={{
              position: 'absolute',
              left: -28,
              top: 0,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: hasRebuttal
                ? 'var(--brand-jade)'
                : isOpen
                ? 'var(--accent-ochre)'
                : 'var(--surface-subtle)',
              color: hasRebuttal ? '#fff' : isOpen ? '#fff' : 'var(--ink-muted)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {hasRebuttal ? (
              <CheckCircle2 size={14} aria-hidden="true" />
            ) : isOpen ? (
              <Clock size={13} aria-hidden="true" />
            ) : (
              <HelpCircle size={13} aria-hidden="true" />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink-primary)' }}>
              {dispute.openedBy === 'NURSE'
                ? 'Ý kiến giải trình của điều dưỡng'
                : hasRebuttal
                ? 'Điều dưỡng đã gửi văn bản phản hồi'
                : isOpen
                ? 'Chờ điều dưỡng gửi phản hồi'
                : 'Hết hạn gửi phản hồi'}
            </div>
            {hasRebuttal && dispute.nurseRebuttal?.submittedAt && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 2 }}>
                Đã gửi lúc: {formatDateTime(dispute.nurseRebuttal.submittedAt)}
              </div>
            )}
            {!hasRebuttal && isOpen && dispute.rebuttalDueAt && (
              <div style={{ fontSize: 12.5, color: 'var(--accent-ochre)', marginTop: 2 }}>
                Hạn chót phản hồi: {formatDateTime(dispute.rebuttalDueAt)}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Admin Review */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div
            style={{
              position: 'absolute',
              left: -28,
              top: 0,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: isResolved
                ? 'var(--brand-jade)'
                : isUnderReview
                ? 'var(--accent-ochre)'
                : 'var(--surface-subtle)',
              color: isResolved || isUnderReview ? '#fff' : 'var(--ink-muted)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Scale size={13} aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink-primary)' }}>
              {isResolved
                ? 'Ban quản trị đã hoàn tất thẩm tra'
                : isUnderReview
                ? 'Ban quản trị đang tiến hành thẩm tra'
                : 'Chờ chuyển sang thẩm tra'}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--ink-secondary)',
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              Đối chiếu hồ sơ lâm sàng, GPS check-in/out, nhật ký sinh hiệu và tin nhắn đính kèm.
            </div>
          </div>
        </div>

        {/* Step 4: Resolution Outcome */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: -28,
              top: 0,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: !isResolved
                ? 'var(--surface-subtle)'
                : dispute.status === DisputeStatus.RESOLVED_NURSE
                ? 'var(--brand-jade)'
                : 'var(--alert-crimson)',
              color: isResolved ? '#fff' : 'var(--ink-muted)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {isResolved ? (
              dispute.status === DisputeStatus.RESOLVED_NURSE ? (
                <ShieldCheck size={14} aria-hidden="true" />
              ) : (
                <AlertCircle size={14} aria-hidden="true" />
              )
            ) : (
              <Clock size={13} aria-hidden="true" />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink-primary)' }}>
              {isResolved ? (
                dispute.status === DisputeStatus.RESOLVED_NURSE ? (
                  <span style={{ color: 'var(--brand-jade)' }}>
                    Kết quả: Khiếu nại được giải quyết có lợi cho Điều dưỡng
                  </span>
                ) : (
                  <span style={{ color: 'var(--alert-crimson)' }}>
                    Kết quả: Chấp thuận khiếu nại của Khách hàng
                  </span>
                )
              ) : (
                <span>Kết quả phân xử cuối cùng</span>
              )}
            </div>
            {isResolved && dispute.resolution?.resolvedAt && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 2 }}>
                Ngày phân xử: {formatDateTime(dispute.resolution.resolvedAt)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
