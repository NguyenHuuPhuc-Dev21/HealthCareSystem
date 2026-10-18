# Chiến lược kiểm thử (Test Strategy)

> **Phạm vi tài liệu:** Toàn bộ nền tảng đặt điều dưỡng chăm sóc tại nhà — pilot Q-23 và các giai đoạn nối tiếp.
> **Nguồn đặc tả (theo thứ tự ưu tiên khi mâu thuẫn):**
> 1. `use_case_v8.1.drawio` — 140 UC, BR-01…BR-23, bảng quyết định tài chính BR-18 (F1a–F9)
> 2. `luong_hoat_dong_v8.14.drawio` — 17 luồng hoạt động, ma trận truy vết 00c, sổ quyết định Q-01…Q-51
> 3. `docs/user_stories/` — 27 User Story nhóm **Must** (US-HP-01…36, kèm ma trận TC trong từng file) + 10 Story nhóm **Should** (US-HP-08, 16, 17, 21, 30, 31, 32, 33, 35, 37)
> 4. `docs/requirement/` — FR-01…FR-11, NFR-01…NFR-09
> 5. `docs/business_rule/` — BR theo 7 nhóm A–G + `open-decisions-register.md`
> 6. `docs/security/` — SEC-00…SEC-10
> 7. `erd_diagram-2` trang 14 (từ điển enum) + trang 15 (ràng buộc & chỉ mục); `docs/database/schema.sql` (đã kiểm chứng chạy sạch trên PostgreSQL 16: 75 bảng, 63 enum, 192 khóa ngoại)
>
> **Trạng thái:** Tài liệu đề xuất chiến lược — các ngưỡng số học ghi "đề xuất" chờ PO/nhóm chốt cùng các quyết định mở ở Mục 11. Mọi nội dung mâu thuẫn với đặc tả gốc thì đặc tả gốc thắng.

---

## 1. Mục tiêu

1. Mọi luật nghiệp vụ (BR), mọi Story Must và mọi yêu cầu FR/NFR đều có kiểm thử **truy vết được bằng mã** (UC/BR/US/FR/NFR/SEC) — không có kiểm thử "mồ côi" và không có luật "không ai kiểm".
2. Chặn lỗi ở tầng rẻ nhất có thể: luật nằm trong CSDL thì kiểm ở CSDL, luật là hàm tính toán thì kiểm ở unit, luật là luồng người dùng thì kiểm ở E2E/UAT.
3. Bảo vệ ba vùng rủi ro cao nhất của hệ thống bằng kiểm thử tự động bắt buộc xanh trước merge: **tiền** (BR-04, BR-18, BR-05), **an toàn người bệnh** (BR-10 sàng lọc, BR-23 SOS, BR-22 báo cáo bắt buộc), **quyền riêng tư & phân quyền** (BR-09, BR-17, BR-20, BR-21).
4. Mọi quyết định chưa chốt (sổ Q) đều có trạng thái kiểm thử tường minh — không hardcode kỳ vọng cho giá trị chưa được duyệt.

## 2. Phạm vi

### 2.1 Trong phạm vi pilot (Q-23)

Một bệnh viện, đặt lịch trước, thanh toán qua cổng (không tiền mặt, không đặt ngay), sàng lọc bằng luật + bác sĩ trực rà soát, SOS leo thang 5 phút (không tự gọi 115). Kiểm thử bao phủ đầy đủ: 27 Story Must, 62 FR Must, toàn bộ BR-01…BR-23 (trừ nhánh bị khóa bởi quyết định chưa chốt — Mục 11), NFR-01…NFR-09 ở mức chỉ tiêu pilot, SEC-00…SEC-10.

### 2.2 Ngoài phạm vi / hoãn

| Hạng mục | Nguồn | Trạng thái kiểm thử |
|---|---|---|
| Đặt ngay / ghép nhanh toàn trình | FR-04.10, BR-08 | **Won't** — không viết test; chỉ giữ test khẳng định tính năng không xuất hiện trong pilot |
| Chuỗi tiền mặt tại nhà (thu, nộp, đối soát tiền mặt) | FR-06.11, BR-05 nhánh tiền mặt | **Won't** — không viết test |
| Tranh chấp tiền mặt F5 | BR-18 F5, Q-12 | **Không test** — quyết định cố ý để trống; cấm tự chế mặc định trong code lẫn test |
| Đặt hộ qua tổng đài UC135 | FR-04.11, R-UC135 | **Hoãn** — chờ quyết định giữ/cắt; nếu vào phạm vi phải threat-model trước (SEC-10.4) rồi mới viết test |
| Khấu trừ tự động bồi hoàn điều dưỡng | Q-10 | Ngoài MVP — xử lý thủ công, test ở mức quy trình quản trị |
| Các UC đã gộp/bỏ (UC29, UC70–UC76, UC130–UC132) | Danh mục UC | Không sinh yêu cầu, không sinh test |

### 2.3 Nguyên tắc với quyết định chưa chốt

- Giá trị chưa chốt nhưng **cơ chế** đã chốt (Q-03 phí tối thiểu, Q-09 trần phát sinh, Q-22 khung giờ/số ca): test viết theo **tham số cấu hình** — nạp giá trị giả lập qua cấu hình hiệu lực theo thời gian và khẳng định hệ thống đọc đúng giá trị tại thời điểm áp dụng, kể cả việc đổi cấu hình không làm sai lệch dữ kiện lịch sử.
- Nhánh chờ một **ô quyết định** (ô mặc định sau quyết Admin ở F1b — Q-44): chỉ test tới bước leo thang và SLA; bước sau quyết để `it.todo` kèm ghi chú mã Q.
- Tỷ lệ là **đề xuất chưa duyệt** (Q-08 chia phí dừng ca 50%, Q-29 ngưỡng vi phạm nhẹ, Q-35, Q-37, Q-42, Q-17, Q-19, Q-21): test dùng giá trị đề xuất nhưng đánh dấu `PENDING-Q` trong tên test để rà soát lại toàn bộ khi chốt.

## 3. Nguyên tắc kiểm thử

1. **Truy vết bằng mã:** Tên file/tên test mang mã nguồn (vd `br04-refund-policy.test.ts`, `TC-USHP14-02`). Mỗi PR phải liệt kê mã UC/BR/US mà test bao phủ (theo mẫu PR của repo).
2. **Đặc tả thắng:** Test fail vì đặc tả đổi → sửa test theo đặc tả đã duyệt, không sửa test cho khớp code sai.
3. **Dữ liệu tổng hợp tuyệt đối:** Không dùng dữ liệu bệnh nhân thật ở bất kỳ môi trường kiểm thử nào (NFR-04.4, NFR-09.4). Bộ dữ kiện chuẩn duy nhất là ca mẫu #MH-8824 trong `db/seeds/`; fixture sinh bằng mã trong `db/tests/src/fixtures.ts`.
4. **Độc lập & lặp lại được:** Mỗi test tự dựng dữ liệu tối thiểu, không phụ thuộc thứ tự chạy; test DB chạy nối tiếp trên DB kiểm thử riêng và TRUNCATE giữa các test.
5. **Thời gian là dữ kiện kiểm thử:** Mọi logic mốc thời gian (cửa sổ cọc, SLA, leo thang) kiểm bằng đồng hồ giả (fake timer) + mốc biên ±1 giây/phút, không chờ thời gian thật.
6. **Kiểm cả đường xấu:** Mỗi Story Must có ít nhất một test phủ định/bảo mật tương ứng với AC âm đã ghi trong file story (vd TC-USHP02-02 link hết hạn, TC-USHP05-01 chặn phiên thiếu 2FA, TC-USHP18-02 từ chối truy cập trái quyền).
7. **Shift-left:** Test viết cùng PR với tính năng; PR chạm tới xác thực/phân quyền/tài chính/dữ liệu lâm sàng bắt buộc qua security review (SEC-10.1).

## 4. Các tầng kiểm thử

### Tầng 1 — Kiểm thử ràng buộc CSDL (`db/tests/`)

Mục tiêu: chứng minh các luật "không được phép xảy ra" đã được khóa ngay trong lược đồ PostgreSQL 16 — tầng rẻ và chắc nhất của dự án này.

Phạm vi: toàn bộ ràng buộc ở trang 15 của ERD-2, mỗi ràng buộc gồm test hợp lệ + test vi phạm:

| Nhóm ràng buộc | Ràng buộc đại diện | Nguồn |
|---|---|---|
| Unique từng phần 3.1a | Một đơn chỉ một lần hủy vì sàng lọc khẩn cấp (`triage_assessment.resulting_cancellation_id`) + CHECK liên kết hủy chỉ khi kết quả EMERGENCY | Danh sách góp ý ERD 3.1a; ERD 8.11 |
| Unique từng phần 3.1b | Giao dịch/webhook không trùng theo `(gateway, mã giao dịch)` / `(gateway, event_id)` | 3.1b; BR-05, NFR-01.4, NFR-05.2 |
| Unique từng phần 3.1c | Một hẹn giờ PENDING duy nhất cho mỗi (loại, đối tượng) | 3.1c; FR-11.2 |
| Unique cấu hình 3.1d | `(key, effective_from)` cho tham số hệ thống và cấu hình bệnh viện | 3.1d; NFR-09.2 |
| Unique từng phần 3.1e | Một đơn chỉ bị xét một lần cho mỗi nhóm bộ đếm vi phạm | 3.1e; BR-01, BR-02 |
| EXCLUDE chống chồng | Lịch trống điều dưỡng; ca trực bác sĩ; cửa sổ chăm sóc của cùng hồ sơ bệnh nhân (kèm ngoại lệ đơn con BR-16) | Trang 15 ERD; BR-03, BR-14 |
| CHECK nghiệp vụ | Nhân sự ACTIVE bắt buộc có 2FA; đơn đã hủy bắt buộc có `cancel_reason_code`; `final_fee ≤ provisional_fee`; `reschedule_count ≤ 2`; `refund` có chứng từ thì bắt buộc có hash; số sao 1–5; số tiền > 0 | BR-20/21, BR-16, BR-13, UC90 |
| Unique hiệu lực | Một consent đang hiệu lực cho một hồ sơ; một cờ lạm dụng đang mở cho một tài khoản; giấy phép/email nhân sự duy nhất trong nhóm hồ sơ đang hiệu lực | BR-17, BR-19, BR-21 |

Trạng thái hiện tại: **đã khởi tạo 17 test, tất cả đạt** trên PostgreSQL 16 thật (4 file: triage, payment, overlap, staff-consent). Việc tiếp theo: bổ sung đủ các ràng buộc còn lại của trang 15 (3.1c, 3.1d, 3.1e, CHECK đơn đã hủy, hash chứng từ hoàn tiền) theo cùng khuôn.

Cách chạy: CI job `db` dựng PostgreSQL 16 → áp migration → chạy suite (đã cấu hình trong `.github/workflows/ci.yml`).

### Tầng 2 — Kiểm thử đơn vị logic nghiệp vụ (`services/api/test/unit/`)

Mục tiêu: kiểm các BR là hàm tính toán/quyết định thuần, bằng test tên-mang-mã-BR, data-driven tại các mốc biên. Bảng bao phủ theo BR:

| BR | Đối tượng kiểm thử chính | Mốc biên bắt buộc |
|---|---|---|
| BR-01 | Cửa sổ trượt 30 ngày, ngưỡng vi phạm nhẹ (Q-29: 2/3 lần — `PENDING-Q`), vòng ghép mới 15' sau hủy trong lúc chờ cọc (Q-45) | Đúng ngày thứ 30/31; lần thứ 2/3 |
| BR-02 | Ba bậc phạt theo giờ hủy (≥12h; 1–12h: −15 điểm % tỷ lệ chia cho 3 đơn kế; <1h/bom ca: khóa tạm), mở khóa tự động 24h (Q-43), xét duyệt một nơi, trễ >30' (Q-37 — `PENDING-Q`) | 12h/1h ±1'; đơn thứ 3/4 sau phạt |
| BR-03 | Khung giờ 17:00–21:30, giới hạn ca/ngày (Q-22 — tham số cấu hình) | 16:59/17:00/21:30/21:31 |
| BR-04 | Công thức cọc `max(30%, 50.000đ)`; bảng hoàn cọc 100/50/0%; phân bổ cọc vào dòng tranh chấp (Q-30); xác nhận bảng kê 2 cấp (Q-33); đối soát 4 nhóm | Mốc 12h/2h (đã có 8 test đạt); tiền lẻ & làm tròn VND |
| BR-05 | Tính phí nền tảng theo cấu hình hiệu lực; nguyên tắc nền tảng không giữ tiền | Đổi cấu hình giữa kỳ |
| BR-06 | Bán kính phục vụ theo cơ sở; quan hệ vùng cơ sở ↔ vùng riêng của điều dưỡng (chờ quyết giữ/bỏ `nurse_service_area` — test ở mức cơ chế) | Điểm trong/ngoài ranh giới |
| BR-07 | Hạn xuất phát, chờ trễ tối đa 2 lần × 15', phát hiện bom ca, check-in geofence + dự phòng ảnh | GPS lệch biên (NFR-08.3) |
| BR-08 | Chỉ kiểm khẳng định tính năng đặt ngay **vắng mặt** trong pilot | — |
| BR-09 | Hàm kiểm quyền 4 yếu tố (vai trò × tenant × quan hệ × ngữ cảnh ca/hồ sơ × trạng thái) — xem thêm Tầng 3 | Ma trận vai trò × tenant |
| BR-10 | Phân loại 4 nhóm; cấm bệnh nhân tự hạ nhóm; phiên bản luật (`rule_version`); AI lỗi/timeout → bác sĩ trực (Q-21 — `PENDING-Q`); cấm kết luận chẩn đoán/kê đơn (FR-03.6) | Bộ triệu chứng biên mỗi nhóm |
| BR-11 | Hạn khiếu nại (24h cho dòng phí; 30 ngày — Q-17 `PENDING-Q`); SLA 3 ngày làm việc; khiếu nại nghiêm trọng → khóa tạm, BV xác nhận trong 4h | Mốc 24h/30 ngày; ngày làm việc vs ngày lịch |
| BR-12 | Xóa/ẩn danh dữ liệu trong 72h; điều kiện chặn xóa (đơn đang mở, tranh chấp, công nợ); lưu giữ theo Q-14 | Đúng mốc 72h; từng điều kiện chặn |
| BR-13 | Đặt trước T+2h…T+14 ngày; tối đa 3 đơn đang hoạt động; đổi lịch tối đa 2 lần, giữ cọc; xác nhận lại T−3h (hạn T−2h); mặc định khi bệnh nhân im lặng (Q-19 — `PENDING-Q`) | T+2h/T+14d ±1'; lần đổi thứ 3 |
| BR-14 | Điều kiện tiên quyết đặt đơn: công nợ = "Chờ thanh toán" > 24h → chặn; không chồng lịch hồ sơ (đệm 30') | Đúng mốc 24h |
| BR-15 | Phân lớp phát sinh A/B/C; lớp B duyệt ≤ 10'; lớp C dừng ca + SOS; dịch vụ cần giấy chỉ định (danh mục Q-13) | Từng lớp; giấy chỉ định hết hạn/không hợp lệ |
| BR-16 | Dừng ca giữa chừng: tính phí phần đã làm (Q-08 50% — `PENDING-Q`), phí giữ ≤ phí tạm tính, hậu kiểm lý do "không an toàn" (Q-46), đơn con 0 cọc; mặc định khi BV quá hạn duyệt (Q-35 — `PENDING-Q`) | Phí biên 0%/100% |
| BR-17 | Đồng ý theo hồ sơ & phiên bản điều khoản; người thân đồng ý qua link email (không phản hồi 24h → không tạo hồ sơ); rút đồng ý theo trạng thái đơn (chưa điều phối → hủy + hoàn 100%; đang đi/đang ca → hoàn tất hoặc dừng an toàn) | Mốc 24h link; từng trạng thái đơn |
| BR-18 | Toàn bộ bảng F1a–F9 dạng data-driven (sự kiện hết hạn → quyết định → bút toán kỳ vọng); F5 không test (Q-12); ô sau-quyết-Admin của F1b để `todo` (Q-44) | Từng mã F × nhánh đúng hạn/quá hạn (khung 9 `it.todo` đã khởi tạo) |
| BR-19 | Cờ lạm dụng: cửa sổ 90 ngày, thông báo & phản biện 7 ngày, tính cả miễn thu tự động (Q-42 — `PENDING-Q`) | Lần thứ 2 trong/ngoài 90 ngày |
| BR-20 | Email là định danh duy nhất; OTP email 5' (reset 15'); bộ đếm khóa chung mật khẩu+2FA: 5 lần → khóa 15' (R-L03); mã trong ca (check-in/bảng kê/phát sinh/dừng ca) tách biệt OTP tài khoản | Mốc 5'/15'; lần sai thứ 5/6 |
| BR-21 | Máy trạng thái hồ sơ nhân sự 10 trạng thái; duyệt 2 bước; nền tảng không chứng nhận CCHN; quét hết hạn giấy phép hằng ngày | Mọi chuyển trạng thái hợp lệ/không hợp lệ |
| BR-22 | Báo cáo chăm sóc bắt buộc kể cả khi bệnh nhân không bổ sung triệu chứng; biểu mẫu theo loại dịch vụ (khung Q-49); nhắc 2h, treo nhận ca sau 24h | Đúng mốc 2h/24h |
| BR-23 | SOS: phát alert ≤ 10 giây (NFR-01.2); leo thang 5' tới đầu mối dự phòng (Q-48, `sos_escalation_event` từng nấc); không tự gọi 115; SOS trong ca → dừng ca, cấm thu phí tại chỗ | Mốc 5:00 chính xác; ack trước/sau mốc |
| R-L03 | Khóa đăng nhập (đã gộp trong BR-20 ở trên — đề xuất đưa vào BR-20 ở bản use_case kế tiếp) | — |
| R-UC135 | Hoãn toàn bộ (Mục 2.2) | — |

Ngưỡng bao phủ: logic tài chính (BR-04, BR-18), vi phạm (BR-01, BR-02) và phân quyền (BR-09) đạt **≥ 80% bao phủ nhánh** trong CI (NFR-09.1).

### Tầng 3 — Kiểm thử tích hợp API & phân quyền

- **Hợp đồng API:** Mỗi endpoint kiểm tra mã trạng thái, cấu trúc đáp ứng, và thông điệp lỗi không lộ dữ kiện nhạy cảm; chuyển trạng thái máy trạng thái đơn/ca chỉ theo bảng chuyển đã duyệt (NFR-05.4) — chuyển sai bị chặn ở API.
- **Ma trận phân quyền BR-09 (bắt buộc, tự động):** Với mỗi route chạm dữ liệu bệnh nhân/tài chính, sinh test hoán đổi hệ thống: vai trò × bệnh viện (tenant) × quan hệ với hồ sơ × trạng thái đơn — kỳ vọng 403/404 khi sai bất kỳ yếu tố nào (khớp SEC-10.2 IDOR/cross-tenant). Bao gồm cả việc **cấp URL ký xem ảnh**: URL chỉ được cấp sau khi qua kiểm tra 4 yếu tố, hết hạn ≤ 15 phút (NFR-03.3), bucket luôn riêng tư.
- **Luồng nghiệp vụ xuyên tầng:** Mỗi luồng 01–15, 17 có ít nhất một test tích hợp đầu-cuối ở mức API cho đường chính + nhánh ngoại lệ tốn kém nhất (hủy trong chờ cọc, rút đồng ý giữa chừng, dừng ca, khiếu nại F1a/F1b).
- **Tính nhất quán dữ liệu:** Sau mỗi luồng, khẳng định bút toán `financial_entry` cân đối và chỉ ghi thêm (không sửa/xóa dòng cũ), `order_status_history` ghi đủ chuyển trạng thái, `audit_log` có sự kiện cho thao tác nhạy cảm (FR-01.7).

### Tầng 4 — Kiểm thử tích hợp ngoài & hợp đồng (contract)

| Đối tác | Cách kiểm thử | Nội dung bắt buộc |
|---|---|---|
| Cổng thanh toán | Sandbox của cổng + máy chủ webhook giả | Chữ ký HMAC hợp lệ/không hợp lệ; webhook bắn trùng/bắn lại (idempotent — một giao dịch, một lệnh hoàn); thứ tự sự kiện lạ (hoàn trước xác nhận); tiền về tài khoản bệnh viện, nền tảng không giữ tiền (BR-05); độ trễ xác nhận webhook ≤ 3 giây (NFR-01.4) |
| Email giao dịch | Hộp thư kiểm thử / nhà cung cấp giả | Mẫu thư không chứa dữ kiện lâm sàng chi tiết (NFR-04.4); OTP đúng hạn; thư đồng ý người thân chứa link đúng phạm vi & hạn (BR-17) |
| Push (FCM/APNs) | Thiết bị/emulator + dịch vụ giả | SOS dùng kênh in-app tức thời, không phụ thuộc hàng đợi email (US-HP-36 AC-03); thông báo không lộ PHI trên màn hình khóa |
| Bản đồ/geocoding | Dịch vụ giả + bộ tọa độ cố định | Tính ETA/hạn xuất phát (BR-07); geofence với bán kính cấu hình được |
| Hóa đơn điện tử | Sandbox nhà cung cấp | Phát hành hóa đơn phần còn lại; hóa đơn điều chỉnh khi hoàn tiền (FR-06.7 — thời điểm theo Q-11) |

### Tầng 5 — Kiểm thử job nền & hẹn giờ (FR-11.2)

Toàn bộ hẹn giờ nghiệp vụ chạy qua hàng đợi job; kiểm bằng đồng hồ giả, khẳng định hành động xảy ra đúng mốc với sai lệch ≤ 60 giây (NFR-05.3) và mỗi lần leo thang đều ghi log mốc gửi/xác nhận (FR-11.3):

Cửa sổ cọc 15' · nhắc T−24h · xác nhận lại của điều dưỡng T−3h (hạn T−2h) · nhắc & mời cập nhật triệu chứng T−2h (UC119) · cửa sổ khiếu nại dòng phí 24h · "Chờ thanh toán" 24h → công nợ · F1a 5 ngày · hạn xử lý cấp BV của F1b → leo thang nền tảng (quyết trong 3 ngày làm việc) · xét vi phạm 72h (F6) và mở khóa bom ca 24h (Q-43) chạy độc lập · leo thang SOS 5' · nhắc báo cáo 2h / treo nhận ca 24h · xóa dữ liệu 72h (BR-12) · quét hết hạn CCHN hằng ngày · đối soát cuối kỳ (F7). Kèm test job chết/treo: hàng đợi tồn đọng phát cảnh báo, job chạy lại không nhân đôi hành động tiền (idempotent theo khóa nghiệp vụ + ràng buộc 3.1c).

### Tầng 6 — Kiểm thử đầu-cuối theo hành trình người dùng (E2E)

- **Web (Playwright):** Luồng vàng pilot: đăng ký email → tạo hồ sơ + đồng ý → sàng lọc → đặt lịch trước → trả cọc → điều dưỡng nhận ca → check-in bằng mã trong app → đánh giá ban đầu → thực hiện + phát sinh có xác nhận → báo cáo → bảng kê 2 cấp → trả phần còn lại → hóa đơn. Các hành trình nhánh bắt buộc: hủy theo 3 mốc hoàn cọc; bổ sung triệu chứng khẩn cấp ở 07A → hủy + hoàn 100% một lần; khiếu nại F1a tới miễn thu tự động; khiếu nại F1b tới leo thang; SOS từ bấm nút tới đóng sự cố có ghi chép xử lý.
- **App điều dưỡng (sau khi chốt React Native):** Maestro/Detox cho các hành trình ca; kiểm riêng hành vi GPS nền, mất mạng giữa ca, đồng bộ lại (phạm vi offline theo quyết định NFR-08.2).
- **Tiêu chí giao diện người lớn tuổi** kiểm ở tầng này: cỡ chữ ≥ 16px, vùng chạm ≥ 48px, tương phản WCAG 2.1 AA, SOS tới được trong ≤ 2 chạm (NFR-07.1, NFR-07.2), hộp xác nhận 2 bước cho thanh toán/hủy (NFR-07.4 — cơ chế đếm ngược chống bấm nhầm SOS còn chờ PO duyệt, test ở mức cơ chế khi được duyệt).

### Tầng 7 — Kiểm thử bảo mật (theo SEC-00…SEC-10)

- **Trong CI, mọi PR (SEC-10.2):** Bộ test bảo mật tự động — ma trận IDOR/cross-tenant (Tầng 3), tính toàn vẹn máy trạng thái, idempotent thanh toán dưới tải đồng thời (hai webhook/xác nhận song song → đúng một thực thi), quét bí mật trong commit, kiểm toán phụ thuộc có lỗ hổng. Test bảo mật fail = chặn merge.
- **Cổng rà soát bảo mật khi merge (SEC-10.1):** PR chạm xác thực/phân quyền/phiên/tài chính/lược đồ lâm sàng phải có security reviewer duyệt kèm checklist BR-09 + test phủ định đi kèm.
- **Kiểm thử xâm nhập độc lập (SEC-10.3):** Trước go-live pilot và sau mọi thay đổi lớn về xác thực/tài chính: OWASP Top 10, OWASP API Security Top 10, thoát cách ly tenant, điều kiện đua tài chính. Mức tuân thủ mục tiêu OWASP ASVS Level 2 (NFR-03.4).
- **Mô hình hóa mối đe dọa (SEC-10.4):** Mỗi năng lực lớn mới (điển hình UC135 nếu được duyệt) phải có phiên STRIDE trước khi viết code/test.
- **Kiểm riêng theo chính sách:** Mật khẩu băm Argon2id/bcrypt, OTP giới hạn số lần thử (NFR-03.2); nhật ký audit chỉ ghi thêm, không chứa mật khẩu/token/PHI thừa (NFR-03.5); khóa API bên thứ ba nằm trong secret manager, không trong repo (NFR-03.6).

### Tầng 8 — Kiểm thử phi chức năng (theo NFR-01…NFR-09)

| Nhóm NFR | Phương pháp kiểm thử | Chỉ tiêu (nguồn) |
|---|---|---|
| NFR-01 Hiệu năng | Kiểm thử tải bằng k6 trên môi trường staging cấu hình như production: kịch bản giờ cao điểm 17:00–21:30, ~300 ca/ngày (giả định pilot) | API p95 ≤ 300ms đọc / ≤ 800ms ghi; phát SOS → push tới đầu mối ≤ 10 giây (p95); GPS gửi mỗi 10–15 giây, pin ≤ 5%/giờ |
| NFR-02 Sẵn sàng & khôi phục | Diễn tập khôi phục PITR hàng quý trên bản sao dữ liệu tổng hợp; test suy giảm (tắt AI, tắt cổng, mất GPS) | RPO ≤ 1h, RTO ≤ 4h; AI hỏng → bác sĩ trực phân loại; cổng hỏng → quy trình F8; GPS hỏng → check-in ảnh dự phòng (BR-07, BR-10) |
| NFR-03 Bảo mật | Gộp ở Tầng 7 + kiểm cấu hình TLS/mã hóa tĩnh | TLS 1.2+; AES-256 at rest; URL ký ≤ 15' |
| NFR-04 Riêng tư & pháp lý | Rà soát luồng dữ liệu theo Nghị định 13/2023: đồng ý theo hồ sơ, rút đồng ý, xóa trong 72h; kiểm nội dung email/push không lộ PHI | Theo BR-12, BR-17; nơi lưu trữ dữ liệu chờ đánh giá pháp lý (Q-14) |
| NFR-05 Toàn vẹn dữ liệu & tài chính | Kiểm bất biến: tổng 4 nhóm đối soát cọc = tổng cọc thu (FR-06.8); sổ cái chỉ ghi thêm; múi giờ UTC lưu trữ, hiển thị Asia/Ho_Chi_Minh | Sai lệch đối soát = 0 ở bộ dữ kiện chuẩn; độ chính xác hẹn giờ ≤ 60 giây |
| NFR-06 Mở rộng & đa tenant | Test cách ly tenant từ ngày một (kèm Tầng 3); test tăng tải gấp 5 lần nền pilot | Không rò dữ liệu chéo tenant; chịu surge ×5 không đổi kiến trúc |
| NFR-07 Khả dụng | Kiểm tự động WCAG + kiểm thủ công với người dùng lớn tuổi thật ở UAT | Chữ ≥ 16px; chạm ≥ 48px; đặt lịch ≤ 5 màn hình; SOS ≤ 2 chạm |
| NFR-08 Tương thích & bền bỉ hiện trường | Ma trận thiết bị Android 10+/iOS 15+, trình duyệt admin 2 phiên bản mới nhất; test mạng 3G chập chờn, mất mạng giữa ca (khi chốt phạm vi offline) | Theo NFR-08.1/08.2/08.3 |
| NFR-09 Bảo trì & quan trắc | Kiểm log JSON có cấu trúc; cảnh báo vận hành: tồn đọng hàng đợi, webhook lỗi, tỷ lệ OTP thất bại tăng, SOS quá 5' chưa xác nhận; 4 runbook sự cố chuẩn có diễn tập | NFR-09.3, NFR-09.5 |

Các chỉ tiêu số ở tầng này phần lớn là **đề xuất kỹ thuật chờ chốt** (danh sách 5 quyết định ở cuối tài liệu NFR) — test viết theo giá trị đề xuất và đánh dấu `PENDING-NFR`, rà lại khi chốt.

### Tầng 9 — Kiểm thử chấp nhận (UAT) & sẵn sàng pilot

- Bệnh viện đối tác chạy kịch bản UAT dựng từ AC của 27 Story Must trên môi trường staging với dữ kiện tổng hợp giống thật (cấu hình giá/khung giờ của chính bệnh viện).
- Diễn tập vận hành: trực SOS một ca mẫu, xử lý khiếu nại F1a/F1b mẫu, đối soát cuối kỳ mẫu, khôi phục dữ liệu (liên kết NFR-02.2) — theo 4 runbook ở NFR-09.5.
- Tiêu chí go/no-go ở Mục 8.

## 5. Bảng truy vết bao phủ theo User Story

Mỗi Story Must đã có sẵn ma trận TC trong file story (tổng **69 TC** cho 27 Story). Bảng dưới đây gán tầng kiểm thử chính/phụ và trạng thái khởi tạo:

| Epic | Story | TC sẵn có | Tầng chính | Trạng thái |
|---|---|---|---|---|
| A — Tài khoản & truy cập | US-HP-01 Đăng ký/đăng nhập email | 3 | 2, 3 | Chưa khởi tạo |
| | US-HP-02 Đồng ý người thân qua link email | 3 | 2, 3, 4 | Chưa khởi tạo |
| | US-HP-03 Rút đồng ý & đồng ý điều khoản mới | 3 | 2, 3, 5 | Chưa khởi tạo |
| | US-HP-04 Kích hoạt nhân sự 2 bước | 2 | 1 (CHECK 2FA), 2, 3 | Một phần (Tầng 1) |
| | US-HP-05 2FA bắt buộc cho nhân sự | 3 | 2, 3, 7 | Một phần (Tầng 1) |
| B — Hồ sơ & sàng lọc | US-HP-06 Tạo hồ sơ bệnh nhân | 3 | 3, 6 | Chưa khởi tạo |
| | US-HP-07 Sàng lọc 4 nhóm | 3 | 1 (3.1a), 2 | Một phần (Tầng 1) |
| C — Đặt lịch & ghép ca | US-HP-09 Đặt lịch trước | 2 | 2, 3, 6 | Chưa khởi tạo |
| | US-HP-10 Ghép ca tự động | 2 | 2, 3 | Chưa khởi tạo |
| | US-HP-11 Vòng ghép mới khi ĐD hủy lúc chờ cọc | 2 | 2, 5 | Chưa khởi tạo |
| | US-HP-12 Nhắc lịch & cập nhật triệu chứng (07A) | 3 | 1, 2, 5 | Một phần (Tầng 1) |
| | US-HP-13 Bệnh nhân hủy & bảng hoàn cọc | 3 | 2 (BR-04 — **đã có 8 test đạt**) | Một phần |
| D — Cọc & thanh toán | US-HP-14 Cọc 30% qua cổng BV | 3 | 1 (3.1b), 4, 5 | Một phần (Tầng 1) |
| | US-HP-15 Phần còn lại & "Chờ thanh toán" 24h | 3 | 2, 5 | Chưa khởi tạo |
| E — Thực hiện ca | US-HP-18 Điều dưỡng xem tóm tắt trước ca | 2 | 3 | Chưa khởi tạo |
| | US-HP-19 Check-in bằng mã trong app | 3 | 2, 3, 6 | Chưa khởi tạo |
| | US-HP-20 Đánh giá ban đầu theo biểu mẫu | 2 | 3, 6 | Chưa khởi tạo |
| | US-HP-22 Báo cáo chăm sóc bắt buộc | 3 | 2, 3 | Chưa khởi tạo |
| | US-HP-23 Phát sinh trong ca có xác nhận | 3 | 2, 3 | Chưa khởi tạo |
| | US-HP-24 Dừng ca vì môi trường không an toàn | 3 | 2, 3 | Chưa khởi tạo |
| | US-HP-25 Phí tối thiểu khi không thực hiện được do phía bệnh nhân (Q-03) | 3 | 2 (tham số cấu hình) | Chờ giá trị Q-03 cho test số tiền |
| F — SOS | US-HP-26 Bệnh nhân/người nhà bấm SOS | 3 | 2, 5, 8 (độ trễ) | Chưa khởi tạo |
| | US-HP-27 Đầu mối trực xác nhận & đóng SOS | 2 | 3, 5 | Chưa khởi tạo |
| G — Quản trị BV | US-HP-28 Khiếu nại dòng phí F1a/F1b | 3 | 2 (khung BR-18), 5 | Khung `todo` đã có |
| | US-HP-29 Ghi nhận vi phạm & khóa/mở khóa | 3 | 2, 5 | Chưa khởi tạo |
| H — Quản trị nền tảng | US-HP-34 Admin nền tảng quyết F1b leo thang (Q-44) | 2 | 2, 5 | Tới bước leo thang; sau-quyết để `todo` |
| I — Thông báo | US-HP-36 Thông báo theo sự kiện, không SMS | 3 | 4, 5 | Chưa khởi tạo |

Nhóm **Should** (US-HP-08 xem lại kết quả sàng lọc; US-HP-16 hoàn tiền thủ công có đối soát; US-HP-17 sao kê & xác nhận 2 cấp; US-HP-21 liên lạc trong app; US-HP-30 đối soát cọc 4 nhóm; US-HP-31 điều phối đơn chờ & ngoại lệ; US-HP-32 cấu hình theo bệnh viện; US-HP-33 quản lý tenant; US-HP-35 tra cứu audit & quyết định tài chính; US-HP-37 tra cứu lịch sử đơn & báo cáo): khi được kéo vào phạm vi, mỗi Story viết bản đầy đủ cùng khuôn (AC + ma trận TC) trước khi viết test; riêng US-HP-30 và US-HP-17 thuộc vùng tiền nên áp ngưỡng bao phủ nhánh như nhóm Must ngay từ đầu.

## 6. Bao phủ theo FR

| Nhóm FR | Tầng bao phủ chính | Điểm nhấn |
|---|---|---|
| FR-01 Tài khoản & phân quyền | 1, 2, 3, 7 | Khóa chung 5 lần (FR-01.2/R-L03); audit chỉ ghi thêm (FR-01.7) |
| FR-02 Hồ sơ, đồng ý, riêng tư | 1, 2, 3, 5 | Xóa 72h (FR-02.5); rút đồng ý theo trạng thái đơn (FR-02.3) |
| FR-03 Sàng lọc & AI | 1, 2, 8 | Fallback bác sĩ trực (FR-03.4); ranh giới AI (FR-03.6) |
| FR-04 Đặt lịch & ghép ca | 2, 3, 5, 6 | Trần 3 đơn, kiểm công nợ, geofence dịch vụ (FR-04.1) |
| FR-05 Thực hiện ca | 2, 3, 6 | Bom ca (FR-05.2); vắng mặt bệnh nhân (FR-05.9) |
| FR-06 Tiền & đối soát | 1, 2, 4, 5 | Webhook ký + idempotent (FR-06.2); đối soát 4 nhóm (FR-06.8) |
| FR-07 Vi phạm & khiếu nại | 2, 3, 5 | Khiếu nại nghiêm trọng khóa tạm 4h (FR-07.4); sự cố lâm sàng tách riêng (FR-07.9) |
| FR-08 Tái khám | 3 | Phân quyền lịch sử theo tenant (FR-08.2) — nhóm Should |
| FR-09 SOS | 2, 5, 8 | Độ trễ phát alert; SOS trong ca cấm thu phí (FR-09.4) |
| FR-10 Quản trị & cấu hình | 2, 3 | Cấu hình hiệu lực theo thời gian (FR-10.1/10.2); biểu mẫu báo cáo (FR-10.6/Q-49) |
| FR-11 Thông báo & job | 4, 5 | Không SMS, không lộ PHI (FR-11.1); log leo thang (FR-11.3) |

## 7. Dữ liệu kiểm thử

- **Fixture theo test** (`db/tests/src/fixtures.ts`): dựng tối thiểu — bệnh viện, cơ sở, tài khoản theo vai trò, hồ sơ, dịch vụ+giá hiệu lực, đơn ở trạng thái cần thiết.
- **Seed chuẩn** (`db/seeds/001_reference_and_demo.sql`): ca #MH-8824 — một bộ số liệu duy nhất cho dev, E2E và UAT (BV Đa khoa Đà Nẵng, giá 400.000đ, cọc 120.000đ, ca 17:30–18:15). Không tạo bộ số liệu thứ hai lệch nhau (bài học từ đợt rà soát giao diện Stitch).
- **Dữ kiện biên bắt buộc có sẵn trong fixture:** số tiền quanh sàn cọc 50.000đ và điểm làm tròn 30%; thời gian quanh các mốc 2h/12h/24h/72h/5 ngày; triệu chứng mẫu cho đủ 4 nhóm sàng lọc kèm `rule_version`; tọa độ trong/ngoài geofence; giấy phép nhân sự còn hạn/hết hạn.
- **Dữ liệu tải:** Sinh tổng hợp ~300 ca/ngày theo phân bố giờ cao điểm; tuyệt đối không sao chép dữ liệu production (NFR-09.4).

## 8. Môi trường, CI và tiêu chí chất lượng

**Môi trường:** Local (docker compose: PostgreSQL 16 + Redis) → CI (GitHub Actions) → Staging (cấu hình như production, dữ kiện tổng hợp, cấu hình bệnh viện pilot thật) → Production.

**Cổng CI (mọi PR — `.github/workflows/ci.yml`):**
1. Unit test + kiểm tra kiểu — phải xanh.
2. Job DB: áp migration lên PostgreSQL 16 trắng → chạy `db/tests` — phải xanh.
3. Quét bí mật + kiểm toán phụ thuộc (SEC-10.2) — phát hiện là chặn.
4. Bao phủ nhánh ≥ 80% cho các module BR-04, BR-18, BR-01, BR-02, BR-09 (NFR-09.1).
5. PR thuộc vùng nhạy cảm (xác thực/phân quyền/tài chính/lâm sàng): thêm duyệt của security reviewer (SEC-10.1).

**Tiêu chí vào kiểm thử (entry):** Story có AC rõ và mã truy vết; đặc tả liên quan không còn mâu thuẫn chưa xử lý; môi trường + dữ kiện sẵn sàng.

**Tiêu chí ra / sẵn sàng pilot (exit):** 69 TC của 27 Story Must đạt; 0 lỗi mức Blocker/Critical đang mở; bộ test bảo mật CI xanh và pen test độc lập đã xong, lỗi Critical/High đã xử lý (SEC-10.3); diễn tập PITR đạt RPO/RTO; UAT bệnh viện ký; 4 runbook sự cố đã diễn tập (NFR-09.5).

**Quản lý lỗi:** Mức độ theo tác động (tiền/an toàn người bệnh/riêng tư = cao nhất); mọi lỗi ghi mã UC/BR liên quan; lỗi thoát ra pilot quay lại thành test hồi quy bắt buộc ở tầng thấp nhất bắt được nó.

## 9. Vai trò

| Vai trò | Trách nhiệm kiểm thử |
|---|---|
| Lập trình viên | Viết unit/DB/API test cùng PR; giữ test xanh; sửa test khi đặc tả duyệt đổi |
| QA | Sở hữu E2E, kịch bản UAT, ma trận truy vết; rà bao phủ theo Story/BR mỗi đợt phát hành |
| PO | Chốt các quyết định ở Mục 11; ký tiêu chí go/no-go pilot |
| Security reviewer | Duyệt PR vùng nhạy cảm; sở hữu lịch pen test & threat model |
| Bệnh viện đối tác | UAT, xác nhận biểu mẫu lâm sàng (Q-49), diễn tập vận hành & SOS |

## 10. Lộ trình triển khai kiểm thử

1. **Nền dữ liệu (đã xong khung):** Migration + seed chạy sạch trên PostgreSQL 16; 17 test ràng buộc đạt; CI có job DB. → Bổ sung nốt các ràng buộc trang 15 còn thiếu test (3.1c/d/e và các CHECK còn lại).
2. **API lõi:** Unit theo bảng BR ở Tầng 2 (ưu tiên BR-04, BR-18, BR-20/21, BR-09, BR-10); ma trận phân quyền Tầng 3; contract cổng thanh toán.
3. **Job & thông báo:** Tầng 5 cho toàn bộ hẹn giờ; kiểm kênh email/push theo Tầng 4.
4. **Ứng dụng:** E2E luồng vàng + nhánh (Tầng 6); kiểm khả dụng người lớn tuổi.
5. **Trước pilot:** Pen test (SEC-10.3), diễn tập PITR + runbook, UAT ký (Tầng 9).

## 11. Quyết định mở ảnh hưởng trực tiếp tới kiểm thử

| Quyết định | Ảnh hưởng tới kiểm thử | Cách xử lý hiện tại | Điều kiện mở khóa |
|---|---|---|---|
| Q-03 Phí tối thiểu ca tại nhà | US-HP-25 không khẳng định được số tiền | Test cơ chế theo tham số cấu hình | PO + kế toán BV chốt giá trị |
| Q-44 Ô mặc định sau quyết Admin (F1b) | Không viết được test bước cuối của F1b/US-HP-34 | `it.todo` kèm mã Q-44 | PO xác nhận ô "đề xuất" trong use_case_v8.1 |
| Q-12 / F5 Tiền mặt | Toàn bộ nhánh tiền mặt ngoài phạm vi | Không test; test khẳng định tính năng vắng mặt | Chỉ khi tiền mặt vào phạm vi |
| Q-11 Thời điểm xuất hóa đơn cọc | FR-06.7 thiếu mốc khẳng định | Test cơ chế phát hành/điều chỉnh, bỏ mốc thời gian | Kế toán BV chốt |
| Q-49 Trường biểu mẫu báo cáo theo dịch vụ | Test biểu mẫu chỉ ở mức khung | Test khung + trường bắt buộc tối thiểu | Khoa lâm sàng BV duyệt từng biểu mẫu |
| Duyệt từ điển enum + mô hình trạng thái 2 lớp | Mọi test trạng thái đang dựa trên enum "đề xuất" của ERD-2 | Test theo enum hiện hành; khi duyệt khác, rà soát tập trung qua `packages/shared` | PO ký duyệt (ADR-0003) |
| 5 quyết định NFR (SLA uptime, RPO/RTO & ngân sách, nơi lưu trữ dữ liệu + đánh giá chuyển dữ liệu xuyên biên giới theo NĐ 13/2023, phạm vi offline của app điều dưỡng, cơ chế chống bấm nhầm SOS) | Chỉ tiêu Tầng 8 đang là đề xuất | Đánh dấu `PENDING-NFR` | PO/pháp lý chốt từng mục |
| UC135 giữ/cắt | FR-04.11 chưa có test | Hoãn toàn bộ; nếu giữ: threat model trước (SEC-10.4) | Chủ dự án quyết |

---

*Nguyên tắc xuyên suốt: kiểm thử bám đặc tả đã chốt; phần chưa chốt được kiểm ở mức cơ chế hoặc để chờ có đánh dấu — tuyệt đối không biến một đề xuất thành "sự thật đã kiểm chứng" chỉ vì test viết theo nó đang xanh.*
