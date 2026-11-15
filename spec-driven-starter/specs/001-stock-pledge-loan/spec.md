# Feature Specification: Cầm cố cổ phiếu vay tiền, tính lãi hằng ngày

**Feature Branch**: `001-stock-pledge-loan`

**Created**: 2026-11-15

**Status**: Approved

**Input**: User description: "App cầm cố cổ phiếu để vay tiền, tính lãi hằng ngày"

## Clarifications

### Session 2026-11-15

- Q: Lãi suất năm mà nhân viên được nhập tối đa là bao nhiêu? → A: Tối đa 20%/năm theo Bộ luật Dân sự 2015, Điều 468; nhập vượt mức thì bị chặn.
- Q (từ input của `speckit-plan`): Khách dùng app trên nền tảng nào? → A: Web và app mobile (iOS/Android). Nhân viên dùng web.
- Q (từ input của `speckit-plan`): Đăng nhập thế nào? → A: Chỉ email + mật khẩu, sau đó nhập mã OTP gửi qua email (xác thực 2 bước) ở mỗi lần đăng nhập.
- Q (từ input của `speckit-plan`): Quy mô? → A: 500.000 người dùng hoạt động mỗi tháng.
- Q (sau `speckit-analyze`): Thông số bảo mật đăng nhập? → A: Đồng ý FR-015 như đề xuất, thêm phiên đăng nhập hết hạn sau 30 ngày không hoạt động.
- Q (sau `speckit-analyze`): Giới hạn dữ liệu nhập? → A: Đồng ý danh sách giới hạn, ghi vào FR-004.
- Q (sau `speckit-analyze`): Ngày giải ngân được lùi về trước bao xa? → A: Từ ngày khách gửi yêu cầu đến hôm nay.
- Q (sau `speckit-analyze`): Khách đổi thông tin ở yêu cầu sau thì hợp đồng cũ thế nào? → A: Mỗi khoản vay lưu bản sao thông tin người vay lúc gửi yêu cầu; hợp đồng cũ không đổi.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Khách đăng ký vay online, nhân viên duyệt và giải ngân (Priority: P1)

Khách hàng tự tạo tài khoản, đăng nhập và gửi yêu cầu vay: danh sách cổ phiếu muốn cầm cố (mã, số lượng) và số tiền muốn vay. App định giá tài sản theo giá tham chiếu hiện tại, cho khách thấy hạn mức tối đa và chặn yêu cầu vượt hạn mức. Yêu cầu hợp lệ ở trạng thái "Chờ duyệt". Nhân viên bên cho vay xem yêu cầu, xác minh khách và cổ phiếu (ngoài app), rồi duyệt kèm lãi suất và ngày giải ngân (hợp đồng chuyển "Đang vay") hoặc từ chối kèm lý do (chuyển "Từ chối").

**Why this priority**: Không có khoản vay thì không có gì để tính lãi. Đây là lõi của sản phẩm.

**Independent Test**: Khách gửi yêu cầu với 1 mã cổ phiếu, nhân viên duyệt; kiểm tra hợp đồng lưu đúng giá trị tài sản, số tiền gốc, lãi suất, ngày giải ngân và trạng thái.

**Acceptance Scenarios**:

1. **Given** giá tham chiếu mã ABC là 20.000 đ/cp, **When** khách gửi yêu cầu cầm cố 1.000 cp ABC (tài sản 20.000.000 đ, hạn mức 10.000.000 đ) và vay 10.000.000 đ, **Then** yêu cầu được tạo ở trạng thái "Chờ duyệt".
2. **Given** cùng tài sản như trên, **When** khách xin vay 10.000.001 đ, **Then** app từ chối và báo hạn mức tối đa là 10.000.000 đ.
3. **Given** yêu cầu "Chờ duyệt", **When** nhân viên duyệt với lãi suất 12%/năm và ngày giải ngân D, **Then** hợp đồng chuyển "Đang vay" và bắt đầu tính lãi từ ngày D.
4. **Given** yêu cầu "Chờ duyệt", **When** nhân viên từ chối kèm lý do, **Then** hợp đồng chuyển "Từ chối", khách thấy lý do, không tính lãi.
5. **Given** form yêu cầu vay, **When** nhập số lượng cổ phiếu ≤ 0 hoặc không nguyên, số tiền vay ≤ 0, hoặc mã cổ phiếu chưa có giá tham chiếu, **Then** app từ chối và báo trường nào sai.
6. **Given** yêu cầu "Chờ duyệt", **When** nhân viên duyệt với lãi suất 20%/năm, **Then** được chấp nhận; **When** nhập 20,01%/năm hoặc 0%/năm, **Then** app từ chối và báo lãi suất phải lớn hơn 0 và không vượt 20%/năm (Bộ luật Dân sự 2015, Điều 468).
7. **Given** khách A đã đăng nhập, **When** cố xem khoản vay của khách B, **Then** app từ chối truy cập.
8. **Given** yêu cầu "Chờ duyệt" được gửi ngày R, **When** nhân viên duyệt với ngày giải ngân trước R hoặc sau hôm nay, **Then** app từ chối và báo khoảng ngày hợp lệ.

---

### User Story 2 - Xem lãi cộng dồn theo ngày (Priority: P1)

Khách (với khoản vay của mình) hoặc nhân viên (với mọi khoản vay) mở một khoản vay đang hoạt động và thấy: số ngày đã vay, lãi mỗi ngày, tổng lãi cộng dồn đến hôm nay (hoặc đến một ngày được chọn), và tổng số tiền phải trả nếu tất toán vào ngày đó.

**Why this priority**: "Tính lãi hằng ngày" là yêu cầu chính của người dùng; sai lãi là sai sản phẩm.

**Independent Test**: Với một khoản vay có gốc, lãi suất và ngày giải ngân cố định, chọn một ngày tính lãi và so tổng lãi với kết quả tính tay theo công thức ở FR-005.

**Acceptance Scenarios**:

1. **Given** khoản vay gốc 10.000.000 đ, lãi suất 12%/năm, giải ngân ngày D, **When** xem lãi tại ngày D + 30, **Then** số ngày tính lãi = 30, tổng lãi = 98.630 đ (10.000.000 × 12% × 30 ÷ 365 = 98.630,13 → làm tròn xuống), tổng phải trả = 10.098.630 đ.
2. **Given** khoản vay giải ngân ngày D, **When** xem lãi tại chính ngày D, **Then** số ngày tính lãi = 0, tổng lãi = 0 đ.
3. **Given** khoản vay gốc 10.000.000 đ, lãi suất 12%/năm, giải ngân 2028-01-01 (năm nhuận), **When** xem lãi tại 2029-01-01, **Then** số ngày = 366, tổng lãi = 1.203.287 đ (10.000.000 × 12% × 366 ÷ 365 = 1.203.287,67 → làm tròn xuống).
4. **Given** một khoản vay, **When** chọn ngày tính lãi trước ngày giải ngân, **Then** app từ chối và báo lỗi.

---

### User Story 3 - Tất toán khoản vay và trả lại cổ phiếu (Priority: P2)

Người vay trả hết gốc và lãi (việc chuyển tiền diễn ra ngoài app). Nhân viên chọn ngày tất toán, app tính số tiền phải trả (gốc + lãi cộng dồn đến ngày đó), ghi nhận đã thu, chuyển hợp đồng sang "Đã tất toán" và đánh dấu cổ phiếu được giải chấp (trả lại người vay).

**Why this priority**: Đóng vòng đời khoản vay; cần sau khi đã tạo và tính lãi được.

**Independent Test**: Tạo khoản vay, tất toán ở một ngày cụ thể, kiểm tra số tiền phải trả, trạng thái hợp đồng và trạng thái cổ phiếu.

**Acceptance Scenarios**:

1. **Given** khoản vay "Đang vay", **When** tất toán vào ngày T với số tiền thu đúng bằng gốc + lãi đến ngày T, **Then** hợp đồng chuyển "Đã tất toán", cổ phiếu chuyển "Đã giải chấp", lãi ngừng cộng dồn.
2. **Given** khoản vay "Đang vay", **When** số tiền thu nhỏ hơn tổng phải trả, **Then** app từ chối tất toán và báo số tiền còn thiếu.
3. **Given** khoản vay "Đã tất toán", **When** cố tất toán lại, **Then** app từ chối.

---

### User Story 4 - Cảnh báo khi giá cổ phiếu giảm (Priority: P3)

Nhân viên cập nhật giá tham chiếu mới cho các mã cổ phiếu. App tính lại giá trị tài sản cầm cố của từng khoản vay "Đang vay" và đánh dấu "Cảnh báo" những khoản có dư nợ (gốc + lãi cộng dồn) ≥ 70% giá trị tài sản. Cảnh báo chỉ để hiển thị, không tự động xử lý tài sản.

**Why this priority**: Bảo vệ bên cho vay khi thị trường giảm, nhưng không chặn MVP.

**Independent Test**: Tạo khoản vay, hạ giá tham chiếu của mã cổ phiếu, kiểm tra khoản vay bị đánh dấu cảnh báo đúng ngưỡng.

**Acceptance Scenarios**:

1. **Given** khoản vay gốc 10.000.000 đ, lãi cộng dồn 0 đ, cầm cố 1.000 cp ABC, **When** cập nhật giá ABC xuống 14.285 đ (tài sản 14.285.000 đ, tỷ lệ 70,005%), **Then** khoản vay hiện trong danh sách cảnh báo kèm tỷ lệ hiện tại.
2. **Given** cùng khoản vay, **When** cập nhật giá ABC lên 14.286 đ (tỷ lệ 69,998%), **Then** khoản vay không bị cảnh báo.
3. **Given** khoản vay đang bị cảnh báo, **When** giá tăng trở lại dưới ngưỡng, **Then** cảnh báo được gỡ.

---

### Edge Cases

- Vay và tất toán trong cùng ngày giải ngân: 0 ngày, lãi 0 đ.
- Khoản vay kéo dài qua năm nhuận: số ngày tính theo lịch thực tế, mẫu số luôn là 365.
- Giá cổ phiếu thay đổi giữa lúc khách gửi yêu cầu và lúc nhân viên duyệt: hạn mức được kiểm tra lại theo giá tại lúc duyệt; vượt hạn mức thì không cho duyệt.
- Dư nợ tăng dần theo lãi nên khoản vay có thể chuyển sang "Cảnh báo" dù giá không đổi; trạng thái cảnh báo được tính lại mỗi khi xem.
- Một khoản vay cầm cố nhiều mã cổ phiếu khác nhau (tối đa 20 mã, không trùng mã).
- Khách gửi yêu cầu mới với họ tên/số giấy tờ/số điện thoại khác: khoản vay mới dùng thông tin mới; các khoản vay cũ giữ nguyên thông tin đã lưu.
- Lãi suất đúng bằng 20%/năm: hợp lệ; lớn hơn 20%/năm dù chỉ 0,01%: bị từ chối.
- Số tiền lãi lẻ dưới 1 đồng: làm tròn xuống (FR-005).
- Cập nhật giá cho mã cổ phiếu không thuộc khoản vay nào: lưu giá, không ảnh hưởng gì.
- Khoản vay đã tất toán không được sửa và không bị tính lãi thêm.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-000**: App MUST có 2 vai trò: **Khách hàng** (tự đăng ký tài khoản, chỉ thấy khoản vay của mình) và **Nhân viên** (do bên cho vay cấp tài khoản, thấy mọi khoản vay, duyệt/từ chối, tất toán, cập nhật giá).
- **FR-001**: Khách hàng MUST gửi được yêu cầu vay gồm: thông tin người vay (họ tên, số giấy tờ tùy thân, số điện thoại), danh sách cổ phiếu cầm cố (mã, số lượng), số tiền muốn vay. Giá tham chiếu lấy từ giá do nhân viên cập nhật (FR-008). Yêu cầu hợp lệ có trạng thái "Chờ duyệt".
- **FR-001a**: Nhân viên MUST duyệt được yêu cầu "Chờ duyệt" kèm lãi suất (%/năm) và ngày giải ngân → "Đang vay"; hoặc từ chối kèm lý do → "Từ chối". Lúc duyệt, hạn mức FR-003 MUST được kiểm tra lại theo giá hiện tại.
- **FR-002**: Giá trị tài sản cầm cố MUST bằng tổng (số lượng × giá tham chiếu) của mọi mã trong khoản vay.
- **FR-003**: Số tiền gốc tối đa MUST bằng giá trị tài sản × 50%, làm tròn xuống đến đồng. Vượt mức MUST bị từ chối. Ngưỡng cảnh báo là dư nợ (gốc + lãi cộng dồn) ≥ 70% giá trị tài sản; khi vượt ngưỡng app chỉ hiển thị cảnh báo, không tự động xử lý tài sản.
- **FR-004**: Mọi dữ liệu nhập MUST được kiểm tra:
  - Số lượng cổ phiếu là số nguyên dương; giá, số tiền gốc là số nguyên dương.
  - Lãi suất (%/năm) lớn hơn 0 và không vượt 20%/năm (trần theo Bộ luật Dân sự 2015, Điều 468), tối đa 2 chữ số thập phân.
  - Ngày giải ngân nằm trong khoảng từ ngày khách gửi yêu cầu đến hôm nay (giờ Việt Nam).
  - Mã cổ phiếu gồm đúng 3 ký tự chữ in hoa hoặc chữ số; mỗi yêu cầu vay có 1–20 mã, không trùng mã.
  - Họ tên 1–100 ký tự; số giấy tờ tùy thân 9–12 chữ số; số điện thoại 10 chữ số, bắt đầu bằng 0.
  - Lý do từ chối 1–500 ký tự.
  - Mỗi lần cập nhật giá có 1–500 mã.
- **FR-005**: Lãi MUST được tính đơn (không nhập lãi vào gốc) trên số tiền gốc:
  - Lãi suất nhập theo %/năm.
  - Số ngày tính lãi = ngày tính − ngày giải ngân (không tính ngày tất toán; vay và trả cùng ngày = 0 ngày).
  - Tổng lãi = gốc × lãi suất năm × số ngày ÷ 365, tính chính xác rồi **làm tròn xuống đến đồng một lần ở cuối** (không cộng các khoản lãi ngày đã làm tròn). Mẫu số luôn là 365, kể cả năm nhuận.
  - "Lãi mỗi ngày" hiển thị = gốc × lãi suất năm ÷ 365, làm tròn xuống đến đồng, chỉ để tham khảo.
- **FR-006**: App MUST hiển thị cho mỗi khoản vay "Đang vay": số ngày tính lãi, lãi mỗi ngày, tổng lãi cộng dồn và tổng phải trả tính đến ngày được chọn (mặc định hôm nay).
- **FR-007**: App MUST cho phép tất toán khi số tiền thu ≥ gốc + lãi cộng dồn đến ngày tất toán; sau tất toán hợp đồng chuyển "Đã tất toán", cổ phiếu chuyển "Đã giải chấp", và lãi ngừng tính.
- **FR-008**: App MUST cho phép cập nhật giá tham chiếu theo mã cổ phiếu và tính lại giá trị tài sản, tỷ lệ dư nợ / tài sản của các khoản vay đang hoạt động.
- **FR-009**: App MUST liệt kê các khoản vay có tỷ lệ dư nợ / tài sản vượt ngưỡng cảnh báo ở FR-003.
- **FR-010**: App MUST hiển thị danh sách khoản vay, lọc được theo trạng thái ("Chờ duyệt", "Từ chối", "Đang vay", "Đã tất toán", "Cảnh báo"). Nhân viên thấy mọi khoản vay; khách chỉ thấy khoản vay của mình.
- **FR-011**: Mọi số tiền MUST là số nguyên đồng (VND), không có phần lẻ thập phân khi lưu và hiển thị.
- **FR-012**: Các thao tác sau MUST được ghi nhật ký (ai, làm gì, lúc nào, kết quả): gửi yêu cầu vay, duyệt, từ chối, tất toán, cập nhật giá, đăng nhập thành công/thất bại, nhập sai OTP, tạo tài khoản nhân viên.
- **FR-013**: Người dùng MUST đăng nhập trước khi thao tác. Khách hàng MUST NOT xem hoặc thao tác được khoản vay của khách khác.
- **FR-014**: Đăng nhập MUST chỉ dùng email + mật khẩu, rồi xác thực bước 2 bằng mã OTP gửi về email đó. Không có đăng nhập bằng mạng xã hội hay số điện thoại. Khi khách đăng ký, email MUST được xác minh bằng OTP trước khi gửi yêu cầu vay.
- **FR-015**: Thông số bảo mật đăng nhập (người dùng đã xác nhận 2026-11-15): OTP gồm 6 chữ số, hiệu lực 5 phút, dùng 1 lần; nhập sai 5 lần thì OTP bị huỷ; gửi lại OTP sau tối thiểu 60 giây; mật khẩu tối thiểu 8 ký tự; phiên đăng nhập hết hạn sau 30 ngày không hoạt động, đăng xuất thì hết hiệu lực ngay.
- **FR-016**: Khách hàng MUST dùng được mọi chức năng của mình (đăng ký, đăng nhập, gửi yêu cầu vay, xem khoản vay và lãi) trên cả web lẫn app mobile iOS/Android với kết quả giống nhau. Chức năng nhân viên chỉ cần trên web.

### Key Entities

- **Người vay**: họ tên, số giấy tờ tùy thân, số điện thoại (thông tin mới nhất, dùng để điền sẵn form). Một người vay có thể có nhiều khoản vay.
- **Tài khoản**: vai trò (Khách hàng / Nhân viên), thông tin đăng nhập. Tài khoản khách gắn với một Người vay.
- **Khoản vay (Hợp đồng)**: số tiền gốc, lãi suất, ngày giải ngân, ngày tất toán (nếu có), trạng thái (Chờ duyệt / Từ chối / Đang vay / Đã tất toán), lý do từ chối (nếu có), nhân viên duyệt, người vay, **bản sao** họ tên/số giấy tờ/số điện thoại tại lúc gửi yêu cầu (không đổi về sau), ngày gửi yêu cầu.
- **Cổ phiếu cầm cố**: mã, số lượng, trạng thái (đang cầm cố / đã giải chấp), thuộc một khoản vay.
- **Giá tham chiếu**: mã cổ phiếu, giá, ngày cập nhật. Giá mới nhất được dùng để định giá tài sản.
- **Giao dịch tất toán**: khoản vay, ngày, số tiền thu, gốc, lãi.
- **Nhật ký thao tác**: người thực hiện, hành động, thời điểm, kết quả.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Khách gửi xong một yêu cầu vay có 1–3 mã cổ phiếu trong dưới 3 phút.
- **SC-002**: 100% kết quả tính lãi khớp với tính tay theo công thức FR-005 trên bộ ví dụ mẫu (gồm cả trường hợp 0 ngày, qua năm nhuận, số tiền lẻ).
- **SC-003**: Không có khoản vay nào được tạo với số tiền gốc vượt hạn mức FR-003.
- **SC-004**: Sau khi cập nhật giá, danh sách cảnh báo phản ánh giá mới ngay khi người dùng mở lại danh sách.
- **SC-005**: App phục vụ 500.000 người dùng hoạt động mỗi tháng; 95% thao tác xem/gửi hoàn tất trong dưới 1 giây ở giờ cao điểm.
- **SC-006**: Mã OTP đến hộp thư người dùng trong vòng 1 phút ở 95% lần gửi.

## Assumptions

- Phạm vi v1 là một bên cho vay duy nhất, đơn vị tiền VND.
- Giá cổ phiếu do nhân viên nhập tay; v1 không kết nối dữ liệu sàn chứng khoán (nếu cần sẽ là feature riêng, kèm hợp đồng API theo constitution III).
- Cầm cố được ghi nhận trên app; việc phong tỏa cổ phiếu thật tại công ty chứng khoán/VSDC làm ngoài app.
- v1 chỉ hỗ trợ tất toán toàn bộ (trả hết gốc + lãi một lần). Trả lãi định kỳ, trả gốc một phần, gia hạn, phạt quá hạn và bán giải chấp cổ phiếu nằm ngoài phạm vi v1.
- Không có kỳ hạn cố định trong v1: lãi cộng dồn cho đến khi tất toán.
- Lãi suất do nhân viên nhập riêng cho từng khoản vay lúc duyệt (không phải một mức chung cho cả hệ thống).
- Xác minh danh tính khách (eKYC) và xác minh quyền sở hữu cổ phiếu do nhân viên làm ngoài app; app chỉ ghi nhận kết quả duyệt/từ chối.
- Giải ngân và thu tiền diễn ra ngoài app (chuyển khoản); app chỉ ghi nhận.
- Bên cho vay không phải tổ chức tín dụng, nên áp dụng trần lãi suất 20%/năm của Bộ luật Dân sự 2015 (Điều 468). Nếu sau này bên cho vay là tổ chức tín dụng thì phải cập nhật spec.
