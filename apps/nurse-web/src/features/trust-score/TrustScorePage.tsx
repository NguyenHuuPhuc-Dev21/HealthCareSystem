import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  PendingReviewDto,
  ReceivedReviewDto,
  SentReviewDto,
  TrustScoreDto,
} from '@healthcare-system/shared';
import { Button } from '../../components';
import { getReceivedReviews, getTrustScore } from './trust-score.api';
import { getPendingReviews, getSentReviews } from '../reviews/reviews.api';
import { RateCustomerModal } from '../reviews/components/RateCustomerModal';
import { ScoreGauge } from './components/ScoreGauge';
import { ScoreHistory } from './components/ScoreHistory';
import { ReceivedReviews } from './components/ReceivedReviews';
import { mockSetScoreForTesting } from './trust-score.mock';
import { USE_MOCK_TRUST_SCORE } from '../../lib/mock-flags';

export const TrustScorePage: React.FC = () => {
  const [trustScoreData, setTrustScoreData] = useState<TrustScoreDto | null>(null);
  const [reviews, setReviews] = useState<ReceivedReviewDto[]>([]);
  const [sentReviews, setSentReviews] = useState<SentReviewDto[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReviewDto[]>([]);
  const [activeRateModal, setActiveRateModal] = useState<PendingReviewDto | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [tsRes, revRes, sentRes, pendingRes] = await Promise.all([
        getTrustScore(),
        getReceivedReviews(),
        getSentReviews(),
        getPendingReviews(),
      ]);

      if (tsRes.success && tsRes.data) {
        setTrustScoreData(tsRes.data);
      } else {
        setPageError(tsRes.error?.message || 'Không thể tải điểm TrustScore');
      }

      if (revRes.success && revRes.data) {
        setReviews(revRes.data);
      }

      if (sentRes.success && sentRes.data) {
        setSentReviews(sentRes.data);
      }

      if (pendingRes.success && pendingRes.data) {
        setPendingReviews(pendingRes.data);
      }
    } catch {
      setPageError('Lỗi kết nối khi tải dữ liệu điểm uy tín');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const score = trustScoreData?.score ?? 0;
  const isSuspended = trustScoreData !== null && score < 60;
  const isWarning = trustScoreData !== null && score >= 60 && score < 70;

  // Switcher for testing (92, 65, 55)
  const handleTestScoreChange = (testScore: number) => {
    mockSetScoreForTesting(testScore);
    loadData();
  };

  return (
    <div>
      {/* Standard Page Head */}
      <div className="page-head">
        <div>
          <h1>Đánh giá &amp; điểm TrustScore</h1>
          <p>Điểm uy tín quyết định thứ hạng gợi ý việc — minh bạch từng lần thay đổi</p>
        </div>
        <Link
          to="/"
          className="btn btn-secondary btn-sm"
          style={{ minHeight: 44, padding: '8px 18px', fontSize: 14.5 }}
          aria-label="Về trang chủ"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Về trang chủ</span>
        </Link>
      </div>

      {/* Success Toast Alert */}
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
            fontSize: 14.5,
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Error Alert */}
      {pageError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'var(--alert-crimson-soft)',
            color: 'var(--alert-crimson)',
            border: '1px solid #FECACA',
            marginBottom: 20,
            fontSize: 15,
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1 }}>{pageError}</div>
          <Button type="button" variant="secondary" onClick={loadData} style={{ minHeight: 36 }}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* Warning / Suspension Alert Banners */}
      {!loading && isSuspended && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '16px 20px',
            borderRadius: 12,
            background: 'var(--alert-crimson-soft)',
            border: '2px solid var(--alert-crimson)',
            color: 'var(--alert-crimson)',
            marginBottom: 22,
          }}
        >
          <ShieldAlert size={24} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16.5, fontWeight: 700 }}>
              Tài khoản đang tạm khóa nhận ca
            </h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Điểm TrustScore của bạn hiện tại là <b>{score} / 100</b> (dưới ngưỡng an toàn 60
              điểm). Bạn tạm thời không thể nhận ca mới từ Radar hoặc Job Board. Vui lòng liên hệ
              Admin để được hỗ trợ kiểm tra và hướng dẫn khắc phục.
            </p>
          </div>
        </div>
      )}

      {!loading && isWarning && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '16px 20px',
            borderRadius: 12,
            background: 'var(--accent-ochre-soft)',
            border: '2px solid var(--accent-ochre)',
            color: '#78350F',
            marginBottom: 22,
          }}
        >
          <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16.5, fontWeight: 700 }}>
              Cảnh báo: Điểm TrustScore sắp chạm ngưỡng 60
            </h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Điểm của bạn hiện tại là <b>{score} / 100</b>. Khi điểm dưới 60, hệ thống sẽ tự động
              tạm khóa quyền nhận ca. Hãy hoàn thành tốt các ca sắp tới để phục hồi điểm uy tín (+2
              điểm mỗi ca được đánh giá ≥ 4★).
            </p>
          </div>
        </div>
      )}

      {/* Main 2-column Layout */}
      <div className="cols-2" style={{ alignItems: 'start' }}>
        {/* Left Column: Gauge, Score Explanations & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Card 1: Score Gauge & Policy */}
          <div className="card" style={{ padding: '24px 22px', textAlign: 'center' }}>
            <div style={{ marginBottom: 14 }}>
              <ScoreGauge score={loading ? 0 : score} />
            </div>

            <h2
              style={{
                color: 'var(--ink-primary)',
                fontSize: 20,
                fontWeight: 800,
                margin: '0 0 6px',
              }}
            >
              TrustScore · {loading ? '...' : `${score} / 100`}
            </h2>

            <p style={{ color: 'var(--ink-secondary)', fontSize: 15, margin: '0 0 16px', lineHeight: 1.5 }}>
              {isSuspended ? (
                <b style={{ color: 'var(--alert-crimson)' }}>
                  Tài khoản đang bị tạm khóa nhận ca (dưới 60 điểm).
                </b>
              ) : isWarning ? (
                <b style={{ color: '#EA580C' }}>
                  Điểm của bạn sắp chạm 60 — dưới 60 tài khoản sẽ bị tạm khóa nhận ca.
                </b>
              ) : score >= 80 ? (
                <span>
                  Mức rất tốt — bạn được ưu tiên gợi ý ca trên Radar.{' '}
                  <b style={{ color: 'var(--alert-crimson)' }}>Dưới 60 điểm: tạm khóa nhận ca.</b>
                </span>
              ) : (
                <span>
                  Mức khá — duy trì dịch vụ tốt để tích lũy điểm.{' '}
                  <b style={{ color: 'var(--alert-crimson)' }}>Dưới 60 điểm: tạm khóa nhận ca.</b>
                </span>
              )}
            </p>

            {/* Quy tắc cộng / trừ điểm */}
            <div
              style={{
                textAlign: 'left',
                background: 'var(--surface-canvas)',
                borderRadius: 14,
                padding: '14px 18px',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ink-muted)',
                  marginBottom: 6,
                }}
              >
                Quy tắc tính điểm (Tối đa 100)
              </div>
              <div className="kv">
                <span>Ca quyết toán, được đánh giá ≥ 4★</span>
                <b style={{ color: 'var(--color-success)' }}>+2 điểm</b>
              </div>
              <div className="kv">
                <span>Hủy ca trước giờ hẹn trên 12 giờ</span>
                <b style={{ color: 'var(--accent-ochre)' }}>−5 điểm</b>
              </div>
              <div className="kv">
                <span>Hủy ca gấp (trong vòng 12 giờ)</span>
                <b style={{ color: 'var(--alert-crimson)' }}>−20 điểm</b>
              </div>
              <div className="kv">
                <span>Khiếu nại của khách được xác nhận đúng</span>
                <b style={{ color: 'var(--alert-crimson)' }}>−25 điểm</b>
              </div>
            </div>

            {/* Test Helper (Chỉ hiển thị khi chạy Mock) */}
            {USE_MOCK_TRUST_SCORE && (
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  background: 'var(--surface-subtle)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: 'var(--ink-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span>Thử nghiệm mức điểm:</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ minHeight: 30, padding: '2px 8px', fontSize: 12.5 }}
                  onClick={() => handleTestScoreChange(92)}
                >
                  92 (Tốt)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ minHeight: 30, padding: '2px 8px', fontSize: 12.5 }}
                  onClick={() => handleTestScoreChange(65)}
                >
                  65 (Cảnh báo)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ minHeight: 30, padding: '2px 8px', fontSize: 12.5 }}
                  onClick={() => handleTestScoreChange(55)}
                >
                  55 (Tạm khóa)
                </button>
              </div>
            )}
          </div>

          {/* Card 2: Lịch sử điểm */}
          <ScoreHistory history={trustScoreData?.history ?? []} loading={loading} />
        </div>

        {/* Right Column: Rating Summary, Received Reviews & Sent Reviews */}
        <ReceivedReviews
          ratingAvg={trustScoreData?.ratingAvg ?? null}
          ratingCount={trustScoreData?.ratingCount ?? 0}
          distribution={trustScoreData?.ratingDistribution}
          reviews={reviews}
          sentReviews={sentReviews}
          pendingReviews={pendingReviews}
          loading={loading}
          onOpenRateModal={(pending) => setActiveRateModal(pending)}
        />
      </div>

      {/* Modal đánh giá khách hàng (W06) */}
      {activeRateModal && (
        <RateCustomerModal
          bookingId={activeRateModal.bookingId}
          bookingCode={activeRateModal.bookingCode}
          customerName={activeRateModal.customerName}
          isOpen={true}
          onClose={() => setActiveRateModal(null)}
          onSuccess={() => {
            setActiveRateModal(null);
            setToastMessage(
              'Đánh giá đã được gửi thành công! Theo quy định đánh giá 2 chiều (FR-RATE-01), nội dung sẽ hiển thị khi khách hàng hoàn tất đánh giá hoặc sau 7 ngày.'
            );
            setTimeout(() => setToastMessage(null), 6000);
            loadData();
          }}
        />
      )}
    </div>
  );
};
