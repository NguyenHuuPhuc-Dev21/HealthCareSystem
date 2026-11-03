import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type {
  CredentialUrl,
  NurseReviewDetail,
  QueueItem,
  QueueQuery,
  QueueSummary,
  VerifyNurseRequest,
} from './nurse-verification.types';

/**
 * Duyệt hồ sơ điều dưỡng (FR-AUTH-01/02) — màn A2 + A3.
 *
 * Hai chế độ:
 * - Mock (VITE_USE_MOCK=true): gọi thẳng các endpoint "đề xuất" cũ, mock handlers
 *   (src/mocks) trả đúng kiểu FE bên dưới.
 * - Thật: BE-1 đã có module credential-review trên main với contract riêng
 *   (docs/api/credential-review.api.md). Lớp này ÁNH XẠ response của BE
 *   (queue item gọn + dossier) sang kiểu hiển thị của FE:
 *     GET    /admin/nurses/verification-queue?limit&offset  -> {items:[...]}
 *     GET    /admin/nurses/:id/dossier                      -> kèm fileUrl từng giấy tờ
 *     PATCH  /admin/nurses/:id/verify  {decisions:[{credentialId, decision, rejectionReason?}]}
 *   Khác biệt cần biết: BE tự suy Tier từ GPHN được duyệt (không nhận field tier),
 *   và hàng đợi thật chỉ gồm hồ sơ ĐANG chờ duyệt — tab "Đã xử lý" chưa có endpoint.
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/* ================= Kiểu của BE (camelCase) ================= */

type BeTier = 'TIER_1_BASIC' | 'TIER_2_SPECIALIST';

interface BeQueueItem {
  nurseId: string;
  fullName: string;
  phone: string;
  profileStatus: string;
  tier: BeTier;
  pendingCount: number;
  hasPendingGphn: boolean;
  oldestPendingAt: string;
  kind: 'ONBOARDING' | 'RENEWAL';
}

interface BeCredential {
  id: string;
  docType: 'CCCD' | 'DEGREE' | 'GPHN' | 'RETIREMENT_DECISION';
  side: 'FRONT' | 'BACK' | null;
  documentNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  issuingAuthority: string | null;
  scopeOfPractice: string | null;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  submittedAt: string;
  fileUrl?: string;
}

interface BeDossier {
  nurseId: string;
  fullName: string;
  phone: string;
  cccdNumber: string | null;
  profile: {
    profileStatus: string;
    tier: BeTier;
    yearsOfExp: number;
    isRetiredMedicalStaff: boolean;
  };
  credentials: BeCredential[];
}

/* ================= Hàm ánh xạ ================= */

function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 4)} ••• ${phone.slice(-3)}` : phone;
}

function maskCccd(n: string): string {
  return `${n.slice(0, 6)} ••• ${n.slice(-2)}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickGphn(creds: BeCredential[]): BeCredential | undefined {
  const gphns = creds.filter((c) => c.docType === 'GPHN');
  return gphns.find((c) => c.verificationStatus === 'PENDING') ?? gphns[gphns.length - 1];
}

function suggestion(creds: BeCredential[]): { tier: BeTier; note: string } {
  const gphn = pickGphn(creds);
  if (!gphn) return { tier: 'TIER_1_BASIC', note: 'Chưa có GPHN — chỉ nhận ca không xâm lấn' };
  if (gphn.expiryDate && gphn.expiryDate > todayIso()) {
    return {
      tier: 'TIER_2_SPECIALIST',
      note: `GPHN ${gphn.documentNumber ?? ''} · còn hạn tới ${gphn.expiryDate ? fmtDate(gphn.expiryDate) : ''}`,
    };
  }
  return { tier: 'TIER_1_BASIC', note: `GPHN đã hết hạn ${gphn.expiryDate ? fmtDate(gphn.expiryDate) : ''}` };
}

function mapQueueItem(item: BeQueueItem, dossier: BeDossier | null): QueueItem {
  const creds = dossier?.credentials ?? [];
  const gphn = pickGphn(creds);
  const sug = suggestion(creds);
  return {
    nurse_id: item.nurseId,
    full_name: item.fullName,
    phone_masked: maskPhone(item.phone),
    subtitle: dossier ? `${dossier.profile.yearsOfExp} năm kinh nghiệm` : '',
    request_type: item.kind === 'RENEWAL' ? 'RENEWAL' : 'NEW',
    submitted_at: item.oldestPendingAt,
    documents: {
      cccd: creds.some((c) => c.docType === 'CCCD'),
      degree: creds.some((c) => c.docType === 'DEGREE'),
      gphn: !gphn ? 'NONE' : gphn.expiryDate && gphn.expiryDate > todayIso() ? 'NEW_SUBMITTED' : 'EXPIRED',
      retirement: creds.some((c) => c.docType === 'RETIREMENT_DECISION'),
    },
    current_tier: item.kind === 'RENEWAL' ? item.tier : null,
    suggested_tier: sug.tier,
    suggestion_note: sug.note,
    review_status: 'PENDING',
  };
}

function mapDetail(d: BeDossier): NurseReviewDetail {
  const creds = d.credentials;
  const gphn = pickGphn(creds);
  const degree = creds.find((c) => c.docType === 'DEGREE');
  const sug = suggestion(creds);
  const pending = creds.some((c) => c.verificationStatus === 'PENDING');
  const rejected = creds.find((c) => c.verificationStatus === 'REJECTED');
  const isRenewal = d.profile.profileStatus === 'ACTIVE';
  return {
    nurse_id: d.nurseId,
    full_name: d.fullName,
    phone_masked: maskPhone(d.phone),
    address: '',
    years_of_exp: d.profile.yearsOfExp,
    cccd_number_masked: d.cccdNumber ? maskCccd(d.cccdNumber) : null,
    request_type: isRenewal ? 'RENEWAL' : 'NEW',
    submitted_at: creds.map((c) => c.submittedAt).sort()[0] ?? '',
    review_status: pending ? 'PENDING' : rejected ? 'REJECTED' : 'APPROVED',
    current_tier: isRenewal ? d.profile.tier : null,
    suggested_tier: sug.tier,
    suggestion_reason: sug.note,
    gphn: gphn
      ? {
          number: gphn.documentNumber ?? '',
          issuer: gphn.issuingAuthority ?? '',
          issued_date: gphn.issuedDate ?? '',
          expiry_date: gphn.expiryDate ?? '',
          scope_of_practice: gphn.scopeOfPractice ?? '',
          is_valid: !!gphn.expiryDate && gphn.expiryDate > todayIso(),
          days_remaining: gphn.expiryDate
            ? Math.round((Date.parse(gphn.expiryDate) - Date.parse(todayIso())) / 86400000)
            : null,
          identity_match: null, // BE chưa đối chiếu tự động — giao diện hiện "chưa đối chiếu"
        }
      : null,
    degree: degree ? { title: '', year: degree.issuedDate ? Number(degree.issuedDate.slice(0, 4)) : null } : null,
    retirement_submitted: creds.some((c) => c.docType === 'RETIREMENT_DECISION'),
    credentials: creds.map((c) => ({
      id: c.id,
      doc_type:
        c.docType === 'CCCD'
          ? c.side === 'BACK'
            ? 'CCCD_BACK'
            : 'CCCD_FRONT'
          : c.docType,
      verification_status: c.verificationStatus,
    })),
    rejection_reason: rejected?.rejectionReason ?? null,
  };
}

async function fetchQueue(): Promise<ApiResponse<BeQueueItem[]>> {
  const res = await apiClient<{ items: BeQueueItem[] }>('/admin/nurses/verification-queue?limit=100&offset=0');
  if (!res.success) return res as unknown as ApiResponse<BeQueueItem[]>;
  return { success: true, data: res.data.items };
}

async function fetchDossier(nurseId: string): Promise<ApiResponse<BeDossier>> {
  return apiClient<BeDossier>(`/admin/nurses/${nurseId}/dossier`);
}

/* ================= API cho các trang ================= */

/** A2 — danh sách hồ sơ theo tab + bộ lọc. */
export async function getVerificationQueue(query: QueueQuery): Promise<ApiResponse<QueueItem[]>> {
  if (USE_MOCK) {
    const params = new URLSearchParams({ tab: query.tab });
    if (query.q?.trim()) params.set('q', query.q.trim());
    if (query.submitted && query.submitted !== 'ALL') params.set('submitted', query.submitted);
    if (query.docs && query.docs !== 'ALL') params.set('docs', query.docs);
    return apiClient<QueueItem[]>(`/admin/nurses/verification-queue?${params.toString()}`);
  }

  // BE chưa có danh sách "đã xử lý" — tab này trả rỗng ở chế độ thật.
  if (query.tab === 'PROCESSED') return { success: true, data: [] };

  const queueRes = await fetchQueue();
  if (!queueRes.success) return queueRes as unknown as ApiResponse<QueueItem[]>;
  let items = queueRes.data.filter((i) => (query.tab === 'RENEWAL' ? i.kind === 'RENEWAL' : i.kind === 'ONBOARDING'));

  const mapped: QueueItem[] = [];
  for (const item of items) {
    const dossierRes = await fetchDossier(item.nurseId);
    mapped.push(mapQueueItem(item, dossierRes.success ? dossierRes.data : null));
  }
  items = queueRes.data; // (giữ biến cho rõ luồng lọc phía dưới)
  let out = mapped;
  const q = query.q?.trim().toLowerCase();
  if (q) out = out.filter((i) => i.full_name.toLowerCase().includes(q) || i.phone_masked.replace(/\D/g, '').includes(q.replace(/\D/g, '')));
  if (query.submitted === 'TODAY') {
    out = out.filter((i) => i.submitted_at.slice(0, 10) === todayIso());
  } else if (query.submitted === 'OVER_24H') {
    out = out.filter((i) => Date.now() - Date.parse(i.submitted_at) > 24 * 3600 * 1000);
  }
  if (query.docs === 'HAS_GPHN') out = out.filter((i) => i.documents.gphn !== 'NONE');
  if (query.docs === 'DEGREE_ONLY') out = out.filter((i) => i.documents.gphn === 'NONE');
  if (query.docs === 'HAS_RETIREMENT') out = out.filter((i) => i.documents.retirement);
  return { success: true, data: out };
}

/** Số hồ sơ chờ duyệt cho badge sidebar + tab. */
export async function getQueueSummary(): Promise<ApiResponse<QueueSummary>> {
  if (USE_MOCK) return apiClient<QueueSummary>('/admin/nurses/verification-queue/summary');
  const res = await fetchQueue();
  if (!res.success) return res as unknown as ApiResponse<QueueSummary>;
  return {
    success: true,
    data: {
      NEW: res.data.filter((i) => i.kind === 'ONBOARDING').length,
      RENEWAL: res.data.filter((i) => i.kind === 'RENEWAL').length,
    },
  };
}

/** A3 — chi tiết hồ sơ để thẩm định. */
export async function getNurseReview(nurseId: string): Promise<ApiResponse<NurseReviewDetail>> {
  if (USE_MOCK) return apiClient<NurseReviewDetail>(`/admin/nurses/${nurseId}/verification`);
  const res = await fetchDossier(nurseId);
  if (!res.success) return res as unknown as ApiResponse<NurseReviewDetail>;
  return { success: true, data: mapDetail(res.data) };
}

/** Presigned URL cho 1 giấy tờ — bản thật lấy thẳng fileUrl trong dossier (BE ký sẵn 10 phút). */
export async function getCredentialUrl(nurseId: string, credentialId: string): Promise<ApiResponse<CredentialUrl>> {
  if (USE_MOCK) return apiClient<CredentialUrl>(`/admin/nurses/${nurseId}/credentials/${credentialId}/url`);
  const res = await fetchDossier(nurseId);
  if (!res.success) return res as unknown as ApiResponse<CredentialUrl>;
  const cred = res.data.credentials.find((c) => c.id === credentialId);
  if (!cred?.fileUrl) {
    return {
      success: false,
      data: null as unknown as CredentialUrl,
      error: { code: 'FILE_URL_MISSING', message: 'Không lấy được địa chỉ xem giấy tờ' },
    };
  }
  return {
    success: true,
    data: { url: cred.fileUrl, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
  };
}

/**
 * PATCH /api/v1/admin/nurses/:id/verify (SRS §8, FR-AUTH-02).
 * BE nhận quyết định THEO TỪNG GIẤY TỜ (decisions[]) và tự suy Tier —
 * FE ánh xạ quyết định chung của Admin thành quyết định cho mọi giấy tờ đang chờ.
 */
export async function verifyNurse(nurseId: string, payload: VerifyNurseRequest): Promise<ApiResponse<NurseReviewDetail>> {
  if (USE_MOCK) {
    return apiClient<NurseReviewDetail>(`/admin/nurses/${nurseId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
  const dossierRes = await fetchDossier(nurseId);
  if (!dossierRes.success) return dossierRes as unknown as ApiResponse<NurseReviewDetail>;
  const pendingCreds = dossierRes.data.credentials.filter((c) => c.verificationStatus === 'PENDING');
  if (pendingCreds.length === 0) {
    return {
      success: false,
      data: null as unknown as NurseReviewDetail,
      error: { code: 'NOTHING_PENDING', message: 'Hồ sơ không còn giấy tờ nào đang chờ duyệt' },
    };
  }
  const res = await apiClient(`/admin/nurses/${nurseId}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({
      decisions: pendingCreds.map((c) => ({
        credentialId: c.id,
        decision: payload.decision,
        ...(payload.decision === 'REJECTED' ? { rejectionReason: payload.rejection_reason ?? 'Hồ sơ chưa đạt yêu cầu' } : {}),
      })),
    }),
  });
  if (!res.success) return res as unknown as ApiResponse<NurseReviewDetail>;
  return getNurseReview(nurseId);
}
