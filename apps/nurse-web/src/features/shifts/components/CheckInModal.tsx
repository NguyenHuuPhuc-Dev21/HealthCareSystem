import React, { useState, useRef } from 'react';
import { Camera, MapPin, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { ShiftExecutionState } from '../shift.types';
import { submitCheckIn } from '../shift.api';
import { haversineDistanceMeters, CHECKIN_MAX_RADIUS_METERS } from '@healthcare-system/shared';

interface CheckInModalProps {
  shift: ShiftExecutionState;
  onSuccess: (updated: ShiftExecutionState) => void;
  onClose: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({ shift, onSuccess, onClose }) => {
  // Mock dev GPS coordinates: near (35m) vs far (450m)
  const [lat, setLat] = useState<number>(shift.patientLatitude + 0.0002);
  const [lng, setLng] = useState<number>(shift.patientLongitude + 0.0002);
  const [isMockLocation, setIsMockLocation] = useState<boolean>(false);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const distance = Math.round(
    haversineDistanceMeters(lat, lng, shift.patientLatitude, shift.patientLongitude)
  );
  const isWithinRadius = distance <= CHECKIN_MAX_RADIUS_METERS;

  const handleCapturePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfieBase64(reader.result as string);
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
    const res = await submitCheckIn({
      bookingId: shift.bookingId,
      latitude: lat,
      longitude: lng,
      isMockLocation,
      selfieImageBase64: selfieBase64,
      timestamp: new Date().toISOString(),
    });
    setIsSubmitting(false);

    if (res.success && res.data) {
      onSuccess(res.data);
    } else {
      setErrorMessage(res.message || 'Check-in thất bại.');
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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--navy)', fontWeight: 800 }}>
              Điểm Danh Bắt Đầu Ca (Check-In)
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--slate)', fontSize: 14 }}>
              Đơn {shift.bookingCode} · Bán kính quy định ≤ {CHECKIN_MAX_RADIUS_METERS}m (BR-07)
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

        {errorMessage && (
          <div
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
            backgroundColor: isWithinRadius ? '#F0FDF4' : '#FEF2F2',
            border: `1.5px solid ${isWithinRadius ? '#86EFAC' : '#FCA5A5'}`,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={24} color={isWithinRadius ? 'var(--teal)' : 'var(--red)'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)' }}>
                {isWithinRadius
                  ? `✓ Đang ở trong bán kính (${distance}m / ${CHECKIN_MAX_RADIUS_METERS}m)`
                  : `✕ Ngoài bán kính quy định (${distance}m > ${CHECKIN_MAX_RADIUS_METERS}m)`}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--slate)' }}>
                Điểm đến: {shift.patientAddress}
              </p>
            </div>
          </div>

          {/* Dev Test GPS Simulator Controls */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #CBD5E1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>[Dev GPS Test]:</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, height: 30 }}
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
              style={{ fontSize: 12, height: 30 }}
              onClick={() => {
                setLat(shift.patientLatitude + 0.004);
                setLng(shift.patientLongitude + 0.004);
              }}
            >
              Ở xa (450m)
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--red)', cursor: 'pointer', marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={isMockLocation}
                onChange={(e) => setIsMockLocation(e.target.checked)}
              />
              Giả lập Mock GPS
            </label>
          </div>
        </div>

        {/* Section 2: Camera Live Selfie Capture */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 15, color: 'var(--navy)', marginBottom: 8 }}>
            Chụp ảnh selfie trực tiếp tại chỗ (Camera phần cứng):
          </label>
          <p style={{ fontSize: 13.5, color: 'var(--slate)', margin: '0 0 10px 0' }}>
            Hệ thống chặn tải ảnh từ thư viện. Ảnh sẽ được đóng dấu GPS + timestamp để gửi người nhà đối chiếu (BR-07 §2.1).
          </p>

          {/* Hidden native camera capture input */}
          <input
            type="file"
            accept="image/*"
            capture="user"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleCapturePhoto}
          />

          {selfieBase64 ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid var(--teal)' }}>
              <img
                src={selfieBase64}
                alt="Selfie Check-in"
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
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>CareNest Verified Presence</div>
                  <div>GPS: {lat.toFixed(4)}, {lng.toFixed(4)} · {new Date().toLocaleTimeString('vi-VN')}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ height: 28, fontSize: 11, background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshCw size={12} style={{ marginRight: 4 }} /> Chụp lại
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: 180,
                borderRadius: 12,
                border: '2px dashed var(--teal)',
                backgroundColor: 'var(--mint)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
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
              >
                <Camera size={28} />
              </div>
              <strong style={{ color: 'var(--navy)', fontSize: 16 }}>Bấm để mở Camera selfie</strong>
              <span style={{ fontSize: 13, color: 'var(--slate)' }}>Chụp khuôn mặt rõ nét trước cửa/phòng bệnh nhân</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, height: 50 }}
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2, height: 50, fontSize: 16, fontWeight: 700 }}
            onClick={handleCheckInSubmit}
            disabled={isSubmitting || !isWithinRadius || isMockLocation || !selfieBase64}
          >
            {isSubmitting ? 'Đang xác thực GPS...' : 'Xác nhận Điểm danh (Bắt đầu ca)'}
          </button>
        </div>
      </div>
    </div>
  );
};
