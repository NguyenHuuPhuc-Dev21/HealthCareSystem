import { formatVND } from '../../../lib/formatters';
import { PRICE_EXAMPLES } from '../landing-data';

/** Bento grid — theo DESIGN.md, bento chỉ xuất hiện ở section này của landing. */
export default function TrustFeatures() {
    return (
        <section id="tinh-nang">
            <div className="wrap">
                <div className="reveal">
                    <div className="eyebrow">Vì sao chọn CareNest</div>
                    <h2 className="title">Thiết kế để cả hai phía đều yên tâm</h2>
                </div>
                <div className="bento">
                    <div className="tile big reveal">
                        <span className="ic">📡</span>
                        <h3>Ghép ca Radar &amp; Bảng việc làm</h3>
                        <p>
                            Ca gấp được phát qua Radar theo khoảng cách. Ca đặt trước lên Bảng việc làm hoặc gửi
                            thẳng tới điều dưỡng bạn chọn.
                        </p>
                        <div className="radar-flex">
                            <svg
                                className="radar-svg"
                                viewBox="0 0 200 200"
                                role="img"
                                aria-label="Sơ đồ Radar ghép ca: vòng 5 km và vòng 10 km quanh nhà bệnh nhân"
                            >
                                <circle cx="100" cy="100" r="94" className="radar-ring" />
                                <circle cx="100" cy="100" r="52" className="radar-ring inner" />
                                <text x="100" y="16" textAnchor="middle" className="radar-lbl soft">
                                    10 km
                                </text>
                                <text x="100" y="40" textAnchor="middle" className="radar-lbl soft">
                                    5 km
                                </text>
                                <circle cx="132" cy="76" r="11" className="radar-pulse" />
                                <circle cx="132" cy="76" r="5" className="radar-nurse" />
                                <text x="132" y="58" textAnchor="middle" className="radar-lbl">
                                    ĐD. Mai · 1,2 km
                                </text>
                                <circle cx="100" cy="100" r="5" className="radar-home" />
                                <text x="100" y="122" textAnchor="middle" className="radar-lbl">
                                    Nhà bệnh nhân
                                </text>
                            </svg>
                            <div className="radar-steps">
                                <div className="rstep">
                                    <b>0–5 phút</b>
                                    <span>Trong 5 km — ca gấp đến điều dưỡng gần nhất</span>
                                </div>
                                <div className="rstep">
                                    <b>Sau 5 phút</b>
                                    <span>Mở rộng 10 km — nếu chưa ai nhận</span>
                                </div>
                                <div className="rstep">
                                    <b>Nhận ca</b>
                                    <span>Khóa lịch ngay — không bao giờ trùng ca</span>
                                </div>
                            </div>
                        </div>
                        <div className="jobboard">
                            <h4>Bảng việc làm — ca đặt trước</h4>
                            <div className="jb-row">
                                <span>{PRICE_EXAMPLES[1].label}</span>
                                <b>{formatVND(PRICE_EXAMPLES[1].price)}</b>
                            </div>
                            <div className="jb-row">
                                <span>{PRICE_EXAMPLES[2].label}</span>
                                <b>{formatVND(PRICE_EXAMPLES[2].price)}</b>
                            </div>
                            <p className="jb-note">
                                Điều dưỡng chọn ca hợp lịch trống — hệ thống vẫn khóa trùng ca.
                            </p>
                        </div>
                    </div>

                    <div className="tile reveal">
                        <span className="ic">🛡️</span>
                        <h3>Ví 3 ngăn, sổ cái bất biến</h3>
                        <p>
                            Tiền khả dụng, tiền tạm giữ và ký quỹ tách bạch. Mọi biến động là một dòng sổ cái
                            riêng — không sửa, không xóa.
                        </p>
                        <div className="mini-ledger">
                            <div>
                                <span>Quyết toán ca HC-2026-1039</span>
                                <b>+{formatVND(425_000)}</b>
                            </div>
                            <div>
                                <span>Tạm giữ đơn HC-2026-1042</span>
                                <b>{formatVND(500_000)}</b>
                            </div>
                        </div>
                    </div>

                    <div className="tile reveal">
                        <span className="ic">⭐</span>
                        <h3>TrustScore 100 điểm</h3>
                        <p>
                            Điểm uy tín của điều dưỡng tăng theo ca tốt, giảm khi hủy ca gấp hoặc khiếu nại đúng.
                            Dưới 60 điểm: tạm khóa nhận ca.
                        </p>
                    </div>

                    <div className="tile reveal">
                        <span className="ic">💬</span>
                        <h3>Chat &amp; gọi, che số điện thoại</h3>
                        <p>
                            Liên lạc ngay trong ứng dụng, hai bên không thấy số thật của nhau. Hệ thống tự quét
                            tin nhắn lộ số điện thoại / link ngoài.
                        </p>
                    </div>

                    <div className="tile reveal">
                        <span className="ic">📋</span>
                        <h3>Bệnh án chỉ mở đúng cửa sổ</h3>
                        <p>
                            Điều dưỡng chỉ xem được hồ sơ và ảnh y lệnh từ khi ca được xác nhận tới 12 giờ sau
                            khi kết thúc ca. Mọi lượt xem đều ghi nhật ký.
                        </p>
                    </div>

                    <div
                        className="tile wide reveal"
                        style={{ background: 'var(--red-bg)', borderColor: '#F3D3D3' }}
                    >
                        <span className="ic">🚨</span>
                        <h3>Nút SOS trong ca</h3>
                        <p>
                            Một chạm mở ngay màn hình gọi <b>115</b>, đồng thời gửi cảnh báo tới người nhà và đội
                            ngũ vận hành. Không qua tổng đài trung gian, không chậm một giây nào.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}