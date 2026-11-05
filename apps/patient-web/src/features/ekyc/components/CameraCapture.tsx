import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '../../../components';
import { Camera } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

/**
 * Chụp ảnh chân dung trực tiếp bằng camera trước (getUserMedia).
 * Không cho chọn ảnh có sẵn trong máy — đúng yêu cầu "Ảnh chân dung trực tiếp".
 * Lưu ý: getUserMedia chỉ chạy trên https hoặc localhost.
 */
export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Trình duyệt này không hỗ trợ mở camera. Vui lòng dùng Chrome, Safari hoặc Edge bản mới.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          video.play().catch(() => undefined);
        }
        setReady(true);
      })
      .catch((err: DOMException) => {
        setError(
          err.name === 'NotAllowedError'
            ? 'Bạn chưa cho phép truy cập camera. Hãy bấm biểu tượng ổ khoá trên thanh địa chỉ để cấp quyền, rồi thử lại.'
            : 'Không mở được camera. Kiểm tra thiết bị có camera và không bị ứng dụng khác chiếm dụng.'
        );
      });

    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="modal camera-modal">
        <h3 id="camera-title">Chụp ảnh chân dung</h3>
        <p className="modal-sub">Nhìn thẳng vào camera, đủ sáng, không đeo kính râm hay khẩu trang.</p>

        {error ? (
          <Alert title="Không mở được camera.">{error}</Alert>
        ) : (
          <div className="camera-frame">
            <video ref={videoRef} playsInline muted aria-label="Hình ảnh từ camera" />
            <div className="camera-oval" aria-hidden="true" />
            {!ready && <span className="camera-loading">Đang mở camera…</span>}
          </div>
        )}

        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onCancel}>Huỷ</Button>
          {!error && (
            <Button type="button" onClick={handleCapture} disabled={!ready}><Camera size={16} style={{ marginRight: 6 }} /> Chụp ảnh</Button>
          )}
        </div>
      </div>
    </div>
  );
}
