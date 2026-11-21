import React from 'react';
import { Clock, Eye, EyeOff, Lock, MessageSquare, Star } from 'lucide-react';
import type { PendingReviewDto, SentReviewDto } from '@healthcare-system/shared';
import { formatDateTime } from '../../../lib/formatters';

export interface SentReviewListProps {
  reviews: SentReviewDto[];
  pendingReviews?: PendingReviewDto[];
  loading?: boolean;
  onOpenRateModal?: (pending: PendingReviewDto) => void;
}

export const SentReviewList: React.FC<SentReviewListProps> = ({
  reviews,
  pendingReviews = [],
  loading = false,
  onOpenRateModal,
}) => {
  const renderStars = (rating: number) => {
    return (
      <span className="stars" aria-label={`${rating} trên 5 sao`} style={{ fontSize: 16 }}>
        {'★'.repeat(rating)}
        {'☆'.repeat(5 - rating)}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Pending Reviews Prompt Banner (Ca chờ đánh giá) */}
      {pendingReviews.length > 0 && (
        <div
          role="region"
          aria-label="Ca trực đang chờ bạn đánh giá"
          style={{
            background: 'var(--surface-paper)',
            border: '1.5px solid var(--accent-ochre)',
            borderRadius: 12,
            padding: '18px 20px',
            boxShadow: '0 2px 6px rgba(180, 83, 9, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Clock size={18} color="var(--accent-ochre)" aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-primary)' }}>
              Bạn có {pendingReviews.length} ca trực đang chờ đánh giá khách hàng
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingReviews.map((pending) => (
              <div
                key={pending.bookingId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 14px',
                  background: 'var(--surface-canvas)',
                  borderRadius: 8,
                  border: '1px solid var(--border-hairline)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink-primary)', fontSize: 15 }}>
                    {pending.customerName} · Mã đơn {pending.bookingCode}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>
                    Hoàn tất lúc: {formatDateTime(pending.completedAt)}
                  </div>
                </div>

                {onOpenRateModal && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenRateModal(pending)}
                    style={{ fontSize: 13.5 }}
                  >
                    <Star size={14} aria-hidden="true" />
                    <span>Đánh giá ngay</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Sent Reviews List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--ink-muted)' }}>
          Đang tải danh sách đánh giá đã gửi...
        </div>
      ) : reviews.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '40px 16px',
            color: 'var(--ink-muted)',
          }}
        >
          <MessageSquare size={36} style={{ opacity: 0.35, marginBottom: 8 }} aria-hidden="true" />
          <div style={{ fontWeight: 600, fontSize: 15.5 }}>Chưa có đánh giá nào đã gửi</div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            Sau khi hoàn tất ca trực, bạn có thể gửi phản hồi và đánh giá về khách hàng tại đây.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map((rev) => {
            return (
              <div
                key={rev.id}
                className="card"
                style={{
                  padding: '18px 20px',
                  background: rev.isVisible ? '#fff' : 'var(--surface-canvas)',
                  border: rev.isVisible
                    ? '1px solid var(--border-hairline)'
                    : '1px dashed rgba(245, 158, 11, 0.5)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ color: 'var(--ink-primary)', fontSize: 15.5 }}>
                        {rev.customerName} · Đơn {rev.bookingCode}
                      </b>
                      {rev.isVisible ? (
                        <span
                          className="status-pill status-pill--jade"
                          style={{ fontSize: 11.5, padding: '1px 8px' }}
                        >
                          <Eye size={12} aria-hidden="true" />
                          Đã công khai
                        </span>
                      ) : (
                        <span
                          className="status-pill status-pill--ochre"
                          style={{ fontSize: 11.5, padding: '1px 8px' }}
                        >
                          <Lock size={12} aria-hidden="true" />
                          Đang ẩn (Blind review)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>
                      Gửi lúc: {formatDateTime(rev.createdAt)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>{renderStars(rev.rating)}</div>
                </div>

                {!rev.isVisible && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      color: '#92400E',
                      background: '#FFFBEB',
                      padding: '6px 10px',
                      borderRadius: 6,
                      marginBottom: 10,
                    }}
                  >
                    <EyeOff size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
                    <span>
                      Đang ẩn theo quy định 2 chiều (FR-RATE-01). Sẽ công khai khi khách đánh giá hoặc sau 7 ngày.
                    </span>
                  </div>
                )}

                {rev.tags && rev.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {rev.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'var(--brand-jade-soft)',
                          color: 'var(--brand-jade)',
                          fontWeight: 500,
                        }}
                      >
                        ✓ {tag}
                      </span>
                    ))}
                  </div>
                )}

                {rev.comment ? (
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: 14.5,
                      color: 'var(--ink-primary)',
                      lineHeight: 1.5,
                      fontStyle: 'italic',
                    }}
                  >
                    “{rev.comment}”
                  </p>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                    Không có nhận xét bổ sung
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
