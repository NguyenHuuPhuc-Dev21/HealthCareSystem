import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

/** Phân trang theo offset (khớp `{ total, limit, offset }` của các API Admin). */
export function Pagination({ total, limit, offset, onChange }: PaginationProps) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <nav className="pager" aria-label="Phân trang">
      <span>{offset + 1}–{Math.min(offset + limit, total)} / {total}</span>
      <button type="button" className="icon-btn" aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}><ChevronLeft size={18} /></button>
      <b>{page}/{pages}</b>
      <button type="button" className="icon-btn" aria-label="Trang sau" disabled={page >= pages} onClick={() => onChange(offset + limit)}><ChevronRight size={18} /></button>
    </nav>
  );
}
