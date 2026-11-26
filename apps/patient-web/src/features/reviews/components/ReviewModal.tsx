import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Button, Modal } from '../../../components';
import { getErrorMessage } from '../../../lib/errors';
import { REVIEW_COMMENT_MAX, REVIEW_TAGS, REVIEW_WINDOW_DAYS, rememberReviewed, submitReview } from '../reviews.api';
import { StarRating } from './StarRating';

interface ReviewModalProps {
  bookingId: string | null;
  bookingCode?: string;
  nurseName?: string | null;
  onClose: () => void;
  /** Gọi sau khi gửi thành công (hoặc khi backend báo đã đánh giá từ trước) */
  onDone: (result: { alreadyReviewed: boolean }) => void;
}

const MESSAGES: Record<string, string> = {
  ALREADY_REVIEWED: 'Bạn đã đánh giá ca này rồi.',
  REVIEW_WINDOW_CLOSED: `Đã quá ${REVIEW_WINDOW_DAYS} ngày kể từ khi ca kết thúc nên không thể đánh giá nữa.`,
  BOOKING_NOT_COMPLETED: 'Chỉ đánh giá được khi ca đã hoàn thành.',
};

/** Đánh giá điều dưỡng sau ca (FR-RATE-01): 1–5 sao, thẻ nhanh, nhận xét ≤ 500 ký tự. Đánh giá ẩn tới khi bên kia đánh giá hoặc sau 7 ngày. */
export function ReviewModal({ bookingId, bookingCode, nurseName, onClose, onDone }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ isVisible: boolean } | null>(null);

  useEffect(() => {
    if (bookingId) {
      setRating(0);
      setTags([]);
      setComment('');
      setError(null);
      setSent(null);
    }
  }, [bookingId]);

  const toggle = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = async () => {
    if (!bookingId || rating < 1) return;
    setSubmitting(true);
    setError(null);
    const res = await submitReview(bookingId, { rating: rating as 1 | 2 | 3 | 4 | 5, comment: comment.trim() || undefined, tags: tags.length ? tags : undefined });
    setSubmitting(false);
    if (!res.success) {
      const code = res.error?.code ?? '';
      if (code === 'ALREADY_REVIEWED') {
        rememberReviewed(bookingId);
        onDone({ alreadyReviewed: true });
        return;
      }
      setError(MESSAGES[code] ?? getErrorMessage(res.error, 'Chưa gửi được đánh giá. Vui lòng thử lại.'));
      return;
    }
    rememberReviewed(bookingId);
    setSent({ isVisible: res.data.isVisible });
  };

  return (
    <Modal
      isOpen={!!bookingId}
      onClose={() => (sent ? onDone({ alreadyReviewed: false }) : onClose())}
      title={sent ? 'Cảm ơn bạn đã đánh giá' : `Đánh giá điều dưỡng${nurseName ? ` ${nurseName}` : ''}`}
      subtitle={bookingCode ? `Ca ${bookingCode}` : undefined}
      maxWidth={540}
    >
      {sent ? (
        <div className="rv-done">
          <CheckCircle2 size={44} aria-hidden="true" />
          <p>
            {sent.isVisible
              ? 'Đánh giá của bạn và của điều dưỡng đã cùng được hiển thị.'
              : `Đánh giá của bạn đang được giữ kín. Nó sẽ hiển thị khi điều dưỡng cũng đánh giá, hoặc sau ${REVIEW_WINDOW_DAYS} ngày — để hai bên đánh giá công bằng, không bị ảnh hưởng lẫn nhau.`}
          </p>
          <Button type="button" onClick={() => onDone({ alreadyReviewed: false })}>Đóng</Button>
        </div>
      ) : (
        <>
          <StarRating value={rating} onChange={setRating} disabled={submitting} />

          <div className="field">
            <span className="field-label">Điều gì làm bạn hài lòng? <span className="ns-muted">(không bắt buộc)</span></span>
            <div className="chip-select" role="group" aria-label="Thẻ nhanh">
              {REVIEW_TAGS.map((t) => (
                <button key={t} type="button" className={tags.includes(t) ? 'selected' : ''} aria-pressed={tags.includes(t)} onClick={() => toggle(t)} disabled={submitting}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="rv-comment">Nhận xét thêm <span className="ns-muted">(không bắt buộc)</span></label>
            <textarea
              id="rv-comment"
              className="input rv-comment"
              rows={4}
              maxLength={REVIEW_COMMENT_MAX}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn để giúp các gia đình khác lựa chọn…"
              disabled={submitting}
            />
            <div className="hint rv-count">{comment.length}/{REVIEW_COMMENT_MAX}</div>
          </div>

          <p className="ns-muted rv-note">Mỗi bên chỉ đánh giá một lần cho mỗi ca, trong vòng {REVIEW_WINDOW_DAYS} ngày kể từ khi ca kết thúc.</p>
          {error && <Alert title={error} />}

          <div className="step-card__actions">
            <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>Để sau</Button>
            <Button type="button" onClick={submit} loading={submitting} disabled={rating < 1}>Gửi đánh giá</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
