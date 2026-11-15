import React, { useId, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, Lock, Send, Tag } from 'lucide-react';
import type { CreateReviewInput } from '@healthcare-system/shared';
import { Modal, ModalCloseButton } from '../../../components';
import { StarInput } from './StarInput';
import { submitCustomerRating } from '../reviews.api';

export interface RateCustomerModalProps {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_TAGS = [
  'Hợp tác tốt',
  'Thông tin bệnh nhân đúng',
  'Môi trường sạch sẽ',
  'Thanh toán đúng hạn',
  'Thân thiện, tôn trọng',
  'Người nhà theo sát dặn dò',
];

export const RateCustomerModal: React.FC<RateCustomerModalProps> = ({
  bookingId,
  bookingCode,
  customerName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const titleId = useId();

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setErrorMessage('Vui lòng chọn số sao đánh giá (từ 1 đến 5 sao).');
      return;
    }

    if (comment.length > 500) {
      setErrorMessage('Nhận xét không được vượt quá 500 ký tự.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const input: CreateReviewInput = {
      rating: rating as 1 | 2 | 3 | 4 | 5,
      comment: comment.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    };

    try {
      const res = await submitCustomerRating(bookingId, input);
      if (res.success) {
        onSuccess();
      } else {
        const code = res.error?.code;
        if (code === 'REVIEW_ALREADY_SUBMITTED') {
          setErrorMessage('Bạn đã gửi đánh giá cho ca trực này rồi.');
        } else if (code === 'REVIEW_WINDOW_CLOSED') {
          setErrorMessage('Thời hạn đánh giá cho ca này đã kết thúc (quá 7 ngày kể từ khi hoàn tất).');
        } else {
          setErrorMessage(res.error?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.');
        }
      }
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLowRating = rating > 0 && rating <= 2;

  return (
    <Modal open onClose={onClose} titleId={titleId} maxWidth={560}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          borderBottom: '1px solid var(--border-hairline)',
          paddingBottom: 14,
        }}
      >
        <div>
          <h2
            id={titleId}
            className="font-display"
            style={{
              margin: '0 0 4px',
              fontSize: 21,
              fontWeight: 700,
              color: 'var(--ink-primary)',
            }}
          >
            Đánh giá khách hàng sau ca trực
          </h2>
          <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink-secondary)' }}>
            Mã ca: <b className="tabular-nums">{bookingCode}</b> · Khách hàng: <b>{customerName}</b>
          </p>
        </div>
        <ModalCloseButton onClick={onClose} />
      </div>

      <form onSubmit={handleSubmit}>
        {errorMessage && (
          <div
            role="alert"
            className="alert-error"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: '0 0 16px',
              padding: '10px 14px',
              fontSize: 14,
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Star Rating Selection */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--ink-primary)',
              marginBottom: 4,
            }}
          >
            Mức độ hài lòng của bạn về buổi làm việc <span style={{ color: 'var(--alert-crimson)' }}>*</span>
          </label>
          <StarInput value={rating} onChange={(val) => setRating(val)} disabled={submitting} />
        </div>

        {/* Low rating guidance reminder (<= 2 stars) */}
        {isLowRating && (
          <div
            role="note"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: 13.5,
              lineHeight: 1.45,
              marginBottom: 16,
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div>
              <b>Có sự cố bất thường tại ca trực?</b>
              <div style={{ marginTop: 2 }}>
                Nếu xảy ra vi phạm hợp đồng, xúc phạm hoặc môi trường nguy hiểm, bạn có thể gửi phản
                ánh hoặc mở khiếu nại để ban quản trị CareNest bảo vệ quyền lợi của bạn.
              </div>
            </div>
          </div>
        )}

        {/* 2. Quick Tags Selection */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink-primary)',
              marginBottom: 8,
            }}
          >
            <Tag size={15} color="var(--brand-jade)" aria-hidden="true" />
            <span>Điểm nổi bật (chọn nhanh)</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  disabled={submitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 34,
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    border: `1.5px solid ${isSelected ? 'var(--brand-jade)' : 'var(--border-hairline)'}`,
                    background: isSelected ? 'var(--brand-jade-soft)' : 'var(--surface-canvas)',
                    color: isSelected ? 'var(--brand-jade)' : 'var(--ink-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected && <Check size={13} aria-hidden="true" />}
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Comment Textarea */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <label
              htmlFor="customer-comment-input"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-primary)' }}
            >
              Nhận xét chi tiết (không bắt buộc)
            </label>
            <span
              className="tabular-nums"
              style={{
                fontSize: 12.5,
                color: comment.length > 500 ? 'var(--alert-crimson)' : 'var(--ink-muted)',
              }}
            >
              {comment.length} / 500
            </span>
          </div>

          <textarea
            id="customer-comment-input"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            maxLength={500}
            placeholder="Chia sẻ thêm về thái độ hợp tác, sự phối hợp của người nhà, điều kiện chăm sóc..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1.5px solid var(--border-hairline)',
              fontSize: 14.5,
              fontFamily: 'inherit',
              lineHeight: 1.45,
              resize: 'vertical',
            }}
          />
        </div>

        {/* 4. Blind Review Explanatory Notice */}
        <div
          role="note"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--surface-canvas)',
            border: '1px dashed var(--border-hairline)',
            fontSize: 13,
            color: 'var(--ink-secondary)',
            marginBottom: 20,
          }}
        >
          <Lock size={16} style={{ color: 'var(--brand-jade)', flexShrink: 0 }} aria-hidden="true" />
          <span>
            <b>Đánh giá hai chiều (FR-RATE-01):</b> Đánh giá của bạn sẽ được ẩn cho đến khi khách
            hàng cũng gửi đánh giá, hoặc sau 7 ngày để đảm bảo tính khách quan.
          </span>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 16,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Để sau
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || rating === 0}
          >
            <Send size={16} aria-hidden="true" />
            <span>{submitting ? 'Đang gửi...' : 'Gửi đánh giá'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
