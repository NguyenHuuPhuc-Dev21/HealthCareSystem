import {
  DisputeDto,
  OpenDisputeInput,
  PresignedUploadUrlDto,
  DisputeStatus,
} from '@healthcare-system/shared';

const STORAGE_DISPUTES_KEY = 'carenest_mock_disputes_v1';

// Mốc thời gian tương đối: giả định hiện tại là một thời điểm cụ thể
const NOW = new Date();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
const hoursLater = (h: number) => new Date(NOW.getTime() + h * 3600 * 1000).toISOString();

const INITIAL_DISPUTES: DisputeDto[] = [
  {
    id: 'disp-001',
    bookingId: 'job-1',
    bookingCode: 'BK-20261102-001',
    openedBy: 'PATIENT',
    category: 'PREMATURE_ABANDONMENT',
    description:
      'Điều dưỡng kết thúc ca sớm 45 phút và rời đi khi người bệnh chưa kịp ăn bữa phụ chiều. Đề nghị ban quản trị kiểm tra lại camera an ninh gia đình.',
    status: DisputeStatus.OPEN,
    evidences: [
      {
        id: 'ev-1',
        url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
        kind: 'IMAGE',
        uploadedBy: 'PATIENT',
        fileName: 'camera_phong_khach_16h15.jpg',
        fileSizeBytes: 1245000,
      },
      {
        id: 'ev-2',
        url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
        kind: 'IMAGE',
        uploadedBy: 'PATIENT',
        fileName: 'dong_ho_va_cua_ra_vao.jpg',
        fileSizeBytes: 890000,
      },
    ],
    nurseRebuttal: null,
    rebuttalDueAt: hoursLater(20), // Còn 20 giờ để gửi phản hồi
    resolution: null,
    kind: 'BOOKING',
    createdAt: hoursAgo(4),
  },
  {
    id: 'disp-002',
    bookingId: 'job-2',
    bookingCode: 'BK-20261104-002',
    openedBy: 'PATIENT',
    category: 'CLINICAL_PROTOCOL_VIOLATION',
    description:
      'Gia đình phản ánh điều dưỡng đo huyết áp bằng máy cơ nhưng thao tác không đúng kỹ thuật, ghi chép vào sổ tay có sai lệch so với chỉ số thực tế.',
    status: DisputeStatus.UNDER_REVIEW,
    evidences: [
      {
        id: 'ev-3',
        url: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80',
        kind: 'IMAGE',
        uploadedBy: 'PATIENT',
        fileName: 'anh_so_theo_doi_huyet_ap.jpg',
        fileSizeBytes: 950000,
      },
    ],
    nurseRebuttal: {
      content:
        'Tôi đã đo lại 2 lần cách nhau 5 phút theo đúng phác đồ kiểm tra huyết áp của Bộ Y tế. Chỉ số 135/85 mmHg được đo lại trước khi bàn giao và người nhà đã ký xác nhận vào phiếu theo dõi lâm sàng tại chỗ.',
      submittedAt: hoursAgo(10),
      evidences: [
        {
          id: 'ev-reb-1',
          url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
          kind: 'IMAGE',
          uploadedBy: 'NURSE',
          fileName: 'phieu_theo_doi_co_chu_ky.jpg',
          fileSizeBytes: 1420000,
        },
      ],
    },
    rebuttalDueAt: hoursAgo(10),
    resolution: null,
    kind: 'BOOKING',
    createdAt: hoursAgo(24),
  },
  {
    id: 'disp-003',
    bookingId: 'job-3',
    bookingCode: 'BK-20261025-015',
    openedBy: 'PATIENT',
    category: 'UNPROFESSIONAL_CONDUCT',
    description:
      'Khách phàn nàn điều dưỡng sử dụng điện thoại cá nhân trong giờ chăm sóc người bệnh cao tuổi.',
    status: DisputeStatus.RESOLVED_NURSE,
    evidences: [
      {
        id: 'ev-4',
        url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
        kind: 'IMAGE',
        uploadedBy: 'PATIENT',
        fileName: 'anh_chup_khach_gui.jpg',
        fileSizeBytes: 780000,
      },
    ],
    nurseRebuttal: {
      content:
        'Tôi sử dụng ứng dụng CareNest trên điện thoại để đối chiếu y lệnh thuốc và ghi nhận sinh hiệu điện tử theo quy định của nền tảng, hoàn toàn không làm việc riêng.',
      submittedAt: hoursAgo(72),
    },
    resolution: {
      outcome: DisputeStatus.RESOLVED_NURSE,
      note: 'Admin kiểm tra nhật ký log ca trực trên ứng dụng trùng khớp thời gian cập nhật chỉ số sinh hiệu. Khiếu nại của khách không có cơ sở xác thực. 85% thù lao ca trực đã được giải phóng vào ví điều dưỡng.',
      releasedToNurse: true,
      resolvedAt: hoursAgo(48),
    },
    kind: 'BOOKING',
    createdAt: hoursAgo(96),
  },
  {
    id: 'disp-004',
    bookingId: 'job-4',
    bookingCode: 'BK-20261018-009',
    openedBy: 'PATIENT',
    category: 'CLINICAL_PROTOCOL_VIOLATION',
    description:
      'Điều dưỡng không sát khuẩn tay trước khi thay băng vết thương hở, dẫn đến nguy cơ nhiễm trùng.',
    status: DisputeStatus.RESOLVED_CUSTOMER,
    evidences: [
      {
        id: 'ev-5',
        url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
        kind: 'IMAGE',
        uploadedBy: 'PATIENT',
        fileName: 'hinh_anh_khay_thay_bang.jpg',
        fileSizeBytes: 1100000,
      },
    ],
    nurseRebuttal: {
      content: 'Tôi có sát khuẩn bằng cồn nhanh để trong túi y tế trước khi vào phòng.',
      submittedAt: hoursAgo(120),
    },
    resolution: {
      outcome: DisputeStatus.RESOLVED_CUSTOMER,
      note: 'Hội đồng chuyên môn xác định điều dưỡng vi phạm quy trình kiểm soát nhiễm khuẩn (không mang găng vô khuẩn và dung dịch sát khuẩn đạt chuẩn). Khiếu nại được chấp thuận. Trừ 25 điểm TrustScore và phạt khấu trừ ký quỹ.',
      trustScoreDelta: -25,
      depositDeducted: 150000,
      refundedToPatient: true,
      resolvedAt: hoursAgo(90),
    },
    kind: 'BOOKING',
    createdAt: hoursAgo(140),
  },
  {
    id: 'disp-005',
    bookingId: 'job-5',
    bookingCode: 'BK-20261110-022',
    openedBy: 'NURSE',
    category: 'UNPROFESSIONAL_CONDUCT',
    description:
      'Gia đình người bệnh có hành vi to tiếng, xúc phạm danh dự và yêu cầu điều dưỡng làm các công việc dọn dẹp nhà cửa ngoài phạm vi hợp đồng chăm sóc y tế.',
    status: DisputeStatus.UNDER_REVIEW,
    evidences: [
      {
        id: 'ev-6',
        url: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80',
        kind: 'IMAGE',
        uploadedBy: 'NURSE',
        fileName: 'tin_nhan_yeu_cau_ngoai_pham_vi.jpg',
        fileSizeBytes: 980000,
      },
    ],
    nurseRebuttal: null,
    resolution: null,
    kind: 'BOOKING',
    createdAt: hoursAgo(12),
  },
  {
    id: 'disp-006',
    bookingId: 'job-tx-001',
    bookingCode: 'BK-20261108-011',
    openedBy: 'NURSE',
    category: 'CLINICAL_PROTOCOL_VIOLATION',
    description:
      'Tôi phải hủy ca đột xuất trước 2 giờ do gặp tai nạn giao thông trên đường di chuyển tới nhà người bệnh (có biên bản sơ cấp cứu tại Trạm Y tế Phường). Đề nghị xem xét hoàn lại khoản trừ ký quỹ 20% theo điều khoản bất khả kháng (ADR-0004 D3).',
    status: DisputeStatus.UNDER_REVIEW,
    evidences: [
      {
        id: 'ev-7',
        url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
        kind: 'IMAGE',
        uploadedBy: 'NURSE',
        fileName: 'giay_xac_nhan_tai_nan_tram_yte.jpg',
        fileSizeBytes: 1300000,
      },
    ],
    nurseRebuttal: null,
    resolution: null,
    kind: 'PENALTY_APPEAL',
    appealedTransactionId: 'tx-penalty-20261108-01',
    penaltyAmount: 180000,
    penaltyReason: 'Hủy ca gấp trong vòng 12 giờ trước giờ hẹn (NURSE_LATE_CANCEL)',
    slaRule: 'SRS §5.2 Dòng 7 / ADR-0004: Khấu trừ 20% giá trị ca trực',
    createdAt: hoursAgo(30),
  },
];

function getStoredDisputes(): DisputeDto[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_DISPUTES_KEY);
    return raw ? JSON.parse(raw) : INITIAL_DISPUTES;
  } catch {
    return INITIAL_DISPUTES;
  }
}

function setStoredDisputes(list: DisputeDto[]): void {
  try {
    sessionStorage.setItem(STORAGE_DISPUTES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function mockGetMyDisputes(): Promise<DisputeDto[]> {
  await new Promise((r) => setTimeout(r, 180));
  return getStoredDisputes();
}

export async function mockGetDispute(id: string): Promise<DisputeDto> {
  await new Promise((r) => setTimeout(r, 150));
  const list = getStoredDisputes();
  const found = list.find((d) => d.id === id);
  if (!found) {
    const err: any = new Error('Không tìm thấy thông tin khiếu nại.');
    err.code = 'DISPUTE_NOT_FOUND';
    throw err;
  }
  return found;
}

export async function mockOpenDispute(
  bookingId: string,
  input: OpenDisputeInput
): Promise<{ dispute_id: string }> {
  await new Promise((r) => setTimeout(r, 220));

  if (!input.description || input.description.trim().length < 20) {
    const err: any = new Error('Mô tả khiếu nại phải có tối thiểu 20 ký tự.');
    err.code = 'DESCRIPTION_TOO_SHORT';
    throw err;
  }

  const list = getStoredDisputes();
  const newId = `disp-${Date.now()}`;

  const evidences = (input.evidenceUrls || []).map((url, idx) => ({
    id: `ev-new-${Date.now()}-${idx}`,
    url,
    kind: (url.endsWith('.mp4') ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO',
    uploadedBy: 'NURSE' as const,
    fileName: `bang_chung_${idx + 1}.jpg`,
  }));

  const newDispute: DisputeDto = {
    id: newId,
    bookingId,
    bookingCode: `BK-${bookingId}`,
    openedBy: 'NURSE',
    category: input.category,
    description: input.description.trim(),
    status: DisputeStatus.OPEN,
    evidences,
    nurseRebuttal: null,
    resolution: null,
    kind: 'BOOKING',
    createdAt: new Date().toISOString(),
  };

  setStoredDisputes([newDispute, ...list]);
  return { dispute_id: newId };
}

export async function mockSubmitDisputeRebuttal(
  disputeId: string,
  content: string,
  evidenceUrls: string[] = []
): Promise<{ updated: boolean }> {
  await new Promise((r) => setTimeout(r, 200));

  if (!content || content.trim().length < 10) {
    const err: any = new Error('Nội dung phản hồi phải có tối thiểu 10 ký tự.');
    err.code = 'REBUTTAL_TOO_SHORT';
    throw err;
  }

  const list = getStoredDisputes();
  const dispute = list.find((d) => d.id === disputeId);
  if (!dispute) {
    const err: any = new Error('Không tìm thấy khiếu nại.');
    err.code = 'DISPUTE_NOT_FOUND';
    throw err;
  }

  if (dispute.status !== DisputeStatus.OPEN) {
    const err: any = new Error('Khiếu nại này đã qua giai đoạn gửi phản hồi.');
    err.code = 'REBUTTAL_NOT_ALLOWED';
    throw err;
  }

  const rebuttalEvidences = evidenceUrls.map((url, idx) => ({
    id: `ev-reb-${Date.now()}-${idx}`,
    url,
    kind: (url.endsWith('.mp4') ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO',
    uploadedBy: 'NURSE' as const,
    fileName: `bang_chung_phan_hoi_${idx + 1}.jpg`,
  }));

  dispute.nurseRebuttal = {
    content: content.trim(),
    submittedAt: new Date().toISOString(),
    evidences: rebuttalEvidences,
  };
  dispute.status = DisputeStatus.UNDER_REVIEW; // Chuyển sang đang thẩm tra
  dispute.updatedAt = new Date().toISOString();

  setStoredDisputes([...list]);
  return { updated: true };
}

export async function mockGetEvidenceUploadUrls(
  _disputeId: string,
  fileNames: string[]
): Promise<PresignedUploadUrlDto[]> {
  await new Promise((r) => setTimeout(r, 120));
  return fileNames.map((name, i) => ({
    fileId: `mock-file-${Date.now()}-${i}`,
    fileName: name,
    uploadUrl: `https://storage.carenest.vn/upload/mock-presigned-${i}`,
    // Tạm thời tạo object URL hoặc placeholder demo
    publicUrl: `https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80&demo=${i}`,
  }));
}

export function resetMockDisputes(): void {
  try {
    sessionStorage.removeItem(STORAGE_DISPUTES_KEY);
  } catch {
    // ignore
  }
}
