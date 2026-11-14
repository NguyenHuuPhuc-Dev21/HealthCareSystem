import React from 'react';
import { Link } from 'react-router-dom';
import { Award, Calendar, Landmark, PhoneCall, Zap } from 'lucide-react';

export const QuickActionsCard: React.FC = () => {
  return (
    <aside className="ledger-panel" aria-label="Thao tác nhanh 1 chạm">
      <div className="ledger-panel__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} color="var(--brand-jade)" aria-hidden="true" />
          <h3 className="ledger-panel__title">Thao tác nhanh</h3>
        </div>
        <span className="chip grey" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999 }}>
          1 chạm
        </span>
      </div>

      <div className="quick-actions-grid">
        <Link to="/schedule" className="quick-action-btn">
          <Calendar size={22} aria-hidden="true" />
          <span>Lịch rảnh</span>
        </Link>

        <Link to="/wallet/withdraw" className="quick-action-btn">
          <Landmark size={22} aria-hidden="true" />
          <span>Rút tiền</span>
        </Link>

        <Link to="/credentials" className="quick-action-btn">
          <Award size={22} aria-hidden="true" />
          <span>Văn bằng</span>
        </Link>

        <a href="tel:19006868" className="quick-action-btn" style={{ color: 'var(--alert-crimson)' }}>
          <PhoneCall size={22} style={{ color: 'var(--alert-crimson)' }} aria-hidden="true" />
          <span>Tổng đài 24/7</span>
        </a>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '10px 12px',
          background: 'var(--surface-canvas)',
          borderRadius: 8,
          fontSize: 12.5,
          color: 'var(--ink-secondary)',
          lineHeight: 1.4,
          border: '1px solid var(--border-hairline)',
        }}
      >
        💡 <b>Hỗ trợ khẩn cấp:</b> Trong lúc đang trực, bạn luôn có thể kích hoạt nút <b>Báo động SOS</b> ngay trên màn hình ca trực để tổng đài can thiệp ngay lập tức.
      </div>
    </aside>
  );
};
