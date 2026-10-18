# Yêu cầu Chức năng (FR) & Phi chức năng (NFR)
## Nền tảng Điều dưỡng Bệnh viện Chăm sóc Tại nhà

| | |
|---|---|
| Nguồn chuẩn | `use_case_v8.1.drawio` (140 UC, BR-01–BR-23) + `luong_hoat_dong_v8.14.drawio` — baseline chốt 16/10/2026; tài liệu BR tổng hợp đi kèm |
| Stack đã chốt | React / React Native (app điều dưỡng), Node.js + TypeScript, PostgreSQL, cloud object storage (signed URL), job queue, email giao dịch, push, maps API |
| Trạng thái | **Đề xuất của Atlas — chờ Phúc/PO chốt.** FR suy ra từ UC/BR của baseline (không thêm nghiệp vụ); các con số trong NFR là chỉ tiêu đề xuất, trừ chỗ ghi "theo đặc tả" |

**Quy ước ưu tiên (theo phạm vi pilot Q-23: 1 bệnh viện, chỉ đặt trước, chỉ thanh toán qua cổng, không tiền mặt, không đặt ngay, AI hỗ trợ + bác sĩ trực):**

- **Must** — pilot không chạy được nếu thiếu; tương ứng 27 user story Must (US-HP) đã viết.
- **Should** — cần ngay sau pilot hoặc có cách làm tay tạm chấp nhận được trong pilot.
- **Could** — có thì tốt, không chặn mốc nào.
- **Won't (đợt này)** — ngoài phạm vi có chủ ý; ghi rõ để không ai tự làm.

Các UC đã "Gộp / bỏ" trong danh mục (UC29, UC70–UC76, UC130–UC132) không sinh FR. UC131 để trống theo quy ước không tái sử dụng mã.

---

# PHẦN 1 — YÊU CẦU CHỨC NĂNG (FR)

## FR-01 — Tài khoản, định danh & phân quyền

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-01.1 | Đăng ký / đăng nhập chỉ bằng email + mật khẩu; mã xác thực tài khoản qua email, hiệu lực 5 phút (đặt lại mật khẩu 15 phút); quên/đặt lại mật khẩu qua email | UC1, UC14, UC82; BR-20 | Must |
| FR-01.2 | Khóa tạm tài khoản khi sai mật khẩu + mã 2 lớp đủ 5 lần (bộ đếm chung), khóa 15 phút, báo chủ tài khoản; đặt lại bộ đếm khi đăng nhập thành công | UC15; luồng 03 (chưa có mã BR) | Must |
| FR-01.3 | Xác thực 2 lớp bắt buộc cho Điều dưỡng, Bác sĩ, Quản trị BV, Admin (email OTP hoặc app xác thực) | UC83; BR-20 | Must |
| FR-01.4 | Hồ sơ nhân sự 2 bước: BV tạo & gửi (kèm CCHN, bằng cấp) → BV xác nhận chuyên môn (bước 1) → nền tảng duyệt đầy đủ (bước 2); yêu cầu bổ sung / từ chối có lý do; vòng đời trạng thái theo BR-21, quét hạn CCHN hằng ngày | UC5–UC8, UC10–UC12, UC139; BR-21 | Must |
| FR-01.5 | Kích hoạt tài khoản nhân sự (gửi thông tin đăng nhập), khóa/cập nhật khi nghỉ việc, hết hạn CCHN, chuyển khoa | UC69, UC81; BR-21 | Must |
| FR-01.6 | Kiểm tra quyền ở backend theo 4 yếu tố (vai trò × bệnh viện × quan hệ × ca/hồ sơ × trạng thái); vai trò con của Quản trị BV (Điều phối, Kế toán, Nhân sự–CL, Quản trị trưởng) | UC16; BR-09; trang 13 use_case | Must |
| FR-01.7 | Ghi audit log mọi truy cập hồ sơ bệnh nhân và thao tác nhạy cảm (ai, lúc nào, hồ sơ nào, hành động) | UC17; BR-09, BR-21 | Must |
| FR-01.8 | Tạo cơ sở (bệnh viện) & cấp tài khoản quản trị cho tenant mới | UC80 | Must |

## FR-02 — Hồ sơ bệnh nhân, consent & quyền dữ liệu

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-02.1 | Tạo hồ sơ bệnh nhân; một tài khoản quản lý nhiều hồ sơ người thân; chủ tài khoản tự khai quan hệ + cam kết đại diện (không thu CCCD) | UC3, UC4; BR-17, BR-20 | Must |
| FR-02.2 | Consent riêng cho từng hồ sơ; người thân là người lớn tự đồng ý qua link email; ghi phiên bản điều khoản đã đồng ý | UC2, UC4; BR-17 | Must |
| FR-02.3 | Rút đồng ý bất cứ lúc nào (OTP email / link email): khóa đặt lịch mới, xử lý đơn đang chạy theo trạng thái (chưa xuất phát → hủy + hoàn 100%; đang chạy → hoàn tất/dừng ca) | UC106, UC129; BR-17 | Must |
| FR-02.4 | Đồng ý lại khi điều khoản thay đổi trọng yếu (chưa đồng ý → chỉ xem); thay đổi không trọng yếu chỉ thông báo | UC138; BR-17 (Q-47) | Should |
| FR-02.5 | Yêu cầu xóa dữ liệu: xác thực OTP email, xét ràng buộc (đơn đang chạy, khiếu nại, công nợ, dữ liệu phải lưu theo luật), xóa/ẩn danh trong 72h, cảnh báo quá hạn theo mốc, từ chối phải báo lý do | UC61–UC65, UC104, UC105; BR-12 | Must |
| FR-02.6 | Phân công bác sĩ phụ trách bệnh nhân tái khám; cấp/thu hồi quyền xem lịch sử có thời hạn, chỉ tại bệnh viện của bác sĩ | UC13, UC58, UC59, UC102; BR-09 | Should |

## FR-03 — Sàng lọc triệu chứng & hỗ trợ AI

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-03.1 | Sàng lọc triệu chứng khi đặt lịch, phân loại 4 nhóm (không cảnh báo / cần đánh giá sớm / khẩn cấp / chưa đủ thông tin); lưu thành bản ghi sự kiện lặp lại được theo đơn (mẫu hình ERD theo bản 8.11) | UC21; BR-10 | Must |
| FR-03.2 | Nhóm khẩn cấp: chặn đặt lịch, hướng dẫn gọi 115, hiển thị nút SOS | UC20; BR-10, BR-23 | Must |
| FR-03.3 | Bệnh nhân xem kết quả và bổ sung triệu chứng (không được hạ mức nguy hiểm); bổ sung trước ca đến T−1h, phân loại lại theo cùng quy tắc; khẩn cấp → hủy ca + hoàn 100% cọc | UC22, UC119; BR-10 | Must |
| FR-03.4 | AI lỗi/timeout/không chắc chắn → chuyển bác sĩ trực phân loại thủ công trong 10 phút; quá hạn → hướng dẫn bệnh nhân liên hệ cơ sở | UC23; BR-10 (Q-21) | Must |
| FR-03.5 | AI phân tích rủi ro sau ca từ báo cáo chăm sóc; cảnh báo rủi ro cao cho bác sĩ (khẩn cấp: báo cả BN/người nhà); bác sĩ xử lý cảnh báo; AI lỗi 3 lần/30 phút hoặc BV tắt AI → coi như rủi ro cao | UC54, UC55, UC68; BR-10; luồng 13 | Should |
| FR-03.6 | Ranh giới AI: không chẩn đoán cuối cùng, không kê đơn/quyết thủ thuật, không duyệt hồ sơ/duyệt tiền; mọi kết quả AI hiển thị mục đích, giới hạn, độ không chắc chắn, đường chuyển người | BR-10 | Must |

## FR-04 — Đặt lịch, ghép & điều phối

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-04.1 | Đặt lịch đặt trước (sớm nhất 2h, xa nhất 14 ngày): chọn cơ sở & dịch vụ, kiểm tra công nợ + giới hạn 3 lịch + chống chồng lịch, kiểm tra địa chỉ trong vùng phục vụ | UC18, UC27; BR-06, BR-13, BR-14 | Must |
| FR-04.2 | Xem cơ sở, dịch vụ & bảng giá; chọn ưu tiên (điều dưỡng quen, giới tính) | UC84, UC85 | Must |
| FR-04.3 | Tìm & chọn điều dưỡng theo lịch trống, kỹ năng, đánh giá; gửi yêu cầu chỉ định; điều dưỡng xác nhận/từ chối trong 30 phút (slot được giữ tạm) | UC28, UC112–UC115; BR-13 | Must |
| FR-04.4 | Điều dưỡng khai báo lịch trống 14 ngày tới; bật/tắt "Đang rảnh" trong khung giờ BR-03 | UC114, UC9; BR-03 | Must |
| FR-04.5 | Chuỗi nhắc & xác nhận trước ca: T−24h nhắc lịch, T−3h điều dưỡng xác nhận lại (hạn T−2h), T−2h nhắc BN cập nhật triệu chứng (không bắt buộc); ĐD không xác nhận lại → tìm người thay | UC118, UC119; BR-13 | Must |
| FR-04.6 | Điều dưỡng báo không đi được → tìm người thay theo quy tắc thời gian còn lại; BN chọn đồng ý / chọn khác / đổi giờ / hủy hoàn 100% trong hạn trả lời, quá hạn mặc định theo BR-13 | UC116, UC117, UC37; BR-13 (Q-19) | Must |
| FR-04.7 | Điều phối viên điều điều dưỡng thay thế thủ công khi tự động thất bại | UC78 | Must |
| FR-04.8 | Hủy lịch phía bệnh nhân (hoàn cọc theo bảng BR-04); duyệt hủy ngoại lệ bởi Quản trị BV | UC34, UC36; BR-04, F2 | Must |
| FR-04.9 | Đổi lịch: đơn đã cọc, còn > 2h, tối đa 2 lần/đơn, giữ cọc; ngoại lệ đổi giờ khi thay người | UC120; BR-13 | Should |
| FR-04.10 | Đặt ngay / ghép nhanh tự gán (lọc cứng + xếp hạng, tổng ≤ 15 phút, không có nút từ chối, bộ đếm vi phạm BR-01) | UC19, UC24, UC25, UC30–UC33, UC87; BR-01, BR-08 | **Won't** (Q-23) |
| FR-04.11 | Đặt hộ qua tổng đài / điểm xuất viện: Điều phối đặt thay, BN xác nhận consent + cọc qua link email | UC135 | **Won't** (chờ quyết định riêng của Phúc) |
| FR-04.12 | Dịch vụ cần y lệnh: BN tải chỉ định còn hiệu lực khi đặt; bác sĩ trực kiểm tra trong 30 phút; không hợp lệ → chặn đặt, gợi ý khám tại BV | UC136, UC137; BR-15 | Must |

## FR-05 — Thực hiện ca chăm sóc

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-05.1 | Tính giờ phải xuất phát & ETA theo loại đơn; điều dưỡng chia sẻ vị trí thời gian thực từ xuất phát đến check-in; bệnh nhân xem vị trí trên bản đồ | UC38, UC39; BR-07 | Must |
| FR-05.2 | Phát hiện bom ca (quá giờ xuất phát 10 phút chưa di chuyển / tắt định vị > 10 phút) → tạm khóa nhận ca, chuyển xử lý vi phạm; tự mở khóa sau 24h theo Q-43 | UC77; BR-07, BR-02 | Must |
| FR-05.3 | Check-in tại nhà BN: geofence + mã trên app của BN; đường dự phòng: ảnh + BN xác nhận, Quản trị BV hậu kiểm 24h | UC40; BR-07, BR-20 | Must |
| FR-05.4 | Bắt đầu ca kèm đánh giá ban đầu theo biểu mẫu loại dịch vụ (bắt buộc kể cả khi BN không bổ sung triệu chứng) | UC41; BR-22 | Must |
| FR-05.5 | Dịch vụ phát sinh trong ca: phân loại A/B/C; lớp B chờ duyệt ≤ 10 phút; lớp C dừng & SOS; có phí → BN xác nhận trước; ghi vào báo cáo ca | UC91; BR-15 | Must |
| FR-05.6 | Kết thúc ca; báo cáo chăm sóc bắt buộc theo biểu mẫu loại dịch vụ (hai mốc "Đã kết thúc" / "Hoàn tất"); nhắc quá 2h, tạm khóa nhận ca quá 24h nếu chưa đủ | UC42, UC43; BR-22 | Must |
| FR-05.7 | Lưu báo cáo vào hồ sơ bệnh nhân tại bệnh viện thực hiện; xem lịch sử chăm sóc theo quyền BR-09 | UC44, UC59; BR-09 | Must |
| FR-05.8 | Dừng ca giữa chừng: lý do, tính phí theo BR-16, báo cáo bắt buộc, thanh toán ngay theo mức tạm tính (trừ lý do không an toàn/cấp cứu); Quản trị BV xác nhận giữ/giảm trong 24h; hậu kiểm lý do "không an toàn" (Q-46); đơn con làm phần còn lại không cọc | UC127, UC128; BR-16, F9 | Must |
| FR-05.9 | Báo bệnh nhân vắng mặt sau 15 phút không liên lạc được (không tính vi phạm cho ĐD) | UC89; BR-07 | Must |
| FR-05.10 | Liên lạc BN – ĐD trong app (chat / gọi qua app), không lộ số điện thoại | UC133; BR-20 | Should |
| FR-05.11 | Xác nhận hoàn thành ca & bảng kê (xác nhận rõ từng dòng không tranh chấp; mốc 15 phút tại chỗ / 24h khi dừng ca đặc biệt) | UC93; BR-04 (Q-33) | Must |

## FR-06 — Thanh toán, hoàn tiền & đối soát

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-06.1 | Đặt cọc 30% (tối thiểu 50.000đ) qua cổng trong cửa sổ 15 phút; quá hạn tự hủy đơn, nhả slot; cọc chỉ thu online | UC45; BR-04 | Must |
| FR-06.2 | Thanh toán qua cổng, tiền về thẳng tài khoản bệnh viện (nền tảng không giữ tiền); nhận kết quả qua webhook có kiểm chứng + idempotent; đối chiếu giao dịch với đơn hoàn thành | UC46, UC47, UC48; BR-05 | Must |
| FR-06.3 | Thanh toán phần còn lại sau ca qua cổng; chưa trả → "Chờ thanh toán" 24h → "Công nợ" chặn đặt lịch mới | UC121; BR-04, BR-14 | Must |
| FR-06.4 | Hoàn cọc tự động theo bảng BR-04 (hẹn trước >12h: 100%, 2–12h: 50%, <2h/đã xuất phát: 0%; lỗi phía ĐD/BV hoặc sàng lọc khẩn cấp: luôn 100%); hệ thống tự tạo lệnh hoàn, không duyệt tay | UC90; BR-04 | Must |
| FR-06.5 | Lệnh hoàn tiền thủ công sau thanh toán (khiếu nại dòng, dừng ca, cổng lỗi...) có chứng từ, theo dõi trạng thái lệnh đến khi hoàn tất | UC90; BR-18 F1b/F8 | Must |
| FR-06.6 | Khiếu nại dòng bảng kê: dòng chưa trả theo F1a, dòng đã trả theo F1b; phân bổ & giữ cọc cho dòng bị khiếu nại theo Q-30 | UC93; BR-04, BR-18 | Must |
| FR-06.7 | Xuất hóa đơn điện tử cho bệnh nhân (tổng giá trị ca, đã trừ cọc) qua nhà cung cấp hóa đơn điện tử; hóa đơn điều chỉnh khi hoàn tiền | UC126; BR-04 (Q-11) | Must |
| FR-06.8 | Đối soát cọc cuối kỳ 4 nhóm (đã khấu trừ / đã hoàn / giữ lại / đang giữ cho tranh chấp), tổng phải khớp tổng cọc đã thu; chênh lệch mở đối soát; tải sao kê dự phòng khi API cổng lỗi | UC48, UC111; BR-04, BR-05, F7 | Must |
| FR-06.9 | Tính phí nền tảng %/đơn hoàn thành; xuất hóa đơn phí hằng tháng cho bệnh viện | UC95; BR-05 | Should |
| FR-06.10 | Bảng kê thu nhập điều dưỡng; điều dưỡng xem thu nhập & điểm uy tín của mình | UC96, UC97 | Should |
| FR-06.11 | Chuỗi tiền mặt tại nhà: ĐD nhập số đã thu, BN xác nhận, ĐD nộp quỹ trong 48h, thủ quỹ xác nhận nhận | UC122–UC125; BR-05 | **Won't** (Q-23) |
| FR-06.12 | Xem lịch sử đơn & hóa đơn phía bệnh nhân | UC94 | Must |

## FR-07 — Vi phạm, khiếu nại & sự cố

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-07.1 | Áp quy tắc vi phạm hủy ca theo lead time (BR-02): ghi log/trừ điểm, giảm tỷ lệ chia 3 ca, tạm khóa; xét một lần tại luồng 06 kèm xét bất khả kháng; trần 3 lần/30 ngày, lần 4 khóa vô thời hạn chờ kỷ luật | UC72, UC88; BR-02 | Must |
| FR-07.2 | Quản trị BV nhận hồ sơ vi phạm & xử lý kỷ luật (nền tảng chỉ khóa kỹ thuật + cung cấp số liệu) | UC79; BR-02 | Must |
| FR-07.3 | Gửi khiếu nại (hạn 30 ngày sau ca; khiếu nại dòng: 24h); phân loại & chuyển nguyên văn về BV nếu về ĐD; theo dõi hạn xử lý, nhắc BV, quá hạn Admin xử lý thay (F3) | UC51, UC52, UC53, UC100; BR-11 | Must |
| FR-07.4 | Khiếu nại nghiêm trọng → tạm khóa nhận ca ngay, Quản trị BV xác nhận giữ/gỡ trong 4h | UC98; BR-11 | Must |
| FR-07.5 | Phúc tra 1 lần, người phúc tra khác người kết luận lần đầu, theo ma trận F4; bên bị khiếu nại cũng được phúc tra | UC53, UC99; BR-11, F4 | Should |
| FR-07.6 | Xử lý khiếu nại về nền tảng bởi Admin khác người kết luận trước; báo cáo SLA tháng | UC99; BR-11 | Should |
| FR-07.7 | Cờ lạm dụng bệnh nhân: đếm theo tài khoản cửa sổ 90 ngày, gắn/gỡ cờ, thông báo BN + nhận phản hồi 7 ngày; cờ chỉ đổi người quyết khi quá hạn | UC36, UC51, UC93; BR-19 | Should |
| FR-07.8 | Điều dưỡng báo cáo hành vi bệnh nhân (quấy rối, không an toàn) | UC101; BR-11 | Should |
| FR-07.9 | Báo cáo sự cố tại nhà tách khỏi khiếu nại, xử lý ngay theo an toàn | UC134; BR-11 | Must |
| FR-07.10 | Đánh giá điều dưỡng sau ca (không bắt buộc, không là điều kiện khiếu nại) | UC50; BR-11 | Could |

## FR-08 — Tái khám & theo dõi sau ca

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-08.1 | Hệ thống đề xuất tái khám từ kết quả phân tích rủi ro; bệnh nhân xác nhận & chọn bệnh viện | UC56, UC57 | Should |
| FR-08.2 | Bác sĩ duyệt kế hoạch tái khám; lịch sử chăm sóc phục vụ tái khám chỉ trong phạm vi BV mình | UC60, UC59; BR-09 | Should |

## FR-09 — SOS & ứng phó khẩn cấp

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-09.1 | BN/người nhà bấm SOS bất kỳ lúc nào (không chờ AI/BS); ĐD bấm SOS trong ca; điểm vào từ sàng lọc khẩn cấp, phát sinh lớp C, AI/bác sĩ | UC140, UC92; BR-23 | Must |
| FR-09.2 | Màn hình SOS hiển thị ngay hướng dẫn gọi 115 + nút gọi bằng điện thoại người dùng; hệ thống không tuyên bố đã gọi thay | BR-23 | Must |
| FR-09.3 | Báo đầu mối trực theo cấu hình BV; quá 5 phút chưa xác nhận → leo thang đầu mối dự phòng; ghi nhật ký sự cố SOS đầy đủ (thời điểm, người kích hoạt, vị trí nếu được phép, hành động) | UC140; BR-23 (Q-48) | Must |
| FR-09.4 | SOS trong ca → mở xử lý dừng ca lý do cấp cứu y khoa, không thu tiền tại chỗ | BR-23, BR-16 | Must |

## FR-10 — Quản trị, cấu hình & báo cáo

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-10.1 | Cấu hình bệnh viện có ngày hiệu lực: bảng giá, vùng phục vụ, tỷ lệ chia, mức hoàn/phạt | UC108; BR-05, BR-06 | Must |
| FR-10.2 | Cấu hình tham số hệ thống: khung giờ, thời gian chờ, ngưỡng mặc định, cấu hình SOS & đầu mối trực theo BV | UC109; BR-03, BR-23 | Must |
| FR-10.3 | Liên kết tài khoản nhận tiền của BV với cổng thanh toán | UC110; BR-05 | Must |
| FR-10.4 | Dashboard bệnh viện; dashboard toàn hệ thống (Admin); giám sát cảnh báo quá hạn chưa xử lý (hàng đợi BR-18, hạn xóa dữ liệu, hạn khiếu nại) | UC107, UC66, UC103 | Must |
| FR-10.5 | Báo cáo hiệu suất điều dưỡng; thống kê doanh thu theo cơ sở / loại dịch vụ | UC67, UC49 | Should |
| FR-10.6 | Cấu hình biểu mẫu báo cáo chăm sóc & trường bắt buộc theo loại dịch vụ (chuyên môn BV phê duyệt) | BR-22 (Q-49) | Must |

## FR-11 — Thông báo & nhắc việc (xuyên suốt)

| Mã | Yêu cầu | Nguồn | Ưu tiên |
|---|---|---|---|
| FR-11.1 | Kênh thông báo: push trong app + email; **không SMS, không dùng số điện thoại**; nội dung thông báo không chứa dữ liệu sức khỏe thừa | BR-20, BR-23 | Must |
| FR-11.2 | Bộ hẹn giờ nghiệp vụ tập trung (hàng đợi công việc): cửa sổ cọc 15 phút, nhắc T−24h/T−3h/T−2h, hạn xác nhận bảng kê, các mốc nhắc/quá hạn của BR-18 (48h, 5 ngày, 72h, 7 ngày...), hạn nộp tiền mặt, hạn CCHN, hạn xóa dữ liệu 72h | BR-04, BR-13, BR-18, BR-12, BR-21 | Must |
| FR-11.3 | Mọi thông báo leo thang (SOS 5 phút, khiếu nại quá hạn, đối soát chênh lệch) ghi nhận thời điểm gửi/xác nhận để đối chiếu SLA | BR-11, BR-18, BR-23 | Must |

---

# PHẦN 2 — YÊU CẦU PHI CHỨC NĂNG (NFR)

> Mọi con số dưới đây là **chỉ tiêu đề xuất của Atlas — chờ Phúc/PO chốt**, trừ dòng ghi "theo đặc tả" (lấy nguyên từ BR/luồng). Giả định tải pilot: 1 bệnh viện, ~300 ca/ngày, giờ cao điểm tập trung 17:00–21:30 (khung BR-03) — nếu giả định này sai, chỉ tiêu hiệu năng phải tính lại.

## NFR-01 — Hiệu năng

| Mã | Yêu cầu | Chỉ tiêu đề xuất | Căn cứ |
|---|---|---|---|
| NFR-01.1 | Thời gian phản hồi API | p95 ≤ 300 ms (đọc), ≤ 800 ms (ghi) ở tải pilot; màn hình chính mở ≤ 2 giây trên mạng 4G | Đề xuất |
| NFR-01.2 | Độ trễ gửi thông báo SOS | Từ lúc bấm SOS đến khi push tới đầu mối trực ≤ 10 giây (p95); mốc leo thang 5 phút là theo đặc tả BR-23 | BR-23 + đề xuất |
| NFR-01.3 | Cập nhật vị trí điều dưỡng | Gửi vị trí mỗi 10–15 giây khi đang di chuyển; độ trễ hiển thị phía BN ≤ 15 giây; không làm hao pin quá ~5%/giờ di chuyển | BR-07 + đề xuất |
| NFR-01.4 | Xử lý webhook thanh toán | Xác nhận & ghi nhận ≤ 3 giây; xử lý trùng (idempotent) không tạo giao dịch/lệnh hoàn thứ hai | BR-05 + đề xuất |

## NFR-02 — Khả dụng & phục hồi thảm họa

| Mã | Yêu cầu | Chỉ tiêu đề xuất | Căn cứ |
|---|---|---|---|
| NFR-02.1 | Uptime dịch vụ lõi (đặt lịch, ca, thanh toán, SOS) | ≥ 99,9% theo tháng trong pilot | Đề xuất — PO chốt theo cam kết với BV |
| NFR-02.2 | Sao lưu & khôi phục | PostgreSQL PITR: RPO ≤ 1 giờ, RTO ≤ 4 giờ; kiểm tra khôi phục thử mỗi quý | Đề xuất |
| NFR-02.3 | Suy giảm có kiểm soát | Cổng thanh toán/AI/bản đồ lỗi không được làm sập luồng lõi: AI lỗi → bác sĩ trực (đã có trong BR-10); cổng lỗi → lệnh hoàn thủ công F8; mất định vị → check-in dự phòng (BR-07) | Theo đặc tả |
| NFR-02.4 | Bảo trì có kế hoạch | Ngoài khung giờ phục vụ cao điểm; thông báo trước ≥ 24h trong app | Đề xuất |

## NFR-03 — Bảo mật

| Mã | Yêu cầu | Chỉ tiêu đề xuất | Căn cứ |
|---|---|---|---|
| NFR-03.1 | Mã hóa | TLS 1.2+ mọi kết nối; mã hóa dữ liệu lưu trữ (at-rest) cho CSDL và object storage | Đề xuất (chuẩn ngành) |
| NFR-03.2 | Mật khẩu & mã xác thực | Băm mật khẩu bằng Argon2id/bcrypt (cost phù hợp); OTP 6 số, hiệu lực theo BR-20, giới hạn số lần thử & gửi lại; khóa tài khoản theo FR-01.2 | BR-20 + đề xuất |
| NFR-03.3 | Truy cập file/ảnh | Bucket riêng tư; chỉ cấp **signed URL thời hạn ≤ 15 phút** sau khi backend kiểm tra quyền 4 yếu tố (BR-09); cấm tuyệt đối link công khai vĩnh viễn tới ảnh sức khỏe | BR-09 + đề xuất thời hạn |
| NFR-03.4 | Kiểm soát truy cập | Mọi kiểm tra quyền thực thi ở backend/tầng truy vấn (không tin frontend); kiểm thử xâm nhập (pentest) trước go-live pilot và định kỳ hằng năm; mục tiêu tương đương OWASP ASVS mức 2 | BR-09 + đề xuất |
| NFR-03.5 | Audit log | Chỉ ghi thêm (append-only), không sửa/xóa qua ứng dụng; không ghi mật khẩu, token, nội dung sức khỏe thừa vào log; thời hạn lưu audit theo Q-14 | BR-09, BR-21 + đề xuất |
| NFR-03.6 | Bí mật & khóa | API key/khóa cổng thanh toán lưu trong secret manager, không trong mã nguồn; webhook thanh toán phải xác thực chữ ký | Đề xuất |

## NFR-04 — Riêng tư & tuân thủ pháp luật

| Mã | Yêu cầu | Chỉ tiêu đề xuất | Căn cứ |
|---|---|---|---|
| NFR-04.1 | Dữ liệu sức khỏe là dữ liệu cá nhân nhạy cảm theo Nghị định 13/2023/NĐ-CP: có căn cứ consent cho từng hồ sơ, ghi phiên bản điều khoản, rút được, xóa được theo BR-12/BR-17 | Bắt buộc theo luật + đặc tả |
| NFR-04.2 | Lưu trữ dữ liệu | Đặt dữ liệu (CSDL + object storage) tại region Việt Nam hoặc region gần nhất có đánh giá chuyển dữ liệu xuyên biên giới theo NĐ 13/2023 trước go-live | Đề xuất — pháp chế chốt cùng Q-14 |
| NFR-04.3 | Thời hạn lưu trữ | Hồ sơ chăm sóc & chứng từ theo Q-14 (chờ pháp chế); hệ thống phải cấu hình được thời hạn theo loại dữ liệu, không hard-code | BR-12 (Q-14) |
| NFR-04.4 | Không lộ dữ liệu qua kênh phụ | Thông báo push/email không chứa nội dung sức khỏe chi tiết; ảnh chụp màn hình báo cáo không bị index công khai; dữ liệu test không dùng dữ liệu bệnh nhân thật | BR-23 + đề xuất |

## NFR-05 — Toàn vẹn dữ liệu & tiền

| Mã | Yêu cầu | Chỉ tiêu | Căn cứ |
|---|---|---|---|
| NFR-05.1 | Tiền tệ | Mọi số tiền lưu dạng số nguyên VND; giao dịch tiền qua bút toán ghi mới (ledger append-only), không sửa/xóa dòng tiền đã ghi | Theo đặc tả (trang 14 use_case) |
| NFR-05.2 | Tính duy nhất của lệnh tiền | Mỗi sự kiện hoàn tiền chỉ sinh đúng một lệnh hoàn (ràng buộc duy nhất ở CSDL — đã có trong bản ERD 8.11 cho trường hợp sàng lọc khẩn cấp) | ERD 8.11 |
| NFR-05.3 | Mốc thời gian nghiệp vụ | Mọi bộ hẹn giờ (cọc 15 phút, T−2h, quá hạn BR-18...) sai lệch cho phép ≤ 60 giây so với mốc quy định; lưu thời gian UTC, hiển thị Asia/Ho_Chi_Minh | Đề xuất |
| NFR-05.4 | Nhất quán trạng thái | Chuyển trạng thái đơn/ca theo đúng máy trạng thái đã duyệt (bộ enum trang 00c sau khi được ký duyệt); chuyển trạng thái trái phép bị chặn ở backend | 00c (chờ duyệt) |

## NFR-06 — Khả năng mở rộng

| Mã | Yêu cầu | Chỉ tiêu đề xuất | Căn cứ |
|---|---|---|---|
| NFR-06.1 | Đa tenant | Cách ly dữ liệu theo bệnh viện ở tầng truy vấn ngay từ pilot (dù pilot 1 BV), để thêm BV không phải thiết kế lại | Kiến trúc SaaS + BR-09 |
| NFR-06.2 | Tăng tải | API không trạng thái, scale ngang được; chịu được ×5 tải pilot mà không đổi kiến trúc (chỉ tăng tài nguyên) | Đề xuất |
| NFR-06.3 | Tách hàng đợi | Các việc hẹn giờ & thông báo chạy qua job queue riêng, không chặn request người dùng; hàng đợi có giám sát tồn đọng | Stack đã chốt |

## NFR-07 — Tính dễ dùng (người dùng chính: bệnh nhân cao tuổi & điều dưỡng ngoài hiện trường)

| Mã | Yêu cầu | Chỉ tiêu đề xuất | Căn cứ |
|---|---|---|---|
| NFR-07.1 | Chuẩn hiển thị phía bệnh nhân | Cỡ chữ cơ sở ≥ 16px, vùng chạm ≥ 48px, tương phản đạt WCAG 2.1 AA; không truyền đạt thông tin chỉ bằng màu sắc | Đề xuất (hướng thiết kế đã dùng cho Stitch) |
| NFR-07.2 | Độ sâu thao tác | Đặt lịch hoàn tất trong ≤ 5 màn hình chính; SOS tới được trong ≤ 2 chạm từ mọi màn hình chính | Đề xuất |
| NFR-07.3 | Ngôn ngữ | Toàn bộ giao diện & thông báo tiếng Việt; thuật ngữ y tế kèm cách diễn đạt phổ thông cho bệnh nhân | Đề xuất |
| NFR-07.4 | Chống thao tác nhầm ở thao tác tiền & SOS | Xác nhận 2 bước cho thanh toán, hủy lịch, bấm SOS có đếm ngược hủy 5 giây chống bấm nhầm nhưng không làm chậm gửi cảnh báo thật | Đề xuất — cần PO duyệt vì chạm vào BR-23 |

## NFR-08 — Tương thích & điều kiện thực địa

| Mã | Yêu cầu | Chỉ tiêu đề xuất | Căn cứ |
|---|---|---|---|
| NFR-08.1 | Nền tảng | App BN/ĐD: Android 10+ và iOS 15+; web admin: 2 phiên bản trình duyệt gần nhất (Chrome/Edge/Safari) | Đề xuất |
| NFR-08.2 | Mạng yếu & mất sóng | App điều dưỡng hoạt động được ở 3G chập chờn: check-in và nháp báo cáo lưu cục bộ, tự đồng bộ khi có mạng; xung đột đồng bộ hiển thị cho Quản trị BV hậu kiểm | Đề xuất — đặc tả chưa có, cần PO xác nhận phạm vi offline |
| NFR-08.3 | Định vị | Độ chính xác geofence check-in chấp nhận sai số GPS đô thị (bán kính cấu hình, mặc định theo BR-07); có đường check-in dự phòng khi GPS không khả dụng | BR-07 + đề xuất |

## NFR-09 — Bảo trì, kiểm thử & vận hành

| Mã | Yêu cầu | Chỉ tiêu đề xuất | Căn cứ |
|---|---|---|---|
| NFR-09.1 | Kiểm thử tự động | Lớp logic tiền (BR-04/BR-18), vi phạm (BR-01/BR-02) và phân quyền (BR-09) có test tự động bao phủ ≥ 80% nhánh quyết định; chạy trong CI trước mỗi merge | Đề xuất |
| NFR-09.2 | Cấu hình thay vì code | Mọi ngưỡng/phí/thời hạn trong BR là cấu hình có ngày hiệu lực (FR-10.1/10.2) — thay đổi nghiệp vụ thông thường không cần triển khai lại code | Theo đặc tả |
| NFR-09.3 | Quan trắc | Log có cấu trúc, dashboard sức khỏe hệ thống, cảnh báo tự động khi: hàng đợi hẹn giờ tồn đọng, webhook thất bại, tỷ lệ email OTP thất bại tăng, SOS chưa xác nhận quá 5 phút | BR-18, BR-23 + đề xuất |
| NFR-09.4 | Môi trường | Tách dev / staging / production; staging dùng dữ liệu giả lập, tuyệt đối không dùng dữ liệu bệnh nhân thật | Đề xuất |
| NFR-09.5 | Tài liệu vận hành | Runbook cho 4 sự cố chuẩn: cổng thanh toán lỗi (F8), AI ngừng (BR-10), SOS không ai xác nhận (BR-23), chênh lệch đối soát (F7) | Theo đặc tả |

---

## Các quyết định cần chốt riêng cho NFR

1. **NFR-02.1** — Mức uptime cam kết với bệnh viện pilot (99,9% là đề xuất; tăng lên 99,95% sẽ đổi chi phí hạ tầng).
2. **NFR-02.2** — RPO/RTO chính thức và ngân sách sao lưu.
3. **NFR-04.2** — Vị trí lưu dữ liệu & đánh giá chuyển dữ liệu xuyên biên giới (gắn với Q-14, chờ pháp chế).
4. **NFR-08.2** — Phạm vi offline của app điều dưỡng: đặc tả hiện chưa có; nếu không làm, phải chấp nhận rủi ro mất check-in/báo cáo khi mất sóng.
5. **NFR-07.4** — Cơ chế chống bấm nhầm SOS (chạm vào trải nghiệm BR-23, cần PO duyệt).

*Các FR/NFR trên không thay thế UC/BR trong hai file sơ đồ baseline. Khi có mâu thuẫn, thứ tự ưu tiên: BR (use_case_v8.1) → luồng (8.14) → tài liệu này.*
