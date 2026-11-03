import { X, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Credential } from '../nurse-verification.types';
import { DOC_META } from '../nurse-verification.types';
import { useCredentialUrls } from '../useCredentialUrls';

interface DocumentViewerProps {
  nurseId: string;
  credentials: Credential[];
  initialDocType?: Credential['doc_type'];
}

const ZOOMS = [1, 1.5, 2, 3];

/** Ảnh giấy tờ: khung xem chính + dải thumbnail; bấm ảnh để mở lightbox toàn màn hình (A3). */
export function DocumentViewer({ nurseId, credentials, initialDocType = 'GPHN' }: DocumentViewerProps) {
  const { urlFor, ensure, refresh } = useCredentialUrls(nurseId);
  const startIndex = Math.max(0, credentials.findIndex((c) => c.doc_type === initialDocType));
  const [index, setIndex] = useState(startIndex);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState(0);

  const current = credentials[index];
  const url = current ? urlFor(current.id) : null;
  const meta = current ? DOC_META[current.doc_type] : null;

  // Xin presigned URL cho ảnh đang xem; kiểm tra lại mỗi 20s để làm mới trước khi hết hạn
  useEffect(() => {
    if (!current) return;
    ensure(current.id);
    const id = window.setInterval(() => ensure(current.id), 20_000);
    return () => window.clearInterval(id);
  }, [current, ensure]);

  const go = (delta: number) => {
    setIndex((i) => (i + delta + credentials.length) % credentials.length);
    setZoom(0);
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(ZOOMS.length - 1, z + 1));
      if (e.key === '-') setZoom((z) => Math.max(0, z - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, credentials.length]);

  if (!current || !meta) return <div className="doc-viewer doc-viewer--empty">Ứng viên chưa tải giấy tờ nào.</div>;

  const image = (className: string) =>
    url === 'error' ? (
      <div className={`${className} doc-viewer__placeholder`}>
        <span>Không tải được ảnh.</span>
        <button type="button" className="link-button" onClick={(e) => { e.stopPropagation(); refresh(current.id); }}>Thử lại</button>
      </div>
    ) : url ? (
      <img
        className={className}
        src={url}
        alt={meta.label}
        onError={() => refresh(current.id)} // URL vừa hết hạn → xin URL mới
        style={className.includes('lightbox') ? { transform: `scale(${ZOOMS[zoom]})` } : undefined}
        draggable={false}
      />
    ) : (
      <div className={`${className} doc-viewer__placeholder`}>Đang tải ảnh…</div>
    );

  return (
    <div className="doc-viewer">
      <button type="button" className="doc-viewer__main" onClick={() => setLightbox(true)} aria-label={`Mở ${meta.label} toàn màn hình`}>
        {image('doc-viewer__img')}
        <span className="doc-viewer__hint"><ZoomIn size={14} aria-hidden="true" /> Bấm để phóng to · {meta.label}</span>
      </button>

      <div className="doc-viewer__thumbs" role="tablist" aria-label="Giấy tờ đã nộp">
        {credentials.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={`doc-thumb${i === index ? ' active' : ''}`}
            onClick={() => { setIndex(i); setZoom(0); }}
            title={DOC_META[c.doc_type].label}
          >
            <span aria-hidden="true">{(() => { const ThumbIcon = DOC_META[c.doc_type].icon; return <ThumbIcon size={17} />; })()}</span>
          </button>
        ))}
      </div>
      <p className="doc-viewer__caption">{credentials.map((c) => DOC_META[c.doc_type].label).join(' · ')}</p>

      {lightbox && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${meta.label} — xem toàn màn hình`} onClick={() => setLightbox(false)}>
          <div className="lightbox__bar" onClick={(e) => e.stopPropagation()}>
            <span><meta.icon size={15} /> {meta.label} ({index + 1}/{credentials.length})</span>
            <div className="lightbox__tools">
              <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Thu nhỏ">－</button>
              <span>{Math.round(ZOOMS[zoom] * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Phóng to">＋</button>
              <button type="button" onClick={() => setLightbox(false)} aria-label="Đóng"><X size={17} /></button>
            </div>
          </div>
          <button type="button" className="lightbox__nav lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Ảnh trước">‹</button>
          <div className="lightbox__stage" onClick={(e) => e.stopPropagation()}>
            {image('lightbox__img')}
          </div>
          <button type="button" className="lightbox__nav lightbox__nav--next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Ảnh sau">›</button>
        </div>
      )}
    </div>
  );
}
