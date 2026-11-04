import { useState } from 'react';
import { Alert, Button } from '../../../components';

interface ConsentStepProps {
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

/**
 * SH3 · Bước 3 — Đồng ý xử lý dữ liệu sức khoẻ (FR-PRIV-01, NĐ 13/2023/NĐ-CP).
 * Checkbox KHÔNG được tick sẵn. Thời điểm, IP, thiết bị do backend ghi nhận khi nhận request.
 *
 * TODO: nội dung tóm tắt + link toàn văn cần bộ phận pháp lý/PO duyệt; link đang tạm.
 */
export function ConsentStep({ submitting, error, onSubmit }: ConsentStepProps) {
  const [checked, setChecked] = useState(false);

  return (
    <section className="card step-card" aria-labelledby="consent-title">
      <h3 id="consent-title" className="step-card__title">Bước 3 · Đồng ý xử lý dữ liệu sức khỏe</h3>
      <p className="step-card__sub">
        Xác nhận theo Nghị định 13/2023/NĐ-CP — hệ thống ghi lại thời điểm và thiết bị khi bạn đồng ý.
      </p>

      <div className="terms-box" tabIndex={0} aria-label="Tóm tắt điều khoản xử lý dữ liệu">
        <p><b>Dữ liệu được thu thập:</b> họ tên, năm sinh, cân nặng, mức độ vận động, tiền sử bệnh, dị ứng, nguy cơ truyền nhiễm và địa chỉ chăm sóc của người được chăm sóc.</p>
        <p><b>Mục đích:</b> ghép điều dưỡng phù hợp, giúp điều dưỡng chuẩn bị trước ca và xử lý khi có sự cố hoặc khiếu nại.</p>
        <p><b>Ai được xem:</b> chỉ điều dưỡng được phân đúng ca đó, trong thời gian ca đã xác nhận và một khoảng ngắn sau khi kết thúc; đội ngũ vận hành khi cần hỗ trợ — mọi lượt xem đều được ghi nhật ký.</p>
        <p><b>Quyền của bạn:</b> rút lại đồng ý, yêu cầu xoá hoặc ẩn danh hoá dữ liệu bất kỳ lúc nào trong mục Quyền riêng tư & dữ liệu.</p>
        <p>
          {/* TODO: thay bằng route toàn văn điều khoản */}
          <a href="/chinh-sach-du-lieu" target="_blank" rel="noreferrer">Xem toàn văn chính sách xử lý dữ liệu cá nhân →</a>
        </p>
      </div>

      <label className="consent-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          disabled={submitting}
        />
        <span>
          Tôi xác nhận và đồng ý cho nền tảng xử lý dữ liệu sức khỏe của người được chăm sóc theo{' '}
          <b>Nghị định 13/2023/NĐ-CP</b>. Tôi là người bệnh hoặc người giám hộ/người thân được người bệnh cho phép.
        </span>
      </label>

      {error && <Alert title={error} />}

      <div className="step-card__actions">
        <Button type="button" size="lg" onClick={onSubmit} disabled={!checked} loading={submitting}>
          {submitting ? 'Đang lưu…' : 'Hoàn tất'}
        </Button>
      </div>
    </section>
  );
}
