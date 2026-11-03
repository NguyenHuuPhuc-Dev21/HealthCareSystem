import { PRICE_SPLIT, SAMPLE_SHIFT, SURCHARGE_CHIPS } from '../landing-data';
import { formatVND } from '../../../lib/formatters';

export default function Pricing() {
    return (
        <section className="money" id="minh-bach">
            <div className="wrap">
                <div className="reveal">
                    <div className="eyebrow">Minh bạch chi phí</div>
                    <h2 className="title">Mỗi đồng tiền đi đâu — nhìn thấy trước khi đặt</h2>
                    <p className="sub">
                        Ví dụ một ca thay băng trị giá {formatVND(PRICE_SPLIT.total)} thanh toán chuyển khoản:
                    </p>
                </div>

                <div className="money-card reveal">
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 8,
                        }}
                    >
                        <b style={{ color: 'var(--navy)', fontSize: 18 }}>
                            Đơn {SAMPLE_SHIFT.code} · Thay băng vết mổ
                        </b>
                        <span className="price">{formatVND(PRICE_SPLIT.total)}</span>
                    </div>

                    <div className="split-bar">
                        <div className="a">Điều dưỡng nhận — {formatVND(PRICE_SPLIT.nurse)}</div>
                        <div className="b">Nền tảng 15%</div>
                    </div>
                    <div className="split-legend">
                        <span>85% giá trị ca thuộc về người trực tiếp chăm sóc</span>
                        <span>Phí nền tảng: {formatVND(PRICE_SPLIT.platform)} — khoản phí duy nhất</span>
                    </div>

                    <div className="surcharges">
                        {SURCHARGE_CHIPS.map((chip) => (
                            <span className="chip" key={chip}>
                                {chip}
                            </span>
                        ))}
                    </div>

                    <div className="money-cols">
                        <div className="mc">
                            <h4>Trả tiền mặt tại nhà?</h4>
                            <p>
                                Được. Bạn trả 100% cho điều dưỡng khi ca xong. Điều dưỡng tự nộp 15% hoa hồng qua
                                mã VietQR trong vòng 24 giờ — nền tảng không trừ tiền từ bất kỳ ví nào của họ.
                            </p>
                        </div>
                        <div className="mc">
                            <h4>Ký quỹ 300.000đ là gì?</h4>
                            <p>
                                Điều dưỡng nạp một lần trước khi nhận ca. Khoản này <b>chỉ</b> dùng để trừ tiền
                                phạt khi vi phạm cam kết dịch vụ (hủy ca gấp, không đến) — không bao giờ dùng cho
                                mục đích khác.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}