import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  FileText,
  LogOut,
  Menu,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { ExecutionStatus } from '@healthcare-system/shared';
import { useAuth } from '../../features/auth/AuthContext';
import { getMyShifts } from '../../features/shifts/shift.api';
import { maskPhone } from '../../lib/formatters';

interface HeaderNotification {
  id: string;
  title: string;
  subtitle: string;
  to: string;
  urgent?: boolean;
}

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

interface NavTab {
  label: string;
  path: string;
  isReady: boolean;
  tip?: string;
}

const NAV_TABS: NavTab[] = [
  { label: 'Trang chủ', path: '/', isReady: true },
  { label: 'Việc làm', path: '/jobs', isReady: true },
  { label: 'Ca của tôi', path: '/shifts', isReady: true },
  { label: 'Ví', path: '/wallet/withdraw', isReady: true },
  { label: 'Lịch rảnh', path: '/schedule', isReady: true },
  { label: 'Văn bằng', path: '/credentials', isReady: true },
];

export const NurseLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const profile = session?.profile;
  const user = session?.user;
  const fullName = user?.full_name ?? 'Điều dưỡng viên';
  const phone = user?.phone ?? '';
  const tier = profile?.tier === 'TIER_2_SPECIALIST' ? 'Cấp 2' : 'Cấp 1';
  const tierDesc = profile?.tier === 'TIER_2_SPECIALIST' ? 'Điều dưỡng Cấp 2 — Chuyên môn' : 'Điều dưỡng Cấp 1 — Cơ bản';

  // Aggregate real notifications from shifts API
  useEffect(() => {
    let alive = true;
    setNotifLoading(true);
    getMyShifts()
      .then((res) => {
        if (!alive) return;
        if (!res.success) {
          setNotifications([]);
          return;
        }
        const items: HeaderNotification[] = [];
        for (const s of res.data) {
          if (s.executionStatus === ExecutionStatus.IN_PROGRESS && !s.assessmentCompleted) {
            items.push({
              id: `${s.bookingId}-assess`,
              title: `Cần đánh giá 30 phút · ${s.serviceName}`,
              subtitle: `Đơn ${s.bookingCode} · Người bệnh ${s.patientName}`,
              to: `/shifts/${s.bookingId}/execute`,
              urgent: true,
            });
          } else if (s.executionStatus === ExecutionStatus.IN_PROGRESS) {
            items.push({
              id: `${s.bookingId}-active`,
              title: `Ca đang thực hiện · ${s.serviceName}`,
              subtitle: `${s.startTime} – ${s.endTime} · ${s.patientName}`,
              to: `/shifts/${s.bookingId}/execute`,
            });
          } else if (s.executionStatus === ExecutionStatus.CONFIRMED) {
            items.push({
              id: `${s.bookingId}-upcoming`,
              title: `Ca trực sắp tới · ${s.serviceName}`,
              subtitle: `${s.startTime} – ${s.endTime} · Đơn ${s.bookingCode}`,
              to: `/shifts/${s.bookingId}`,
            });
          }
        }
        setNotifications(items);
      })
      .catch(() => {
        if (alive) setNotifications([]);
      })
      .finally(() => {
        if (alive) setNotifLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  // Click outside or Escape to close avatar/notification menus
  useEffect(() => {
    if (!menuOpen && !notifOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, notifOpen]);

  // Close menus on navigation
  useEffect(() => {
    setMenuOpen(false);
    setNotifOpen(false);
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="nurse-app-frame">
      <header className="navbar">
        <button
          type="button"
          className="nav-mobile-toggle"
          aria-label={mobileNavOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
          aria-expanded={mobileNavOpen}
          aria-controls="nurse-mobile-nav"
          onClick={() => {
            setMobileNavOpen((v) => !v);
            setMenuOpen(false);
            setNotifOpen(false);
          }}
        >
          {mobileNavOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>

        <Link to="/" className="logo">
          <LogoMark />
          <span>CareNest</span>
        </Link>

        <nav className="nav-links" aria-label="Điều hướng chính">
          {NAV_TABS.map((tab) => {
            const active =
              tab.path === '/'
                ? location.pathname === '/'
                : location.pathname === tab.path ||
                  location.pathname.startsWith(`${tab.path}/`) ||
                  (tab.path === '/wallet/withdraw' && location.pathname.startsWith('/wallet'));
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
            aria-label={`Thông báo${notifications.length > 0 ? ` (${notifications.length} mục mới)` : ''}`}
            aria-expanded={notifOpen}
            aria-controls="nurse-notif-popover"
            title="Thông báo ca trực"
            onClick={() => {
              setNotifOpen((v) => !v);
              setMenuOpen(false);
            }}
          >
            <Bell size={20} aria-hidden="true" />
            {notifications.length > 0 && (
              <span className="dot tabular-nums">{notifications.length}</span>
            )}
          </button>

          {notifOpen && (
            <div
              id="nurse-notif-popover"
              className="notif-popover"
              role="region"
              aria-label="Thông báo ca trực"
            >
              <div className="notif-popover__head">
                <strong style={{ fontSize: 15.5, color: 'var(--ink-primary)' }}>
                  Thông báo ca trực
                </strong>
                <span className="status-pill status-pill--neutral tabular-nums">
                  {notifications.length} mục
                </span>
              </div>

              {notifLoading ? (
                <p style={{ margin: '8px 6px', fontSize: 14, color: 'var(--ink-secondary)' }}>
                  Đang tải thông báo...
                </p>
              ) : notifications.length === 0 ? (
                <p style={{ margin: '8px 6px', fontSize: 14, color: 'var(--ink-secondary)' }}>
                  Hiện chưa có thông báo ca trực nào cần xử lý.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {notifications.map((n) => (
                    <Link
                      key={n.id}
                      to={n.to}
                      className="notif-item"
                      onClick={() => setNotifOpen(false)}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14.5,
                          color: n.urgent ? 'var(--alert-crimson)' : 'var(--ink-primary)',
                        }}
                      >
                        {n.title}
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--ink-secondary)', marginTop: 2 }}>
                        {n.subtitle}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="userblock"
            onClick={() => {
              setMenuOpen((v) => !v);
              setNotifOpen(false);
            }}
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
              <Link to="/wallet/withdraw" role="menuitem">
                <span className="mi"><Wallet size={18} /></span>
                Ví &amp; Rút tiền
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

      {mobileNavOpen && (
        <nav
          id="nurse-mobile-nav"
          className="nav-mobile-drawer"
          aria-label="Điều hướng di động"
        >
          {NAV_TABS.map((tab) => {
            const active =
              tab.path === '/'
                ? location.pathname === '/'
                : location.pathname === tab.path ||
                  location.pathname.startsWith(`${tab.path}/`) ||
                  (tab.path === '/wallet/withdraw' && location.pathname.startsWith('/wallet'));
            if (tab.isReady) {
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMobileNavOpen(false)}
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
      )}

      <main className="screen-body elder">
        <div className="page">{children}</div>
      </main>
    </div>
  );
};
