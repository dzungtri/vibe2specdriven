<!--
Sync Impact Report
- Version change: (template, chưa điền) → 1.0.0
- Modified principles: thay 5 placeholder bằng:
  I. Quy tắc nghiệp vụ lấy từ spec
  II. Test trước (KHÔNG THƯƠNG LƯỢNG)
  III. Hợp đồng API trước khi tích hợp
  IV. Bảo mật cơ bản
  V. Đơn giản trước
- Added sections: Ràng buộc kỹ thuật; Quy trình phát triển & cổng chất lượng; Governance
- Removed sections: không có
- Templates: không sửa (template đọc constitution lúc chạy)
- Follow-up TODOs: không có
-->

# spec-driven-starter Constitution

Dự án của sinh viên: ưu tiên **đơn giản, dễ hiểu, dễ kiểm chứng**. Mọi spec, plan, tasks và code
trong repo phải tuân theo các nguyên tắc dưới đây.

## Core Principles

### I. Quy tắc nghiệp vụ lấy từ spec

- Mọi quy tắc nghiệp vụ (số tiền, lãi suất, phí, hạn mức, thời hạn, làm tròn, ngưỡng) MUST được
  ghi rõ trong `spec.md` của feature trước khi xuất hiện trong plan hoặc code.
- Agent và lập trình viên MUST NOT tự đặt hoặc "đoán" giá trị nghiệp vụ, kể cả làm giá trị mặc định.
- Chỗ nào spec chưa rõ MUST đánh dấu `[NEEDS CLARIFICATION: …]` và giải quyết qua
  `speckit-clarify` trước khi sang `speckit-plan`.
- Hằng số nghiệp vụ trong code SHOULD có chú thích trỏ về mục FR tương ứng trong spec.

Lý do: sai một con số nghiệp vụ là sai sản phẩm; nguồn sự thật duy nhất phải là spec đã được
người dùng duyệt.

### II. Test trước (KHÔNG THƯƠNG LƯỢNG)

- Mỗi kịch bản Given/When/Then trong spec MUST có ít nhất một test tự động tương ứng.
- Mọi phép tính liên quan đến tiền (lãi, phí, tổng, làm tròn, chia kỳ) MUST có test, bao gồm cả
  trường hợp biên (0, giá trị tối đa, làm tròn, dữ liệu không hợp lệ).
- Test MUST được viết trước và chạy đỏ trước khi viết code cho nó (Red → Green → Refactor).
- MUST NOT sửa hoặc xoá test chỉ để cho pass; nếu test sai thì sửa spec trước, rồi mới sửa test.
- Tiền MUST được biểu diễn bằng kiểu chính xác (số nguyên đơn vị nhỏ nhất hoặc decimal),
  không dùng số thực dấu phẩy động.

Lý do: test là spec chạy được; với tiền, sai số nhỏ cũng là lỗi.

### III. Hợp đồng API trước khi tích hợp

- Mọi tích hợp với hệ thống ngoài (API bên thứ ba, dịch vụ thanh toán, email, hệ thống trường…)
  MUST có hợp đồng ghi trong `specs/<NNN-feature>/contracts/` trước khi viết code tích hợp.
- Hợp đồng MUST nêu: endpoint/thao tác, dữ liệu vào/ra, mã lỗi, và hành vi khi hệ thống ngoài
  lỗi hoặc chậm.
- Code tích hợp MUST có test dựa trên hợp đồng (dùng giả lập/mock của hệ thống ngoài).
- Thay đổi hợp đồng MUST cập nhật file trong `contracts/` trước, code sau.

Lý do: hệ thống ngoài nằm ngoài tầm kiểm soát; hợp đồng rõ giúp test được và đổi được.

### IV. Bảo mật cơ bản

- MUST NOT đặt mật khẩu, khoá API, token hay chuỗi kết nối trong code hoặc commit lên repo;
  dùng biến môi trường hoặc file cấu hình bị `.gitignore`, kèm file mẫu `.env.example`.
- Mọi dữ liệu đầu vào từ người dùng hoặc hệ thống ngoài MUST được kiểm tra (kiểu, khoảng giá trị,
  độ dài, định dạng) trước khi xử lý; dữ liệu không hợp lệ MUST bị từ chối với thông báo rõ ràng.
- Thao tác quan trọng (đăng nhập, thay đổi tiền/số dư, thay đổi hạn mức, xoá dữ liệu,
  thay đổi quyền) MUST được ghi nhật ký: ai, làm gì, lúc nào, kết quả.
- Nhật ký MUST NOT chứa mật khẩu, khoá hoặc dữ liệu nhạy cảm ở dạng rõ.

Lý do: lỗi bảo mật cơ bản là lỗi phổ biến nhất và dễ phòng nhất.

### V. Đơn giản trước

- Chọn công nghệ phổ biến, có tài liệu tốt, phù hợp trình độ sinh viên.
- Mỗi phụ thuộc mới MUST được nêu lý do trong `plan.md`; ưu tiên thư viện chuẩn khi đủ dùng.
- MUST NOT thêm tính năng, lớp trừu tượng hay cấu hình mà spec không yêu cầu (YAGNI).
- Code SHOULD dễ đọc hơn là "thông minh": tên rõ nghĩa, hàm ngắn, ít tầng gián tiếp.

Lý do: dự án nhỏ, người làm đang học; đơn giản thì dễ hiểu, dễ test, dễ sửa.

## Ràng buộc kỹ thuật

- Stack và kiến trúc chỉ được quyết trong `speckit-plan` và ghi vào `plan.md`, kèm phần
  "Constitution Check" đối chiếu 5 nguyên tắc trên.
- Mọi vi phạm nguyên tắc (ví dụ thêm phụ thuộc lớn) MUST được ghi trong mục
  "Complexity Tracking" của `plan.md` với lý do và phương án đơn giản hơn đã bị loại.
- Thử nghiệm nhanh làm trong `spikes/`; code từ `spikes/` MUST NOT được copy thẳng vào code chính.

## Quy trình phát triển & cổng chất lượng

- Không spec, không code: feature MUST có `spec.md`, `plan.md`, `tasks.md` trước khi implement.
- Spec đổi trước, code đổi sau.
- Cổng duyệt: người dùng duyệt spec sau `speckit-clarify`, và xem plan/analyze trước
  `speckit-implement`.
- Cổng hoàn thành: toàn bộ test pass và `speckit-converge` báo **Converged**.

## Governance

- Constitution này đứng trên mọi hướng dẫn khác trong repo; `AGENTS.md` là hướng dẫn vận hành
  chi tiết cho agent và không được mâu thuẫn với constitution.
- Sửa đổi: chạy `speckit-constitution`, ghi rõ thay đổi và lý do, người dùng duyệt trước khi áp dụng.
- Phiên bản theo semantic versioning:
  MAJOR = bỏ hoặc định nghĩa lại nguyên tắc; MINOR = thêm nguyên tắc/mục hoặc mở rộng đáng kể;
  PATCH = sửa câu chữ, làm rõ.
- Tuân thủ: `speckit-plan` (Constitution Check) và `speckit-analyze` MUST kiểm tra plan, tasks
  theo constitution; vi phạm nguyên tắc là lỗi CRITICAL cần sửa trước khi implement.

**Version**: 1.0.0 | **Ratified**: 2026-11-15 | **Last Amended**: 2026-11-15
