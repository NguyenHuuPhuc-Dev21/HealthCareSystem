import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  HeartPulse,
  MapPin,
  Moon,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Syringe,
  X,
} from 'lucide-react';
import { Alert, Button } from '../components';
import { PatientLayout } from '../components/layout/PatientLayout';
import { useAuth } from '../features/auth';
import { getPatientProfiles } from '../features/patient-profiles/patient-profiles.api';
import type { PatientProfileDto } from '../features/patient-profiles/patient-profiles.types';

interface NurseItem {
  id: string;
  name: string;
  avatar: string;
  tier: string;
  rating: string;
  stars: string;
  completedShifts: number;
  distance: string;
  gphn: string | null;
  retiredBadge: boolean;
  availability: string;
  availabilityTone: 'teal' | 'amber' | 'grey';
  specialties: string[];
  bio: string;
}

const NURSES: NurseItem[] = [
  {
    id: 'nurse-mai',
    name: 'ĐD. Trần Thị Mai',
    avatar: 'TM',
    tier: 'Cấp 2',
    rating: '4.9',
    stars: '★★★★★',
    completedShifts: 128,
    distance: '1,2 km',
    gphn: '00976/GPHN-ĐN',
    retiredBadge: true,
    availability: 'Trống tối nay',
    availabilityTone: 'teal',
    specialties: ['Thay băng vết mổ', 'Tiêm bắp/dưới da', 'Truyền dịch y lệnh', 'Chăm sóc người cao tuổi'],
    bio: 'Nguyên điều dưỡng trưởng khoa Ngoại, hơn 25 năm kinh nghiệm chăm sóc bệnh nhân hậu phẫu và người cao tuổi tại Đà Nẵng.',
  },
  {
    id: 'nurse-ha',
    name: 'ĐD. Phạm Thu Hà',
    avatar: 'HA',
    tier: 'Cấp 2',
    rating: '4.8',
    stars: '★★★★★',
    completedShifts: 95,
    distance: '2,6 km',
    gphn: '01284/GPHN-ĐN',
    retiredBadge: false,
    availability: 'Trống ngày mai',
    availabilityTone: 'teal',
    specialties: ['Thay băng vết thương', 'Cắt chỉ hậu phẫu', 'Chăm sóc ống thông', 'Hút đờm'],
    bio: 'Cử nhân Điều dưỡng chuyên ngành Phục hồi chức năng, thành thạo các thủ thuật y tế tại nhà theo đúng y lệnh bác sĩ.',
  },
  {
    id: 'nurse-hung',
    name: 'Nguyễn Văn Hùng',
    avatar: 'NH',
    tier: 'Cấp 1 · Chăm sóc cơ bản',
    rating: '4.7',
    stars: '★★★★☆',
    completedShifts: 42,
    distance: '3,1 km',
    gphn: null,
    retiredBadge: false,
    availability: 'Trống cuối tuần',
    availabilityTone: 'teal',
    specialties: ['Hỗ trợ ăn uống, vệ sinh', 'Vận động & xoay trở', 'Trông nom người bệnh', 'Túc trực ca đêm'],
    bio: 'Tốt nghiệp Trung cấp Điều dưỡng, chu đáo, nhiệt tình và kiên nhẫn trong chăm sóc người bệnh suy giảm vận động.',
  },
];

const CAROUSEL_SLIDES = [
  {
    chip: 'Bắt đầu tại đây',
    title: 'Đặt ca tại nhà trong 3 bước',
    desc: 'Chọn dịch vụ → Chọn điều dưỡng đã thẩm định → Thanh toán tạm giữ an toàn. Xong — hệ thống lo phần còn lại.',
    cta: 'Đặt ca ngay →',
    action: 'book',
  },
  {
    chip: 'An toàn y tế',
    title: '100% Điều dưỡng có chứng chỉ hành nghề (GPHN)',
    desc: 'Thẩm định thủ công bởi hội đồng chuyên môn. Dịch vụ xâm lấn (tiêm, truyền, thay băng) bắt buộc y lệnh của bác sĩ.',
    cta: 'Xem dịch vụ thủ thuật →',
    action: 'invasive',
  },
  {
    chip: 'Bảo vệ quyền lợi',
    title: 'Thanh toán tạm giữ & giải quyết tranh chấp 24h',
    desc: 'Tiền được nền tảng giữ an toàn cho đến khi hoàn tất ca và được bạn xác nhận hoặc sau 24h không có khiếu nại.',
    cta: 'Xem chính sách an toàn →',
    action: 'policy',
  },
];

const LOCATIONS = [
  'Hải Châu, Đà Nẵng',
  'Thanh Khê, Đà Nẵng',
  'Sơn Trà, Đà Nẵng',
  'Ngũ Hành Sơn, Đà Nẵng',
  'Cẩm Lệ, Đà Nẵng',
  'Liên Chiểu, Đà Nẵng',
];

export function HomePage() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;

  const [activeSlide, setActiveSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Dữ liệu hồ sơ người bệnh thực tế nếu có
  const [profiles, setProfiles] = useState<PatientProfileDto[]>([]);
  const primaryPatient = profiles[0] ?? null;

  // Modals tương tác
  const [shiftDetailOpen, setShiftDetailOpen] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState<NurseItem | null>(null);
  const [selectedService, setSelectedService] = useState<{
    title: string;
    desc: string;
    tier: string;
    badge: string;
    price: string;
    requiresOrder: boolean;
  } | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  // Tải danh sách người được chăm sóc để cá nhân hóa lời chào
  useEffect(() => {
    let cancelled = false;
    getPatientProfiles().then((res) => {
      if (!cancelled && res.success && res.data) {
        setProfiles(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tự động chuyển slide sau mỗi 7s nếu người dùng không tương tác
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  // Lọc điều dưỡng theo tìm kiếm
  const filteredNurses = NURSES.filter((nurse) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      nurse.name.toLowerCase().includes(q) ||
      nurse.tier.toLowerCase().includes(q) ||
      nurse.specialties.some((s) => s.toLowerCase().includes(q))
    );
  });

  const handleCarouselAction = (action: string) => {
    if (action === 'book' || action === 'invasive') {
      setSelectedService({
        title: 'Thủ thuật y tế tại nhà',
        desc: 'Thay băng, tiêm, truyền dịch theo y lệnh bác sĩ — chỉ điều dưỡng Cấp 2 có Giấy phép hành nghề (GPHN) còn hiệu lực.',
        tier: 'Điều dưỡng Cấp 2',
        badge: 'Nhóm 2 · Xâm lấn có điều kiện',
        price: 'Từ 150.000đ – 500.000đ / lần',
        requiresOrder: true,
      });
    } else if (action === 'policy') {
      setPolicyModalOpen(true);
    }
  };

  const displayName = user?.full_name || 'anh An';

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      {flash && <Alert tone="success">{flash}</Alert>}
<<<<<<< Updated upstream
      <div className="page-head">
        <h1>Xin chào 👋</h1>
        <p>Trang chủ (P1) sẽ làm ở Phase 2–3. Hiện bạn có thể quản lý hồ sơ người được chăm sóc.</p>
=======

      {/* 1. Phần lời chào & chọn địa chỉ (P1 .greet) */}
      <div className="greet">
        <div>
          <h1>Xin chào, {displayName}</h1>
          <p>
            {primaryPatient
              ? `Hôm nay bạn cần chăm sóc cho ${primaryPatient.full_name}?`
              : 'Hôm nay bạn cần hỗ trợ chăm sóc sức khỏe cho người thân?'}
          </p>
        </div>
        <button
          type="button"
          className="addr-pick"
          onClick={() => setShowLocationPicker(true)}
          title="Bấm để đổi khu vực giao ca"
        >
          <MapPin size={15} style={{ color: 'var(--blue)' }} />
          <span>Giao ca tại: {selectedLocation}</span>
          <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
        </button>
>>>>>>> Stashed changes
      </div>

      {/* Cảnh báo eKYC CCCD theo quy chuẩn SRS v2.0 */}
      {user?.kyc_status !== 'VERIFIED' && (
        <Alert
          tone="info"
          title={user?.kyc_status === 'PENDING' ? 'CCCD đang chờ xét duyệt.' : 'Bạn chưa xác thực CCCD.'}
        >
          Cần hoàn tất xác thực CCCD trước khi đặt ca chăm sóc tại nhà riêng.{' '}
          {user?.kyc_status !== 'PENDING' && (
            <Link to="/onboarding" className="link-strong">
              Xác thực ngay →
            </Link>
          )}
        </Alert>
      )}

      {/* 2. Thanh tìm kiếm lớn (P1 .search-big) */}
      <div className="search-big">
        <Search size={20} className="search-icon" aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm dịch vụ (thay băng, tiêm, truyền dịch, trông nom...) hoặc tên điều dưỡng..."
          aria-label="Tìm kiếm dịch vụ hoặc điều dưỡng"
        />
        {searchQuery && (
          <button
            type="button"
            className="link-button"
            style={{ color: 'var(--muted)', padding: '0 8px' }}
            onClick={() => setSearchQuery('')}
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <X size={18} />
          </button>
        )}
        <Button variant="primary" size="sm" type="button" style={{ height: 42 }}>
          Tìm kiếm
        </Button>
      </div>

      {/* 3. Banner Hero Carousel (P1 .carousel) */}
      <div className="carousel">
        <span className="carousel-chip">{CAROUSEL_SLIDES[activeSlide].chip}</span>
        <h2>{CAROUSEL_SLIDES[activeSlide].title}</h2>
        <p>{CAROUSEL_SLIDES[activeSlide].desc}</p>
        <button
          type="button"
          className="btn cbtn"
          style={{ background: '#fff', color: 'var(--blue-dark)', fontWeight: 700 }}
          onClick={() => handleCarouselAction(CAROUSEL_SLIDES[activeSlide].action)}
        >
          {CAROUSEL_SLIDES[activeSlide].cta}
        </button>
        <div className="dots" role="tablist" aria-label="Các trang giới thiệu">
          {CAROUSEL_SLIDES.map((slide, idx) => (
            <button
              key={slide.chip}
              type="button"
              className={idx === activeSlide ? 'on' : undefined}
              onClick={() => setActiveSlide(idx)}
              aria-label={`Chuyển đến trang ${idx + 1}: ${slide.title}`}
              aria-selected={idx === activeSlide}
            />
          ))}
        </div>
      </div>

      {/* 4. Banner ca sắp diễn ra (P1 .banner-live) */}
      <div className="banner-live">
        <span className="banner-live-icon" aria-hidden="true">
          <Moon size={20} strokeWidth={2.2} />
        </span>
        <div className="banner-live-content">
          <b>Ca tối nay 20:00 với ĐD. Trần Thị Mai</b>
          <span>Ca đêm chăm sóc sau phẫu thuật · Đơn HC-2026-1050 · Đã xác nhận, chờ đến giờ</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setShiftDetailOpen(true)}
          style={{ whiteSpace: 'nowrap' }}
        >
          Xem chi tiết
        </Button>
      </div>

      {/* 5. Bento Grid dịch vụ (P1 .bento-p) */}
      <div className="bento-p">
        {/* Ô Hero nổi bật (span 2) */}
        <div
          className="btile hero-t"
          onClick={() =>
            setSelectedService({
              title: 'Thủ thuật y tế tại nhà',
              desc: 'Thay băng vết mổ, tiêm bắp/dưới da, truyền dịch duy trì theo y lệnh bác sĩ — chỉ điều dưỡng Cấp 2 có Giấy phép hành nghề (GPHN) hợp lệ.',
              tier: 'Điều dưỡng Cấp 2 (Chuyên môn)',
              badge: 'Nhóm 2 · Xâm lấn có điều kiện',
              price: '150.000đ – 500.000đ / lần',
              requiresOrder: true,
            })
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
        >
          <span className="bic-box" aria-hidden="true">
            <Syringe size={22} strokeWidth={2.2} />
          </span>
          <h3>Thủ thuật y tế tại nhà</h3>
          <p>Thay băng, tiêm, truyền dịch theo y lệnh — chỉ điều dưỡng Cấp 2 có GPHN. Đặt ngay cho người thân.</p>
        </div>

        {/* Ô 2: Chăm sóc cơ bản */}
        <div
          className="btile"
          onClick={() =>
            setSelectedService({
              title: 'Chăm sóc cơ bản',
              desc: 'Không xâm lấn · Hỗ trợ vệ sinh thân thể, tắm gội tại giường, ăn uống, vận động xoay trở, theo dõi sinh hiệu và trông nom bệnh nhân.',
              tier: 'Điều dưỡng Cấp 1 & Cấp 2',
              badge: 'Nhóm 1 · Không xâm lấn',
              price: 'Từ 200.000đ / ca',
              requiresOrder: false,
            })
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
        >
          <span className="bic-box" aria-hidden="true">
            <HeartPulse size={22} strokeWidth={2.2} />
          </span>
          <h3>Chăm sóc cơ bản</h3>
          <p>Không xâm lấn · Vệ sinh, ăn uống, vận động, trông nom bệnh nhân.</p>
        </div>

        {/* Ô 3: Theo ca linh hoạt */}
        <div
          className="btile"
          onClick={() =>
            setSelectedService({
              title: 'Gói chăm sóc theo ca linh hoạt',
              desc: 'Túc trực chăm sóc tại nhà hoặc tại bệnh viện theo các khung thời gian linh hoạt: ca lẻ 4h, 8h, 12h hoặc ca đêm chuyên sâu 20:00–06:00 sáng hôm sau.',
              tier: 'Cấp 1 & Cấp 2',
              badge: 'Gói theo ca linh hoạt',
              price: 'Từ 450.000đ / ca 4 giờ',
              requiresOrder: false,
            })
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
        >
          <span className="bic-box" aria-hidden="true">
            <CalendarClock size={22} strokeWidth={2.2} />
          </span>
          <h3>Theo ca linh hoạt</h3>
          <p>4h · 8h · 12h · Ca đêm 20:00–06:00 hỗ trợ túc trực liên tục.</p>
        </div>

        {/* Ô 4: Quản lý hồ sơ người bệnh (Link trực tiếp đến /patient-profiles) */}
        <Link to="/patient-profiles" className="btile">
          <span className="bic-box" aria-hidden="true">
            <ClipboardList size={22} strokeWidth={2.2} />
          </span>
          <h3>Hồ sơ người được chăm sóc</h3>
          <p>
            {primaryPatient
              ? `Đang có hồ sơ: ${primaryPatient.full_name} · Xem & quản lý →`
              : 'Cập nhật tiền sử bệnh, dị ứng & sự đồng ý xử lý dữ liệu NĐ 13/2023.'}
          </p>
        </Link>

        {/* Ô 5: Điều dưỡng gần bạn */}
        <div
          className="btile"
          onClick={() => {
            const el = document.getElementById('featured-nurses');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
        >
          <span className="bic-box" aria-hidden="true">
            <MapPin size={22} strokeWidth={2.2} />
          </span>
          <h3>Điều dưỡng gần bạn</h3>
          <p>Trong bán kính 5 km quanh khu vực {selectedLocation}.</p>
        </div>

        {/* Ô 6: Voucher khả dụng */}
        <div
          className="btile"
          onClick={() => setPolicyModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
        >
          <span className="bic-box" aria-hidden="true">
            <BadgePercent size={22} strokeWidth={2.2} />
          </span>
          <h3>Voucher khả dụng: 1</h3>
          <p>Voucher hỗ trợ 50.000đ — tự động áp dụng cho đơn tiếp theo.</p>
        </div>
      </div>

      {/* 6. Danh sách điều dưỡng sẵn sàng gần bạn (P1 .nurse-scroll) */}
      <div id="featured-nurses">
        <div className="section-head">
          <h2>Điều dưỡng gần bạn</h2>
          <span style={{ fontSize: 14, color: 'var(--slate)' }}>
            Đã thẩm định Giấy phép hành nghề (GPHN)
          </span>
        </div>

        {filteredNurses.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--slate)' }}>
            Không tìm thấy điều dưỡng phù hợp với từ khóa "{searchQuery}".
          </div>
        ) : (
          <div className="nurse-scroll">
            {filteredNurses.map((nurse) => (
              <article key={nurse.id} className="nurse-card">
                <div className="nurse-card-head">
                  <span className="avatar avatar--lg" aria-hidden="true">
                    {nurse.avatar}
                  </span>
                  <div>
                    <h3>{nurse.name}</h3>
                    <div className="nurse-card-sub">
                      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#f59e0b', fontWeight: 700, gap: 3 }}>
                        <Star size={13} fill="#f59e0b" color="#f59e0b" />
                        {nurse.rating}
                      </span>
                      <span>
                        · ({nurse.completedShifts} ca) · {nurse.distance}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="nurse-card-chips">
                  <span className="chip">{nurse.tier}</span>
                  {nurse.retiredBadge && (
                    <span className="chip amber">Nhân viên y tế hưu trí</span>
                  )}
                  <span className={`chip ${nurse.availabilityTone}`}>{nurse.availability}</span>
                </div>

                <Button
                  variant={nurse.id === 'nurse-mai' ? 'primary' : 'secondary'}
                  type="button"
                  block
                  onClick={() => setSelectedNurse(nurse)}
                >
                  Xem hồ sơ &amp; đặt trực tiếp
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* 7. Dải cam kết & an toàn chuẩn SRS (P1 .trust-strip) */}
      <div className="trust-strip">
        <span>
          <ShieldCheck size={18} style={{ color: 'var(--blue)' }} /> Điều dưỡng 100% xác thực GPHN
        </span>
        <span>·</span>
        <span>
          <Shield size={18} style={{ color: 'var(--blue)' }} /> Thanh toán tạm giữ qua nền tảng an toàn
        </span>
        <span>·</span>
        <span>
          <Clock size={18} style={{ color: 'var(--blue)' }} /> Hỗ trợ khiếu nại &amp; đối soát 24h sau ca
        </span>
      </div>

      {/* ================= MODAL: Chi tiết ca tối nay ================= */}
      {shiftDetailOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="shift-modal-title">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="shift-modal-title">Chi tiết ca trực</h3>
              <button
                type="button"
                className="link-button"
                onClick={() => setShiftDetailOpen(false)}
                style={{ color: 'var(--slate)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-sub">Mã đơn: HC-2026-1050 · Ca đêm chăm sóc sau phẫu thuật</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '16px 0 20px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg)', padding: '12px 14px', borderRadius: 12 }}>
                <span className="avatar avatar--lg" aria-hidden="true">
                  TM
                </span>
                <div>
                  <b style={{ color: 'var(--navy)', fontSize: 16 }}>ĐD. Trần Thị Mai</b>
                  <div style={{ fontSize: 13.5, color: 'var(--slate)' }}>
                    Điều dưỡng Cấp 2 · GPHN 00976/GPHN-ĐN
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                <div style={{ background: '#fff', border: '1px solid var(--line)', padding: '12px', borderRadius: 12 }}>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: 12 }}>THỜI GIAN CA</span>
                  <b style={{ color: 'var(--navy)' }}>20:00 – 06:00 (10h)</b>
                  <div style={{ color: 'var(--slate)', fontSize: 12 }}>Tối nay, 05/11/2026</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--line)', padding: '12px', borderRadius: 12 }}>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: 12 }}>NGƯỜI BỆNH</span>
                  <b style={{ color: 'var(--navy)' }}>Bà Nguyễn Thị Hoa</b>
                  <div style={{ color: 'var(--slate)', fontSize: 12 }}>78 tuổi · 25 Quang Trung</div>
                </div>
              </div>

              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 14px', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: '#065f46' }}>Tổng thanh toán (Đã tạm giữ):</span>
                  <b style={{ color: '#065f46', fontSize: 18 }}>580.000đ</b>
                </div>
                <div style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>
                  Gốc 500.000đ + Phụ phí ca đêm 80.000đ (+20% theo quy định §5.1)
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="chip teal">Đã xác nhận ca</span>
                <span className="chip teal">Đã tạm giữ tiền</span>
                <span className="chip grey">Check-in bằng GPS &amp; Selfie khi tới</span>
              </div>
            </div>

            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setShiftDetailOpen(false)}>
                Đóng
              </Button>
              <Link to="/patient-profiles" style={{ textDecoration: 'none' }}>
                <Button variant="primary" type="button" onClick={() => setShiftDetailOpen(false)}>
                  Xem hồ sơ người bệnh
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: Chi tiết Điều dưỡng ================= */}
      {selectedNurse && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nurse-modal-title">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="nurse-modal-title">Hồ sơ Điều dưỡng</h3>
              <button
                type="button"
                className="link-button"
                onClick={() => setSelectedNurse(null)}
                style={{ color: 'var(--slate)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '14px 0' }}>
              <span className="avatar avatar--lg" style={{ width: 56, height: 56, fontSize: 20 }} aria-hidden="true">
                {selectedNurse.avatar}
              </span>
              <div>
                <b style={{ color: 'var(--navy)', fontSize: 18 }}>{selectedNurse.name}</b>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Star size={14} fill="#f59e0b" color="#f59e0b" />
                  <b style={{ color: '#f59e0b', fontSize: 14 }}>{selectedNurse.rating}</b>
                  <span style={{ fontSize: 14, color: 'var(--slate)' }}>
                    ({selectedNurse.completedShifts} ca thành công)
                  </span>
                </div>
              </div>
            </div>

            <p style={{ color: 'var(--slate)', fontSize: 14.5, lineHeight: 1.5, marginBottom: 14 }}>
              {selectedNurse.bio}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)', padding: '14px', borderRadius: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--slate)' }}>Cấp bậc chuyên môn:</span>
                <b style={{ color: 'var(--navy)' }}>{selectedNurse.tier}</b>
              </div>
              {selectedNurse.gphn && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--slate)' }}>Giấy phép hành nghề:</span>
                  <b style={{ color: 'var(--blue)' }}>Số {selectedNurse.gphn} (Hợp lệ)</b>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--slate)' }}>Khoảng cách:</span>
                <b style={{ color: 'var(--navy)' }}>Khoảng {selectedNurse.distance}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--slate)' }}>Tình trạng nhận ca:</span>
                <span className={`chip ${selectedNurse.availabilityTone}`}>{selectedNurse.availability}</span>
              </div>
            </div>

            <b style={{ fontSize: 14.5, color: 'var(--navy)' }}>Chuyên môn thực hiện</b>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 20px' }}>
              {selectedNurse.specialties.map((spec) => (
                <span key={spec} className="chip grey">
                  ✓ {spec}
                </span>
              ))}
            </div>

            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setSelectedNurse(null)}>
                Đóng
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  setSelectedNurse(null);
                  setSelectedService({
                    title: `Đặt ca với ${selectedNurse.name}`,
                    desc: `Yêu cầu ca trực tại nhà cho bệnh nhân cùng điều dưỡng ${selectedNurse.name}.`,
                    tier: selectedNurse.tier,
                    badge: selectedNurse.availability,
                    price: 'Theo biểu giá dịch vụ đã niêm yết',
                    requiresOrder: selectedNurse.tier.includes('Cấp 2'),
                  });
                }}
              >
                Đặt ca với điều dưỡng này
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: Chi tiết dịch vụ ================= */}
      {selectedService && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="svc-modal-title">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="svc-modal-title">{selectedService.title}</h3>
              <button
                type="button"
                className="link-button"
                onClick={() => setSelectedService(null)}
                style={{ color: 'var(--slate)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ margin: '8px 0 14px' }}>
              <span className="chip teal">{selectedService.badge}</span>
            </div>

            <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.5, marginBottom: 16 }}>
              {selectedService.desc}
            </p>

            {selectedService.requiresOrder && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '12px 14px',
                  borderRadius: 12,
                  fontSize: 14,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <b>Yêu cầu an toàn y tế:</b> Dịch vụ xâm lấn chỉ dành cho điều dưỡng Cấp 2 có Giấy phép hành
                  nghề và bắt buộc phải có y lệnh/đơn thuốc của bác sĩ điều trị.
                </span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg)',
                padding: '14px 18px',
                borderRadius: 14,
                marginBottom: 20,
              }}
            >
              <div>
                <span style={{ fontSize: 13, color: 'var(--muted)', display: 'block' }}>MỨC GIÁ THAM KHẢO</span>
                <b style={{ color: 'var(--navy)', fontSize: 18 }}>{selectedService.price}</b>
              </div>
              <span style={{ fontSize: 13, color: 'var(--slate)' }}>Đã chốt giá trước khi đặt</span>
            </div>

            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setSelectedService(null)}>
                Đóng
              </Button>
              <Link to="/patient-profiles" style={{ textDecoration: 'none' }}>
                <Button variant="primary" type="button" onClick={() => setSelectedService(null)}>
                  Chọn người bệnh &amp; Đặt lịch →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: Chọn khu vực giao ca ================= */}
      {showLocationPicker && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="loc-modal-title">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="loc-modal-title">Chọn khu vực giao ca</h3>
              <button
                type="button"
                className="link-button"
                onClick={() => setShowLocationPicker(false)}
                style={{ color: 'var(--slate)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-sub">Hệ thống sẽ ưu tiên tìm điều dưỡng trong bán kính 5 km gần bạn nhất.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0 20px' }}>
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setSelectedLocation(loc);
                    setShowLocationPicker(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1.5px solid',
                    borderColor: loc === selectedLocation ? 'var(--blue)' : 'var(--line)',
                    background: loc === selectedLocation ? '#edf7f1' : '#fff',
                    color: 'var(--navy)',
                    fontWeight: loc === selectedLocation ? 700 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={16} style={{ color: loc === selectedLocation ? 'var(--blue)' : 'var(--muted)' }} />
                    {loc}
                  </span>
                  {loc === selectedLocation && <CheckCircle2 size={18} style={{ color: 'var(--blue)' }} />}
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setShowLocationPicker(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: Chính sách an toàn & Escrow ================= */}
      {policyModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="policy-modal-title">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="policy-modal-title">Quy chế bảo vệ &amp; Thanh toán tạm giữ</h3>
              <button
                type="button"
                className="link-button"
                onClick={() => setPolicyModalOpen(false)}
                style={{ color: 'var(--slate)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-sub">Cơ chế bảo vệ 3 lớp cho người bệnh và gia đình:</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '14px 0 20px', fontSize: 14.5 }}>
              <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 12 }}>
                <b style={{ color: 'var(--navy)' }}>1. Thẩm định Giấy phép hành nghề (GPHN)</b>
                <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13.5 }}>
                  Mọi điều dưỡng trên hệ thống đều qua kiểm duyệt hồ sơ bằng cấp, chứng chỉ hành nghề và lý lịch tư pháp.
                </p>
              </div>

              <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 12 }}>
                <b style={{ color: 'var(--navy)' }}>2. Thanh toán tạm giữ (Escrow nội bộ)</b>
                <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13.5 }}>
                  Số tiền bạn trả được tạm giữ an toàn trong sổ cái nền tảng. Điều dưỡng chỉ nhận quyết toán sau khi bạn hài lòng hoặc sau 24h kết thúc ca.
                </p>
              </div>

              <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 12 }}>
                <b style={{ color: 'var(--navy)' }}>3. Cửa sổ khiếu nại 24 giờ</b>
                <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13.5 }}>
                  Nếu ca trực không đạt yêu cầu hoặc xảy ra sự cố, bạn có 24 giờ sau khi điều dưỡng check-out để gửi khiếu nại. Hệ thống sẽ đóng băng tiền ca ngay lập tức để giải quyết.
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <Button variant="primary" type="button" onClick={() => setPolicyModalOpen(false)}>
                Đã hiểu
              </Button>
            </div>
          </div>
        </div>
      )}
    </PatientLayout>
  );
}
