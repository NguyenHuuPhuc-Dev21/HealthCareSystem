import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, MessageSquare, Star } from 'lucide-react';
import { ChatPanel } from '../../chat/ChatPanel';
import { FileDisputeModal } from '../../disputes/components/FileDisputeModal';
import { ReviewModal } from '../../reviews/components/ReviewModal';
import { REVIEW_WINDOW_DAYS, wasReviewed } from '../../reviews/reviews.api';
import type { Booking } from '../booking.types';

type Subject = Pick<Booking, 'id' | 'code' | 'executionStatus' | 'paymentStatus' | 'disputeStatus' | 'endAt'>;

interface PostShiftActionsProps {
  booking: Subject;
  nurseName?: string | null;
  /** Gọi sau khi gửi khiếu nại / đánh giá để trang cha tải lại dữ liệu và hiện thông báo */
  onChanged?: (message?: string) => void;
  /** Mở sẵn khung chat (vd. đi từ thông báo "tin nhắn mới") */
  autoOpenChat?: boolean;
  /** `stack`: xếp dọc (danh sách đơn) · `row`: xếp ngang (trang theo dõi ca) */
  layout?: 'stack' | 'row';
}

/**
 * Các hành động sau/trong ca (Phase 6): nhắn tin với điều dưỡng, đánh giá, khiếu nại — kèm các hộp thoại tương ứng.
 * Điều kiện hiện nút chỉ để gợi ý đúng lúc; thời hạn thật do backend kiểm tra (REVIEW_WINDOW_CLOSED, DISPUTE_WINDOW_CLOSED).
 */
export function PostShiftActions({ booking, nurseName, onChanged, autoOpenChat, layout = 'stack' }: PostShiftActionsProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(() => wasReviewed(booking.id));

  useEffect(() => {
    if (autoOpenChat) setChatOpen(true);
  }, [autoOpenChat]);

  const { executionStatus: exec, paymentStatus: pay, disputeStatus: dispute } = booking;
  const canChat = exec === 'CONFIRMED' || exec === 'IN_PROGRESS' || exec === 'COMPLETED';
  const canReview = exec === 'COMPLETED' && !reviewed && Date.now() - Date.parse(booking.endAt) < REVIEW_WINDOW_DAYS * 86_400_000;
  const canDispute = (exec === 'IN_PROGRESS' || exec === 'COMPLETED') && dispute === 'NONE' && pay !== 'SETTLED' && pay !== 'REFUNDED';

  if (!canChat && !canReview && !canDispute && dispute === 'NONE') return null;

  return (
    <>
      <div className={`psa psa--${layout}`}>
        {canChat && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setChatOpen(true)}>
            <MessageSquare size={14} aria-hidden="true" /> {exec === 'COMPLETED' ? 'Xem tin nhắn' : 'Nhắn tin'}
          </button>
        )}
        {canReview && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setReviewId(booking.id)}>
            <Star size={14} aria-hidden="true" /> Đánh giá
          </button>
        )}
        {canDispute && (
          <button type="button" className="btn btn-secondary btn-sm psa__danger" onClick={() => setDisputeId(booking.id)}>
            <Flag size={14} aria-hidden="true" /> Khiếu nại
          </button>
        )}
        {dispute !== 'NONE' && <Link to="/disputes" className="btn btn-secondary btn-sm"><Flag size={14} aria-hidden="true" /> Xem khiếu nại</Link>}
      </div>

      {canChat && <ChatPanel bookingId={booking.id} bookingCode={booking.code} isOpen={chatOpen} onClose={() => setChatOpen(false)} viewerRole="PATIENT" />}

      <ReviewModal
        bookingId={reviewId}
        bookingCode={booking.code}
        nurseName={nurseName}
        onClose={() => setReviewId(null)}
        onDone={({ alreadyReviewed }) => {
          setReviewId(null);
          setReviewed(true);
          onChanged?.(alreadyReviewed ? 'Bạn đã đánh giá ca này trước đó.' : 'Cảm ơn bạn đã đánh giá điều dưỡng.');
        }}
      />

      <FileDisputeModal
        bookingId={disputeId}
        bookingCode={booking.code}
        onClose={() => setDisputeId(null)}
        onFiled={() => {
          setDisputeId(null);
          onChanged?.(`Đã gửi khiếu nại cho ca ${booking.code}. Tiền tạm giữ được đóng băng cho tới khi Admin quyết định.`);
        }}
      />
    </>
  );
}
