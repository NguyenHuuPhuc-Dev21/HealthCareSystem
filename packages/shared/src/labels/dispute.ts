import type { DisputeCategory } from '../contracts/dispute.contracts';
import { DisputeStatus } from '../enums';

export const DISPUTE_MAX_EVIDENCE_FILES = 5;
export const DISPUTE_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const DISPUTE_MAX_VIDEO_DURATION_SECONDS = 60;
export const DISPUTE_DESCRIPTION_MIN_LENGTH = 20;
export const DISPUTE_DESCRIPTION_MAX_LENGTH = 1000;
export const DISPUTE_OPEN_WINDOW_HOURS = 24;

export const DISPUTE_CATEGORY_LABELS: Record<
  DisputeCategory,
  { title: string; desc: string }
> = {
  UNPROFESSIONAL_CONDUCT: {
    title: 'Hành vi xúc phạm / Môi trường nguy hiểm',
    desc: 'Người nhà hoặc bệnh nhân có hành vi bạo lực, xúc phạm danh dự, hoặc môi trường làm việc mất an toàn.',
  },
  CLINICAL_PROTOCOL_VIOLATION: {
    title: 'Bắt làm việc ngoài phạm vi chuyên môn',
    desc: 'Gia đình ép buộc thực hiện các thủ thuật không có chỉ định y khoa hoặc việc gia đình ngoài hợp đồng.',
  },
  FALSE_CLINICAL_DECLARATION: {
    title: 'Khai báo sai tình trạng người bệnh',
    desc: 'Tình trạng thực tế khác biệt nghiêm trọng so với hồ sơ ban đầu (ví dụ bệnh truyền nhiễm cấp tính không báo trước).',
  },
  PREMATURE_ABANDONMENT: {
    title: 'Khách hàng hủy ngang ca bất hợp lý',
    desc: 'Gia đình cho điều dưỡng về sớm vô cớ nhưng sau đó khiếu nại hoặc từ chối xác nhận ca.',
  },
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  [DisputeStatus.OPEN]: 'Cần phản hồi',
  [DisputeStatus.UNDER_REVIEW]: 'Đang thẩm tra',
  [DisputeStatus.RESOLVED_NURSE]: 'Điều dưỡng thắng',
  [DisputeStatus.RESOLVED_CUSTOMER]: 'Khách thắng',
  [DisputeStatus.RESOLVED_PARTIAL]: 'Phân xử một phần',
};

export function canOpenDisputeAfterCheckout(
  checkOutAt?: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!checkOutAt) return false;
  const checkOutMs = new Date(checkOutAt).getTime();
  if (Number.isNaN(checkOutMs)) return false;
  const diffMs = nowMs - checkOutMs;
  if (diffMs < 0) return true;
  return diffMs <= DISPUTE_OPEN_WINDOW_HOURS * 60 * 60 * 1000;
}
