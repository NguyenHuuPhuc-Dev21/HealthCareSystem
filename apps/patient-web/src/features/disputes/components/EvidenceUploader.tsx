import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, ImagePlus, X } from 'lucide-react';
import { EVIDENCE_ACCEPT, EVIDENCE_EXT_LABEL, MAX_EVIDENCE_FILES, MAX_EVIDENCE_MB } from '../disputes.types';

interface EvidenceUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

const fmtSize = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Chọn tối đa 5 tệp bằng chứng (JPG/PNG/WEBP/PDF, ≤ 20 MB mỗi tệp); có xem trước ảnh và nút gỡ từng tệp. */
export function EvidenceUploader({ files, onChange, disabled }: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const previews = useMemo(() => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const add = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const next = [...files];
    const problems: string[] = [];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_EVIDENCE_FILES) {
        problems.push(`Chỉ đính kèm tối đa ${MAX_EVIDENCE_FILES} tệp.`);
        break;
      }
      if (!EVIDENCE_ACCEPT.includes(f.type)) problems.push(`"${f.name}": chỉ nhận ${EVIDENCE_EXT_LABEL}.`);
      else if (f.size > MAX_EVIDENCE_MB * 1024 * 1024) problems.push(`"${f.name}": quá ${MAX_EVIDENCE_MB} MB.`);
      else if (next.some((x) => x.name === f.name && x.size === f.size)) problems.push(`"${f.name}": đã chọn rồi.`);
      else next.push(f);
    }
    setError(problems.length ? problems.join(' ') : null);
    onChange(next);
  };

  const remove = (i: number) => {
    setError(null);
    onChange(files.filter((_, n) => n !== i));
  };

  return (
    <div className="ev">
      <div
        className={`ev__drop${dragging ? ' is-drag' : ''}${disabled ? ' is-disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
      >
        <ImagePlus size={26} aria-hidden="true" />
        <p>Kéo thả hoặc <button type="button" className="link-button" onClick={() => inputRef.current?.click()} disabled={disabled || files.length >= MAX_EVIDENCE_FILES}>chọn tệp</button></p>
        <small>{EVIDENCE_EXT_LABEL} · tối đa {MAX_EVIDENCE_MB} MB mỗi tệp · {files.length}/{MAX_EVIDENCE_FILES} tệp</small>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept={EVIDENCE_ACCEPT.join(',')}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && <div className="field-error" role="alert">{error}</div>}

      {files.length > 0 && (
        <ul className="ev__list" aria-label="Tệp bằng chứng đã chọn">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}`}>
              {previews[i] ? <img src={previews[i]!} alt="" /> : <span className="ev__pdf" aria-hidden="true"><FileText size={22} /></span>}
              <span className="ev__name">{f.name}<small>{fmtSize(f.size)}</small></span>
              <button type="button" className="icon-btn" aria-label={`Gỡ ${f.name}`} onClick={() => remove(i)} disabled={disabled}><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
