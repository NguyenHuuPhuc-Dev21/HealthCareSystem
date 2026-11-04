import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { maskPhone } from '../../lib/phone';
import { initialsOf, LogoMark } from './SetupLayout';

/**
 * Navbar Patient chuẩn NAV-0: logo · 5 tab · chuông · avatar + menu.
 * Mục chưa có màn hình thì để `to: null` → hiển thị mờ, chưa bấm được.
 */
const NAV_ITEMS: Array<{ label: string; to: string | null; match?: string[] }> = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Dịch vụ', to: null },
  { label: 'Đơn của tôi', to: null },
  { label: 'Tin nhắn', to: null },
  { label: 'Tài khoản', to: '/patient-profiles', match: ['/patient-profiles'] },
];

const MENU_ITEMS: Array<{ icon: string; label: string; to: string | null }> = [
  { icon: '👤', label: 'Hồ sơ cá nhân', to: null },
  { icon: '🩺', label: 'Hồ sơ người được chăm sóc', to: '/patient-profiles' },
  { icon: '💳', label: 'Thanh toán của tôi', to: null },
  { icon: '🔔', label: 'Thông báo', to: null },
  { icon: '🔒', label: 'Quyền riêng tư & dữ liệu', to: null },
  { icon: '💬', label: 'Hỗ trợ', to: null },
];

interface PatientLayoutProps {
  fullName?: string | null;
  phone?: string | null;
  onSignOut: () => void;
  children: ReactNode;
}

export function PatientLayout({ fullName, phone, onSignOut, children }: PatientLayoutProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = fullName || 'Tài khoản của tôi';

  // Đóng menu khi bấm ra ngoài / nhấn Esc / chuyển trang
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.to === location.pathname || (item.match ?? []).some((m) => location.pathname.startsWith(m));

  return (
    <div className="app-shell">
      <header className="navbar">
        <Link to="/" className="navbar__logo"><LogoMark />CareNest</Link>

        <nav className="nav-links" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) =>
            item.to ? (
              <Link key={item.label} to={item.to} className={isActive(item) ? 'active' : undefined} aria-current={isActive(item) ? 'page' : undefined}>
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className="is-disabled" aria-disabled="true" title="Đang phát triển">{item.label}</span>
            )
          )}
        </nav>

        <div className="navbar__right" ref={menuRef}>
          {/* TODO: số thông báo chưa đọc — làm ở Phase 6 (notifications) */}
          <button type="button" className="bell" aria-label="Thông báo" disabled title="Đang phát triển">🔔</button>
          <button
            type="button"
            className="userblock"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="avatar" aria-hidden="true">{initialsOf(fullName)}</span>
            <span className="userblock__name">{displayName}</span>
            <span className="userblock__caret" aria-hidden="true">▾</span>
          </button>

          {menuOpen && (
            <div className="avatar-menu" role="menu">
              <div className="avatar-menu__head">
                <span className="avatar avatar--lg" aria-hidden="true">{initialsOf(fullName)}</span>
                <div>
                  <b>{displayName}</b>
                  {phone && <span>{maskPhone(phone)}</span>}
                </div>
              </div>
              {MENU_ITEMS.map((m) =>
                m.to ? (
                  <Link key={m.label} to={m.to} role="menuitem">
                    <span className="mi" aria-hidden="true">{m.icon}</span>{m.label}
                  </Link>
                ) : (
                  <span key={m.label} className="is-disabled" role="menuitem" aria-disabled="true">
                    <span className="mi" aria-hidden="true">{m.icon}</span>{m.label}
                  </span>
                )
              )}
              <div className="avatar-menu__divider" />
              <button type="button" role="menuitem" className="avatar-menu__logout" onClick={onSignOut}>
                <span className="mi" aria-hidden="true">↩️</span>Đăng xuất
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
