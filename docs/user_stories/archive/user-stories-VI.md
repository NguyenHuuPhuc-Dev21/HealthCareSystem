# User Stories dạng đầy đủ (nhóm Must) — Nền tảng đặt điều dưỡng bệnh viện chăm sóc tại nhà

> Toàn bộ **27 story Must** của bộ đề xuất (`user-stories-de-xuat-theo-baseline-v8.1-8.14.md`) được viết lại theo đúng cấu trúc dạng đầy đủ đã dùng cho Nexus: **Story Metadata → Bối cảnh & Vấn đề thực tế → User Story Statement → Acceptance Criteria (Given/When/Then) → Acceptance Test Cases (Traceability Matrix)**.
> Nguồn truy vết: `use_case_diagram.drawio` (140 UC, BR-01–BR-23) + `workflow_diagram.drawio` + thay đổi luồng 07A của bản 8.11. Phạm vi: pilot Q-23 — 1 bệnh viện, chỉ đặt hẹn trước, chỉ thanh toán qua cổng, không tiền mặt, không đặt tức thì.
> Trạng thái: **đề xuất của Atlas, chờ Phúc/PO chốt**. Story phụ thuộc điểm chưa chốt được ghi ở dòng **Phụ thuộc quyết định** trong metadata. 10 story Should chưa viết dạng đầy đủ trong file này.

---

# EPIC A — TÀI KHOẢN & QUYỀN TRUY CẬP

# User Story US-HP-01 — Đăng ký và đăng nhập bằng email (bệnh nhân/người thân)

## 📌 Story Metadata

- **Story ID:** `US-HP-01`
- **Story Title:** Email-Only Registration & Sign-In for Patients
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Bệnh nhân, Người thân/Người đại diện
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC1, UC14, UC61, UC82, UC83 · BR-20 · Luồng 01

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Nhóm bệnh nhân cao tuổi ít dùng công nghệ:** mỗi kênh đăng nhập thêm vào (SĐT, CCCD) là thêm một điểm rơi khỏi luồng. Baseline đã chốt email là kênh tài khoản duy nhất (Q-51 → BR-20).
2. **Dữ liệu định danh nhạy cảm không cần thiết:** nền tảng không thu CCCD nên không thể và không cần xác minh tuổi/danh tính pháp lý — thu thêm chỉ tăng rủi ro bảo mật mà không phục vụ nghiệp vụ.

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> tôi muốn đăng ký và đăng nhập chỉ bằng email + mật khẩu (kèm OTP gửi qua email khi hệ thống yêu cầu),  
> để dùng dịch vụ mà không cần cung cấp số điện thoại hay CCCD.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Đăng ký bằng email
- **Given** một người dùng chưa có tài khoản,
- **When** họ đăng ký bằng email và mật khẩu,
- **Then** hệ thống tạo tài khoản và xác thực quyền kiểm soát email qua OTP/link gửi tới chính email đó.

### AC-02: Không tồn tại kênh định danh khác
- **Given** bất kỳ màn hình đăng ký/đăng nhập nào của bệnh nhân,
- **When** người dùng thao tác,
- **Then** không xuất hiện trường SĐT hay CCCD và không có đường đăng nhập qua SMS.

### AC-03: Quên mật khẩu qua email
- **Given** một tài khoản đã đăng ký,
- **When** chủ tài khoản yêu cầu đặt lại mật khẩu,
- **Then** hệ thống gửi OTP/link đặt lại tới email đã đăng ký; không có kênh đặt lại nào khác cho bệnh nhân.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP01-01` | Đăng ký email mới | Functional | Tài khoản được tạo sau khi xác thực email |
| `TC-USHP01-02` | Rà soát form đăng ký/đăng nhập | UI/Compliance | Không có trường SĐT/CCCD, không có tùy chọn SMS |
| `TC-USHP01-03` | Đặt lại mật khẩu | Functional/Security | Chỉ hoàn tất được bằng OTP/link qua email đã đăng ký |

---

# User Story US-HP-02 — Người thân đồng ý thay qua link email

## 📌 Story Metadata

- **Story ID:** `US-HP-02`
- **Story Title:** Relative Consent via Email Link
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Người thân/Người đại diện
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC2, UC4 · BR-17 · Luồng 02/04

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Bệnh nhân thường không tự thao tác:** người đặt và người đồng ý thường là người thân. Nếu điều phối viên bấm đồng ý thay, giá trị pháp lý của consent bằng không khi có tranh chấp.
2. **Consent phải gắn với nội dung cụ thể:** đồng ý chung chung không đủ căn cứ — phải biết ai đồng ý, cho hồ sơ/đơn nào, với nội dung nào, lúc nào.

---

## 📖 User Story Statement

> Là **người thân/người đại diện**,  
> tôi muốn nhận link qua email để xem tóm tắt đơn và tự xác nhận đồng ý cho hồ sơ của bệnh nhân,  
> để việc đặt hộ có căn cứ rõ ràng mà không ai phải bấm đồng ý thay tôi.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Link gắn đúng một đối tượng đồng ý
- **Given** một đơn/hồ sơ cần consent của người đại diện,
- **When** hệ thống gửi link qua email,
- **Then** link chỉ mở đúng nội dung cần đồng ý của đối tượng đó, hết hạn theo thời hạn cấu hình.

### AC-02: Người xác nhận tự thao tác và được ghi vết
- **Given** người đại diện mở link hợp lệ,
- **When** họ xác nhận đồng ý,
- **Then** hệ thống ghi lại danh tính email, thời điểm và phiên bản nội dung đã đồng ý; điều phối viên không có thao tác đồng ý thay.

### AC-03: Cam kết tư cách đại diện
- **Given** bệnh nhân là trẻ em hoặc người không tự quyết định được,
- **When** chủ tài khoản/người đại diện xác nhận,
- **Then** họ phải cam kết tư cách người đại diện theo BR-17; nền tảng không xác minh tuổi/quan hệ.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP02-01` | Mở link và xác nhận | Functional | Consent được ghi với email, thời điểm, phiên bản nội dung |
| `TC-USHP02-02` | Link hết hạn/dùng lại | Security | Link hết hạn bị từ chối, không ghi consent |
| `TC-USHP02-03` | Đồng ý thay bởi điều phối | Security AuthZ | Không tồn tại thao tác đồng ý thay trong vai trò Điều phối |

---

# User Story US-HP-03 — Rút lại đồng ý và đồng ý điều khoản mới

## 📌 Story Metadata

- **Story ID:** `US-HP-03`
- **Story Title:** Consent Withdrawal & New-Terms Consent
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Chủ tài khoản (bệnh nhân/người đại diện)
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC106, UC138 · Q-47 · Luồng 02, 03

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Đồng ý một chiều là rủi ro pháp lý:** nếu người dùng không rút lại được consent, bệnh viện và nền tảng mang rủi ro khi tiếp tục xử lý dữ liệu sau khi họ đã đổi ý.
2. **Điều khoản thay đổi theo thời gian:** áp điều khoản mới cho người chưa đồng ý phiên bản mới tạo tranh chấp về căn cứ áp dụng.

---

## 📖 User Story Statement

> Là **chủ tài khoản**,  
> tôi muốn rút lại đồng ý đã cấp (và được báo rõ hệ quả), và khi nền tảng đổi điều khoản thì được mời đồng ý lại qua luồng riêng,  
> để quyền của tôi đối với dữ liệu của mình có hiệu lực thực tế.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Rút lại đồng ý có ghi vết và có hệ quả
- **Given** một consent đang hiệu lực,
- **When** chủ tài khoản rút lại qua luồng 02,
- **Then** hệ thống ghi thời điểm rút, hiển thị hệ quả trước khi xác nhận, và chặn các xử lý phụ thuộc consent đó theo quy định.

### AC-02: Điều khoản mới cần đồng ý lại
- **Given** một phiên bản điều khoản mới được ban hành,
- **When** người dùng đăng nhập,
- **Then** hệ thống mời đồng ý qua luồng 03 (UC138); chưa đồng ý thì phiên bản mới không áp dụng cho tài khoản.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP03-01` | Rút consent | Functional | Consent chuyển trạng thái đã rút, có timestamp và log |
| `TC-USHP03-02` | Chặn xử lý phụ thuộc consent đã rút | Functional/Security | Xử lý liên quan bị chặn sau khi rút |
| `TC-USHP03-03` | Đồng ý điều khoản mới | Functional | Tài khoản chưa đồng ý vẫn theo phiên bản cũ |

---

# User Story US-HP-04 — Kích hoạt tài khoản nhân sự hai bước + xác nhận chuyên môn

## 📌 Story Metadata

- **Story ID:** `US-HP-04`
- **Story Title:** Two-Step Staff Activation & Professional Confirmation
- **Bounded Context:** `Identity & Consent`, `Hospital Operations`
- **Primary Persona:** Điều dưỡng, Bác sĩ (nhân sự bệnh viện)
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC139 · BR-21 · Q-50 · Luồng 01

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Tài khoản được cấp không đồng nghĩa đủ điều kiện hành nghề trong hệ thống:** bệnh viện cấp tài khoản cho nhân sự, nhưng chuyên môn phải được xác nhận riêng trước khi họ chạm vào bệnh nhân.
2. **Ghép nối nhầm người chưa xác nhận là rủi ro an toàn:** nếu danh sách ghép không loại tài khoản chưa kích hoạt đủ hai bước, hệ thống có thể giao ca cho người chưa được xác nhận chuyên môn.

---

## 📖 User Story Statement

> Là **điều dưỡng/bác sĩ mới được bệnh viện cấp tài khoản**,  
> tôi muốn hoàn tất xác thực hai bước và được xác nhận chuyên môn trước khi nhận ca,  
> để chỉ nhân sự đủ điều kiện mới xuất hiện trong danh sách ghép nối.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Chưa xác nhận chuyên môn thì không nhận ca
- **Given** một tài khoản nhân sự chưa hoàn tất bước xác nhận chuyên môn (UC139),
- **When** hệ thống chạy ghép nối,
- **Then** tài khoản đó không xuất hiện trong danh sách ứng viên của bất kỳ ca nào.

### AC-02: Trạng thái hồ sơ theo danh sách BR-21
- **Given** một hồ sơ nhân sự đang kích hoạt,
- **When** hồ sơ chuyển bước,
- **Then** trạng thái luôn thuộc danh sách trạng thái của BR-21 và mọi chuyển trạng thái đều ghi log.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP04-01` | Ghép nối với nhân sự chưa UC139 | Functional | Nhân sự bị loại khỏi danh sách ứng viên |
| `TC-USHP04-02` | Chuyển trạng thái hồ sơ | Functional | Trạng thái hợp lệ theo BR-21, có log đầy đủ |

---

# User Story US-HP-05 — Đăng nhập nhân sự có xác thực hai yếu tố bắt buộc

## 📌 Story Metadata

- **Story ID:** `US-HP-05`
- **Story Title:** Mandatory Two-Factor Sign-In for Staff
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Nhân sự bệnh viện (điều dưỡng, bác sĩ, quản trị, điều phối)
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** BR-20, BR-21 · Luồng 01

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Tài khoản nhân sự chạm tới dữ liệu bệnh nhân và tiền:** mất một mật khẩu nhân sự là lộ dữ liệu sức khỏe và mở đường thao tác tài chính — rủi ro cao hơn hẳn tài khoản bệnh nhân.
2. **Áp 2FA cho tất cả lại gây hại nhóm bệnh nhân cao tuổi:** baseline tách rõ — nhân sự bắt buộc yếu tố thứ hai, bệnh nhân thì không.

---

## 📖 User Story Statement

> Là **nhân sự bệnh viện**,  
> tôi muốn đăng nhập bằng email + mật khẩu kèm yếu tố thứ hai bắt buộc,  
> để tài khoản vận hành không bị chiếm dụng dễ dàng.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Thiếu yếu tố thứ hai thì không vào khu vực nhân sự
- **Given** một tài khoản nhân sự hợp lệ,
- **When** đăng nhập mới chỉ qua mật khẩu,
- **Then** hệ thống yêu cầu yếu tố thứ hai trước khi cấp phiên nhân sự.

### AC-02: Bệnh nhân không bị áp 2FA
- **Given** một tài khoản bệnh nhân,
- **When** đăng nhập,
- **Then** hệ thống không yêu cầu yếu tố thứ hai.

### AC-03: Nhân sự không có đường khôi phục tự phục vụ qua tổng đài
- **Given** một nhân sự mất quyền truy cập,
- **When** họ yêu cầu khôi phục,
- **Then** việc khôi phục đi qua quy trình quản trị của bệnh viện, không qua quy trình tổng đài dành cho bệnh nhân.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP05-01` | Đăng nhập nhân sự thiếu 2FA | Security | Bị chặn ở bước yếu tố thứ hai |
| `TC-USHP05-02` | Đăng nhập bệnh nhân | Functional | Không xuất hiện yêu cầu 2FA |
| `TC-USHP05-03` | Khôi phục tài khoản nhân sự | Security | Không tồn tại đường self-service qua tổng đài |

---

# EPIC B — HỒ SƠ BỆNH NHÂN & SÀNG LỌC TRIỆU CHỨNG

# User Story US-HP-06 — Tạo hồ sơ bệnh nhân

## 📌 Story Metadata

- **Story ID:** `US-HP-06`
- **Story Title:** Patient Profile Creation
- **Bounded Context:** `Patient Profile & Screening`
- **Primary Persona:** Bệnh nhân, Chủ tài khoản
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC6, UC11 · BR-17 · Luồng 02

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Nhập lại thông tin mỗi lần đặt là nguyên nhân bỏ cuộc:** nhóm người dùng cao tuổi cần hồ sơ tạo một lần, dùng lại cho mọi đơn.
2. **Thu thập quá mức tạo rủi ro:** hồ sơ chỉ nên chứa thông tin phục vụ chăm sóc tại nhà; CCCD đã bị loại khỏi mô hình (Q-51) nên hồ sơ không được lén thu lại qua đường khác.

---

## 📖 User Story Statement

> Là **bệnh nhân/chủ tài khoản**,  
> tôi muốn tạo hồ sơ người được chăm sóc (thông tin cơ bản, tiền sử liên quan, địa chỉ nhà),  
> để dùng lại cho mọi lần đặt lịch mà không phải nhập lại.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Tạo và dùng lại hồ sơ
- **Given** một tài khoản đã đăng nhập,
- **When** chủ tài khoản tạo hồ sơ,
- **Then** hồ sơ dùng được ngay cho luồng đặt lịch và hiển thị lại đầy đủ ở các lần đặt sau.

### AC-02: Không thu CCCD trong hồ sơ
- **Given** biểu mẫu hồ sơ,
- **When** rà soát các trường,
- **Then** không có trường CCCD hay ảnh giấy tờ tùy thân.

### AC-03: Một tài khoản quản lý nhiều hồ sơ thuộc quyền đại diện
- **Given** một chủ tài khoản là người đại diện hợp lệ theo BR-17,
- **When** họ tạo hồ sơ cho người thân,
- **Then** hệ thống cho phép và ghi rõ quan hệ đại diện đã cam kết.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP06-01` | Tạo hồ sơ và đặt lịch bằng hồ sơ đó | Functional | Đặt lịch thành công không cần nhập lại |
| `TC-USHP06-02` | Rà soát trường hồ sơ | UI/Compliance | Không có trường CCCD |
| `TC-USHP06-03` | Tạo hồ sơ người thân | Functional | Hồ sơ gắn cam kết đại diện theo BR-17 |

---

# User Story US-HP-07 — Khai triệu chứng và nhận phân loại 4 nhóm

## 📌 Story Metadata

- **Story ID:** `US-HP-07`
- **Story Title:** Symptom Entry & Four-Group Classification
- **Bounded Context:** `Patient Profile & Screening`
- **Primary Persona:** Bệnh nhân
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC21, UC22 · BR-15 · Luồng 04

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Không phải triệu chứng nào cũng phù hợp chăm sóc tại nhà:** tiếp nhận ca cấp cứu như ca thường là rủi ro tính mạng và trách nhiệm pháp lý cho bệnh viện.
2. **Phân loại thủ công không nhất quán:** cùng một bộ triệu chứng phải cho cùng một kết quả phân loại và truy vết được bộ quy tắc đã áp dụng.

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> khi đặt lịch tôi muốn khai triệu chứng hiện tại và nhận kết quả phân loại vào một trong 4 nhóm kèm hướng xử lý,  
> để biết ca của mình được tiếp nhận, cần bổ sung thông tin hay phải đi cấp cứu.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Phân loại theo bộ quy tắc hiện hành, có phiên bản
- **Given** một bộ triệu chứng đã khai,
- **When** hệ thống phân loại,
- **Then** kết quả thuộc đúng một trong 4 nhóm và bản ghi sàng lọc lưu phiên bản bộ quy tắc đã dùng.

### AC-02: Nhóm cấp cứu chặn luồng đặt thường
- **Given** kết quả phân loại thuộc nhóm cấp cứu,
- **When** kết quả hiển thị,
- **Then** hệ thống hiển thị hướng dẫn gọi 115/SOS và không tiếp tục luồng đặt lịch như ca thường.

### AC-03: Sàng lọc là sự kiện lặp lại được
- **Given** một đơn đã có kết quả sàng lọc khi đặt,
- **When** bệnh nhân bổ sung triệu chứng sau đó (theo US-HP-12),
- **Then** hệ thống tạo bản ghi sàng lọc mới gắn cùng đơn, không sửa đè bản ghi cũ.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP07-01` | Phân loại 4 nhóm | Functional | Mỗi bộ triệu chứng mẫu cho đúng nhóm kỳ vọng, có rule_version |
| `TC-USHP07-02` | Triệu chứng cấp cứu | Functional/Safety | Hiển thị hướng dẫn 115/SOS, chặn đặt thường |
| `TC-USHP07-03` | Sàng lọc lại | Functional | Tạo bản ghi mới, bản ghi cũ nguyên vẹn |

---

# EPIC C — ĐẶT LỊCH & GHÉP NỐI ĐIỀU DƯỠNG

# User Story US-HP-09 — Đặt lịch hẹn trước

## 📌 Story Metadata

- **Story ID:** `US-HP-09`
- **Story Title:** Advance Booking
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Bệnh nhân
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** Luồng 04 · BR-03, BR-04

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Đặt ngoài giờ dịch vụ là ca không thực hiện được:** bệnh viện chỉ phục vụ 17:00–21:30 (BR-03); cho đặt ngoài khung này là hứa một ca không ai làm.
2. **Giá không minh bạch trước xác nhận gây tranh chấp:** bệnh nhân phải thấy tổng giá và tiền cọc trước khi cam kết.

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> tôi muốn chọn dịch vụ, ngày và khung giờ trong giờ dịch vụ của bệnh viện để đặt lịch hẹn trước, và thấy tổng giá cùng tiền cọc trước khi xác nhận,  
> để quyết định đặt trên thông tin đầy đủ.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Chỉ hiển thị slot hợp lệ
- **Given** trang đặt lịch,
- **When** bệnh nhân chọn ngày,
- **Then** chỉ hiển thị slot trong khung 17:00–21:30 và còn trống; không có tùy chọn đặt tức thì trong pilot.

### AC-02: Hiển thị giá và cọc trước xác nhận
- **Given** một dịch vụ đã chọn,
- **When** bệnh nhân tới bước xác nhận,
- **Then** hệ thống hiển thị giá dịch vụ của bệnh viện và số tiền cọc 30% (tối thiểu 50.000đ) sẽ phải trả.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP09-01` | Danh sách slot | Functional | Chỉ có slot 17:00–21:30 còn trống |
| `TC-USHP09-02` | Hiển thị giá/cọc | Functional | Giá và cọc khớp cấu hình bệnh viện trước bước xác nhận |

---

# User Story US-HP-10 — Được ghép điều dưỡng phù hợp

## 📌 Story Metadata

- **Story ID:** `US-HP-10`
- **Story Title:** Automatic Nurse Matching
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Bệnh nhân
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** Luồng 04/05 · BR-01

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Bệnh nhân không đủ thông tin để tự chọn người:** chuyên môn, lịch trống và trạng thái kích hoạt của điều dưỡng chỉ hệ thống mới biết đầy đủ.
2. **Ghép trùng lịch hoặc ghép người chưa xác nhận chuyên môn phá vỡ toàn bộ cam kết dịch vụ.**

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> tôi muốn hệ thống tự ghép điều dưỡng đủ chuyên môn và còn lịch,  
> để không phải tự tìm người.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Điều kiện ứng viên
- **Given** một đơn chờ ghép,
- **When** hệ thống chạy ghép,
- **Then** ứng viên phải đã qua xác nhận chuyên môn (UC139), đúng chuyên môn dịch vụ và không trùng lịch ca khác.

### AC-02: Thông báo kết quả ghép
- **Given** quá trình ghép kết thúc (có người hoặc không có người trong cửa sổ quy định),
- **When** kết quả xác định,
- **Then** bệnh nhân nhận thông báo kết quả kèm bước tiếp theo tương ứng.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP10-01` | Ghép ca chuẩn | Functional | Ghép đúng điều dưỡng đủ điều kiện, không trùng lịch |
| `TC-USHP10-02` | Không có ứng viên | Functional | Bệnh nhân nhận thông báo không có người kèm hướng xử lý |

---

# User Story US-HP-11 — Vòng ghép mới khi điều dưỡng hủy trong lúc chờ cọc

## 📌 Story Metadata

- **Story ID:** `US-HP-11`
- **Story Title:** New Matching Round After Nurse Cancellation During Deposit Wait
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Bệnh nhân
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** BR-01 · Q-45 · Luồng 04/08

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Hủy đơn của bệnh nhân vì điều dưỡng đổi ý là bất công và mất khách:** lỗi thuộc phía cung cấp dịch vụ, hậu quả không được đẩy sang bệnh nhân.
2. **Không ghi nhận vi phạm thì hành vi hủy sát giờ lặp lại:** điều dưỡng hủy trong lúc chờ cọc phải bị ghi nhận như các vi phạm BR-01 khác, nếu không vòng ghép mới trở thành đường lách.

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> nếu điều dưỡng vừa được ghép hủy ca trong lúc tôi đang chờ đặt cọc, tôi muốn hệ thống tự mở vòng ghép mới trong 15 phút thay vì hủy đơn của tôi,  
> để không mất lịch vì lý do không do tôi.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Mở vòng ghép mới, giữ nguyên đơn
- **Given** một đơn đã ghép người và đang trong cửa sổ chờ cọc,
- **When** điều dưỡng được ghép hủy ca,
- **Then** hệ thống mở vòng ghép mới 15 phút cho cùng đơn; đơn không bị hủy.

### AC-02: Vi phạm vẫn được ghi nhận
- **Given** sự kiện hủy ở AC-01,
- **When** vòng ghép mới mở,
- **Then** hệ thống đồng thời ghi sự kiện vi phạm của điều dưỡng theo BR-01 (đếm vào cửa sổ 3 lần/30 ngày).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP11-01` | ĐD hủy trong chờ cọc | Functional | Đơn giữ nguyên, vòng ghép mới 15 phút được mở |
| `TC-USHP11-02` | Ghi vi phạm đồng thời | Functional | Sự kiện vi phạm BR-01 tồn tại cho điều dưỡng đã hủy |

---

# User Story US-HP-12 — Nhắc lịch và mời bổ sung triệu chứng trước buổi (không bắt buộc)

## 📌 Story Metadata

- **Story ID:** `US-HP-12`
- **Story Title:** Pre-Session Reminder & Optional Symptom Update
- **Bounded Context:** `Booking & Matching`, `Patient Profile & Screening`
- **Primary Persona:** Bệnh nhân
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC119, UC22 · Luồng 07A (bản 8.11)

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Triệu chứng thay đổi giữa lúc đặt và lúc khám:** bản 8.11 đã bỏ sàng lọc lại bắt buộc — ép bệnh nhân khai lại mọi ca tạo ma sát và dữ liệu rác; nhưng không có kênh cập nhật thì điều dưỡng đến nhà với thông tin cũ.
2. **"Không cập nhật" không phải là một trạng thái:** nếu hệ thống ghi cờ "chưa sàng lọc lại", dev sẽ biến sự im lặng của bệnh nhân thành dữ liệu — và sớm muộn thành điều kiện chặn ca sai.

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> tôi muốn nhận nhắc lịch trước buổi (T−2h) kèm lời mời bổ sung triệu chứng mới nếu có,  
> để điều dưỡng nắm tình hình mới nhất — và nếu tôi không bổ sung gì thì buổi chăm sóc vẫn diễn ra bình thường.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Nhắc lịch đúng thời điểm, đúng tính chất
- **Given** một đơn đã xác nhận có buổi chăm sóc sắp tới,
- **When** tới mốc T−2h,
- **Then** hệ thống gửi nhắc lịch (UC119) kèm lời mời bổ sung triệu chứng tới tối đa T−1h.

### AC-02: Không bổ sung → không hệ quả dữ liệu
- **Given** bệnh nhân không bổ sung triệu chứng,
- **When** buổi chăm sóc bắt đầu,
- **Then** ca diễn ra bình thường; hệ thống không ghi cờ/trạng thái "chưa sàng lọc lại", không phạt, không gọi điện nhắc.

### AC-03: Bổ sung thuộc nhóm cấp cứu → hủy buổi + hoàn 100%
- **Given** bệnh nhân bổ sung triệu chứng trước T−1h,
- **When** thông tin được phân loại theo quy tắc luồng 04 và thuộc nhóm cấp cứu,
- **Then** hệ thống hủy buổi, hiển thị hướng dẫn 115/SOS và khởi tạo hoàn 100% tiền cọc (UC90); chỉ đúng một lần hủy và một khoản hoàn cho đơn.

### AC-04: Bổ sung không cấp cứu → lưu và báo điều dưỡng
- **Given** thông tin bổ sung không thuộc nhóm cấp cứu,
- **When** phân loại hoàn tất,
- **Then** kết quả được lưu thành bản ghi sàng lọc mới của đơn và điều dưỡng được giao ca nhận thông báo.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP12-01` | Nhắc T−2h | Functional | Thông báo UC119 gửi đúng mốc, có lời mời cập nhật |
| `TC-USHP12-02` | Không cập nhật | Functional | Ca diễn ra, không tồn tại cờ "chưa sàng lọc lại" |
| `TC-USHP12-03` | Cập nhật cấp cứu hai lần liên tiếp | Functional/Safety | Đúng một lần hủy buổi và một khoản hoàn 100% |
| `TC-USHP12-04` | Cập nhật không cấp cứu | Functional | Bản ghi sàng lọc mới + thông báo tới điều dưỡng |

---

# User Story US-HP-13 — Hủy lịch phía bệnh nhân

## 📌 Story Metadata

- **Story ID:** `US-HP-13`
- **Story Title:** Patient-Initiated Cancellation with Transparent Refund Rule
- **Bounded Context:** `Booking & Matching`, `Payment & Deposit`
- **Primary Persona:** Bệnh nhân
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** BR-04, UC90 · Luồng 08

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Mức hoàn không rõ trước khi hủy là nguồn tranh chấp số một của dịch vụ đặt trước:** bệnh nhân phải biết mình được hoàn bao nhiêu *trước* khi bấm hủy.
2. **Hủy vì cấp cứu không được đối xử như hủy thường:** baseline đã tách tình huống cấp cứu (hoàn 100%) khỏi hủy chủ động theo bảng BR-04.

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> tôi muốn hủy lịch đã đặt và biết ngay mức hoàn cọc áp dụng cho thời điểm hủy của mình theo bảng quy định,  
> để quyết định có căn cứ.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Hiển thị mức hoàn trước khi xác nhận hủy
- **Given** một đơn đã đặt cọc,
- **When** bệnh nhân mở luồng hủy,
- **Then** hệ thống hiển thị mức hoàn theo bảng BR-04 tại thời điểm đó trước khi bệnh nhân xác nhận.

### AC-02: Hủy hoàn tất giải phóng slot và tạo căn cứ hoàn
- **Given** bệnh nhân xác nhận hủy,
- **When** hủy hoàn tất,
- **Then** slot được nhả cho lịch bệnh viện và khoản hoàn (nếu có) được ghi nhận để xử lý theo UC90.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP13-01` | Hiển thị mức hoàn theo mốc thời gian | Functional | Mức hoàn khớp bảng BR-04 tại từng mốc kiểm thử |
| `TC-USHP13-02` | Hủy hoàn tất | Functional | Slot nhả, bản ghi hoàn tồn tại đúng số tiền |

---

# EPIC D — ĐẶT CỌC, THANH TOÁN & HOÀN TIỀN

# User Story US-HP-14 — Đặt cọc 30% qua cổng thanh toán

## 📌 Story Metadata

- **Story ID:** `US-HP-14`
- **Story Title:** 30% Deposit via Hospital Payment Gateway
- **Bounded Context:** `Payment & Deposit`
- **Primary Persona:** Bệnh nhân
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** BR-04 · Luồng 08

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Không cọc thì hành vi đặt rồi bỏ từ phía bệnh nhân không có gì kiềm chế:** cọc 30% là cơ chế cam kết hai chiều của mô hình.
2. **Nền tảng giữ tiền là rủi ro pháp lý và niềm tin:** mô hình SaaS của dự án quy định tiền đi thẳng vào tài khoản bệnh viện qua cổng — nền tảng không bao giờ giữ tiền bệnh nhân.

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> tôi muốn đặt cọc 30% giá dịch vụ (tối thiểu 50.000đ) qua cổng thanh toán của bệnh viện trong cửa sổ 15 phút sau khi có điều dưỡng nhận ca,  
> để giữ lịch chắc chắn.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Số cọc và cửa sổ thanh toán
- **Given** một đơn đã có điều dưỡng nhận ca,
- **When** bệnh nhân vào bước đặt cọc,
- **Then** số tiền phải trả bằng 30% giá dịch vụ, tối thiểu 50.000đ, và cửa sổ thanh toán là 15 phút.

### AC-02: Tiền đi thẳng bệnh viện
- **Given** giao dịch cọc thành công,
- **When** đối chiếu luồng tiền,
- **Then** tiền vào tài khoản bệnh viện qua cổng thanh toán; không tồn tại số dư bệnh nhân trên nền tảng.

### AC-03: Quá hạn cọc hủy đơn, nhả slot
- **Given** cửa sổ 15 phút kết thúc mà cọc chưa thành công,
- **When** hệ thống xử lý quá hạn,
- **Then** đơn bị hủy theo BR-04, slot được nhả và bệnh nhân nhận thông báo.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP14-01` | Tính số cọc | Functional | Cọc = max(30% giá, 50.000đ) |
| `TC-USHP14-02` | Luồng tiền | Functional/Finance | Tiền về tài khoản BV; nền tảng không ghi số dư BN |
| `TC-USHP14-03` | Quá hạn 15 phút | Functional | Đơn hủy, slot nhả, có thông báo |

---

# User Story US-HP-15 — Theo dõi phần còn phải trả và trạng thái "Chờ thanh toán"

## 📌 Story Metadata

- **Story ID:** `US-HP-15`
- **Story Title:** Outstanding Balance & 24h "Chờ thanh toán" State
- **Bounded Context:** `Payment & Deposit`
- **Primary Persona:** Bệnh nhân
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** Luồng 08 · BR-04, BR-14

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Phần tiền sau buổi là vùng tranh chấp mờ nhất:** sau khi trừ cọc và cộng phát sinh đã xác nhận, bệnh nhân phải thấy đúng một con số và một thời hạn.
2. **Công nợ không được định nghĩa mơ hồ:** BR-14 đã chốt — công nợ là khoản "Chờ thanh toán" quá 24h; hệ thống phải áp đúng định nghĩa đó thay vì mỗi màn hình một cách hiểu.

---

## 📖 User Story Statement

> Là **bệnh nhân**,  
> tôi muốn thấy rõ phần tiền còn thiếu sau buổi chăm sóc và thời hạn trả (tối đa 24h ở trạng thái "Chờ thanh toán"),  
> để không bị bất ngờ về công nợ.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Số còn phải trả minh bạch theo dòng
- **Given** một buổi chăm sóc đã hoàn tất có báo cáo,
- **When** bệnh nhân mở chi tiết đơn,
- **Then** hệ thống hiển thị tổng giá, cọc đã trừ, từng dòng phát sinh đã xác nhận và số còn phải trả.

### AC-02: Quá 24h chuyển công nợ
- **Given** một khoản ở trạng thái "Chờ thanh toán" quá 24h,
- **When** mốc 24h qua,
- **Then** khoản chuyển thành công nợ theo BR-04/BR-14 và hệ quả đã quy định được áp dụng.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP15-01` | Đối chiếu số còn trả | Functional/Finance | Số còn trả = tổng đã xác nhận − cọc, khớp từng dòng |
| `TC-USHP15-02` | Chuyển công nợ sau 24h | Functional | Trạng thái và hệ quả khớp BR-14 |

---

# EPIC E — BUỔI CHĂM SÓC TẠI NHÀ

# User Story US-HP-18 — Điều dưỡng xem ca được giao và thông tin bệnh nhân trước buổi

## 📌 Story Metadata

- **Story ID:** `US-HP-18`
- **Story Title:** Nurse Pre-Session Briefing
- **Bounded Context:** `Care Session`
- **Primary Persona:** Điều dưỡng
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** Luồng 07B

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Đến nhà mà không biết tình trạng bệnh nhân là rủi ro chuyên môn:** điều dưỡng cần hồ sơ, kết quả sàng lọc mới nhất và địa chỉ trước khi xuất phát.
2. **Xem quá phạm vi lại là rủi ro dữ liệu:** điều dưỡng chỉ được xem thông tin của ca mình được giao (kiểm tra quyền phía backend theo BR-09).

---

## 📖 User Story Statement

> Là **điều dưỡng**,  
> tôi muốn xem danh sách ca của mình kèm hồ sơ bệnh nhân, kết quả sàng lọc và địa chỉ,  
> để chuẩn bị đúng người, đúng việc.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Đầy đủ thông tin chuẩn bị ca
- **Given** một ca đã giao cho điều dưỡng,
- **When** điều dưỡng mở chi tiết ca,
- **Then** hiển thị hồ sơ bệnh nhân, bản ghi sàng lọc mới nhất (kể cả bản bổ sung ở 07A), địa chỉ và khung giờ.

### AC-02: Chỉ xem được ca của mình
- **Given** một điều dưỡng A,
- **When** A cố mở chi tiết ca của điều dưỡng B,
- **Then** hệ thống từ chối truy cập phía backend và ghi log.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP18-01` | Xem chi tiết ca | Functional | Đủ hồ sơ, sàng lọc mới nhất, địa chỉ, giờ |
| `TC-USHP18-02` | Truy cập ca người khác | Security AuthZ | Bị từ chối, có log truy cập |

---

# User Story US-HP-19 — Check-in tại nhà bệnh nhân bằng mã trong ứng dụng

## 📌 Story Metadata

- **Story ID:** `US-HP-19`
- **Story Title:** In-App Code Check-In at Patient's Home
- **Bounded Context:** `Care Session`
- **Primary Persona:** Điều dưỡng
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC40 · Luồng 07B

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Thời điểm bắt đầu ca là căn cứ tính tiền và phân xử:** không có mốc check-in tin cậy, mọi tranh chấp "đến sớm/muộn/không đến" đều không có bằng chứng.
2. **Nhầm mã phiên với OTP tài khoản là lỗi thiết kế đã được baseline cảnh báo:** BR-20 tách rõ mã trong phiên chăm sóc khỏi OTP email của tài khoản — trộn hai loại mã phá vỡ cả hai cơ chế.

---

## 📖 User Story Statement

> Là **điều dưỡng**,  
> khi đến nhà tôi muốn check-in bằng mã hiển thị trong ứng dụng của buổi chăm sóc,  
> để hệ thống ghi nhận đúng thời điểm bắt đầu ca.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Check-in bằng mã của phiên
- **Given** buổi chăm sóc đã tới giờ và điều dưỡng có mặt tại nhà bệnh nhân,
- **When** điều dưỡng nhập mã check-in hiển thị trong ứng dụng của phiên,
- **Then** hệ thống ghi thời điểm bắt đầu ca và chuyển buổi sang đang chăm sóc.

### AC-02: Mã phiên không dùng thay OTP tài khoản
- **Given** mã check-in của phiên,
- **When** mã được dùng ở bất kỳ luồng xác thực tài khoản nào,
- **Then** hệ thống từ chối — hai loại mã không thay thế được cho nhau.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP19-01` | Check-in đúng mã | Functional | Ca bắt đầu, timestamp ghi đúng |
| `TC-USHP19-02` | Dùng mã phiên làm OTP tài khoản | Security | Bị từ chối ở luồng xác thực |

---

# User Story US-HP-20 — Đánh giá bệnh nhân đầu buổi theo biểu mẫu loại dịch vụ

## 📌 Story Metadata

- **Story ID:** `US-HP-20`
- **Story Title:** Mandatory Initial Assessment by Service-Type Form
- **Bounded Context:** `Care Session`
- **Primary Persona:** Điều dưỡng
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC41 · BR-22 · Q-49

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Tình trạng lúc đặt lịch có thể đã khác khi điều dưỡng tới:** bản 8.11 bỏ sàng lọc lại bắt buộc phía bệnh nhân, nên đánh giá đầu buổi của điều dưỡng là điểm kiểm tra chuyên môn duy nhất còn lại — nó phải diễn ra trong mọi ca.
2. **Đánh giá tự do không so sánh được:** biểu mẫu phải theo loại dịch vụ và có phiên bản, để bệnh viện kiểm chứng chất lượng và xử lý tranh chấp.

---

## 📖 User Story Statement

> Là **điều dưỡng**,  
> tôi muốn thực hiện đánh giá đầu buổi theo biểu mẫu của loại dịch vụ trong mọi ca,  
> để tình trạng thực tế của bệnh nhân luôn được ghi nhận trước khi chăm sóc, kể cả khi bệnh nhân không bổ sung triệu chứng nào trước buổi.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Đánh giá là bước bắt buộc không điều kiện
- **Given** một buổi chăm sóc vừa check-in,
- **When** điều dưỡng bắt đầu ca (UC41),
- **Then** hệ thống yêu cầu hoàn thành đánh giá đầu buổi theo biểu mẫu loại dịch vụ — không phụ thuộc bệnh nhân có bổ sung triệu chứng ở 07A hay không.

### AC-02: Biểu mẫu có phiên bản theo bệnh viện
- **Given** biểu mẫu đánh giá của một loại dịch vụ,
- **When** điều dưỡng nộp đánh giá,
- **Then** bản ghi lưu kèm phiên bản biểu mẫu đã dùng.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP20-01` | Ca không có bổ sung triệu chứng | Functional | Đánh giá đầu buổi vẫn bắt buộc |
| `TC-USHP20-02` | Nộp đánh giá | Functional | Bản ghi có form_version đúng của bệnh viện |

---

# User Story US-HP-22 — Lập báo cáo chăm sóc bắt buộc sau buổi

## 📌 Story Metadata

- **Story ID:** `US-HP-22`
- **Story Title:** Mandatory Post-Session Care Report
- **Bounded Context:** `Care Session`
- **Primary Persona:** Điều dưỡng
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** BR-22 · Luồng 07B

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Ca không có báo cáo là ca không có hồ sơ chuyên môn:** bệnh viện không thể kiểm chứng chất lượng, và mọi tranh chấp sau ca đều thiếu căn cứ.
2. **Báo cáo tách rời khỏi tiền là kẽ hở:** nếu ca vẫn đóng và tính tiền khi chưa có báo cáo, yêu cầu "bắt buộc" chỉ còn trên giấy.

---

## 📖 User Story Statement

> Là **điều dưỡng**,  
> sau buổi chăm sóc tôi phải hoàn thành báo cáo chăm sóc (đánh giá đầu buổi, việc đã làm, phát sinh, tình trạng cuối buổi) thì ca mới được coi là hoàn tất,  
> để bệnh viện có hồ sơ chuyên môn đầy đủ cho mọi ca.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Chưa báo cáo thì ca chưa đóng
- **Given** một buổi chăm sóc đã kết thúc phần việc,
- **When** báo cáo chăm sóc chưa được nộp,
- **Then** ca không chuyển sang hoàn tất và chưa phát sinh bước thanh toán phần còn lại.

### AC-02: Báo cáo đầy đủ các phần bắt buộc
- **Given** điều dưỡng nộp báo cáo,
- **When** hệ thống kiểm tra,
- **Then** báo cáo phải có đủ đánh giá đầu buổi (US-HP-20), công việc đã thực hiện, phát sinh (nếu có, theo US-HP-23) và tình trạng cuối buổi.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP22-01` | Đóng ca thiếu báo cáo | Functional | Bị chặn, ca giữ trạng thái chưa hoàn tất |
| `TC-USHP22-02` | Nộp báo cáo đầy đủ | Functional | Ca hoàn tất, bước thanh toán được mở |

---

# User Story US-HP-23 — Phát sinh dịch vụ/vật tư trong buổi qua dòng "Chờ xác nhận"

## 📌 Story Metadata

- **Story ID:** `US-HP-23`
- **Story Title:** In-Session Add-On Lines with Patient Confirmation
- **Bounded Context:** `Care Session`, `Payment & Deposit`
- **Primary Persona:** Điều dưỡng (ghi nhận), Bệnh nhân (xác nhận)
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** BR-04, BR-18 · Luồng 07B/08

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Phát sinh là thực tế không tránh khỏi của chăm sóc tại nhà:** vật tư và dịch vụ ngoài đơn gốc xuất hiện trong ca; cấm ghi nhận thì điều dưỡng tự chịu chi phí, cho tính tiền luôn thì bệnh nhân bị thu không căn cứ.
2. **Dòng "Chờ xác nhận" đã từng bị tính tiền trong bản UI cũ:** nguyên tắc bất biến là dòng chưa xác nhận không bao giờ nằm trong số tiền phải trả.

---

## 📖 User Story Statement

> Là **điều dưỡng**,  
> khi phát sinh dịch vụ hoặc vật tư ngoài đơn gốc, tôi muốn ghi thành dòng riêng ở trạng thái "Chờ xác nhận" để bệnh nhân xác nhận sau,  
> để chi phí phát sinh minh bạch và chỉ tính tiền khi được đồng ý.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Dòng phát sinh mặc định "Chờ xác nhận"
- **Given** một buổi đang diễn ra,
- **When** điều dưỡng ghi một phát sinh,
- **Then** dòng được tạo ở trạng thái chờ xác nhận, tách riêng khỏi đơn gốc.

### AC-02: Chưa xác nhận thì không tính tiền
- **Given** một dòng đang chờ xác nhận,
- **When** hệ thống tính số tiền bệnh nhân phải trả,
- **Then** dòng đó không nằm trong tổng phải trả.

### AC-03: Dòng bị khiếu nại đi đúng nhánh BR-18
- **Given** bệnh nhân khiếu nại một dòng phát sinh,
- **When** khiếu nại được ghi nhận,
- **Then** dòng xử lý theo F1a/F1b của BR-18 (US-HP-28), không tự ý đổi trạng thái tính tiền.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP23-01` | Tạo dòng phát sinh | Functional | Dòng ở trạng thái chờ xác nhận |
| `TC-USHP23-02` | Tính tiền có dòng chờ | Functional/Finance | Tổng phải trả loại trừ dòng chờ |
| `TC-USHP23-03` | Khiếu nại dòng | Functional | Dòng chuyển sang xử lý F1a/F1b |

---

# User Story US-HP-24 — Dừng buổi vì lý do an toàn

## 📌 Story Metadata

- **Story ID:** `US-HP-24`
- **Story Title:** Unsafe-Environment Session Stop Declaration
- **Bounded Context:** `Care Session`, `Hospital Operations`
- **Primary Persona:** Điều dưỡng
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC128 · BR-16 · Q-46 · Luồng 15/12

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Điều dưỡng làm việc một mình tại nhà người lạ:** không có đường dừng ca an toàn và được bảo vệ, họ sẽ hoặc chịu đựng rủi ro, hoặc bỏ ca không căn cứ.
2. **Quyền dừng ca cũng là đường lách việc nếu không hậu kiểm:** baseline Q-46 quy định khai báo sai sự thật bị ghi nhận vi phạm sau hậu kiểm.

---

## 📖 User Story Statement

> Là **điều dưỡng**,  
> nếu môi trường tại nhà không an toàn, tôi muốn dừng buổi và khai báo lý do ngay trong ứng dụng,  
> để được bảo vệ và ca được xử lý theo quy trình.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Dừng ca và khai báo lý do tại chỗ
- **Given** một buổi đang diễn ra và phát sinh tình huống không an toàn,
- **When** điều dưỡng khai báo dừng buổi (UC128) kèm lý do,
- **Then** buổi dừng, sự kiện và lý do được ghi lại, bệnh viện nhận thông báo để xử lý phía bệnh nhân.

### AC-02: Hậu kiểm khai báo sai
- **Given** một khai báo dừng vì không an toàn,
- **When** hậu kiểm kết luận khai báo sai sự thật,
- **Then** hệ thống ghi nhận vi phạm cho điều dưỡng theo quy trình BR-16 (Q-46) và luồng xử lý vi phạm.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP24-01` | Dừng ca kèm lý do | Functional | Buổi dừng, sự kiện + lý do được ghi, BV được báo |
| `TC-USHP24-02` | Hậu kiểm kết luận khai báo sai | Functional | Vi phạm được ghi nhận cho điều dưỡng |

---

# User Story US-HP-25 — Thu phí đến nhà tối thiểu khi dịch vụ gốc không thực hiện được do bệnh nhân

## 📌 Story Metadata

- **Story ID:** `US-HP-25`
- **Story Title:** Minimum Home-Visit Fee When Service Cannot Be Performed Due to Patient
- **Bounded Context:** `Care Session`, `Payment & Deposit`
- **Primary Persona:** Bệnh viện (Quản trị bệnh viện/Kế toán)
- **Target Release:** Pilot Q-23 (Release 1)
- **Phụ thuộc quyết định:** **Q-03 chưa chốt giá trị và dạng phí** — cơ chế code được, giá trị lấy từ cấu hình bệnh viện khi PO + kế toán BV chốt.
- **Truy vết:** Q-03, Q-31 · Luồng 07B/07C

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Điều dưỡng đã đến nhà nhưng không làm được dịch vụ vì phía bệnh nhân:** tính toàn bộ giá dịch vụ thì bất công, không thu gì thì chi phí đi lại và cơ hội ca bị bỏ trống không ai chịu.
2. **Ranh giới thu/không thu đã có sẵn trong baseline:** do bệnh nhân/tình trạng bệnh nhân → thu; do điều dưỡng/bệnh viện → không thu; cấp cứu → không thu (Q-31). Chỉ còn thiếu con số.

---

## 📖 User Story Statement

> Là **bệnh viện**,  
> khi điều dưỡng đã đến nhà nhưng dịch vụ gốc không thực hiện được vì nguyên nhân từ phía bệnh nhân/tình trạng bệnh nhân, tôi muốn thu một khoản phí đến nhà tối thiểu theo cấu hình của bệnh viện thay vì tính toàn bộ dịch vụ,  
> để chi phí chuyến đi được bù đắp mà bệnh nhân không bị thu tiền dịch vụ chưa nhận.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Chỉ thu khi nguyên nhân thuộc phía bệnh nhân
- **Given** một ca kết thúc với lý do dịch vụ gốc không thực hiện được do bệnh nhân/tình trạng bệnh nhân,
- **When** hệ thống chốt tiền ca,
- **Then** khoản phí đến nhà tối thiểu theo cấu hình bệnh viện được áp dụng thay cho giá dịch vụ gốc.

### AC-02: Không thu trong hai trường hợp còn lại
- **Given** lý do không thực hiện được thuộc phía điều dưỡng/bệnh viện, hoặc thuộc tình huống cấp cứu,
- **When** hệ thống chốt tiền ca,
- **Then** không phát sinh phí đến nhà tối thiểu (trường hợp cấp cứu: bệnh viện chịu chi phí đi lại theo Q-31).

### AC-03: Phí khấu vào cọc, phần thiếu đi đường "Chờ thanh toán"
- **Given** khoản phí đến nhà tối thiểu nhỏ hơn hoặc bằng tiền cọc đã thu,
- **When** chốt tiền,
- **Then** phí được khấu vào cọc; nếu lớn hơn cọc, phần thiếu trở thành khoản "Chờ thanh toán" 24h theo BR-04 *(cơ chế khấu trừ là đề xuất trong gói Q-03, chờ chốt cùng giá trị)*.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP25-01` | Ca không làm được do bệnh nhân | Functional/Finance | Áp phí cấu hình, không tính giá dịch vụ gốc |
| `TC-USHP25-02` | Ca không làm được do BV/cấp cứu | Functional/Finance | Không phát sinh phí đến nhà |
| `TC-USHP25-03` | Khấu cọc và phần thiếu | Functional/Finance | Khấu đúng cọc; phần thiếu ở trạng thái chờ thanh toán 24h |

---

# EPIC F — SOS & AN TOÀN

# User Story US-HP-26 — Bệnh nhân/người nhà phát tín hiệu SOS

## 📌 Story Metadata

- **Story ID:** `US-HP-26`
- **Story Title:** Patient/Relative SOS Signal
- **Bounded Context:** `Safety & SOS`
- **Primary Persona:** Bệnh nhân, Người nhà có mặt trong buổi chăm sóc
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC140 · BR-23 · Q-48 · Luồng 17

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Trong tình huống khẩn cấp tại nhà, người dùng không thao tác được luồng phức tạp:** SOS phải là một chạm, ghi nhận ngay và tới đúng người trực.
2. **Kỳ vọng sai về 115 là rủi ro:** baseline BR-23 chốt hệ thống *không* tự gọi 115 trong MVP — giao diện và quy trình phải nói rõ điều này, đồng thời hướng dẫn gọi 115, tránh người dùng ngồi chờ một cuộc gọi không bao giờ đến.

---

## 📖 User Story Statement

> Là **bệnh nhân hoặc người nhà có mặt trong buổi chăm sóc**,  
> tôi muốn bấm SOS để sự cố được ghi nhận ngay và chuyển tới đầu mối trực của bệnh viện, kèm hướng dẫn gọi 115,  
> để được hỗ trợ kịp thời mà không hiểu lầm rằng hệ thống đã gọi cấp cứu thay mình.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Tạo sự cố SOS với mốc thời gian gốc
- **Given** một buổi chăm sóc đang diễn ra,
- **When** bệnh nhân/người nhà bấm SOS,
- **Then** hệ thống tạo sự cố SOS ghi `triggered_at` và chuyển ngay tới đầu mối trực đã cấu hình của bệnh viện.

### AC-02: Leo thang sau 5 phút không xác nhận
- **Given** một sự cố SOS chưa có đầu mối xác nhận tiếp nhận,
- **When** mốc 5 phút từ `triggered_at` qua,
- **Then** hệ thống tự leo thang sang đầu mối dự phòng theo cấu hình bệnh viện và ghi sự kiện leo thang append-only.

### AC-03: Không tự gọi 115
- **Given** bất kỳ sự cố SOS nào,
- **When** sự cố được xử lý,
- **Then** hệ thống không thực hiện cuộc gọi 115 tự động; giao diện hiển thị hướng dẫn gọi 115 cho người dùng.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP26-01` | Bấm SOS trong ca | Functional | Sự cố tạo với triggered_at, đầu mối trực nhận được |
| `TC-USHP26-02` | Không ai xác nhận sau 5 phút | Functional | Leo thang sang dự phòng, có sos_escalation_event |
| `TC-USHP26-03` | Kiểm tra hành vi 115 | Compliance | Không có cuộc gọi tự động; có hướng dẫn gọi 115 |

---

# User Story US-HP-27 — Đầu mối trực bệnh viện tiếp nhận và đóng sự cố SOS

## 📌 Story Metadata

- **Story ID:** `US-HP-27`
- **Story Title:** On-Duty Hospital Contact Acknowledges & Closes SOS Incident
- **Bounded Context:** `Safety & SOS`, `Hospital Operations`
- **Primary Persona:** Bác sĩ trực, Quản trị bệnh viện trực
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC140 (phía tiếp nhận) · BR-23, Q-48 · Luồng 17

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **SOS không có người chịu trách nhiệm tiếp nhận thì chỉ là nút bấm:** cam kết vận hành Q-48 yêu cầu 2 đầu mối trực đồng thời trong khung giờ dịch vụ và xác nhận tiếp nhận trong 5 phút.
2. **Sự cố đóng không ghi cách xử lý là sự cố chưa đóng:** resolution bắt buộc là điều kiện để bệnh viện rà soát chất lượng ứng phó sau này.

---

## 📖 User Story Statement

> Là **bác sĩ trực/Quản trị bệnh viện trực**,  
> tôi muốn nhận SOS ngay khi phát sinh, xác nhận tiếp nhận trong 5 phút và đóng sự cố bắt buộc kèm cách xử lý,  
> để không ca SOS nào bị bỏ quên.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Xác nhận tiếp nhận trong 5 phút
- **Given** một sự cố SOS vừa phát sinh trong khung giờ trực đã cam kết,
- **When** đầu mối trực xử lý,
- **Then** xác nhận tiếp nhận được ghi trong vòng 5 phút từ `triggered_at`; quá mốc này hệ thống đã leo thang theo US-HP-26.

### AC-02: Đóng sự cố bắt buộc có resolution
- **Given** một sự cố SOS đã xử lý xong,
- **When** đầu mối trực đóng sự cố,
- **Then** hệ thống yêu cầu ghi cách xử lý (resolution) mới cho đóng; sự cố chưa có resolution không ở trạng thái đã đóng.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP27-01` | Xác nhận tiếp nhận | Functional | Ack ghi trong 5 phút, leo thang không kích hoạt |
| `TC-USHP27-02` | Đóng thiếu resolution | Functional | Bị chặn, sự cố giữ trạng thái mở |

---

# EPIC G — QUẢN TRỊ BỆNH VIỆN & ĐIỀU PHỐI

# User Story US-HP-28 — Xử lý khiếu nại dòng phí theo hai nhánh F1a/F1b

## 📌 Story Metadata

- **Story ID:** `US-HP-28`
- **Story Title:** Fee-Line Complaint Handling — F1a/F1b Branches
- **Bounded Context:** `Hospital Operations`, `Payment & Deposit`
- **Primary Persona:** Quản trị bệnh viện
- **Target Release:** Pilot Q-23 (Release 1)
- **Phụ thuộc quyết định:** Mặc định sau quyết của Platform Admin đối với nhánh F1b đang ghi trong use_case_v8.1 là *"đề xuất – cần PO xác nhận"* — story áp dụng đúng văn bản v8.1 cho tới khi PO chốt khác.
- **Truy vết:** BR-18 F1a/F1b · Q-44 · Luồng 08/12

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Dòng đã thu tiền và dòng chưa thu là hai bản chất khác nhau:** bản v8 từng gộp chung khiến dòng đã thanh toán cũng bị tự miễn khi quá hạn — mâu thuẫn tiền cuối cùng giữa hai file, đã được v8.1 tách F1a/F1b để đóng.
2. **Khiếu nại treo vô hạn làm mất niềm tin cả hai phía:** mỗi nhánh cần một điểm kết — tự miễn có điều kiện, hoàn thủ công có người chịu trách nhiệm, leo thang có thời hạn quyết.

---

## 📖 User Story Statement

> Là **Quản trị bệnh viện**,  
> khi bệnh nhân khiếu nại một dòng phí, tôi muốn hệ thống phân đúng nhánh: dòng chưa thanh toán quá hạn 5 ngày thì tự miễn; dòng đã thanh toán khiếu nại trong 24h thì xử lý hoàn thủ công; quá hạn khiếu nại thì leo thang Platform Admin quyết trong 3 ngày làm việc,  
> để không dòng đã thu tiền nào bị tự ý miễn và không khiếu nại nào treo vô hạn.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Nhánh F1a — dòng chưa thanh toán
- **Given** một dòng phí chưa thanh toán bị khiếu nại,
- **When** khiếu nại quá hạn xử lý 5 ngày,
- **Then** hệ thống tự miễn dòng đó và ghi quyết định kèm quy tắc F1a.

### AC-02: Nhánh F1b — dòng đã thanh toán, khiếu nại trong 24h
- **Given** một dòng phí đã thanh toán và bị khiếu nại trong 24h,
- **When** Quản trị bệnh viện xử lý,
- **Then** khoản hoàn (nếu chấp nhận) thực hiện thủ công qua UC90 với lệnh hoàn và chứng từ; dòng không bị tự miễn.

### AC-03: Nhánh F1b quá hạn — leo thang Platform Admin
- **Given** một khiếu nại F1b quá hạn xử lý tại bệnh viện,
- **When** mốc quá hạn tới,
- **Then** hồ sơ leo thang Platform Admin để quyết trong 3 ngày làm việc (US-HP-34); dòng tuyệt đối không tự miễn trong thời gian chờ quyết.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP28-01` | F1a quá hạn 5 ngày | Functional/Finance | Dòng tự miễn, có bản ghi quyết định F1a |
| `TC-USHP28-02` | F1b khiếu nại trong 24h | Functional/Finance | Hoàn qua lệnh UC90 thủ công, không tự miễn |
| `TC-USHP28-03` | F1b quá hạn tại BV | Functional | Hồ sơ leo thang Platform Admin; dòng giữ nguyên trạng thái thu |

---

# User Story US-HP-29 — Ghi nhận và phân xử vi phạm; khóa/mở khóa tài khoản nhân sự

## 📌 Story Metadata

- **Story ID:** `US-HP-29`
- **Story Title:** Violation Recording, Adjudication & Staff Lock/Unlock
- **Bounded Context:** `Hospital Operations`
- **Primary Persona:** Quản trị bệnh viện
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** BR-01, BR-02 · Q-43 · BR-18 F6 · Luồng 12

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Vi phạm tính theo cửa sổ trượt chứ không phải tổng tích lũy:** BR-01 đếm 3 lần/30 ngày — lưu vi phạm dạng tổng số sẽ xử oan người có vi phạm cũ đã hết cửa sổ và bỏ sót cụm vi phạm mới.
2. **Khóa tài khoản bom ca là biện pháp kỹ thuật, không phải phán quyết:** nếu tài khoản bị khóa vô hạn chỉ vì Quản trị bệnh viện chưa kịp xác nhận lý do, nền tảng vô tình vượt quyền kỷ luật vốn thuộc bệnh viện.

---

## 📖 User Story Statement

> Là **Quản trị bệnh viện**,  
> tôi muốn hệ thống ghi nhận sự kiện vi phạm theo cửa sổ trượt và áp biện pháp kỹ thuật tương ứng — riêng bom ca, tài khoản tự mở khóa sau 24h nếu tôi chưa xác nhận lý do, còn phân xử vi phạm vẫn tiếp tục tới mốc 72h —  
> để biện pháp kỹ thuật không bao giờ thay thế phán quyết kỷ luật của bệnh viện.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Vi phạm lưu dạng sự kiện có mốc thời gian
- **Given** một hành vi vi phạm thuộc BR-01/BR-02/BR-18,
- **When** hệ thống ghi nhận,
- **Then** vi phạm được lưu thành sự kiện có timestamp riêng; bộ đếm cửa sổ (ví dụ 3 lần/30 ngày của BR-01) tính từ các sự kiện trong cửa sổ, không dùng tổng tích lũy.

### AC-02: Bom ca — tự mở khóa sau 24h nếu chưa xác nhận lý do
- **Given** một tài khoản điều dưỡng bị tạm khóa vì bom ca,
- **When** 24h trôi qua mà Quản trị bệnh viện chưa xác nhận lý do,
- **Then** hệ thống tự mở khóa, ghi log cả hai sự kiện khóa và mở khóa; quá trình phân xử vi phạm vẫn tiếp tục tới mốc 72h theo BR-18 F6.

### AC-03: Nền tảng không ra quyết định kỷ luật/tiền thay bệnh viện
- **Given** bất kỳ sự kiện vi phạm nào,
- **When** hệ thống xử lý,
- **Then** hệ thống chỉ áp biện pháp kỹ thuật đã cấu hình và ghi log; quyết định kỷ luật và tài chính thuộc bệnh viện.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP29-01` | Đếm vi phạm theo cửa sổ 30 ngày | Functional | Vi phạm ngoài cửa sổ không tính vào bộ đếm hiện tại |
| `TC-USHP29-02` | Bom ca không xác nhận lý do sau 24h | Functional | Tài khoản tự mở khóa, đủ log khóa + mở khóa, phân xử vẫn mở tới 72h |
| `TC-USHP29-03` | Bom ca có xác nhận lý do trước 24h | Functional | Không tự mở khóa; xử lý theo quyết định của BV |

---

# EPIC H — PLATFORM ADMIN (PHÍA SAAS)

# User Story US-HP-34 — Quyết định leo thang khiếu nại F1b

## 📌 Story Metadata

- **Story ID:** `US-HP-34`
- **Story Title:** Platform Admin Decision on Escalated F1b Complaints
- **Bounded Context:** `Platform Administration`, `Payment & Deposit`
- **Primary Persona:** Platform Admin
- **Target Release:** Pilot Q-23 (Release 1)
- **Phụ thuộc quyết định:** Mặc định áp dụng khi Platform Admin không quyết trong hạn — đang là *"đề xuất – cần PO xác nhận"* trong use_case_v8.1 (giữ nguyên dòng đã thu); story ghi nhận điểm mở này, không tự chốt.
- **Truy vết:** BR-18 F1b · Q-44

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Tranh chấp tiền không thể treo vô hạn ở tầng bệnh viện:** khi bệnh viện quá hạn xử lý khiếu nại dòng đã thanh toán, cần một tầng quyết cuối có thời hạn.
2. **Quyết định tầng nền tảng chạm tiền của bệnh viện:** vì vậy quyết phải ghi lý do, quy tắc áp dụng và người quyết để bệnh viện đối chiếu — và mặc định khi không quyết kịp vẫn đang chờ PO xác nhận, không ai được tự bịa.

---

## 📖 User Story Statement

> Là **Platform Admin**,  
> khi một khiếu nại dòng đã thanh toán quá hạn xử lý ở bệnh viện, tôi muốn nhận hồ sơ leo thang và ra quyết định trong 3 ngày làm việc,  
> để tranh chấp tiền không treo vô hạn.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Nhận hồ sơ leo thang đầy đủ ngữ cảnh
- **Given** một khiếu nại F1b quá hạn tại bệnh viện (US-HP-28),
- **When** hồ sơ leo thang tới Platform Admin,
- **Then** hồ sơ gồm dòng phí, lịch sử khiếu nại, mốc thời gian và toàn bộ quyết định trước đó của bệnh viện.

### AC-02: Quyết trong 3 ngày làm việc, có ghi căn cứ
- **Given** hồ sơ leo thang hợp lệ,
- **When** Platform Admin ra quyết định,
- **Then** quyết định ban hành trong 3 ngày làm việc, ghi người quyết, lý do và quy tắc áp dụng vào nhật ký quyết định tài chính.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP34-01` | Nhận leo thang | Functional | Hồ sơ đủ dòng phí, lịch sử, mốc thời gian |
| `TC-USHP34-02` | Ra quyết định | Functional/Finance | Quyết trong hạn 3 ngày làm việc, có căn cứ trong nhật ký |

---

# EPIC I — THÔNG BÁO & TRA CỨU

# User Story US-HP-36 — Nhận thông báo theo sự kiện qua email và trong ứng dụng

## 📌 Story Metadata

- **Story ID:** `US-HP-36`
- **Story Title:** Event-Driven Notifications via Email & In-App
- **Bounded Context:** `Notification`
- **Primary Persona:** Mọi vai trò (bệnh nhân, người thân, điều dưỡng, quản trị)
- **Target Release:** Pilot Q-23 (Release 1)
- **Truy vết:** UC119 và các điểm thông báo trong luồng 04–15, 17 · BR-20

---

## 💡 Bối cảnh & Vấn đề thực tế (The Problem)

1. **Luồng dịch vụ chạy bằng sự kiện bất đồng bộ:** ghép nối, đổi ca, yêu cầu trả phần còn thiếu, SOS — nếu người liên quan không được báo kịp, quy trình chết ở bước chờ con người.
2. **Kênh thông báo bị giới hạn bởi email-only:** không có SMS (BR-20), nên email + thông báo trong ứng dụng phải là hai kênh chính thức và nhất quán.

---

## 📖 User Story Statement

> Là **người dùng (mọi vai trò)**,  
> tôi muốn nhận thông báo khi có sự kiện liên quan tới mình (ghép được điều dưỡng, nhắc lịch, thay đổi ca, yêu cầu trả phần còn thiếu, SOS) qua email và/hoặc thông báo trong ứng dụng,  
> để không bỏ lỡ việc cần xử lý.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Sự kiện nghiệp vụ sinh thông báo đúng người
- **Given** một sự kiện thuộc danh mục phải thông báo (ghép nối thành công/thất bại, nhắc lịch UC119, thay đổi ca, yêu cầu thanh toán phần còn lại, SOS),
- **When** sự kiện xảy ra,
- **Then** hệ thống gửi thông báo tới đúng (các) vai trò liên quan qua email và/hoặc in-app theo cấu hình sự kiện.

### AC-02: Không dùng SMS
- **Given** bất kỳ sự kiện thông báo nào,
- **When** hệ thống gửi,
- **Then** không có thông báo nào được gửi qua SMS.

### AC-03: SOS không chờ kênh email
- **Given** một sự cố SOS,
- **When** thông báo tới đầu mối trực,
- **Then** thông báo dùng kênh tức thời trong hệ thống tới đầu mối trực (không chỉ dựa vào email), vì mốc xác nhận tiếp nhận là 5 phút.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Mục tiêu kiểm thử | Loại kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| `TC-USHP36-01` | Thông báo ghép nối | Functional | Đúng vai trò nhận email/in-app khi có kết quả ghép |
| `TC-USHP36-02` | Rà soát kênh gửi | Compliance | Không tồn tại thông báo SMS |
| `TC-USHP36-03` | Thông báo SOS | Functional | Đầu mối trực nhận kênh tức thời, không chỉ email |

---

## Ghi chú cuối file

- File này viết dạng đầy đủ cho **27 story Must**. 10 story Should (US-HP-08, 16, 17, 21, 30, 31, 32, 33, 35, 37) vẫn ở dạng tóm tắt trong file đề xuất gốc; khi cần, chúng được viết tiếp theo đúng cấu trúc này mà không đổi mã story.
- Tên bounded context, cách chia AC và ma trận TC trong file này là **đề xuất tổ chức của Atlas** phục vụ dev ước lượng và kiểm thử — không phải cấu trúc module đã chốt của dự án.
- Khi nội dung story lệch với UC/BR của baseline, **UC/BR thắng** và story phải sửa theo; các điểm đang chờ chốt (Q-03 ở US-HP-25, mặc định F1b ở US-HP-28/US-HP-34) giữ nguyên trạng thái mở cho tới khi PO/pháp chế/bệnh viện quyết.
