import { PRICE_EXAMPLES, SERVICE_GROUPS } from '../landing-data';
import { formatVND } from '../../../lib/formatters';

export default function Services() {
    return (
        <section id="dich-vu">
            <div className="wrap">
                <div className="reveal">
                    <div className="eyebrow">Danh mục dịch vụ</div>
                    <h2 className="title">Ba nhóm dịch vụ — ranh giới rõ ràng vì an toàn</h2>
                    <p className="sub">
                        Mọi dịch vụ trên nền tảng được phân loại theo mức độ xâm lấn. Thủ thuật xâm lấn chỉ do
                        điều dưỡng Cấp 2 có GPHN hợp lệ thực hiện, bắt buộc kèm y lệnh bác sĩ.
                    </p>
                </div>

                <div className="svc-grid">
                    {SERVICE_GROUPS.map((group) => (
                        <div className={group.prohibited ? 'svc red reveal' : 'svc reveal'} key={group.title}>
                            <span className={group.chipClass} style={{ alignSelf: 'flex-start' }}>
                                {group.chipLabel}
                            </span>
                            <h3>{group.title}</h3>
                            <p>{group.desc}</p>
                            <ul>
                                {group.items.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                            {group.footChip && (
                                <div className="foot">
                                    <span className={group.footChip.className}>{group.footChip.label}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="price-examples reveal">
                    {PRICE_EXAMPLES.map((example) => (
                        <div className="price-ex" key={example.label}>
                            <b>{formatVND(example.price)}</b>
                            <span>{example.label}</span>
                        </div>
                    ))}
                </div>
                <p className="note">
                    Giá minh họa theo ca mẫu tại Đà Nẵng. Giá chính thức của từng dịch vụ được hiển thị rõ
                    trước khi bạn xác nhận đặt ca — phụ phí (nếu có) luôn tách dòng minh bạch.
                </p>
            </div>
        </section>
    );
}