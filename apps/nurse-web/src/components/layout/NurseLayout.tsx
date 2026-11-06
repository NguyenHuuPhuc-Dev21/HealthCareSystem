import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  FileText,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { maskPhone } from '../../lib/formatters';

export function LogoMark({ size = 33 }: { size?: number }) {
  return (
    <span
      className="logo-mark"
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: 'linear-gradient(135deg, #166B58, #5FB3A1)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 32 32"
        style={{ display: 'block' }}
      >
        <path
          d="M5 14 L16 5 L27 14"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 20.5 Q16 25.5 23.5 20.5"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <rect x="14.9" y="12.6" width="2.2" height="7" fill="#fff" />
        <rect x="12.5" y="15" width="7" height="2.2" fill="#fff" />
      </svg>
    </span>
  );
}

export function initialsOf(fullName?: string | null): string {
  if (!fullName) return 'ĐD';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || 'ĐD';
}

const NAV_TABS = [
  { label: 'Trang chủ', path: '/', isReady: true },
  { label: 'Việc làm', path: '/jobs', isReady: false, tip: 'Sắp ra mắt ở Giai đoạn 3 (Radar & Job Board)' },
  { label: 'Ca của tôi', path: '/shifts', isReady: false, tip: 'Sắp ra mắt ở Giai đoạn 4 (Ca trực)' },
  { label: 'Ví', path: '/wallet', isReady: false, tip: 'Sắp ra mắt ở Giai đoạn 5 (Ví & Thu nhập)' },
  { label: 'Lịch rảnh', path: '/schedule', isReady: true },
  { label: 'Văn bằng', path: '/credentials', isReady: true },
];

export const NurseLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const profile = session?.profile;
  const user = session?.user;
  const fullName = user?.full_name ?? 'Điều dưỡng viên';
  const phone = user?.phone ?? '';
  const tier = profile?.tier === 'TIER_2_SPECIALIST' ? 'Cấp 2' : 'Cấp 1';
  const tierDesc = profile?.tier === 'TIER_2_SPECIALIST' ? 'Điều dưỡng Cấp 2 — Chuyên môn' : 'Điều dưỡng Cấp 1 — Cơ bản';

  // Click outside to close avatar menu
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="nurse-app-frame">
      <header className="navbar">
        <Link to="/" className="logo">
          <LogoMark />
          <span>CareNest</span>
        </Link>

        <nav className="nav-links" aria-label="Điều hướng chính">
          {NAV_TABS.map((tab) => {
            const active = location.pathname === tab.path;
            if (tab.isReady) {
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              );
            }
            return (
              <span
                key={tab.path}
                className="nav-link-disabled"
                title={tab.tip}
                aria-disabled="true"
              >
                {tab.label}
              </span>
            );
          })}
        </nav>

        <div className="nav-right" ref={menuRef}>
          <button
            type="button"
            className="bell"
            aria-label="Thông báo"
            title="Thông báo mới"
            onClick={() => {}}
          >
            <Bell size={20} />
            <span className="dot">3</span>
          </button>

          <button
            type="button"
            className="userblock"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Menu tài khoản"
          >
            <span className="avatar">{initialsOf(fullName)}</span>
            <span className="uname">{fullName}</span>
            <span className="chip teal">{tier}</span>
            <span className="caret">▾</span>
          </button>

          {menuOpen && (
            <div className="avatar-menu open" role="menu">
              <div className="am-head">
                <span className="avatar lg">{initialsOf(fullName)}</span>
                <div>
                  <b>{fullName}</b>
                  <span>{phone ? maskPhone(phone) : '0905 ••• 123'} · {tierDesc}</span>
                </div>
              </div>

              <Link to="/" role="menuitem">
                <span className="mi"><User size={18} /></span>
                Hồ sơ cá nhân
              </Link>
              <Link to="/schedule" role="menuitem">
                <span className="mi"><Calendar size={18} /></span>
                Lịch rảnh &amp; ngày nghỉ
              </Link>
              <Link to="/credentials" role="menuitem">
                <span className="mi"><FileText size={18} /></span>
                Văn bằng &amp; GPHN
              </Link>

              <div className="divider" />

              <button
                type="button"
                className="avatar-menu-logout"
                role="menuitem"
                onClick={handleLogout}
              >
                <span className="mi"><LogOut size={18} /></span>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="screen-body elder">
        <div className="page">{children}</div>
      </main>
    </div>
  );
};
