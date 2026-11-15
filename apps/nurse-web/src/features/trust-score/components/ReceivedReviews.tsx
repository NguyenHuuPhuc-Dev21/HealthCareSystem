import React, { useState } from 'react';
import { Lock, MessageSquare } from 'lucide-react';
import type {
  PendingReviewDto,
  RatingDistributionDto,
  ReceivedReviewDto,
  SentReviewDto,
} from '@healthcare-system/shared';
import { formatDateTime } from '../../../lib/formatters';
import { SentReviewList } from '../../reviews/components/SentReviewList';

export interface ReceivedReviewsProps {
  ratingAvg: number | null;
  ratingCount: number;
  distribution?: RatingDistributionDto;
  reviews: ReceivedReviewDto[];
  sentReviews?: SentReviewDto[];
  pendingReviews?: PendingReviewDto[];
  loading?: boolean;
  onOpenRateModal?: (pending: PendingReviewDto) => void;
}

export const ReceivedReviews: React.FC<ReceivedReviewsProps> = ({
  ratingAvg,
  ratingCount,
  distribution = { star5: 84, star4: 12, star3: 3, star2: 1, star1: 0 },
  reviews,
  sentReviews = [],
  pendingReviews = [],
  loading = false,
  onOpenRateModal,
}) => {
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');

  const renderStars = (rating: number) => {
    return (
      <span className="stars" aria-label={`${rating} trên 5 sao`}>
        {'★'.repeat(rating)}
        {'☆'.repeat(5 - rating)}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Rating Aggregate Summary Card */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', minWidth: 120 }}>
            <div
              className="tabular-nums font-display"
              style={{
                fontSize: 44,
                fontWeight: 900,
                color: 'var(--ink-primary)',
                lineHeight: 1,
              }}
            >
              {ratingAvg !== null ? ratingAvg.toFixed(1) : '—'}
            </div>
            <div style={{ margin: '6px 0 4px' }}>
              <span className="stars" style={{ fontSize: 20 }}>
                ★★★★★
              </span>
            </div>
            <p style={{ color: 'var(--ink-muted)', fontSize: 14, margin: 0 }}>
              {ratingCount} lượt đánh giá
            </p>
          </div>

          {/* Distribution Bars */}
          <div style={{ flex: 1, minWidth: 220 }}>
            {[
              { star: '5★', pct: distribution.star5 },
              { star: '4★', pct: distribution.star4 },
              { star: '3★', pct: distribution.star3 },
              { star: '2★', pct: distribution.star2 },
              { star: '1★', pct: distribution.star1 },
            ].map((d) => (
              <div key={d.star} className="dist-row">
                <span style={{ width: 26, fontSize: 13.5, color: 'var(--ink-secondary)' }}>
                  {d.star}
                </span>
                <span className="tr">
                  <i style={{ width: `${d.pct}%` }} />
                </span>
                <span
                  className="tabular-nums"
                  style={{ width: 34, textAlign: 'right', fontSize: 13, color: 'var(--ink-muted)' }}
                >
                  {d.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="shift-tabs"
        role="tablist"
        aria-label="Chuyển đổi danh sách đánh giá"
        style={{ marginBottom: 2 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'received'}
          className={activeTab === 'received' ? 'active' : ''}
          onClick={() => setActiveTab('received')}
        >
          Đánh giá về tôi ({reviews.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sent'}
          className={activeTab === 'sent' ? 'active' : ''}
          onClick={() => setActiveTab('sent')}
        >
          Đánh giá tôi đã gửi ({sentReviews.length})
          {pendingReviews.length > 0 && (
            <span
              style={{
                display: 'inline-block',
                marginLeft: 6,
                padding: '0 6px',
                borderRadius: 999,
                background: 'var(--accent-ochre)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
              }}
              title={`${pendingReviews.length} ca chờ đánh giá`}
            >
              {pendingReviews.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'received' ? (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--ink-muted)' }}>
              Đang tải danh sách đánh giá...
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
              <div style={{ fontWeight: 600, fontSize: 15.5 }}>Chưa có đánh giá nào</div>
              <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>
                Đánh giá từ khách hàng sau khi hoàn tất ca trực sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            reviews.map((rev) => {
              if (!rev.isVisible) {
                // Blind Review hidden state
                return (
                  <div
                    key={rev.id}
                    className="review-card"
                    style={{
                      borderStyle: 'dashed',
                      borderColor: 'var(--accent-ochre)',
                      background: 'var(--accent-ochre-soft)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <b style={{ color: 'var(--ink-primary)', fontSize: 15.5 }}>
                        Đơn {rev.bookingCode} · Đánh giá đang ẩn
                      </b>
                      <span className="chip amber" style={{ fontSize: 12.5, padding: '2px 10px' }}>
                        <Lock size={13} style={{ marginRight: 4, display: 'inline' }} aria-hidden="true" />
                        Ẩn hai chiều
                      </span>
                    </div>
                    <p style={{ color: '#78350F', fontSize: 14.5, marginTop: 8 }}>
                      Đánh giá của khách cho ca này sẽ hiện khi khách gửi đánh giá của họ, hoặc tự
                      mở sau <b>7 ngày</b> kể từ khi ca kết thúc — để hai bên đánh giá độc lập,
                      không ảnh hưởng lẫn nhau.
                    </p>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--ink-muted)',
                        marginTop: 8,
                      }}
                    >
                      Thời gian ca: {formatDateTime(rev.createdAt)}
                    </div>
                  </div>
                );
              }

              // Visible review
              return (
                <div key={rev.id} className="review-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <b style={{ color: 'var(--ink-primary)', fontSize: 15.5 }}>
                        {rev.customerName || 'Khách hàng'} · Đơn {rev.bookingCode}
                      </b>
                      <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>
                        {formatDateTime(rev.createdAt)}
                      </div>
                    </div>
                    {renderStars(rev.rating)}
                  </div>
                  {rev.comment && <p>“{rev.comment}”</p>}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Tab "Đánh giá tôi đã gửi" (W06) */
        <SentReviewList
          reviews={sentReviews}
          pendingReviews={pendingReviews}
          loading={loading}
          onOpenRateModal={onOpenRateModal}
        />
      )}
    </div>
  );
};
