import { FileText } from 'lucide-react';
import type { DisputeEvidence } from '../disputes.types';

const isImage = (e: DisputeEvidence) => e.kind === 'IMAGE' && (e.url.startsWith('data:image') || /\.(jpe?g|png|webp)(\?|$)/i.test(e.url));

const size = (b?: number) => (b ? (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`) : '');

/** Thư viện bằng chứng của một bên: ảnh xem trước (bấm mở bản gốc ở tab mới), tệp khác hiện biểu tượng. Link tải là presigned, hết hạn nhanh → tải lại chi tiết khi cần. */
export function EvidenceGallery({ items, empty }: { items: DisputeEvidence[]; empty: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="dsp-evid">
      {items.map((e) => (
        <li key={e.id}>
          <a href={e.url} target="_blank" rel="noreferrer" title={e.fileName}>
            {isImage(e) ? <img src={e.url} alt={e.fileName ?? 'Bằng chứng'} /> : <span className="dsp-evid__file"><FileText size={26} aria-hidden="true" /></span>}
            <small>{e.fileName ?? 'Bằng chứng'}{size(e.fileSizeBytes) && ` · ${size(e.fileSizeBytes)}`}</small>
          </a>
        </li>
      ))}
    </ul>
  );
}
