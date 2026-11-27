import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  FileText,
  LogOut,
  Menu,
  Scale,
  Star,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useNotifications } from '../../features/notifications/NotificationContext';
import { getNotificationRoute } from '../../features/notifications/notification-routes';
import { getCommissionDebts } from '../../features/commission-payment/commission-payment.api';
import { maskPhone } from '../../lib/formatters';
import { DepositWarningBanner } from '../DepositWarningBanner';
import { CommissionOverdueBanner } from '../CommissionOverdueBanner';

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
  { label: 'Ví', path: '/wallet', isReady: true },
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
  const { notifications, unreadCount, loading: notifLoading, markAsRead } = useNotifications();
  const [unpaidCommissionCount, setUnpaidCommissionCount] = useState<number>(0);
  const [hasUrgentCommission, setHasUrgentCommission] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const profile = session?.profile;
  const user = session?.user;
  const fullName = user?.full_name ?? 'Điều dưỡng viên';
  const phone = user?.phone ?? '';
  const tier = profile?.tier === 'TIER_2_SPECIALIST' ? 'Cấp 2' : 'Cấp 1';
  const tierDesc = profile?.tier === 'TIER_2_SPECIALIST' ? 'Điều dưỡng Cấp 2 — Chuyên môn' : 'Điều dưỡng Cấp 1 — Cơ bản';

  // Check commission debts for Wallet navigation badge
  useEffect(() => {
    let alive = true;

    getCommissionDebts()
      .then((commissionRes) => {
        if (!alive) return;
        if (commissionRes.success && commissionRes.data) {
          const unpaid = commissionRes.data.filter((d) => d.status === 'UNPAID' || d.status === 'OVERDUE');
          setUnpaidCommissionCount(unpaid.length);
          const urgent = commissionRes.data.some(
            (d) =>
              d.status === 'OVERDUE' ||
              (d.status === 'UNPAID' && new Date(d.dueAt).getTime() - Date.now() < 2 * 3600 * 1000)
          );
          setHasUrgentCommission(urgent);
        }
      })
      .catch(() => {
        if (alive) {
          setUnpaidCommissionCount(0);
          setHasUrgentCommission(false);
        }
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
                  (tab.path === '/wallet' && location.pathname.startsWith('/wallet'));
            if (tab.isReady) {
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <span>{tab.label}</span>
                  {tab.path === '/wallet' && unpaidCommissionCount > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        marginLeft: 6,
                        padding: '0 5px',
                        background: hasUrgentCommission ? '#DC2626' : '#D97706',
                        color: '#ffffff',
                        lineHeight: 1,
                      }}
                      title={`${unpaidCommissionCount} khoản hoa hồng cần nộp`}
                    >
                      {unpaidCommissionCount}
                    </span>
                  )}
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
            aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} mục chưa đọc)` : ''}`}
            aria-expanded={notifOpen}
            aria-controls="nurse-notif-popover"
            title="Trung tâm thông báo"
            onClick={() => {
              setNotifOpen((v) => !v);
              setMenuOpen(false);
            }}
          >
            <Bell size={20} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="dot tabular-nums">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div
              id="nurse-notif-popover"
              className="notif-popover"
              role="region"
              aria-label="Trung tâm thông báo"
            >
              <div className="notif-popover__head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 15, color: 'var(--ink-primary)' }}>
                    Thông báo
                  </strong>
                  {unreadCount > 0 && (
                    <span className="status-pill status-pill--rose tabular-nums" style={{ fontSize: 11.5, padding: '1px 6px' }}>
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                <Link
                  to="/notifications"
                  className="notif-popover__view-all"
                  onClick={() => setNotifOpen(false)}
                >
                  Xem tất cả →
                </Link>
              </div>

              {notifLoading ? (
                <p style={{ margin: '12px 8px', fontSize: 13.5, color: 'var(--ink-secondary)' }}>
                  Đang tải thông báo...
                </p>
              ) : notifications.length === 0 ? (
                <p style={{ margin: '12px 8px', fontSize: 13.5, color: 'var(--ink-secondary)' }}>
                  Hiện chưa có thông báo nào.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {notifications.slice(0, 5).map((n) => {
                    const isUnread = !n.readAt;
                    const isHigh = n.priority === 'HIGH';
                    return (
                      <button
                        key={n.id}
                        type="button"
                        className={`notif-item ${isUnread ? 'notif-item--unread' : ''}`}
                        style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent' }}
                        onClick={() => {
                          if (isUnread) markAsRead(n.id);
                          setNotifOpen(false);
                          navigate(getNotificationRoute(n));
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                          <span
                            style={{
                              fontWeight: isUnread ? 700 : 600,
                              fontSize: 14,
                              color: isHigh ? 'var(--alert-crimson)' : 'var(--ink-primary)',
                              lineHeight: 1.35,
                            }}
                          >
                            {n.title}
                          </span>
                          {isUnread && (
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'var(--alert-crimson)',
                                flexShrink: 0,
                                marginTop: 4,
                              }}
                              title="Chưa đọc"
                            />
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--ink-secondary)',
                            marginTop: 3,
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {n.body}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="notif-popover__foot">
                <Link
                  to="/notifications"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 13, minHeight: 32 }}
                  onClick={() => setNotifOpen(false)}
                >
                  Mở trung tâm thông báo
                </Link>
              </div>
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
                  <span>{phone ? maskPhone(phone) : 'Chưa cập nhật SĐT'} · {tierDesc}</span>
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
              <Link to="/wallet" role="menuitem" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mi"><Wallet size={18} /></span>
                  <span>Ví &amp; thu nhập</span>
                </div>
                {unpaidCommissionCount > 0 && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      background: hasUrgentCommission ? '#FEE2E2' : '#FEF3C7',
                      color: hasUrgentCommission ? '#DC2626' : '#B45309',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {unpaidCommissionCount} nợ hoa hồng
                  </span>
                )}
              </Link>
              <Link to="/trust-score" role="menuitem">
                <span className="mi"><Star size={18} /></span>
                Đánh giá &amp; TrustScore
              </Link>
              <Link to="/disputes" role="menuitem">
                <span className="mi"><Scale size={18} /></span>
                Khiếu nại &amp; Phản hồi
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

      <CommissionOverdueBanner />
      <DepositWarningBanner />

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
                  (tab.path === '/wallet' && location.pathname.startsWith('/wallet'));
            if (tab.isReady) {
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMobileNavOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>{tab.label}</span>
                  {tab.path === '/wallet' && unpaidCommissionCount > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '0 6px',
                        background: hasUrgentCommission ? '#DC2626' : '#D97706',
                        color: '#ffffff',
                      }}
                    >
                      {unpaidCommissionCount} nợ hoa hồng
                    </span>
                  )}
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
