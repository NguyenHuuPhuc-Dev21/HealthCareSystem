import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Camera, MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import { ShiftExecutionState } from '../shift.types';
import { submitCheckIn } from '../shift.api';
import { haversineDistanceMeters, CHECKIN_MAX_RADIUS_METERS } from '@healthcare-system/shared';
import { Modal, ModalCloseButton } from '../../../components';
import { USE_MOCK_SHIFTS } from '../../../lib/mock-flags';

interface CheckInModalProps {
  shift: ShiftExecutionState;
  onSuccess: (updated: ShiftExecutionState) => void;
  onClose: () => void;
}

const ALLOW_GPS_SIMULATOR = USE_MOCK_SHIFTS && import.meta.env.DEV;

export const CheckInModal: React.FC<CheckInModalProps> = ({ shift, onSuccess, onClose }) => {
  const titleId = useId();
  const selfieInputId = useId();

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('Đang đọc vị trí GPS từ trình duyệt...');
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [isMockLocation, setIsMockLocation] = useState<boolean>(false);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestRealGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setGpsLoading(true);
    setGpsStatus('Đang xác định vị trí GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsStatus('Đã đồng bộ tọa độ GPS thiết bị.');
        setGpsLoading(false);
      },
      () => {
        setGpsStatus('Chưa lấy được GPS (hãy cấp quyền vị trí cho trình duyệt và thử lại).');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    requestRealGps();
  }, [requestRealGps]);

  const distance =
    lat !== null && lng !== null
      ? Math.round(haversineDistanceMeters(lat, lng, shift.patientLatitude, shift.patientLongitude))
      : null;
  const isWithinRadius = distance !== null && distance <= CHECKIN_MAX_RADIUS_METERS;

  const handleCapturePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfieBase64(reader.result as string);
        setCapturedAt(new Date().toLocaleTimeString('vi-VN'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCheckInSubmit = async () => {
    setErrorMessage(null);

    // 1. Check Anti-Mock Location (BR-07 §2.1)
    if (isMockLocation) {
      setErrorMessage('Hệ thống phát hiện định vị giả lập (Mock Location). Không thể check-in.');
      return;
    }

    if (lat === null || lng === null || distance === null) {
      setErrorMessage('Chưa có tọa độ GPS thiết bị. Vui lòng cấp quyền định vị và bấm Cập nhật GPS.');
      return;
    }

    // 2. Check Distance <= 200m
    if (!isWithinRadius) {
      setErrorMessage(`Bạn đang cách địa chỉ ca trực ${distance}m (> ${CHECKIN_MAX_RADIUS_METERS}m). Hãy di chuyển tới nơi trước khi check-in.`);
      return;
    }

    // 3. Check Live Selfie
    if (!selfieBase64) {
      setErrorMessage('Vui lòng chụp ảnh selfie nhận diện trực tiếp bằng camera thiết bị.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitCheckIn({
        bookingId: shift.bookingId,
        latitude: lat,
        longitude: lng,
        isMockLocation,
        selfieImageBase64: selfieBase64,
        timestamp: new Date().toISOString(),
      });
      if (res.success && res.data) {
        onSuccess(res.data);
      } else {
        setErrorMessage(res.message || 'Check-in thất bại.');
      }
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ khi điểm danh. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} titleId={titleId} maxWidth={540}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 id={titleId} style={{ margin: 0, fontSize: 20, color: 'var(--navy)', fontWeight: 800 }}>
              Điểm Danh Bắt Đầu Ca (Check-In)
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--slate)', fontSize: 14 }}>
              Đơn {shift.bookingCode} · Bán kính quy định ≤ {CHECKIN_MAX_RADIUS_METERS}m (BR-07)
            </p>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              backgroundColor: '#FDE8E8',
              color: '#9B1C1C',
              fontSize: 14,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: GPS Distance Verification */}
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: isWithinRadius && !isMockLocation ? '#F0FDF4' : '#FEF2F2',
            border: `1.5px solid ${isWithinRadius && !isMockLocation ? '#86EFAC' : '#FCA5A5'}`,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={24} color={isWithinRadius && !isMockLocation ? 'var(--teal)' : 'var(--red)'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)' }}>
                {isMockLocation
                  ? '✕ Phát hiện định vị giả lập — Bị chặn điểm danh'
                  : distance === null
                  ? gpsStatus
                  : isWithinRadius
                  ? `✓ Đang ở trong bán kính (${distance}m / ${CHECKIN_MAX_RADIUS_METERS}m)`
                  : `✕ Ngoài bán kính quy định (${distance}m > ${CHECKIN_MAX_RADIUS_METERS}m)`}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--slate)' }}>
                Điểm đến: {shift.patientAddress}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={requestRealGps}
              disabled={gpsLoading}
              style={{ fontSize: 13 }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              {gpsLoading ? 'Đang lấy GPS...' : 'Cập nhật GPS hiện tại'}
            </button>
          </div>

          {/* Dev Test GPS Simulator Controls — gated strictly to DEV + mock mode */}
          {ALLOW_GPS_SIMULATOR && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #CBD5E1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>[Dev GPS Test]:</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 13 }}
                onClick={() => {
                  setLat(shift.patientLatitude + 0.0002);
                  setLng(shift.patientLongitude + 0.0002);
                }}
              >
                Ở tại chỗ (35m)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 13 }}
                onClick={() => {
                  setLat(shift.patientLatitude + 0.004);
                  setLng(shift.patientLongitude + 0.004);
                }}
              >
                Ở xa (450m)
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--red)', cursor: 'pointer', marginLeft: 'auto', minHeight: 48 }}>
                <input
                  type="checkbox"
                  checked={isMockLocation}
                  onChange={(e) => setIsMockLocation(e.target.checked)}
                />
                Giả lập Mock GPS
              </label>
            </div>
          )}
        </div>

        {/* Section 2: Camera Live Selfie Capture */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor={selfieInputId}
            style={{ display: 'block', fontWeight: 700, fontSize: 15, color: 'var(--navy)', marginBottom: 8 }}
          >
            Chụp ảnh selfie trực tiếp tại chỗ (Camera thiết bị):
          </label>
          <p style={{ fontSize: 13.5, color: 'var(--slate)', margin: '0 0 10px 0' }}>
            Trên điện thoại hệ thống ưu tiên mở camera trước trực tiếp. Ảnh sẽ được gắn dấu GPS + thời gian để gửi người nhà đối chiếu (BR-07 §2.1).
          </p>

          {/* Hidden camera capture input */}
          <input
            id={selfieInputId}
            type="file"
            accept="image/*"
            capture="user"
            ref={fileInputRef}
            className="sr-only"
            onChange={handleCapturePhoto}
          />

          {selfieBase64 ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid var(--teal)' }}>
              <img
                src={selfieBase64}
                alt="Ảnh selfie điểm danh tại nhà người bệnh"
                style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
              />
              {/* Watermark Overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#ffffff',
                  padding: '8px 12px',
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div className="tabular-nums">
                  <div style={{ fontWeight: 700 }}>CareNest Verified Presence</div>
                  <div>GPS: {lat !== null && lng !== null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Chờ GPS'} · {capturedAt}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 13, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshCw size={14} aria-hidden="true" /> Chụp lại
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="camera-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--teal)',
                  marginBottom: 8,
                }}
                aria-hidden="true"
              >
                <Camera size={28} />
              </div>
              <strong style={{ color: 'var(--navy)', fontSize: 16 }}>Bấm để mở Camera selfie</strong>
              <span style={{ fontSize: 13, color: 'var(--slate)' }}>Chụp khuôn mặt rõ nét trước cửa/phòng bệnh nhân</span>
            </button>
          )}
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, minHeight: 50 }}
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2, minHeight: 50, fontSize: 16, fontWeight: 700 }}
            onClick={handleCheckInSubmit}
            disabled={isSubmitting || !isWithinRadius || isMockLocation || !selfieBase64}
          >
            {isSubmitting ? 'Đang xác thực GPS...' : 'Xác nhận Điểm danh (Bắt đầu ca)'}
          </button>
        </div>
    </Modal>
  );
};
