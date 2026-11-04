/**
 * Toàn bộ dữ liệu hiển thị của landing page nằm ở file này —
 * component không hardcode số tiền, mã đơn, tên người hay liên kết CTA.
 * Dữ liệu mẫu lấy từ DESIGN.md mục 9.3 (vũ trụ dữ liệu khóa) và bản mẫu
 * landing đã duyệt (docs/design/ui-boards/landing-page.html).
 */

// Địa chỉ các app khi chạy demo local (xem DEMO.md ở gốc repo). Khi có domain thật,
// đặt VITE_PATIENT_WEB_URL / VITE_NURSE_WEB_URL trong .env của landing — không sửa code.
const PATIENT_WEB_URL = import.meta.env.VITE_PATIENT_WEB_URL ?? 'http://localhost:5173';
const NURSE_WEB_URL = import.meta.env.VITE_NURSE_WEB_URL ?? 'http://localhost:5175';
const ADMIN_WEB_URL = import.meta.env.VITE_ADMIN_WEB_URL ?? 'http://localhost:5174';

export const CTA_LINKS = {
    primaryBooking: '#dat-ca', // section CTA cuối trang — đích của các nút "Đặt điều dưỡng ngay"
    nurseSection: '#dieu-duong',
    faq: '#faq',
    patientApp: PATIENT_WEB_URL, // cổng bệnh nhân/gia đình (patient-web)
    nurseApp: `${NURSE_WEB_URL}/login`, // cổng điều dưỡng — vào thẳng màn đăng nhập
    adminApp: `${ADMIN_WEB_URL}/login`, // cổng quản trị viên (admin-web)
};

export const NAV_LINKS = [
    { href: '#dich-vu', label: 'Dịch vụ' },
    { href: '#cach-hoat-dong', label: 'Cách hoạt động' },
    { href: '#minh-bach', label: 'Minh bạch chi phí' },
    { href: '#dieu-duong', label: 'Dành cho điều dưỡng' },
    { href: '#faq', label: 'Câu hỏi thường gặp' },
];

export const SAMPLE_SHIFT = {
    code: 'HC-2026-1042',
    service: 'Thay băng vết mổ hậu phẫu',
    nurse: 'ĐD. Trần Thị Mai',
    nurseInitials: 'MT',
    nurseMeta: 'Điều dưỡng Cấp 2',
    rating: '4.9',
    trustScore: 92,
    patient: 'bà Nguyễn Thị Hoa, 78 tuổi',
    area: 'Hải Châu, Đà Nẵng',
    time: 'Hôm nay 14:30',
    price: 500_000,
    checkInProof: 'GPS cách điểm hẹn 42 m · Selfie trực tiếp đã xác thực',
};

export const HERO_POINTS = [
    {
        title: 'Hồ sơ được thẩm định thủ công',
        text: 'CCCD, bằng cấp và Giấy phép hành nghề (GPHN) do đội ngũ vận hành kiểm tra trước khi kích hoạt.',
    },
    {
        title: 'Tiền được nền tảng tạm giữ',
        text: 'chỉ giải ngân cho điều dưỡng sau khi ca kết thúc và qua 24 giờ không khiếu nại.',
    },
    {
        title: 'Check-in chống gian lận',
        text: 'GPS trong bán kính 200 m, chặn vị trí giả lập, ảnh selfie chụp trực tiếp tại nhà bạn.',
    },
];

export const COMMITMENTS = [
    { value: '100%', text: 'hồ sơ điều dưỡng được thẩm định CCCD, bằng cấp & GPHN trước ca đầu tiên' },
    { value: '≤ 200 m', text: 'bán kính GPS tối đa để check-in hợp lệ — kèm chặn vị trí giả lập và selfie trực tiếp' },
    { value: '24 giờ', text: 'cửa sổ khiếu nại sau ca trước khi quyết toán — có khiếu nại là tiền bị đóng băng ngay' },
    { value: '15%', text: 'phí nền tảng duy nhất, công khai trên mọi đơn — không phí ẩn, không phụ thu bất ngờ' },
];

export interface ServiceGroup {
    chipClass: string;
    chipLabel: string;
    title: string;
    desc: string;
    items: string[];
    footChip?: { className: string; label: string };
    prohibited?: boolean;
}

export const SERVICE_GROUPS: ServiceGroup[] = [
    {
        chipClass: 'chip teal',
        chipLabel: 'Nhóm 1 · Không xâm lấn',
        title: 'Chăm sóc cơ bản',
        desc: 'Điều dưỡng Cấp 1 & Cấp 2 đều thực hiện được.',
        items: [
            'Trông & chăm sóc theo ca 4h / 8h / 12h / 24h',
            'Vệ sinh cá nhân, tắm tại giường, xoay trở chống loét',
            'Hỗ trợ ăn uống, nhắc thuốc theo đơn có sẵn',
            'Đo sinh tồn: huyết áp, nhiệt độ, SpO2, mạch',
            'Hỗ trợ vận động, dìu đi lại, bầu bạn người cao tuổi',
        ],
    },
    {
        chipClass: 'chip',
        chipLabel: 'Nhóm 2 · Xâm lấn có điều kiện',
        title: 'Thủ thuật theo y lệnh',
        desc: 'Chỉ điều dưỡng Cấp 2 (GPHN hợp lệ) + bắt buộc có y lệnh bác sĩ đính kèm.',
        items: [
            'Tiêm dưới da, tiêm bắp (insulin, thuốc duy trì)',
            'Truyền dịch duy trì theo đúng y lệnh',
            'Thay băng, rửa vết thương, cắt chỉ sau mổ',
            'Chăm sóc sonde tiểu, sonde dạ dày đã đặt sẵn',
            'Hút đờm đường hô hấp trên',
        ],
        footChip: { className: 'chip amber', label: 'Hệ thống chặn cứng nếu chưa đủ điều kiện' },
    },
    {
        chipClass: 'chip red',
        chipLabel: 'Nhóm 3 · Cấm tuyệt đối',
        title: 'Những việc chúng tôi không làm',
        desc: 'Vì an toàn cho bệnh nhân, các thủ thuật sau không bao giờ được đặt qua nền tảng:',
        items: [
            'Truyền máu và chế phẩm máu tại nhà',
            'Truyền tĩnh mạch kháng sinh nguy cơ sốc cao, hóa chất trị liệu',
            'Tiểu phẫu, rạch áp-xe, khâu cấp cứu, gây mê tại nhà',
            'Kê đơn mới hoặc tự ý đổi phác đồ điều trị',
        ],
        footChip: { className: 'chip red', label: 'Không thể tạo đơn — hệ thống từ chối ngay' },
        prohibited: true,
    },
];

export const PRICE_EXAMPLES = [
    { price: 500_000, label: 'Thay băng vết mổ · tính theo lần' },
    { price: 800_000, label: 'Ca chăm sóc cơ bản 8 giờ' },
    { price: 580_000, label: 'Ca đêm 20:00–06:00 · đã gồm phụ phí đêm +20%' },
];

export const STEPS = [
    {
        title: 'Đăng ký & tạo hồ sơ',
        text: 'Đăng nhập bằng số điện thoại + mã OTP. Tạo hồ sơ người được chăm sóc và đồng ý xử lý dữ liệu theo Nghị định 13/2023.',
    },
    {
        title: 'Chọn dịch vụ & điều dưỡng',
        text: 'Tìm theo dịch vụ, khu vực, cấp bậc — hoặc để hệ thống ghép ca qua Radar (bán kính 5 km, mở rộng 10 km) và Bảng việc làm.',
    },
    {
        title: 'Thanh toán an toàn',
        text: 'Chuyển khoản trả trước — tiền được nền tảng tạm giữ; hoặc trả tiền mặt cho điều dưỡng khi ca kết thúc.',
    },
    {
        title: 'Theo dõi ca & đánh giá',
        text: 'Check-in GPS + selfie trực tiếp, nhật ký chăm sóc theo thời gian thực. Đánh giá hai chiều sau ca; khiếu nại trong 24 giờ nếu có vấn đề.',
    },
];

export const PRICE_SPLIT = { total: 500_000, nurse: 425_000, platform: 75_000 };

export const SURCHARGE_CHIPS = [
    'Phụ phí ca đêm 22:00–06:00 · +20%',
    'Ngày lễ thường · +200% giá gốc',
    'Tết Nguyên đán · +300% giá gốc',
    'Bệnh nhân nặng / liệt giường · +15%',
];

export const NURSE_POINTS = [
    {
        title: 'Nhận 85% giá trị mỗi ca',
        text: 'Phí nền tảng 15% công khai từ đầu. Ca 500.000đ → bạn nhận 425.000đ, quyết toán sau 24 giờ hoặc sớm hơn khi khách xác nhận.',
    },
    {
        title: 'Hai cấp bậc rõ ràng',
        text: 'Cấp 1: chăm sóc cơ bản. Cấp 2: thêm thủ thuật xâm lấn khi có GPHN hợp lệ — GPHN hết hạn chỉ tạm hạ cấp, nộp bản mới được duyệt là khôi phục ngay.',
    },
    {
        title: 'Uy tín được ghi nhận bằng TrustScore',
        text: 'Điểm số và đánh giá hai chiều giúp khách hàng tin tưởng chọn bạn — và bảo vệ bạn trước những khiếu nại không đúng.',
    },
];

export const NURSE_EARNINGS = {
    title: 'Thu nhập minh họa · ĐD. Phạm Thu Hà (Cấp 2)',
    rows: [
        { label: 'Thay băng sau mổ · chuyển khoản', amount: 425_000 },
        { label: 'Ca đêm 20:00–06:00 · chuyển khoản', amount: 493_000 },
        { label: 'Ca chăm sóc 8 giờ · tiền mặt (đã nộp hoa hồng)', amount: 680_000 },
    ],
    depositLabel: 'Ký quỹ đang giữ (chỉ trừ khi vi phạm)',
    deposit: 300_000, // ký quỹ — CHỈ trừ phạt SLA, không cộng vào thu nhập
    total: 1_598_000,
    note: 'Số liệu minh họa theo các ca mẫu trong hệ thống. Thu nhập thực tế tùy số ca và loại dịch vụ bạn nhận.',
};

export const STORY = {
    quote:
        '“Mẹ tôi thay khớp háng, cần thay băng mỗi ngày mà nhà neo người. Đặt ca buổi trưa, chiều đã có điều dưỡng tới tận nhà — tôi ở xa vẫn xem được nhật ký ca theo thời gian thực.”',
    who: 'Anh Nguyễn Văn An — đặt ca cho mẹ là bà Nguyễn Thị Hoa, 78 tuổi, Hải Châu, Đà Nẵng',
    whoNote: '(Câu chuyện minh họa dựa trên ca mẫu HC-2026-1042 của hệ thống)',
    timeline: [
        {
            time: '13:05 · ĐẶT CA',
            lead: 'Chọn dịch vụ thay băng + tải ảnh y lệnh.',
            text: 'Giá chốt ngay: 500.000đ, chuyển khoản trả trước vào tạm giữ.',
        },
        {
            time: '13:12 · GHÉP CA',
            lead: 'ĐD. Trần Thị Mai (Cấp 2) nhận ca qua Radar',
            text: '— cách nhà 1,2 km. Chị đối chiếu y lệnh trên ứng dụng trước khi xác nhận.',
        },
        {
            time: '14:30 · CHECK-IN',
            lead: 'GPS 42 m + selfie trực tiếp.',
            text: 'Chị ghi nhận tình trạng ban đầu của vết mổ vào nhật ký ca.',
        },
        {
            time: '15:20 · CHECK-OUT',
            lead: 'Báo cáo ca tối thiểu hoàn tất:',
            text: 'đã thay băng, sinh tồn ổn định, dặn dò chăm sóc. Cửa sổ khiếu nại 24 giờ bắt đầu.',
        },
        {
            time: 'HÔM SAU · QUYẾT TOÁN',
            lead: '+425.000đ vào ví của ĐD. Mai.',
            text: 'Hai bên đánh giá 5 sao — TrustScore của chị tăng lên 92.',
        },
    ],
};

export const FAQS = [
    {
        question: 'Đặt ca chăm sóc tại nhà cần những gì?',
        answer:
            'Bạn cần tài khoản đăng nhập bằng số điện thoại, hồ sơ người được chăm sóc (tình trạng vận động, tiền sử bệnh) và đồng ý xử lý dữ liệu theo Nghị định 13/2023. Nếu chăm sóc tại nhà riêng, tài khoản của bạn cần hoàn tất xác thực CCCD. Dịch vụ xâm lấn (Nhóm 2) bắt buộc đính kèm ảnh y lệnh/đơn thuốc còn hạn.',
    },
    {
        question: 'Tiền trả trước được giữ như thế nào?',
        answer:
            'Khi bạn chuyển khoản, tiền được ghi vào sổ cái của nền tảng ở trạng thái tạm giữ. Sau khi ca kết thúc và qua 24 giờ không có khiếu nại, hệ thống quyết toán: 85% cho điều dưỡng, 15% phí nền tảng. Nếu bạn xác nhận hài lòng sớm, quyết toán diễn ra ngay. Có khiếu nại, số tiền bị đóng băng tới khi phân xử xong.',
    },
    {
        question: 'Tôi trả tiền mặt cho điều dưỡng được không?',
        answer:
            'Được. Bạn trả 100% giá trị ca cho điều dưỡng khi ca kết thúc. Điều dưỡng có trách nhiệm nộp 15% hoa hồng cho nền tảng qua mã VietQR trong vòng 24 giờ; quá hạn, tài khoản tạm khóa nhận ca mới cho tới khi nộp đủ.',
    },
    {
        question: 'Hủy ca thì được hoàn bao nhiêu?',
        answer:
            'Hủy trước giờ hẹn trên 12 giờ: hoàn 100%. Từ 2–12 giờ: hoàn 80%. Dưới 2 giờ: hoàn 50%. Nếu điều dưỡng hủy ca, bạn được hoàn 100% và hệ thống ưu tiên tìm người thay thế. Mọi mốc thời gian và tỉ lệ đều công khai trong quy tắc nền tảng trước khi bạn đặt ca.',
    },
    {
        question: 'Trong ca có tình huống khẩn cấp thì sao?',
        answer:
            'Cả bạn và điều dưỡng đều có nút SOS ngay trong màn hình ca: một chạm mở trình quay số 115 đồng thời gửi cảnh báo tới người nhà và đội ngũ vận hành. Điều dưỡng cũng có quyền dừng ca và được bảo vệ khi phát hiện y lệnh không hợp lệ tại nhà bạn.',
    },
    {
        question: 'Tôi là sinh viên mới tốt nghiệp, chưa có GPHN thì sao?',
        answer:
            'Bạn vẫn đăng ký được ở Cấp 1 — chăm sóc cơ bản không xâm lấn. Khi có Giấy phép hành nghề còn hiệu lực và được thẩm định, tài khoản của bạn được nâng lên Cấp 2 để nhận thêm các thủ thuật theo y lệnh.',
    },
];

export const FOOTER_COLS = [
    {
        heading: 'Dịch vụ',
        links: [
            { href: '#dich-vu', label: 'Chăm sóc cơ bản' },
            { href: '#dich-vu', label: 'Thủ thuật theo y lệnh' },
            { href: '#dich-vu', label: 'Chăm sóc theo ca 4h–24h' },
            { href: '#dich-vu', label: 'Ca đêm 20:00–06:00' },
        ],
    },
    {
        heading: 'Nền tảng',
        links: [
            { href: '#cach-hoat-dong', label: 'Cách hoạt động' },
            { href: '#minh-bach', label: 'Minh bạch chi phí' },
            { href: '#dieu-duong', label: 'Dành cho điều dưỡng' },
            { href: '#faq', label: 'Câu hỏi thường gặp' },
        ],
    },
    {
        heading: 'An toàn & pháp lý',
        links: [
            { href: '#dich-vu', label: 'Dịch vụ cấm tuyệt đối' },
            { href: '#tinh-nang', label: 'Quy tắc bảo vệ bệnh án' },
            { href: '#faq', label: 'Chính sách hủy & hoàn tiền' },
            { href: '#faq', label: 'Đồng ý dữ liệu · Nghị định 13/2023' },
        ],
    },
];