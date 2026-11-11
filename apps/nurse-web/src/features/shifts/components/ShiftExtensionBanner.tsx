import React, { useState } from 'react';
import { Clock, Check, X } from 'lucide-react';
import { DEFAULT_TRAVEL_BUFFER_MINUTES } from '@healthcare-system/shared';
import { respondToExtension } from '../shift.api';

interface ShiftExtensionBannerProps {
  bookingId: string;
  pendingExtension: {
    id: string;
    extraHours: number;
    extraAmount: number;
    requestedAt: string;
  };
  onResponded: (approved: boolean) => void;
}

export const ShiftExtensionBanner: React.FC<ShiftExtensionBannerProps> = ({
  bookingId,
  pendingExtension,
  onResponded,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAction = async (approved: boolean) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await respondToExtension({
        bookingId,
        extensionId: pendingExtension.id,
        approved,
      });

      if (res.success) {
        onResponded(approved);
      } else {
        setErrorMessage(res.message || 'Không thể xử lý yêu cầu lúc này.');
      }
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Không thể gửi phản hồi gia hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 14,
        background: '#FEF3C7',
        border: '1.5px solid #F59E0B',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Clock size={22} color="#D97706" />
        <h4 style={{ margin: 0, fontSize: 16, color: '#92400E', fontWeight: 800 }}>
          Yêu cầu gia hạn ca từ người nhà (+{pendingExtension.extraHours} giờ)
        </h4>
        <span className="chip" style={{ background: '#FDE68A', color: '#92400E', marginLeft: 'auto' }}>
          +{pendingExtension.extraAmount.toLocaleString('vi-VN')}đ thù lao
        </span>
      </div>

      <p style={{ margin: '0 0 12px 0', fontSize: 13.5, color: '#78350F' }}>
        Người nhà bệnh nhân mong muốn bạn hỗ trợ thêm {pendingExtension.extraHours} giờ. Hãy kiểm tra lịch trình cá nhân để đảm bảo đủ đệm di chuyển {DEFAULT_TRAVEL_BUFFER_MINUTES} phút cho ca tiếp theo.
      </p>

      {errorMessage && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ height: 38, borderColor: '#D97706', color: '#92400E' }}
          disabled={isSubmitting}
          onClick={() => handleAction(false)}
        >
          <X size={15} style={{ marginRight: 4 }} /> Từ chối
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ height: 38, background: '#D97706', borderColor: '#B45309' }}
          disabled={isSubmitting}
          onClick={() => handleAction(true)}
        >
          <Check size={15} style={{ marginRight: 4 }} /> Đồng ý nhận thêm ca
        </button>
      </div>
    </div>
  );
};
