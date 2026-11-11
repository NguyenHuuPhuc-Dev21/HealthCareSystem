import React, { useState } from 'react';
import { AlertTriangle, Camera, X } from 'lucide-react';
import { rejectInvalidPrescription } from '../shift.api';
import { DEFAULT_TRAVEL_SUPPORT_VND } from '@healthcare-system/shared';

interface InvalidPrescriptionModalProps {
  bookingId: string;
  bookingCode: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const InvalidPrescriptionModal: React.FC<InvalidPrescriptionModalProps> = ({
  bookingId,
  bookingCode,
  onSuccess,
  onClose,
}) => {
  const [reason, setReason] = useState<string>('Thuốc/vật tư thực tế không khớp với y lệnh của bác sĩ');
  const [detailNote, setDetailNote] = useState<string>('');
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCapturePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidencePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!evidencePhoto) {
      setErrorMessage('Bắt buộc phải chụp ảnh bằng chứng (y lệnh gốc hoặc vỏ thuốc sai lệch) để đối soát.');
      return;
    }

    setIsSubmitting(true);
    const res = await rejectInvalidPrescription({
      bookingId,
      reason: `${reason}: ${detailNote}`,
      evidencePhotoBase64: evidencePhoto,
      evidenceFileName: `evidence_invalid_order_${bookingCode.toLowerCase()}.jpg`,
    });
    setIsSubmitting(false);

    if (res.success) {
      onSuccess();
    } else {
      setErrorMessage(res.message || 'Gửi từ chối thất bại.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 540,
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 24,
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, color: 'var(--red)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={20} />
              Từ Chối Ca Do Y Lệnh Không Hợp Lệ
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--slate)', fontSize: 13.5 }}>
              Đơn {bookingCode} · Cổng bảo vệ điều dưỡng (FR-BOOK-02, BR-15 §2.2)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '50%', width: 36, height: 36, padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Legal protection note */}
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#166534',
            fontSize: 13.5,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          <strong>Chính sách bảo vệ điều dưỡng:</strong> Nếu y lệnh giả mạo, hết hạn (&gt; 7 ngày), thuốc sai loại hoặc người nhà không có bản gốc: Ca hủy ngay, <b>bạn không bị phạt tiền, không bị trừ điểm TrustScore</b> và được hỗ trợ {DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ chi phí đi lại.
        </div>

        {errorMessage && (
          <div style={{ padding: 10, borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontSize: 13.5, marginBottom: 14 }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
              Lý do từ chối can thiệp:
            </label>
            <select
              className="input"
              style={{ width: '100%', height: 44 }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="Thuốc/vật tư thực tế không khớp với y lệnh của bác sĩ">
                Thuốc/vật tư thực tế không khớp với y lệnh
              </option>
              <option value="Không có bản y lệnh giấy gốc có chữ ký/con dấu hợp pháp">
                Không xuất trình được y lệnh giấy gốc
              </option>
              <option value="Y lệnh đã quá hạn 7 ngày kể từ ngày bác sĩ kê đơn">
                Y lệnh đã hết hạn (&gt; 7 ngày)
              </option>
              <option value="Nghi vấn y lệnh bị tẩy xóa, sửa đổi hoặc làm giả">
                Y lệnh có dấu hiệu giả mạo / sửa chữa
              </option>
              <option value="Tên bệnh nhân trên đơn thuốc không trùng với người bệnh">
                Tên bệnh nhân không trùng khớp
              </option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
              Chi tiết đối chiếu thực tế:
            </label>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 70, padding: 8, fontSize: 14 }}
              placeholder="Ghi rõ tên thuốc, nồng độ hoặc biểu hiện sai lệch cụ thể..."
              value={detailNote}
              onChange={(e) => setDetailNote(e.target.value)}
              required
            />
          </div>

          {/* Mandatory Photo Evidence */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
              Chụp ảnh bằng chứng đối soát tại chỗ (bắt buộc):
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapturePhoto}
              style={{ display: 'none' }}
              id="prescription-evidence-input"
            />
            {evidencePhoto ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--red)' }}>
                <img src={evidencePhoto} alt="Evidence" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                <label
                  htmlFor="prescription-evidence-input"
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Chụp lại
                </label>
              </div>
            ) : (
              <label
                htmlFor="prescription-evidence-input"
                style={{
                  height: 120,
                  border: '2px dashed var(--red)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#FEF2F2',
                  cursor: 'pointer',
                }}
              >
                <Camera size={26} color="var(--red)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--red)', marginTop: 6 }}>
                  Bấm để chụp ảnh đơn thuốc / vỏ thuốc thực tế
                </span>
              </label>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, height: 48 }}
              onClick={onClose}
            >
              Quay lại
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2, height: 48, background: 'var(--red)', borderColor: 'var(--red)', fontWeight: 700 }}
              disabled={isSubmitting || !evidencePhoto}
            >
              {isSubmitting ? 'Đang gửi...' : 'Xác nhận Từ Chối Ca Không Phạt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
