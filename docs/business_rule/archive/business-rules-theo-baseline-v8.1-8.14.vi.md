# Đặc tả Quy tắc Nghiệp vụ (Business Rules)
## Nền tảng Điều dưỡng Bệnh viện Chăm sóc Tại nhà

| | |
|---|---|
| Nguồn chuẩn | `use_case_v8.1.drawio` (trang 12, 14) + `luong_hoat_dong_v8.14.drawio` — baseline đồng bộ chốt 16/10/2026 |
| Phạm vi | Toàn bộ 23 quy tắc BR-01–BR-23, bảng quyết định tài chính BR-18 (F1a–F9), và các quy tắc có trong luồng nhưng chưa được cấp mã BR |
| Trạng thái | Tài liệu tổng hợp phục vụ phát triển. Nội dung chép trung thực từ hai file nguồn; câu chữ được chuẩn hóa, không thêm bớt nghiệp vụ. Khi tài liệu này và file nguồn lệch nhau, **file nguồn thắng** |

**Quy ước đọc:**

- Mỗi quy tắc ghi: nội dung → UC liên quan → luồng liên quan → quyết định (Q-xx) còn ảnh hưởng.
- Cụm "đề xuất" trong nội dung nghĩa là giá trị trong sơ đồ đang là giá trị đề xuất chờ chốt — dev không được tự coi là đã duyệt.
- Mọi con số nghiệp vụ (phí, %, thời hạn, ngưỡng) là **tham số cấu hình theo bệnh viện, có ngày hiệu lực** — không hard-code (nguyên tắc gốc ở đầu trang 12 của use_case_v8.1).

---

## Nguyên tắc áp dụng chung

1. **Nền tảng không giữ tiền.** Bệnh viện đăng ký cổng thanh toán và đứng tên nhận tiền; tiền vào thẳng tài khoản bệnh viện (BR-05).
2. **Tiền bị quyết khi quá hạn chỉ tra bảng BR-18.** Mọi trường hợp một khoản tiền bị quyết tự động vì người có trách nhiệm quá hạn đều tra bảng F1a–F9; các luồng 06, 08, 09, 11, 12, 15 chỉ tham chiếu mã Fx, không tự định nghĩa lại (BR-18).
3. **Mọi quyết định tự động phải truy vết được:** lưu kèm mã Fx, mốc thời gian và lý do (BR-18). Tiền ghi theo **bút toán mới**, không sửa số tại chỗ (ghi chú trang 14).
4. **Cấu hình có ngày hiệu lực:** mọi giá trị nghiệp vụ do bệnh viện/Admin cấu hình theo ngày hiệu lực; thay đổi không làm mất lịch sử giá trị cũ.
5. **Nền tảng chỉ khóa kỹ thuật và tính số liệu** đối với điều dưỡng; trừ tiền và kỷ luật lao động do bệnh viện quyết định (BR-02). Không quy tắc nào trong bộ này phạt tiền điều dưỡng qua nền tảng (BR-01, BR-02).

---

## Nhóm A — Định danh, tài khoản, dữ liệu cá nhân

### BR-20 — Định danh & liên lạc chỉ bằng email
- Đăng ký, đăng nhập **chỉ bằng email + mật khẩu**. Mọi mã của tài khoản (đăng ký, quên mật khẩu, xác thực lại khi xóa dữ liệu / rút đồng ý) gửi qua email; hiệu lực **5 phút** (đặt lại mật khẩu: 15 phút). Không dùng SMS (Q-51 đã chốt).
- Xác thực 2 lớp **bắt buộc** cho Điều dưỡng, Bác sĩ, Quản trị BV, Admin: mã qua email hoặc ứng dụng xác thực (UC83). Bệnh nhân không bắt buộc lớp thứ hai.
- **Không thu CCCD** của bệnh nhân hay nhân sự lên nền tảng; không xác minh tuổi, quan hệ. Hồ sơ người nhà do chủ tài khoản tự khai và chịu trách nhiệm. Giấy tờ tùy thân của nhân sự do bệnh viện đối chiếu và lưu giữ.
- Mã xác nhận **trong ca** (check-in, xác nhận bảng kê, dịch vụ phát sinh, dừng ca) là mã hiển thị trên app của bệnh nhân — khác hẳn mã tài khoản, không gửi qua email.
- Bệnh nhân – Điều dưỡng liên lạc qua chat/gọi trong app (UC133); nền tảng không yêu cầu số điện thoại.
- *UC liên quan:* UC1, UC14, UC40, UC61, UC82, UC83, UC106, UC133. *Luồng:* 02, 03.

### BR-21 — Xác minh hồ sơ nhân sự 2 bước
- Vòng đời hồ sơ: **Bản nháp → Chờ BV xác nhận → Chờ nền tảng duyệt → Đã duyệt**; nhánh phụ: *Yêu cầu bổ sung* (hạn 7 ngày, quá hạn → *Hết hạn*), *Bị từ chối* (được cập nhật thành phiên bản mới). Sau khi hoạt động: *Tạm khóa / Hết hạn CCHN / Ngừng hoạt động* (Q-50).
- **Bước 1:** Bệnh viện xác nhận chuyên môn và chịu trách nhiệm về tính xác thực (UC139). **Bước 2:** Admin nền tảng chỉ kiểm tra tính đầy đủ, trạng thái và điều kiện vận hành (UC7, UC12); nền tảng **không tuyên bố đã chứng thực** giấy phép hành nghề.
- Quyền nhận ca/trực chỉ mở khi đồng thời: Đã duyệt + đã kích hoạt + có xác thực 2 lớp + CCHN còn hạn + không bị tạm khóa.
- Quét hạn CCHN hằng ngày: nhắc trước 30 ngày; hết hạn → tự ngừng quyền nhận ca.
- Mọi thay đổi ghi nhật ký kiểm toán: người thao tác, vai trò, thời gian, nội dung, phiên bản hồ sơ, quyết định, lý do. AI không duyệt hồ sơ, không kết luận điều dưỡng đủ điều kiện.
- *UC liên quan:* UC5–UC8, UC10–UC12, UC69, UC81, UC139. *Luồng:* 01.

### BR-09 — Phân quyền dữ liệu (kiểm tra ở backend)
- Quyền = vai trò × bệnh viện; Quản trị BV phân tiếp theo vai trò con (trang 13 của use_case).
- Áp dụng quyền tối thiểu, **kiểm tra ở backend và tầng truy vấn** — không chỉ ẩn nút, không tin ID do frontend gửi. Bốn yếu tố kiểm tra: **vai trò + quan hệ với bệnh nhân + ca/hồ sơ cụ thể + trạng thái nghiệp vụ**.
- Bệnh nhân xem hồ sơ của mình và hồ sơ người nhà do mình tạo. Điều dưỡng chỉ xem hồ sơ cần cho ca được phân công, trong thời gian ca. Quản trị BV chỉ xem dữ liệu bệnh viện mình. Admin nền tảng chỉ xem dữ liệu vận hành, **không mặc định xem nội dung sức khỏe**.
- Bác sĩ chỉ xem lịch sử chăm sóc tại bệnh viện mình, từ khi được phân công đến khi kết thúc kế hoạch tái khám hoặc bệnh nhân thu hồi quyền. Xem lịch sử ở bệnh viện khác — **kể cả khi bệnh nhân đồng ý — chưa hỗ trợ** (Q-20 đã quyết).
- Mọi truy cập hồ sơ bệnh nhân ghi audit log (ai, lúc nào, hồ sơ nào, hành động); không ghi mật khẩu, token, nội dung sức khỏe thừa vào log.
- *UC liên quan:* UC16, UC17, UC58, UC59, UC102. *Áp dụng:* mọi luồng.

### BR-17 — Vòng đời đồng ý xử lý dữ liệu (consent)
- Mỗi hồ sơ người được chăm sóc có consent riêng. Người thân là người lớn, tự quyết định được → **tự đồng ý qua link gửi tới email của họ**. Trẻ em / người không tự quyết định được → chủ tài khoản khai quan hệ, ngày sinh, cam kết là người đại diện hợp pháp và đồng ý thay. Nền tảng không thu CCCD nên không xác minh tuổi hay quan hệ (BR-20).
- **Rút đồng ý (UC106)** bất cứ lúc nào, xác nhận bằng OTP email (người thân dùng link email): khóa đặt lịch mới cho hồ sơ; ngừng xử lý dữ liệu không bắt buộc. Đơn chưa hoàn thành: điều dưỡng chưa bấm "Xuất phát" → hủy, hoàn 100% cọc (luồng 09); đã xuất phát / đang trong ca → hoàn tất hoặc dừng giữa chừng (luồng 15) (UC129). Dữ liệu cần để tất toán đơn đang chạy vẫn được xử lý; dữ liệu đã có → chuyển sang yêu cầu xóa (luồng 14).
- **Điều khoản mới:** thay đổi trọng yếu → hỏi lại khi đăng nhập / đặt lịch (UC138, luồng 03); chưa đồng ý → chỉ xem thông tin; đơn đã đặt vẫn chạy theo phiên bản đã đồng ý. Thay đổi không trọng yếu → chỉ thông báo, coi như tiếp tục đồng ý (Q-47).
- **Không** tự chuyển hồ sơ khi người được chăm sóc tròn 18 tuổi (đã bỏ UC130, UC132): người đó tự đăng ký tài khoản riêng; chủ tài khoản cũ gỡ liên kết hoặc yêu cầu xóa hồ sơ (luồng 14). Q-15 không làm trong MVP.
- *UC liên quan:* UC2, UC4, UC106, UC129, UC138. *Luồng:* 02, 03, 14.

### BR-12 — Xóa dữ liệu
- Xử lý trong **72 giờ** kể từ khi hết ràng buộc; còn 24h → cảnh báo Admin; quá hạn → cảnh báo lần 2 và ghi vào báo cáo SLA tháng gửi PO.
- Dữ liệu phải lưu theo luật (hồ sơ chăm sóc, chứng từ thanh toán): **khóa truy cập / ẩn danh, không xóa**; báo rõ cho bệnh nhân phần nào được giữ và lý do. Danh mục lưu mặc định và thời hạn: chờ pháp chế (Q-14).
- Có đơn đang thực hiện, khiếu nại mở, công nợ, hoàn tiền chờ, hoặc tái khám → hoãn xóa đến khi kết thúc.
- Ai được yêu cầu xóa dữ liệu của ai: chủ tài khoản → dữ liệu của mình và hồ sơ người nhà do mình tạo (theo cam kết đại diện khi tạo hồ sơ); người thân đã tự đồng ý qua email → chính người đó yêu cầu qua link gửi tới email của họ, không cần tài khoản (Q-34); khi đó chủ tài khoản chỉ được gỡ liên kết hồ sơ đó khỏi tài khoản mình. Yêu cầu xóa phải xác thực lại bằng OTP email.
- *UC liên quan:* UC61–UC65, UC104–UC106. *Luồng:* 14.

---

## Nhóm B — Đặt lịch & điều phối

### BR-03 — Khung giờ phục vụ
- Ngày thường **17:00–21:30**; thứ 7, Chủ nhật, lễ **07:00–21:30**. Admin đặt khung chung, bệnh viện chỉnh trong khung. Giá trị đang chờ kiểm chứng nhu cầu (Q-22).
- Trạng thái "Đang rảnh" chỉ bật được trong khung giờ; tự tắt lúc 21:30.
- "Đặt ngay" chỉ khả dụng trong khung; ngoài khung chỉ cho "hẹn giờ".
- Giờ bắt đầu muộn nhất = 21:30 − thời lượng dịch vụ (ví dụ dịch vụ 90 phút → muộn nhất 20:00).
- *UC liên quan:* UC9, UC19, UC24, UC109. *Luồng:* 04, 05.

### BR-06 — Vùng phục vụ
- Địa chỉ chăm sóc phải nằm trong vùng phục vụ của cơ sở được chọn: bán kính / thời gian di chuyển do cơ sở cấu hình (mặc định **15 km hoặc 45 phút**).
- Không xét quê quán; không dùng ranh giới tỉnh (tỉnh sau sáp nhập 2025 có phạm vi rất rộng).
- Ví dụ chuẩn: quê Quảng Trị, đang ở Đà Nẵng → đặt được cơ sở Đà Nẵng. Khám ở Đà Nẵng rồi về Quảng Trị → không đặt được điều dưỡng Đà Nẵng.
- *UC liên quan:* UC27, UC108. *Luồng:* 04, 05.

### BR-14 — Điều kiện đặt lịch
- Tài khoản có **"Công nợ"** — tức đơn ở trạng thái "Chờ thanh toán" quá 24 giờ (định nghĩa ở BR-04) → **chặn đặt lịch mới cho mọi hồ sơ của tài khoản** đến khi trả qua cổng.
- Một hồ sơ người được chăm sóc tối đa **3 lịch chưa hoàn thành** (đề xuất, cấu hình theo bệnh viện).
- Không cho hai lịch của cùng hồ sơ chồng thời gian (tính từ giờ hẹn đến giờ hẹn + thời lượng dịch vụ + 30 phút đệm).
- Áp dụng tại bước kiểm tra đầu vào của luồng 04, 05 và khi đổi lịch (luồng 09).
- Ngoại lệ: đơn con làm phần còn lại sau dừng ca (BR-16) không tính vào giới hạn 3 lịch, được chồng thời gian với đơn gốc và không cần cọc.
- *UC liên quan:* UC18, UC19, UC120. *Luồng:* 04, 05, 09.

### BR-13 — Chọn điều dưỡng, thay người & đổi lịch (đặt trước)
- Đặt trước **sớm nhất 2 giờ, xa nhất 14 ngày**. Điều dưỡng khai báo lịch trống cho đủ 14 ngày tới (UC114); dưới 2 giờ → dùng ghép nhanh (BR-08).
- Bệnh nhân chỉ thấy điều dưỡng có lịch trống ở khung đã chọn; hồ sơ điều dưỡng chỉ hiện thông tin nghề nghiệp. Liên lạc qua chat/gọi trong app (UC133); nền tảng không yêu cầu số điện thoại (BR-20).
- Điều dưỡng trả lời yêu cầu chỉ định trong **30 phút** (slot được giữ); quá hạn = từ chối (không tính vi phạm), báo bệnh nhân chọn người khác.
- Điều dưỡng đồng ý → bệnh nhân đặt cọc trong 15 phút (BR-04); quá hạn → hủy, giải phóng lịch.
- Giới hạn ca: tối đa **4 ca/điều dưỡng/ngày** cuối tuần & lễ; ngày thường tối đa **2 ca** vì khung 17:00–21:30 chỉ 4,5 giờ (đề xuất, Q-22); tính cả thời gian di chuyển. Danh sách gợi ý xen kẽ điều dưỡng mới để tránh dồn đơn.
- Nhắc & xác nhận: T−24h nhắc lịch; T−3h yêu cầu điều dưỡng xác nhận lại (hạn T−2h); T−2h nhắc bệnh nhân cập nhật triệu chứng nếu có — **không bắt buộc** (nếu nhập thêm mà khẩn cấp → chặn ca, hoàn 100% cọc; không nhập → ca vẫn diễn ra). Điều dưỡng chưa xác nhận lại → tìm người thay (luồng 06).
- Thay người khi điều dưỡng báo không đi được: còn > 1h → tìm theo lịch trống (> 3h) hoặc "Đang rảnh" (≤ 3h); ≤ 1h hoặc đặt ngay → ghép nhanh. Người thay phải cùng kỹ năng, trong vùng, đúng yêu cầu giới tính.
- Bệnh nhân chọn: đồng ý / chọn người khác / đổi giờ / hủy hoàn 100% cọc; hạn trả lời **15 phút** (còn > 3h: 30 phút); không trả lời → mặc định đồng ý (đang xem lại, Q-19).
- T−1h chưa có người thay → chuyển ghép nhanh; ghép nhanh không có ai trong 15 phút → hủy, hoàn 100% cọc.
- **Đổi lịch:** chỉ đơn đặt trước đã cọc (chưa cọc → hủy và đặt lại, Q-39), còn > 2h trước giờ hẹn, tối đa **2 lần/đơn**, giữ nguyên cọc. Điều dưỡng hiện tại không trống → chọn lại điều dưỡng (luồng 04); lịch và điều dưỡng cũ được giữ tới khi điều dưỡng mới xác nhận. Còn ≤ 2h → chỉ được hủy theo BR-04. Ngoại lệ: bệnh nhân chọn "đổi giờ" khi được thay người (luồng 06, UC117) → miễn điều kiện > 2h và không tính vào giới hạn 2 lần.
- *UC liên quan:* UC37, UC45, UC78, UC88, UC112–UC120, UC133. *Luồng:* 04, 06, 09.

### BR-08 — Ghép nhanh (đặt ngay)
- **Lọc cứng:** đang rảnh, cùng cơ sở, có kỹ năng cho dịch vụ, trong vùng phục vụ, kịp di chuyển, đúng ưu tiên của bệnh nhân (điều dưỡng quen, giới tính). Dịch vụ cần y lệnh chỉ đặt ngay khi đã có chỉ định được kiểm tra còn hiệu lực (BR-15).
- **Xếp hạng:** điểm ưu tiên, khoảng cách, đánh giá. AI chỉ hỗ trợ xếp hạng, không thay quy tắc lọc.
- Tự gán lần lượt người xếp hạng cao nhất (mỗi lượt 5 phút chờ "Đã nhận đơn"); **tổng thời gian ghép ≤ 15 phút**; hết → báo bệnh nhân (UC87), không tự chuyển sang cơ sở khác.
- *UC liên quan:* UC24, UC25, UC30–UC33, UC37, UC85, UC87. *Luồng:* 05.
- *Lưu ý phạm vi:* đặt ngay không thuộc pilot Q-23 (chỉ đặt trước) — quy tắc này áp dụng khi mở tính năng.

### BR-01 — Xác nhận đơn tự gán (lỗi nhẹ)
- Đặt ngay **không có nút từ chối**: điều dưỡng đang bật "Đang rảnh" nghĩa là sẵn sàng; hệ thống tự gán.
- Điều dưỡng có **5 phút** bấm "Đã nhận đơn"; quá hạn → gỡ gán, tự tắt "Đang rảnh", hệ thống gán người tiếp theo.
- Điều dưỡng **hủy nhận trong 5 phút** sau "Đã nhận đơn" (trước khi bệnh nhân cọc) → ghi ngay **1 vi phạm** (Q-41). Khi hủy nhận trong thời gian chờ cọc: bộ hẹn giờ cọc của lượt ghép đó bị hủy và hệ thống mở **lượt ghép mới 15 phút** cho đơn (Q-45); vi phạm vẫn ghi ngay.
- Không xác nhận: lần đầu không ghi vi phạm; lặp lại **3 lần trong 30 ngày** (cửa sổ cuộn) → ghi 1 vi phạm, đưa bộ đếm không xác nhận về 0; giảm **20% điểm ưu tiên** ghép đơn (tính trên điểm gốc, hồi phục khi ra khỏi cửa sổ 30 ngày).
- Ngưỡng leo thang: **2 vi phạm/30 ngày** → khóa nhận đơn đặt ngay 24 giờ; **≥ 3 vi phạm/30 ngày** → khóa, gửi hồ sơ cho Quản trị BV (ngưỡng đề xuất, Q-29).
- Đặt trước: từ chối / không trả lời yêu cầu chỉ định (UC115) **không** tính vi phạm, chỉ theo dõi tỷ lệ phản hồi để xếp hạng.
- Không phạt tiền. Mô hình tự gán cần bệnh viện xác nhận phù hợp quan hệ lao động (Q-05).
- *UC liên quan:* UC31–UC33, UC115. *Luồng:* 05, 06.

---

## Nhóm C — Thực hiện ca chăm sóc

### BR-07 — Xuất phát, check-in & bom ca
- **Giờ phải xuất phát:** đặt trước = giờ hẹn − thời gian di chuyển ước tính (tính lúc T−1h); đặt ngay = lúc cọc xong + 10 phút; sau thay người = lúc gán + 10 phút. ETA = giờ phải xuất phát + thời gian di chuyển.
- **Check-in hợp lệ:** trong geofence + mã hiển thị trên app của bệnh nhân. Lỗi → check-in dự phòng (ảnh + bệnh nhân xác nhận trên app, Quản trị BV hậu kiểm 24h).
- **Trễ:** quá ETA + 15 phút mà điều dưỡng chưa đến → bệnh nhân chọn: chờ (tối đa 2 lần × 15 phút) / đổi người / hủy hoàn 100%.
- **Bom ca:** quá giờ phải xuất phát 10 phút chưa di chuyển, hoặc tắt định vị > 10 phút → **tạm khóa nhận ca**, chuyển luồng 06 (vi phạm xét tại 06; tự mở khóa sau 24h — BR-02, Q-43).
- Điều dưỡng đến nơi, bệnh nhân vắng mặt và không liên lạc được sau 15 phút → báo vắng mặt (UC89), **không** tính vi phạm cho điều dưỡng.
- *UC liên quan:* UC38, UC40, UC77, UC89. *Luồng:* 06, 07A, 07B.
- *Ghi chú kỹ thuật:* quy tắc này là căn cứ yêu cầu định vị nền + geofence trên app điều dưỡng (đã chốt hướng React Native cho app ĐD trong stack).

### BR-15 — Dịch vụ cần y lệnh / chỉ định & dịch vụ phát sinh
- Mỗi dịch vụ trong bảng giá có cờ "được phép làm tại nhà" và "cần y lệnh"; danh mục do bệnh viện cấu hình theo danh mục pháp chế phê duyệt (Q-13).
- Dịch vụ gốc cần y lệnh (tiêm, truyền dịch, thay băng vết thương phức tạp…) → bệnh nhân tải chỉ định còn hiệu lực khi đặt (UC136); bác sĩ trực kiểm tra trong **30 phút** (UC137); không hợp lệ / quá hạn → không cho đặt, gợi ý khám tại bệnh viện.
- Đặt ngay chỉ dùng cho dịch vụ không cần y lệnh, hoặc khi hồ sơ đã có chỉ định được kiểm tra còn hiệu lực.
- **Dịch vụ phát sinh trong ca** (luồng 07C) phân 3 lớp theo danh mục đã phê duyệt — không từ chối mặc định, không cho phép tuyệt đối:
  - **Lớp A — được phép** (trong phạm vi hành nghề điều dưỡng, thuộc kế hoạch chăm sóc): điều dưỡng kiểm tra điều kiện / chống chỉ định theo checklist.
  - **Lớp B — cần đánh giá / y lệnh / phê duyệt:** người có thẩm quyền duyệt trong **10 phút** (UC137); không làm trước khi được duyệt.
  - **Lớp C — dấu hiệu nguy hiểm:** dừng mọi bước duyệt, chuyển SOS (BR-23).
  - Có phí → bệnh nhân xác nhận **trước** khi làm; kết quả ghi vào báo cáo ca. AI không tự quyết một thuốc/thủ thuật là được phép.
- Điều dưỡng được từ chối thực hiện tại chỗ nếu chỉ định không khớp tình trạng bệnh nhân (→ luồng 15, lý do "do tình trạng BN").
- *UC liên quan:* UC18, UC91, UC136, UC137, UC140. *Luồng:* 04, 07C.

### BR-22 — Báo cáo chăm sóc bắt buộc
- **Bắt đầu ca:** điều dưỡng đánh giá và ghi trạng thái ban đầu theo biểu mẫu của loại dịch vụ — kể cả khi bệnh nhân không cập nhật triệu chứng trước ca. **Trong ca:** ghi hoạt động, thời điểm, sự kiện; dịch vụ phát sinh liên kết vào báo cáo.
- Hai mốc phân biệt: **"Đã kết thúc"** (điều dưỡng bấm kết thúc → thanh toán chạy ngay) và **"Hoàn tất"** (chỉ khi đủ trường bắt buộc theo loại dịch vụ). Thiếu → trạng thái "Chờ hoàn thiện báo cáo", hiển thị trường còn thiếu. **Không có ngoại lệ** hoàn tất khi thiếu trường.
- Quá **2 giờ** chưa đủ → nhắc điều dưỡng và Quản trị BV; quá **24 giờ** → tạm khóa nhận ca đến khi nộp đủ.
- Biểu mẫu và trường bắt buộc cấu hình theo loại dịch vụ, do chuyên môn bệnh viện phê duyệt (Q-49) — không bắt một bộ trường chung cho mọi dịch vụ. Sửa báo cáo theo quyền, lưu người sửa, thời gian, lý do. Bàn giao (thay người, dừng ca) ghi người giao, người nhận, nội dung.
- *UC liên quan:* UC41–UC44, UC127. *Luồng:* 07B, 15.

### BR-16 — Dừng ca giữa chừng
- Áp dụng khi điều dưỡng **đã bắt đầu chăm sóc (UC41) và đã làm ít nhất một hạng mục** của dịch vụ gốc. Chưa làm hạng mục nào (kể cả đã bấm Bắt đầu) → xử lý như "dịch vụ gốc không làm được" (luồng 07B/08) — bấm Bắt đầu rồi dừng ngay không rẻ hơn phí đến nhà (Q-40).
- Người quyết dừng: điều dưỡng (cấp cứu, không an toàn, bệnh nhân không hợp tác, điều dưỡng không thể tiếp tục) hoặc bệnh nhân/người nhà yêu cầu (xác nhận trên app hoặc bằng mã trong app).
- Cấp cứu: SOS (UC92) + hướng dẫn gọi 115; điều dưỡng ở lại hỗ trợ đến khi bàn giao 115 / người nhà. Không an toàn cho điều dưỡng: rời nhà bệnh nhân ngay, bấm SOS, Quản trị BV liên hệ.
- **Tính phí** (đề xuất, Q-08): hạng mục đã hoàn thành → tính đủ. Hạng mục dở dang: do bệnh nhân yêu cầu / không hợp tác → tính **50%** hạng mục đó; do tình trạng bệnh nhân không phù hợp (không cấp cứu) → không tính phần dở dang; do cấp cứu y khoa → không tính phần dở dang, **không thu phí đến nhà** (khớp BR-04); do điều dưỡng / bệnh viện → không tính phần dở dang, bệnh nhân được đề nghị điều dưỡng khác hoàn thành; không an toàn cho điều dưỡng → không tính phần dở dang, không thu phí đến nhà.
- Điều dưỡng nộp báo cáo chăm sóc bắt buộc: thời điểm dừng, lý do, tình trạng bệnh nhân lúc rời, bàn giao (115 / người nhà / điều dưỡng làm tiếp).
- Thanh toán (luồng 08) chạy **ngay khi dừng ca** theo mức tạm tính từ lý do điều dưỡng chọn, để còn thu được tại chỗ; riêng dừng vì **không an toàn / cấp cứu → không thu tại chỗ**, bệnh nhân xác nhận trong 24h và trả qua cổng.
- Quản trị BV xác nhận trong **24h** (UC128), chỉ được **giữ hoặc giảm** mức tạm tính; giảm → hoàn phần chênh thủ công (UC90); quá hạn → giữ mức tạm tính (BR-18 F9, Q-35).
- **Hậu kiểm lý do "không an toàn":** khai đúng → không xét vi phạm điều dưỡng, xem xét chặn bệnh nhân qua luồng 12; **khai sai sự thật → ghi vi phạm cho điều dưỡng** (Q-46), xử lý tiếp qua luồng 12.
- Lý do do điều dưỡng → Quản trị BV xác nhận lý do và xét vi phạm **một lần** ở luồng 06 (UC88), không xác nhận lại ở UC128; luồng 06 chạy song song, không chặn thanh toán. Bệnh nhân muốn → ghép nhanh điều dưỡng khác làm phần còn lại.
- Phần còn lại do điều dưỡng khác làm là **đơn con** liên kết đơn gốc, không cọc (cọc đơn gốc đã tất toán ở luồng 08), bệnh nhân trả sau ca; hủy đơn con không phát sinh hoàn cọc (Q-36).
- *UC liên quan:* UC41, UC43, UC92, UC127, UC128. *Luồng:* 15, 06, 08.

---

## Nhóm D — Thanh toán, hoàn tiền & đối soát

### BR-04 — Đặt cọc, thanh toán & hoàn cọc
- **Cọc:** đặt trước — điều dưỡng đồng ý → bệnh nhân đặt cọc **30% giá dịch vụ (tối thiểu 50.000đ)** qua cổng trong **15 phút**; đặt ngay — tính 15 phút từ lúc điều dưỡng bấm "Đã nhận đơn". Quá hạn → hủy đơn, nhả slot. **Cọc chỉ thu online.** Thời điểm lập hóa đơn cho tiền cọc: chờ kế toán bệnh viện xác nhận (Q-11).
- **Dịch vụ phát sinh trong ca:** bệnh nhân đồng ý trên app, cộng vào hóa đơn cuối ca (trần phát sinh: Q-09).
- **Xác nhận bảng kê sau ca:** bệnh nhân xác nhận tại chỗ trong **15 phút** (không phản hồi → coi như xác nhận để thanh toán); vẫn được khiếu nại dòng trong **24h** — Quản trị BV xử lý như khiếu nại bảng kê (BR-18 **F1a** – dòng chưa trả; **F1b** – dòng đã trả, quá hạn không tự miễn mà chuyển Admin, Q-44); kết luận giảm/miễn → Quản trị BV hoàn tiền thủ công (UC90) và xuất hóa đơn điều chỉnh (Q-33). **Khiếu nại dòng không thay cho xác nhận rõ:** thu tiền mặt phần còn lại chỉ khi bệnh nhân xác nhận rõ các dòng không tranh chấp. Dừng ca vì không an toàn / cấp cứu: không áp mốc 15 phút — bệnh nhân xác nhận trong 24h và trả qua cổng.
- **Phần còn lại** = dịch vụ + phát sinh − cọc; bệnh nhân trả qua cổng hoặc tiền mặt cho điều dưỡng (điều dưỡng nhập số tiền, bệnh nhân xác nhận; lệch số → Quản trị BV chốt).
- Bệnh nhân chưa trả phần còn lại → trạng thái **"Chờ thanh toán"** (trả qua cổng trong 24h); quá hạn → **"Công nợ"**, chặn đặt lịch mới (điểm thực thi: BR-14, luồng 04/05).
- **Có dòng bị khiếu nại:** cọc được phân bổ trước cho các dòng bị khiếu nại (tối đa bằng giá trị các dòng đó) và giữ đến khi chốt; phần cọc còn lại trừ vào các dòng không tranh chấp (Q-30).
- Đã thu đủ → bệnh viện xuất **hóa đơn điện tử** tổng giá trị ca (đã khấu trừ cọc).
- **Đối soát cọc cuối kỳ** (luồng 11) gồm **4 nhóm: đã khấu trừ / đã hoàn / giữ lại khi không hoàn / đang giữ cho tranh chấp**. Tổng 4 nhóm phải bằng tổng cọc đã thu trong kỳ; chênh lệch → mở đối soát (BR-18 F7).
- **Bảng hoàn cọc khi bệnh nhân hủy — đặt trước:** trước giờ hẹn > 12h → **100%**; 2–12h → **50%**; < 2h hoặc điều dưỡng đã xuất phát → **0%** (bù công điều dưỡng). **Đặt ngay:** điều dưỡng chưa bấm "Xuất phát" → 100%; đã bấm → 0% (Q-38).
- "Đã xuất phát" = điều dưỡng đã bấm nút "Xuất phát" trên hệ thống (bật chia sẻ vị trí, UC38). Đã quá giờ phải xuất phát (BR-07) mà điều dưỡng chưa bấm → đơn đang lỗi phía điều dưỡng: bệnh nhân hủy được hoàn 100% (đặt trước).
- Bệnh nhân vắng nhà (UC89) → **không hoàn cọc**.
- Dịch vụ không làm được vì tình trạng bệnh nhân: phát hiện **trước** khi điều dưỡng bấm "Xuất phát" → hoàn 100% cọc; **sau** khi đã xuất phát: tình trạng không phù hợp (không cấp cứu) → thu phí đến nhà tối thiểu (giá trị: Q-03); cấp cứu y khoa (gọi 115) → không thu phí đến nhà, chỉ tính phần đã làm, bệnh viện chịu chi phí đi lại (Q-31).
- Hủy khi đơn đang **lỗi phía điều dưỡng / bệnh viện** (đang thay người, quá giờ phải xuất phát mà điều dưỡng chưa bấm "Xuất phát", điều dưỡng trễ quá mốc, bom ca, ghép nhanh chưa có điều dưỡng) hoặc triệu chứng bệnh nhân nhập thêm trước ca được phân loại khẩn cấp → **luôn hoàn 100%**.
- Hoàn cọc đúng bảng trên: hệ thống **tự tạo lệnh**, không cần duyệt tay; ngoại lệ (UC36) và quá hạn: tra BR-18.
- *UC liên quan:* UC34, UC36, UC45, UC90, UC91, UC121–UC123, UC126. *Luồng:* 07B, 08, 09.

### BR-05 — Phí nền tảng & tiền mặt
- Bệnh viện đăng ký với cổng thanh toán và đứng tên nhận tiền; tiền vào thẳng tài khoản bệnh viện, **nền tảng không giữ tiền**.
- Phí nền tảng: **% trên mỗi đơn hoàn thành** (kể cả đơn tiền mặt), tính trên tổng ca gồm phát sinh; có thể kèm phí cố định hằng tháng (theo hợp đồng).
- Giao dịch qua cổng: kết quả do cổng gửi về (webhook). Đơn tiền mặt: đối chiếu theo xác nhận thu của điều dưỡng & bệnh nhân và xác nhận nộp quỹ.
- Điều dưỡng **nộp tiền mặt về thủ quỹ bệnh viện trong 48 giờ**; quá hạn → cảnh báo, tạm khóa nhận đơn tiền mặt của điều dưỡng đó.
- Cuối tháng đối chiếu với đơn hoàn thành, xuất hóa đơn phí cho bệnh viện; lệch số liệu → mở đối soát (bệnh viện giải trình 7 ngày, BR-18 F7). Dự phòng: sao kê (UC111).
- *UC liên quan:* UC46–UC48, UC95, UC110, UC111, UC124, UC125. *Luồng:* 10, 11.
- *Lưu ý phạm vi:* tiền mặt không thuộc pilot Q-23 — phần tiền mặt của quy tắc này áp dụng khi mở tính năng.

### BR-18 — Quyết định tài chính khi quá hạn (bảng F)
Nguyên tắc: mọi trường hợp tiền bị quyết tự động do người có trách nhiệm quá hạn đều tra bảng dưới đây — ai quyết, mốc nhắc, mốc quá hạn, mặc định, ai chịu tiền. Mặc định chung: bệnh nhân bình thường → quyết định có lợi cho bệnh nhân, bệnh viện chịu chi phí, điều dưỡng vẫn nhận thu nhập/bù công. Bệnh nhân có cờ lạm dụng (BR-19) → Admin quyết trong 3 ngày làm việc; Admin quá hạn → giữ quyết định có lợi cho bệnh viện / điều dưỡng.

| Mã | Trường hợp | Ai quyết | Mốc nhắc / quá hạn | Mặc định khi quá hạn – BN thường | BN có cờ lạm dụng | Ai chịu tiền | Luồng |
|---|---|---|---|---|---|---|---|
| F1a | Khiếu nại dòng bảng kê **chưa trả** (tại chỗ, trước thanh toán) | QT BV (Kế toán) | nhắc 48h; quá hạn 5 ngày | **Tự miễn** dòng bị khiếu nại | Admin quyết trong 3 ngày lv; quá hạn → giữ nguyên dòng tính tiền | BV chịu; ĐD vẫn tính thu nhập | 08 |
| F1b | Khiếu nại dòng bảng kê **đã trả** (trong 24h sau thanh toán) | QT BV (Kế toán); kết luận giảm/miễn → hoàn thủ công (UC90) + hóa đơn điều chỉnh | nhắc 48h; quá hạn 5 ngày | **Không tự miễn** — chuyển Admin nền tảng quyết trong 3 ngày lv (Q-44); Admin quá hạn → giữ nguyên dòng tính tiền *(ô này là đề xuất – cần PO xác nhận; file luồng chỉ ghi tới bước chuyển Admin)* | Admin quyết trong 3 ngày lv; quá hạn → giữ nguyên dòng tính tiền | Theo kết luận: BV chịu khoản hoàn; ĐD vẫn tính thu nhập | 08 |
| F2 | BN xin ngoại lệ hoàn cọc | QT BV (Kế toán) | nhắc 24h; quá hạn 48h | Tự duyệt mức BN xin | Admin quyết trong 3 ngày lv; quá hạn → giữ % theo BR-04 | BV chịu khoản bù công ĐD | 09 |
| F3 | Khiếu nại về ĐD (kết luận + bồi hoàn) | QT BV (Nhân sự – CL) | nhắc 3 ngày lv; quá hạn 5 ngày lv | Admin xử lý thay, kết luận trong 3 ngày lv, trả kết quả cho hai bên | như BN thường | Theo kết luận: BV hoặc ĐD (phần ĐD chịu: QT BV khấu trừ thủ công khi lập bảng kê, ≤ 30%/kỳ – Q-10) | 12 (hoàn thủ công, UC90) |
| F4 | Phúc tra (khiếu nại lại) | Admin (lần đầu do QT BV) / Quản trị trưởng BV (Admin xử lý thay khiếu nại về ĐD) / Admin khác luân phiên (khiếu nại về nền tảng) | quá hạn 5 ngày lv | Giữ kết luận lần đầu; ghi vào báo cáo SLA tháng gửi BV & PO | như BN thường | Theo kết luận lần đầu | 12 |
| F5 | Tranh chấp tiền mặt (BN và ĐD lệch số) | QT BV (Kế toán) | quá hạn 24h → nhắc, báo Admin | **Chưa có mặc định – cần chốt (Q-12)** | — | — | 08 |
| F6 | Xác nhận lý do ĐD nghỉ / bom ca | QT BV (Điều phối) | nhắc 24h; quá hạn 72h | Không ghi vi phạm cho ĐD | — | Không phát sinh tiền | 06 |
| F7 | Giải trình chênh lệch đối soát tháng | QT BV (Kế toán) | quá hạn 7 ngày | Coi như chấp nhận số liệu đối soát | — | BV | 11 |
| F8 | Hoàn tiền thủ công khi cổng lỗi | QT BV (Kế toán) | quá hạn 3 ngày lv | Nhắc + báo Admin; khoản hoàn vẫn giữ cho BN | — | BV (chi trả) | 09; hoàn sau thanh toán ở 08, 12, 15 |
| F9 | Xác nhận lý do & phí khi dừng ca giữa chừng | QT BV (Điều phối) | nhắc 12h; quá hạn 24h | Giữ mức tạm tính (đã thanh toán ngay theo lý do ĐD chọn); QT chỉ được giữ hoặc giảm | Admin quyết trong 3 ngày lv; quá hạn → giữ mức theo lý do ĐD chọn | Theo lý do (BR-16); giảm → QT BV hoàn phần chênh thủ công (UC90) | 15 |

*Ghi chú F1a/F1b (theo bản 8.1, Q-44):* tách theo trạng thái tiền của dòng. Dòng chưa trả: quá hạn thì tự miễn (bệnh nhân chưa mất tiền, rủi ro thấp). Dòng đã trả: quá hạn không tự miễn vì sẽ phát sinh lệnh hoàn tiền mà chưa ai kết luận — chuyển Admin quyết.
*UC liên quan:* UC36, UC53, UC90, UC100.

---

## Nhóm E — Vi phạm, khiếu nại & an toàn

### BR-02 — Hủy ca đã nhận (lỗi nặng, bộ đếm riêng với BR-01)
- **Lead time** = giờ hẹn − thời điểm hủy. Đặt ngay không có giờ hẹn → dùng ETA; vì vậy hủy sau khi bệnh nhân đã cọc luôn thuộc mức < 1h.
- Mức xử lý theo lead time:
  - **≥ 12h:** ghi log + trừ điểm uy tín.
  - **1h ≤ lead time < 12h:** giảm tỷ lệ chia cho **3 ca hoàn thành tiếp theo**, mức do bệnh viện cấu hình (mặc định −15 điểm %, ví dụ 80% → 65%).
  - **< 1h hoặc bom ca:** tạm khóa nhận ca ngay (biện pháp bảo vệ); báo Quản trị BV.
- **Tự mở khóa bom ca (Q-43):** khóa nhận ca do bom ca **tự mở khóa sau 24 giờ khi Quản trị BV chưa xác nhận lý do**, không cần Quản trị BV mở tay; vi phạm vẫn được xét tại luồng 06 tới mốc 72h (BR-18 F6). Sự kiện bom ca và thời điểm tự mở khóa đều ghi vào nhật ký vi phạm.
- Trễ quá mốc (ETA + 15 phút) nhưng vẫn phục vụ: ghi log + trừ điểm uy tín. Đến nơi muộn hơn ETA quá 30 phút, hoặc lặp lại 3 lần/30 ngày → tính như hủy 1–12h và cộng vào bộ đếm 3 lần/30 ngày bên dưới (đề xuất, Q-37); xét tại luồng 06 sau ca.
- **Tối đa 3 lần/30 ngày; lần thứ 4** → khóa nhận ca vô thời hạn, chuyển Quản trị BV xử lý kỷ luật (UC79).
- Ngoại lệ đặt ngay: điều dưỡng hủy trong 5 phút sau khi bấm "Đã nhận đơn" và trước khi bệnh nhân cọc xong → gỡ gán, tự tắt "Đang rảnh", ghi ngay 1 vi phạm theo BR-01 (không chờ đủ 3 lần), không áp các mức của BR-02.
- Vi phạm chỉ xét **một lần cho mỗi đơn**, tại bước Quản trị BV ở luồng 06 (có xét bất khả kháng — UC88). Bất khả kháng → không ghi vi phạm, mở tạm khóa.
- Đơn vào luồng 06 do điều dưỡng bị tạm khóa vì khiếu nại → không xét ở 06, theo kết luận luồng 12.
- Nền tảng chỉ khóa kỹ thuật & tính số liệu; trừ tiền / kỷ luật do bệnh viện quyết định.
- *UC liên quan:* UC72, UC77–UC79, UC88, UC116. *Luồng:* 06.

### BR-11 — Khiếu nại & sự cố
- **Hạn nộp:** 30 ngày kể từ khi kết thúc ca (đề xuất, Q-17) — riêng khiếu nại dòng tính tiền trong bảng kê: 24h (BR-04, F1a/F1b). Quá hạn và không nghiêm trọng → từ chối tiếp nhận, báo lý do. Quá hạn chỉ tiếp nhận khi **nghiêm trọng** (an toàn, bạo lực, quấy rối, gian lận).
- Khiếu nại về điều dưỡng: chuyển **nguyên văn** cho bệnh viện; hạn xử lý **3 ngày làm việc**; quá 3 ngày → nhắc; quá 5 ngày → Admin xử lý thay, kết luận trong 3 ngày làm việc và trả kết quả như Quản trị BV (BR-18 F3).
- Khiếu nại nghiêm trọng: **tạm khóa nhận ca ngay**; Quản trị BV xác nhận giữ/gỡ khóa trong **4 giờ**.
- **Phúc tra:** 1 lần, hạn 5 ngày làm việc. Người phúc tra phải **khác** người kết luận lần đầu: lần đầu do Quản trị BV → Admin phúc tra; lần đầu do Admin xử lý thay (khiếu nại về ĐD) → Quản trị trưởng BV phúc tra; khiếu nại về nền tảng (UC99) → một Admin khác người đã kết luận, phân công luân phiên trong nhóm Admin (Q-32). Quá hạn → giữ kết luận lần đầu, ghi vào báo cáo SLA tháng (BR-18 F4). Bên bị khiếu nại cũng được phúc tra 1 lần.
- Admin quá hạn khi xử lý thay (F3) hoặc xử lý khiếu nại về nền tảng (UC99, 3 ngày làm việc) → ghi báo cáo SLA tháng gửi BV & PO (chỉ một cấp Admin, không có cấp leo thang trong nền tảng).
- **Sự cố tại nhà (UC134)** ghi nhận riêng, xử lý ngay theo an toàn; không phụ thuộc kết luận khiếu nại. Trách nhiệm / bảo hiểm: Q-24.
- Đánh giá (rating) không bắt buộc và không phải điều kiện để khiếu nại.
- *UC liên quan:* UC51–UC53, UC98–UC101, UC134. *Luồng:* 12.

### BR-19 — Cờ lạm dụng của bệnh nhân
- Đếm **theo tài khoản**, cửa sổ **90 ngày cuộn**: số khiếu nại bảng kê + số lần xin ngoại lệ hoàn cọc + số khiếu nại được kết luận "không thành". Khoản được tự miễn / tự duyệt do Quản trị BV quá hạn **cũng được đếm** vì chưa xác minh (Q-42). **≥ 2 → gắn cờ** (đề xuất).
- Cờ **tự gỡ** khi số đếm về < 2 (sự việc ra khỏi cửa sổ 90 ngày); Admin gỡ thủ công được, kèm lý do.
- Bệnh nhân được thông báo khi bị gắn cờ, có thể gửi phản hồi cho Admin trong **7 ngày**.
- Cờ **chỉ đổi người quyết khi quá hạn** (theo BR-18); không chặn đặt lịch, không hiển thị cho điều dưỡng.
- *UC liên quan:* UC36, UC51, UC93. *Luồng:* 08, 09, 12.

### BR-23 — SOS & ứng phó khẩn cấp
- Bệnh nhân / người nhà bấm SOS **bất kỳ lúc nào** (UC140), không phải chờ AI hay bác sĩ; điều dưỡng bấm SOS trong ca (UC92). Điểm vào khác: sàng lọc khẩn cấp (luồng 04, 05, 07A), AI/bác sĩ (luồng 13), dịch vụ phát sinh lớp C (07C).
- Hệ thống hiển thị ngay hướng dẫn gọi **115** và nút gọi bằng điện thoại của người dùng; **không tuyên bố đã gọi 115 thay** người dùng. Gọi tự động chỉ làm khi có thiết kế riêng (xác nhận, vị trí, nội dung chuyển giao, xử lý gọi thất bại, trách nhiệm) — **ngoài MVP**.
- Báo đầu mối trực theo cấu hình bệnh viện (bác sĩ trực, Quản trị BV, điều dưỡng đang phân công); quá **5 phút** chưa xác nhận → báo đầu mối dự phòng (Q-48).
- Đang trong ca → mở luồng 15 (lý do cấp cứu y khoa), không thu tiền tại chỗ.
- Ghi nhật ký: thời điểm, người kích hoạt, vị trí (nếu được phép), thông báo, hành động; không đưa nội dung sức khỏe thừa vào thông báo.
- *UC liên quan:* UC20, UC92, UC134, UC140. *Luồng:* 17, 15.

---

## Nhóm F — Sàng lọc triệu chứng & AI

### BR-10 — Phân loại triệu chứng & vai trò của AI
- Sàng lọc là công cụ **hỗ trợ, không chẩn đoán**. Kết quả gồm **4 nhóm**: (1) chưa phát hiện cảnh báo từ thông tin hiện có; (2) cần nhân viên y tế đánh giá sớm (bác sĩ trực gọi lại trước giờ hẹn); (3) cảnh báo khẩn cấp (chặn đặt lịch, hướng dẫn gọi 115, nút SOS — BR-23); (4) chưa đủ thông tin (hỏi bổ sung). AI lỗi hoặc không chắc chắn → bác sĩ trực xử lý.
- Trước ca đặt trước, bệnh nhân **không bắt buộc sàng lọc lại**; có triệu chứng mới thì nhập thêm đến **T−1h** và được phân loại theo cùng quy tắc (UC119, UC22). Bệnh nhân chỉ được **bổ sung** triệu chứng, không được hạ mức xuống dưới ngưỡng nguy hiểm.
- AI lỗi / timeout khi đặt lịch → bác sĩ trực của cơ sở phân loại trong **10 phút**; quá hạn → báo bệnh nhân liên hệ cơ sở trực tiếp (SLA trực: Q-21).
- AI phân tích rủi ro sau ca (luồng 13): không trả kết quả sau **3 lần thử trong 30 phút**, hoặc bệnh viện tắt AI → coi như rủi ro cao, bác sĩ xem tất cả báo cáo.
- AI là công cụ hỗ trợ; quyết định y khoa và trách nhiệm thuộc bác sĩ của bệnh viện. Tiêu chí kiểm chứng độ chính xác AI: Q-26.
- **AI không được:** chẩn đoán cuối cùng; kê đơn / đổi thuốc / quyết thủ thuật; duyệt hồ sơ chuyên môn hay kết luận điều dưỡng đủ điều kiện; đổi kế hoạch chăm sóc; quyết thanh toán / hoàn tiền / khiếu nại; truy cập ngoài phạm vi được cấp. Kết quả AI phải hiển thị mục đích, giới hạn, mức không chắc chắn và đường chuyển cho người.
- *UC liên quan:* UC20–UC23, UC54, UC68, UC119. *Luồng:* 04, 07A, 13.

---

## Quy tắc có trong sơ đồ luồng nhưng chưa được cấp mã BR

Hai quy tắc dưới đây **đang có hiệu lực** trong `luong_hoat_dong_v8.14` nhưng chưa có nhà trong bảng BR của use_case_v8.1. Liệt kê tại đây để dev không bỏ sót; việc cấp mã chính thức thuộc lần sửa use_case tiếp theo *(đề xuất của Atlas — chờ chốt)*.

### R-L03 — Khóa tài khoản khi đăng nhập sai (luồng 03)
- Mật khẩu và mã xác thực 2 lớp dùng **chung một bộ đếm 5 lần sai**. Sai đủ 5 lần → **khóa tài khoản 15 phút** (UC15) và báo cho chủ tài khoản. Bộ đếm đặt lại khi đăng nhập thành công.
- *Đề xuất:* bổ sung vào BR-20 khi sửa use_case lần tới.

### R-UC135 — Đặt hộ qua tổng đài / điểm xuất viện (chưa có luồng riêng)
- Quản trị BV vai trò **Điều phối** đặt thay cho bệnh nhân ít dùng công nghệ (UC135). Bệnh nhân xác nhận **consent và tiền cọc qua link gửi tới email** của mình — không có ngoại lệ dùng tiền mặt hay bỏ qua consent cho kênh này.
- Nguồn: ghi chú trang 3 (sơ đồ nhóm Đặt lịch) và dòng UC135 trong danh mục UC của use_case_v8.1; trang 00c của file luồng xác nhận "đã có UC & quy tắc, chưa vẽ luồng".

---

## Các quyết định còn mở làm thay đổi hành vi quy tắc

| Mã | Nội dung | Quy tắc bị ảnh hưởng | Trạng thái |
|---|---|---|---|
| Q-03 | Phí đến nhà tối thiểu (chưa có giá trị) | BR-04, BR-16 | Chặn riêng nhánh "dịch vụ không làm được sau khi ĐD đã xuất phát" |
| Q-05 | BV xác nhận mô hình tự gán phù hợp quan hệ lao động | BR-01 | Chờ BV |
| Q-08 | Tỷ lệ tính phí hạng mục dở dang khi dừng ca | BR-16 | Đang là giá trị đề xuất |
| Q-09 | Trần tiền dịch vụ phát sinh trong ca | BR-04 | Chưa có giá trị |
| Q-10 | Khấu trừ tự động phần ĐD chịu khi lập bảng kê | BR-18 F3 | Không làm trong MVP — khấu trừ thủ công, trần 30%/kỳ |
| Q-11 | Thời điểm lập hóa đơn cho tiền cọc | BR-04 | Chờ kế toán BV |
| Q-12 | Mặc định khi tranh chấp tiền mặt | BR-18 F5 | **Để trống có chủ ý** — chặn riêng tính năng tiền mặt (ngoài pilot) |
| Q-13 | Danh mục dịch vụ được làm tại nhà | BR-15 | Chờ pháp chế/BV phê duyệt |
| Q-14 | Thời hạn lưu trữ hồ sơ & chứng từ | BR-12 | Chờ pháp chế |
| Q-17 | Hạn nộp khiếu nại 30 ngày | BR-11 | Đang là giá trị đề xuất |
| Q-19 | Mặc định "không trả lời = đồng ý" khi thay người | BR-13 | Đang xem lại |
| Q-21 | SLA bác sĩ trực phân loại thay AI | BR-10 | Chưa có giá trị |
| Q-22 | Khung giờ phục vụ & trần ca/ngày | BR-03, BR-13 | Chờ kiểm chứng nhu cầu |
| Q-24 | Trách nhiệm & bảo hiểm cho sự cố tại nhà | BR-11 | Chờ pháp chế |
| Q-26 | Tiêu chí kiểm chứng độ chính xác AI | BR-10 | Chưa có |
| Q-29 | Ngưỡng vi phạm 2/3 lần trong 30 ngày | BR-01 | Đang là giá trị đề xuất |
| Q-35 | Mặc định giữ mức tạm tính khi dừng ca quá hạn xác nhận | BR-16, F9 | Đang là giá trị đề xuất |
| Q-37 | Tính trễ nặng như hủy 1–12h | BR-02 | Đang là giá trị đề xuất |
| Q-42 | Đếm khoản tự miễn/tự duyệt vào cờ lạm dụng | BR-19 | Đang là giá trị đề xuất |
| Q-44 (ô F1b) | Mặc định sau khi Admin cũng quá hạn ở F1b | BR-18 F1b | Đề xuất trong file — **cần PO xác nhận** |
| Q-48 | Đầu mối dự phòng khi SOS không được xác nhận | BR-23 | Theo cấu hình BV |
| Q-49 | Biểu mẫu & trường bắt buộc của báo cáo theo loại dịch vụ | BR-22 | Khung đã có; nội dung trường do chuyên môn BV duyệt |

*Đã chốt, không còn mở:* Q-20 (không xem lịch sử BV khác, kể cả có đồng ý — BR-09), Q-23 (phạm vi pilot), Q-30 (phân bổ cọc cho dòng bị khiếu nại — BR-04), Q-33 (xác nhận bảng kê 2 cấp — BR-04), Q-38 (bảng hoàn cọc đặt ngay — BR-04), Q-41/Q-43/Q-45/Q-46 (đã vào BR-01/BR-02/BR-16), Q-50 (trạng thái hồ sơ nhân sự — BR-21), Q-51 (email-only — BR-20).

---

*Tài liệu này do Atlas tổng hợp từ hai file sơ đồ baseline v8.1 / 8.14 ngày 18/10/2026. Mọi thay đổi nghiệp vụ phải sửa ở file sơ đồ nguồn trước, rồi cập nhật tài liệu này — không sửa ngược.*
