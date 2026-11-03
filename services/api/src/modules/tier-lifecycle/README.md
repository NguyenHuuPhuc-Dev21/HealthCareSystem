# tier-lifecycle (Owner: BE-2) — FR-AUTH-02, TC-AUTH-02

Job `tier-lifecycle.gphn-sweep` chạy 00:05 hằng ngày (giờ VN):
1. `gphn_expiry_date < hôm nay` và đang Tier 2 → hạ `TIER_1_BASIC`; `profile_status` giữ nguyên.
2. Ca xâm lấn `CONFIRMED` của điều dưỡng đó, bắt đầu sau ngày hết hạn → gỡ `nurse_id`,
   trả về `MATCHING` để điều phối lại. Không phạt, không đổi `payment_status`.

Idempotent: chạy lại không thay đổi gì thêm.
Nâng lại Tier 2 khi Admin duyệt GPHN mới: thuộc `credential-review` (BE-1).

Mở: thông báo (Dev C), audit_logs (cần thêm giá trị enum), điều phối lại (Phase 3).