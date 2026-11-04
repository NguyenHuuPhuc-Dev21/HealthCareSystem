import { useRef, useState } from 'react';
import { useObjectUrl } from '../../../lib/useObjectUrl';
import { CameraCapture } from './CameraCapture';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_MB = 10; // giới hạn kỹ thuật phía client, backend vẫn kiểm tra lại

interface DocumentUploadTileProps {
  icon: string;
  title: string;
  emptyHint: string;
  /** file: chọn ảnh từ máy · camera: bắt buộc chụp trực tiếp */
  source: 'file' | 'camera';
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

/** Ô tải giấy tờ ở Bước 1 (SH3): trống → nét đứt; đã có ảnh → viền liền + ảnh xem trước. */
export function DocumentUploadTile({ icon, title, emptyHint, source, file, onChange, disabled }: DocumentUploadTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useObjectUrl(file);

  const pick = () => {
    if (disabled) return;
    setError(null);
    if (source === 'camera') setCameraOpen(true);
    else inputRef.current?.click();
  };

  const handleFile = (picked: File | undefined) => {
    if (!picked) return;
    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setError('Chỉ nhận ảnh JPG hoặc PNG.');
      return;
    }
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Ảnh quá lớn (tối đa ${MAX_FILE_MB} MB).`);
      return;
    }
    setError(null);
    onChange(picked);
  };

  return (
    <div className={`upload${file ? ' filled' : ''}${error ? ' has-error' : ''}`}>
      {previewUrl ? (
        <img className="upload__preview" src={previewUrl} alt={`Xem trước ${title}`} />
      ) : (
        <div className="upload__icon" aria-hidden="true">{icon}</div>
      )}
      <h4>{title}</h4>
      <p>{file ? file.name : emptyHint}</p>

      {error && <p className="upload__error" role="alert">{error}</p>}

      <button type="button" className={file ? 'link-button' : 'btn btn-secondary btn-sm'} onClick={pick} disabled={disabled}>
        {file ? (source === 'camera' ? 'Chụp lại' : 'Chọn ảnh khác') : source === 'camera' ? '📷 Mở camera' : '⬆ Tải ảnh lên'}
      </button>

      {source === 'file' && (
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = ''; // cho phép chọn lại cùng 1 file
          }}
        />
      )}

      {cameraOpen && (
        <CameraCapture
          onCancel={() => setCameraOpen(false)}
          onCapture={(captured) => {
            setCameraOpen(false);
            onChange(captured);
          }}
        />
      )}
    </div>
  );
}
