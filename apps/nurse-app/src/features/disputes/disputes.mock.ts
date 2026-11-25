import {
  DISPUTE_DESCRIPTION_MIN_LENGTH,
  DisputeStatus,
  type DisputeDto,
  type DisputeEvidenceDto,
  type OpenDisputeInput,
  type PresignedUploadUrlDto,
} from '@healthcare-system/shared';

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
      'Điều dưỡng kết thúc ca sớm 45 phút và rời đi khi người bệnh chưa kịp ăn bữa phụ chiều. Đề nghị ban quản trị kiểm tra lại.',
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
    ],
    nurseRebuttal: null,
    rebuttalDueAt: hoursLater(20),
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
      'Gia đình phản ánh điều dưỡng đo huyết áp bằng máy cơ nhưng thao tác không đúng kỹ thuật, ghi chép vào sổ tay có sai lệch.',
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
        'Tôi đã đo lại 2 lần cách nhau 5 phút theo đúng phác đồ. Chỉ số 135/85 mmHg đã được người nhà ký xác nhận vào phiếu theo dõi lâm sàng.',
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
    id: 'disp-006',
    bookingId: 'job-tx-001',
    bookingCode: 'BK-20261108-011',
    openedBy: 'NURSE',
    category: 'CLINICAL_PROTOCOL_VIOLATION',
    description:
      'Tôi phải hủy ca đột xuất trước 2 giờ do gặp tai nạn giao thông trên đường di chuyển (có biên bản sơ cấp cứu tại Trạm Y tế Phường). Đề nghị xem xét hoàn lại khoản trừ ký quỹ 20% theo điều khoản bất khả kháng (ADR-0004 D3).',
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
  {
    id: 'disp-003',
    bookingId: 'job-3',
    bookingCode: 'BK-20261025-015',
    openedBy: 'PATIENT',
    category: 'UNPROFESSIONAL_CONDUCT',
    description: 'Khách phàn nàn điều dưỡng sử dụng điện thoại cá nhân trong giờ chăm sóc.',
    status: DisputeStatus.RESOLVED_NURSE,
    evidences: [],
    nurseRebuttal: {
      content: 'Tôi sử dụng ứng dụng CareNest trên điện thoại để đối chiếu y lệnh và ghi nhận sinh hiệu điện tử.',
      submittedAt: hoursAgo(72),
    },
    resolution: {
      outcome: DisputeStatus.RESOLVED_NURSE,
      note: 'Admin kiểm tra nhật ký log ca trực trùng khớp thời gian cập nhật chỉ số sinh hiệu. Khiếu nại không có cơ sở. 85% thù lao đã vào ví.',
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
    description: 'Điều dưỡng không sát khuẩn tay trước khi thay băng vết thương hở.',
    status: DisputeStatus.RESOLVED_CUSTOMER,
    evidences: [],
    nurseRebuttal: {
      content: 'Tôi có sát khuẩn bằng cồn nhanh trước khi vào phòng.',
      submittedAt: hoursAgo(120),
    },
    resolution: {
      outcome: DisputeStatus.RESOLVED_CUSTOMER,
      note: 'Hội đồng chuyên môn xác định vi phạm quy trình kiểm soát nhiễm khuẩn. Khoản trừ từ phán quyết này không thể khiếu nại lại.',
      trustScoreDelta: -25,
      depositDeducted: 150000,
      refundedToPatient: true,
      resolvedAt: hoursAgo(90),
    },
    kind: 'BOOKING',
    createdAt: hoursAgo(140),
  },
];

let disputesStore: DisputeDto[] = INITIAL_DISPUTES.map((d) => ({ ...d }));

export function resetDisputesMockState(): void {
  disputesStore = INITIAL_DISPUTES.map((d) => ({ ...d }));
}

export async function mockGetMyDisputes(): Promise<DisputeDto[]> {
  return disputesStore.map((d) => ({ ...d }));
}

export async function mockGetDispute(id: string): Promise<DisputeDto> {
  const found = disputesStore.find((d) => d.id === id);
  if (!found) {
    const err: any = new Error('Không tìm thấy thông tin khiếu nại.');
    err.code = 'DISPUTE_NOT_FOUND';
    throw err;
  }
  return { ...found };
}

export async function mockOpenDispute(
  bookingId: string,
  input: OpenDisputeInput
): Promise<{ dispute_id: string }> {
  if (!input.description || input.description.trim().length < DISPUTE_DESCRIPTION_MIN_LENGTH) {
    const err: any = new Error(
      `Mô tả khiếu nại phải có ít nhất ${DISPUTE_DESCRIPTION_MIN_LENGTH} ký tự.`
    );
    err.code = 'INVALID_DESCRIPTION';
    throw err;
  }

  const newId = `disp-${Date.now()}`;
  const evidences: DisputeEvidenceDto[] = (input.evidenceUrls ?? []).map((url, idx) => ({
    id: `ev-open-${Date.now()}-${idx}`,
    url,
    kind: url.match(/\.(mp4|mov|m4v)/i) ? 'VIDEO' : 'IMAGE',
    uploadedBy: 'NURSE',
    fileName: `bang_chung_${idx + 1}`,
  }));

  const newDispute: DisputeDto = {
    id: newId,
    bookingId,
    bookingCode: `HC-${bookingId.slice(-6).toUpperCase()}`,
    openedBy: 'NURSE',
    category: input.category,
    description: input.description.trim(),
    status: DisputeStatus.UNDER_REVIEW,
    evidences,
    nurseRebuttal: null,
    resolution: null,
    kind: 'BOOKING',
    createdAt: new Date().toISOString(),
  };

  disputesStore = [newDispute, ...disputesStore];
  return { dispute_id: newId };
}

export async function mockGetEvidenceUploadUrls(
  disputeId: string,
  fileNames: string[]
): Promise<PresignedUploadUrlDto[]> {
  return fileNames.map((fileName, idx) => ({
    fileId: `file-${Date.now()}-${idx}`,
    fileName,
    uploadUrl: `mock://presigned-dispute/${disputeId}/${encodeURIComponent(fileName)}`,
    publicUrl: `mock://cdn-dispute/${disputeId}/${encodeURIComponent(fileName)}`,
  }));
}

export async function mockSubmitDisputeRebuttal(
  disputeId: string,
  rebuttal: string,
  evidenceUrls: string[] = []
): Promise<{ updated: boolean }> {
  const idx = disputesStore.findIndex((d) => d.id === disputeId);
  if (idx === -1) {
    const err: any = new Error('Không tìm thấy khiếu nại.');
    err.code = 'DISPUTE_NOT_FOUND';
    throw err;
  }

  const target = disputesStore[idx];
  const evidences: DisputeEvidenceDto[] = evidenceUrls.map((url, i) => ({
    id: `ev-reb-${Date.now()}-${i}`,
    url,
    kind: url.match(/\.(mp4|mov|m4v)/i) ? 'VIDEO' : 'IMAGE',
    uploadedBy: 'NURSE',
    fileName: `phan_hoi_${i + 1}`,
  }));

  disputesStore[idx] = {
    ...target,
    status: DisputeStatus.UNDER_REVIEW,
    nurseRebuttal: {
      content: rebuttal.trim(),
      submittedAt: new Date().toISOString(),
      evidences: evidences.length > 0 ? evidences : undefined,
    },
    updatedAt: new Date().toISOString(),
  };

  return { updated: true };
}
