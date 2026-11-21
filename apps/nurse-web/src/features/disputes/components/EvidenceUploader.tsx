import React, { useRef, useState } from 'react';
import { AlertCircle, Trash2, Upload, Video } from 'lucide-react';

export interface SelectedEvidenceFile {
  file: File;
  previewUrl: string;
  kind: 'IMAGE' | 'VIDEO';
  id: string;
}

export interface EvidenceUploaderProps {
  files: SelectedEvidenceFile[];
  onChange: (files: SelectedEvidenceFile[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  disabled?: boolean;
}

const MAX_FILES_DEFAULT = 5;
const MAX_SIZE_BYTES_DEFAULT = 20 * 1024 * 1024; // 20 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EvidenceUploader: React.FC<EvidenceUploaderProps> = ({
  files,
  onChange,
  maxFiles = MAX_FILES_DEFAULT,
  maxSizeBytes = MAX_SIZE_BYTES_DEFAULT,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setErrorMessage(null);

    const incoming = Array.from(e.target.files);
    if (files.length + incoming.length > maxFiles) {
      setErrorMessage(`Bạn chỉ được tải lên tối đa ${maxFiles} tệp bằng chứng.`);
      e.target.value = '';
      return;
    }

    const newFiles: SelectedEvidenceFile[] = [];

    for (const file of incoming) {
      if (file.size > maxSizeBytes) {
        setErrorMessage(
          `Tệp "${file.name}" vượt quá dung lượng tối đa cho phép (${formatFileSize(maxSizeBytes)}).`
        );
        e.target.value = '';
        return;
      }

      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        setErrorMessage(`Tệp "${file.name}" không đúng định dạng. Chỉ chấp nhận ảnh hoặc video.`);
        e.target.value = '';
        return;
      }

      newFiles.push({
        file,
        previewUrl: URL.createObjectURL(file),
        kind: isVideo ? 'VIDEO' : 'IMAGE',
        id: `ev-upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      });
    }

    onChange([...files, ...newFiles]);
    e.target.value = '';
  };

  const handleRemove = (index: number) => {
    const target = files[index];
    if (target?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(target.previewUrl);
    }
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
    setErrorMessage(null);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-primary)' }}>
          Đính kèm hình ảnh / video bằng chứng (tối đa {maxFiles} tệp)
        </label>
        <span
          className="tabular-nums"
          style={{
            fontSize: 12.5,
            color: files.length >= maxFiles ? 'var(--alert-crimson)' : 'var(--ink-muted)',
            fontWeight: files.length >= maxFiles ? 700 : 500,
          }}
        >
          {files.length} / {maxFiles} tệp
        </span>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--alert-crimson-soft)',
            color: 'var(--alert-crimson)',
            border: '1px solid #FECACA',
            fontSize: 13,
            marginBottom: 10,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Upload Zone */}
      {files.length < maxFiles && (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-hairline)',
            borderRadius: 12,
            padding: '18px 16px',
            textAlign: 'center',
            background: disabled ? 'var(--surface-subtle)' : 'var(--surface-canvas)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s ease, background 0.15s ease',
            marginBottom: 12,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleSelectFiles}
            disabled={disabled}
          />
          <Upload
            size={24}
            style={{ color: 'var(--brand-jade)', margin: '0 auto 6px' }}
            aria-hidden="true"
          />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-primary)' }}>
            Nhấn để tải lên ảnh hoặc video bằng chứng
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
            Hỗ trợ PNG, JPG, JPEG, MP4, MOV · Tối đa {formatFileSize(maxSizeBytes)} mỗi tệp
          </div>
        </div>
      )}

      {/* Selected files list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--surface-paper)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {item.kind === 'VIDEO' ? (
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 6,
                      background: 'var(--accent-ochre-soft)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Video size={18} color="var(--accent-ochre)" aria-hidden="true" />
                  </div>
                ) : (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 6,
                      objectFit: 'cover',
                      border: '1px solid var(--border-hairline)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--ink-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.file.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                    {formatFileSize(item.file.size)} · {item.kind === 'VIDEO' ? 'Video' : 'Hình ảnh'}
                  </div>
                </div>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '4px 8px',
                    minHeight: 28,
                    color: 'var(--alert-crimson)',
                    borderColor: 'transparent',
                  }}
                  aria-label={`Xóa tệp ${item.file.name}`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
