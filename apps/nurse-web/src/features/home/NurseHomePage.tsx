import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, ChevronRight, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { USE_MOCK_AUTH } from '../../lib/mock-flags';
import { DEFAULT_MIN_NURSE_DEPOSIT_VND } from '@healthcare-system/shared';

/**
 * N1 · Trang chủ điều dưỡng (NAV-0 + Bento tổng quan).
 * Kết nối liền mạch tới N13 (Lịch rảnh & ngày nghỉ) và N14 (Giấy tờ & GPHN).
 */
export const NurseHomePage: React.FC = () => {
    const { session } = useAuth();
    const profile = session?.profile;
    const user = session?.user;

    if (!profile) return null;

    const fullName = user?.full_name ?? 'Điều dưỡng';
    const isTier2 = profile.tier === 'TIER_2_SPECIALIST';
    const gphnNumber = profile.gphn_number || 'Chưa cập nhật';
    const gphnExpiry = profile.gphn_expiry_date || 'Chưa xác định';
    const depositBalance = (profile as any).deposit_balance ?? DEFAULT_MIN_NURSE_DEPOSIT_VND;
    const isDepositSufficient = depositBalance >= DEFAULT_MIN_NURSE_DEPOSIT_VND;

    return (
        <div>
            {/* Header chào mừng */}
            <div className="page-head" style={{ alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: '0 0 6px', color: 'var(--navy)', fontWeight: 800 }}>
                        Xin chào, {fullName}
                    </h1>
                    <p style={{ margin: 0, color: 'var(--slate)' }}>
                        Điều dưỡng {isTier2 ? 'Cấp 2 (Chuyên môn)' : 'Cấp 1 (Cơ bản)'} · Trạng thái:{' '}
                        <span className="chip teal" style={{ padding: '2px 10px', fontSize: '13px' }}>
                            ✓ Đang hoạt động
                        </span>
                        {USE_MOCK_AUTH && (
                            <span style={{ marginLeft: '10px', color: 'var(--slate)' }}>
                                · TrustScore: <strong>{profile.trust_score ?? 98}/100</strong>
                            </span>
                        )}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Link to="/schedule" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                        <Calendar size={16} /> Quản lý lịch rảnh
                    </Link>
                </div>
            </div>

            {/* Bento Grid */}
            <div className="bento">
                {/* Tile 1: Ký quỹ */}
                <div className="tile">
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0 }}>Ví ký quỹ</h3>
                            <Wallet size={20} style={{ color: 'var(--blue)' }} />
                        </div>
                        <div className="big-num" style={{ margin: '8px 0' }}>
                            {depositBalance.toLocaleString('vi-VN')}đ
                        </div>
                        <p style={{ margin: '6px 0 10px' }}>
                            <span className={`chip ${isDepositSufficient ? 'teal' : 'amber'}`} style={{ fontSize: '13px' }}>
                                {isDepositSufficient ? '✓ Đã đủ ký quỹ' : '⚠ Chưa đủ ký quỹ (BR-14)'}
                            </span>
                        </p>
                        <p style={{ fontSize: '14.5px', color: 'var(--slate)', margin: 0, lineHeight: 1.5 }}>
                            Bạn có thể nhận mọi ca thuộc {isTier2 ? 'Cấp 2' : 'Cấp 1'}.
                        </p>
                    </div>
                    <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px dashed var(--line)' }}>
                        <Link to="/schedule" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '14.5px' }}>
                            Chi tiết ví &amp; nạp ký quỹ <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>

                {/* Tile 2: Lịch rảnh hôm nay (N13) */}
                <div className="tile">
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0 }}>Lịch rảnh hôm nay</h3>
                            <Calendar size={20} style={{ color: 'var(--blue)' }} />
                        </div>
                        <div className="big-num" style={{ margin: '8px 0' }}>07:00 – 21:00</div>
                        <p style={{ margin: '6px 0 10px' }}>
                            <span className="chip teal" style={{ fontSize: '13px' }}>✓ Đã bật nhận ca</span>
                        </p>
                        <p style={{ fontSize: '14.5px', color: 'var(--slate)', margin: 0, lineHeight: 1.5 }}>
                            Hệ thống gợi ý việc trong khung giờ rảnh đã khai báo.
                        </p>
                    </div>
                    <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px dashed var(--line)' }}>
                        <Link to="/schedule" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '14.5px' }}>
                            Chỉnh sửa lịch rảnh <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>

                {/* Tile 3: Giấy phép hành nghề GPHN */}
                <div className="tile" style={{ gridColumn: 'span 2' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0 }}>Giấy phép hành nghề (GPHN)</h3>
                            <ShieldCheck size={22} style={{ color: 'var(--blue)' }} />
                        </div>
                        <p style={{ fontSize: '16.5px', marginTop: '10px', marginBottom: '8px' }}>
                            Số <strong style={{ color: 'var(--navy)' }}>{gphnNumber}</strong> · Còn hiệu lực tới{' '}
                            <strong style={{ color: 'var(--navy)' }}>{gphnExpiry}</strong>
                        </p>
                        <p style={{ fontSize: '14.5px', color: 'var(--slate)', margin: 0, lineHeight: 1.5 }}>
                            {isTier2
                                ? 'Cấp 2 mở khóa toàn bộ dịch vụ Nhóm 1 và các thủ thuật xâm lấn Nhóm 2 theo y lệnh.'
                                : 'Cấp 1 được nhận các dịch vụ chăm sóc cơ bản Nhóm 1.'}
                        </p>
                    </div>
                    <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px dashed var(--line)' }}>
                        <Link to="/credentials" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '14.5px' }}>
                            Xem chi tiết văn bằng &amp; GPHN <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Thông báo hướng dẫn Phase 2 */}
            <div className="alert-info" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                <span>
                    <strong>Giai đoạn 2 (FR-SCHED-01) đã sẵn sàng:</strong> Hãy kiểm tra và lưu <strong>Lịch rảnh &amp; ngày nghỉ</strong> để Radar và Job Board gợi ý ca làm việc chính xác nhất trong khung giờ bạn đăng ký.
                </span>
            </div>
        </div>
    );
};
