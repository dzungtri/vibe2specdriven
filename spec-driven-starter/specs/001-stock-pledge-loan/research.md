# Research: Cầm cố cổ phiếu vay tiền, tính lãi hằng ngày

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-15

Ràng buộc do người dùng chọn (input của `speckit-plan`): AWS, TypeScript cả frontend lẫn backend,
web React + shadcn/ui, mobile React Native, đăng nhập email/mật khẩu + OTP qua email,
500.000 người dùng/tháng. Các quyết định dưới đây lấp phần còn lại.

## R1. Biểu diễn tiền và lãi suất (constitution II: không dùng số thực)

- **Decision**: Tiền là số nguyên VND. Lãi suất lưu theo **basis point** (1 bp = 0,01%; 12%/năm = 1200 bp,
  trần 20%/năm = 2000 bp). Trong code tính toán dùng `bigint` của TypeScript; trong PostgreSQL dùng `BIGINT`.
  - Tổng lãi (FR-005) = `floor(gốc × bp × số_ngày / 3_650_000)`. Phép chia nguyên trên `bigint` đã làm tròn xuống
    vì mọi giá trị đều không âm.
  - Hạn mức (FR-003) = `floor(giá_trị_tài_sản × 50 / 100)`.
  - Cảnh báo (FR-003, FR-009): `dư_nợ × 100 >= giá_trị_tài_sản × 70`, so sánh số nguyên, không chia.
- **Rationale**: Không có sai số làm tròn ở giữa phép tính; kết quả khớp tính tay (SC-002). Lãi suất nhập tối đa 2 chữ số
  thập phân (vd 12,5%) được biểu diễn đúng bằng bp.
- **Alternatives considered**: `number` + làm tròn (sai số dấu phẩy động, vi phạm constitution II);
  thư viện decimal.js (thêm phụ thuộc, không cần vì mọi phép tính đều là nhân/chia nguyên).

## R2. Ngày và múi giờ

- **Decision**: Mọi "ngày" nghiệp vụ (giải ngân, tính lãi, tất toán) là ngày lịch theo múi giờ `Asia/Ho_Chi_Minh`,
  lưu kiểu `DATE`. Số ngày = hiệu hai ngày lịch. "Hôm nay" được tính phía server theo múi giờ này.
- **Rationale**: Tránh lệch một ngày khi server chạy UTC (giữa 00:00 và 07:00 giờ Việt Nam).
- **Alternatives considered**: Lưu timestamp UTC rồi tính ngày (dễ sai biên ngày).

## R3. Kiến trúc tổng thể

- **Decision**: Monorepo **pnpm workspaces** gồm 3 app + 1 package dùng chung + 1 hạ tầng:
  `apps/api` (REST API), `apps/web` (web cho khách và nhân viên), `apps/mobile` (app cho khách),
  `packages/domain` (logic nghiệp vụ thuần + schema kiểm tra dữ liệu), `infra/` (AWS CDK).
  API là **một service duy nhất** (modular monolith), không chia microservice.
- **Rationale**: Logic tiền chỉ viết một lần trong `packages/domain`, có test một lần, rồi web, mobile và API cùng dùng
  (constitution I, II). Một service thì dễ hiểu và dễ chạy local (constitution V).
- **Alternatives considered**: Microservices (quá phức tạp so với nhu cầu); repo riêng cho từng app
  (lặp code nghiệp vụ, dễ lệch công thức).

## R4. Backend

- **Decision**: Node.js 22 LTS + **Fastify 5** + **Zod** (kiểm tra dữ liệu, dùng chung schema với client) +
  **Prisma** (ORM, migration) + PostgreSQL 16. Mật khẩu băm bằng **argon2id** (`@node-rs/argon2`).
- **Rationale**: Fastify nhẹ, có sẵn `inject()` để test không cần mở cổng; Prisma có tài liệu tốt cho người mới,
  migration rõ ràng; argon2id là khuyến nghị của OWASP cho băm mật khẩu.
- **Alternatives considered**: NestJS (nhiều tầng trừu tượng, khó cho sinh viên); Express (cũ hơn, thiếu typing tốt);
  Drizzle/Kysely (tốt nhưng ít tài liệu cho người mới hơn Prisma); bcrypt (vẫn ổn, nhưng argon2id mới hơn).

## R5. Phiên đăng nhập cho cả web và mobile

- **Decision**: Đăng nhập 2 bước: (1) email + mật khẩu đúng → server gửi OTP và trả `challengeId`;
  (2) nhập đúng OTP → tạo **session token ngẫu nhiên** (32 byte), DB chỉ lưu hash SHA-256 của token.
  Web nhận token qua cookie `HttpOnly; Secure; SameSite=Lax`; mobile nhận qua body và lưu trong `expo-secure-store`,
  gửi lên bằng header `Authorization: Bearer`. API chấp nhận cả hai cách.
  Session hết hạn sau 30 ngày không hoạt động, đăng xuất thì xoá session.
- **Rationale**: Session trong DB thu hồi được ngay (đăng xuất, khoá tài khoản), đơn giản hơn JWT + refresh token.
- **Alternatives considered**: JWT (khó thu hồi, cần refresh token); Amazon Cognito (bỏ được code xác thực nhưng
  luồng OTP qua email cần custom auth Lambda, khó test local, khó cho sinh viên).
- **Lưu ý**: Thời hạn session 30 ngày đã được người dùng xác nhận và ghi vào FR-015 (2026-11-15).

## R6. Gửi email OTP

- **Decision**: **Amazon SES v2** (`@aws-sdk/client-sesv2`), đặt sau interface `EmailSender`. Local và test dùng
  `FakeEmailSender` (ghi OTP vào bộ nhớ/log) và Mailpit khi chạy thủ công. Hợp đồng ở
  [contracts/email-otp.md](./contracts/email-otp.md) (constitution III).
- **Rationale**: Dịch vụ email có sẵn của AWS, rẻ, đạt SC-006. Interface giúp test không cần mạng.
- **Alternatives considered**: SendGrid/Mailgun (thêm nhà cung cấp ngoài AWS).
- **Rủi ro**: Tài khoản SES mới ở chế độ sandbox; phải xin production access và xác minh domain (SPF, DKIM, DMARC)
  trước khi chạy thật.

## R7. Web frontend

- **Decision**: **Vite** + React 19 + TypeScript + **shadcn/ui** (Tailwind CSS) + **TanStack Query** (gọi API)
  + **React Router** + **React Hook Form** dùng resolver Zod từ `packages/domain`. Một app web, phân màn hình theo vai trò.
- **Rationale**: Không cần render phía server cho app có đăng nhập, nên Vite đơn giản hơn Next.js;
  build ra file tĩnh đặt lên S3 + CloudFront.
- **Alternatives considered**: Next.js (cần server, thừa); 2 app web riêng cho khách và nhân viên (lặp code, YAGNI).

## R8. Mobile

- **Decision**: **Expo** (React Native, managed workflow) + Expo Router + TanStack Query + `expo-secure-store`;
  build và phát hành bằng **EAS Build**. App mobile chỉ có chức năng của khách (FR-016).
  shadcn/ui không chạy trên React Native, nên mobile dùng component React Native cơ bản, thống nhất màu và chữ với web.
- **Rationale**: Expo là cách chính thức React Native khuyến nghị để bắt đầu; không cần Xcode/Android Studio
  cho phần lớn công việc.
- **Alternatives considered**: React Native CLI thuần (cấu hình native phức tạp); NativeWind/React Native Reusables
  (giống shadcn hơn, nhưng thêm phụ thuộc mà spec không yêu cầu).

## R9. Hạ tầng AWS và ước lượng tải (SC-005)

- **Ước lượng**: 500.000 người dùng/tháng × khoảng 10 phiên × khoảng 20 request/phiên ≈ 100 triệu request/tháng
  ≈ 40 request/giây trung bình. Lấy hệ số cao điểm ×5 thì cần khoảng **200 request/giây**. Đây là tải vừa phải.
- **Decision** (Region `ap-southeast-1` Singapore, viết bằng **AWS CDK TypeScript**):
  - API: **ECS Fargate** sau **Application Load Balancer**; 2 task (0,5 vCPU / 1 GB), tự giãn 2–6 task theo CPU.
  - DB: **RDS PostgreSQL 16** Multi-AZ (`db.t4g.medium`), backup tự động 7 ngày.
  - Web: **S3 + CloudFront**.
  - Email: **SES**. Bí mật: **Secrets Manager**. Log và metric: **CloudWatch**.
  - Chống dò mật khẩu/OTP: **AWS WAF** có rule giới hạn tần suất theo IP trên ALB; ngoài ra có bộ đếm số lần sai OTP trong DB (FR-015).
- **Rationale**: Container chạy server Fastify bình thường, local và cloud giống nhau, dễ debug. Tải khoảng 200 request/giây
  vừa sức 2–6 task nhỏ cộng một Postgres cỡ trung.
- **Alternatives considered**: Lambda + API Gateway (cold start, kết nối Postgres cần RDS Proxy, khó chạy local giống thật);
  EKS (quá phức tạp); DynamoDB (dữ liệu tiền có quan hệ và cần giao dịch, Postgres hợp hơn).
- **Rủi ro pháp lý (cần người dùng kiểm tra)**: AWS chưa có region tại Việt Nam. Nghị định 13/2023 (bảo vệ dữ liệu cá nhân)
  và Nghị định 53/2022 có thể đặt yêu cầu khi lưu hoặc chuyển dữ liệu cá nhân ra nước ngoài (số giấy tờ tùy thân).
  Plan giả định bên cho vay đã hoặc sẽ làm hồ sơ đánh giá tác động chuyển dữ liệu; nếu không được thì phải đổi nơi lưu trữ.

## R10. Danh sách cảnh báo (FR-009) ở quy mô lớn

- **Decision**: Khi mở danh sách cảnh báo, API đọc các khoản "Đang vay" kèm cổ phiếu và giá mới nhất, rồi tính dư nợ và
  tỷ lệ bằng **chính hàm trong `packages/domain`**. Không viết lại công thức bằng SQL.
- **Rationale**: Chỉ có một nguồn công thức (constitution I). Với khoảng 50.000 khoản đang vay thì đọc theo lô và tính trong
  Node mất dưới 1 giây.
- **Ngưỡng xem lại**: trên 200.000 khoản đang vay, hoặc màn hình cảnh báo chậm hơn 1 giây, thì cân nhắc lưu sẵn tỷ lệ
  (cập nhật khi đổi giá và chạy lại hằng ngày).

## R11. Kiểm thử (constitution II)

- **Decision**: **Vitest** cho `packages/domain`, `apps/api`, `apps/web`; **jest-expo** + React Native Testing Library
  cho `apps/mobile`. Test tích hợp API chạy với PostgreSQL thật qua `docker compose`. Test hợp đồng email dùng
  `FakeEmailSender` và mock SES client. Mỗi kịch bản Given/When/Then trong spec có ít nhất một test, đặt tên theo mã
  kịch bản (vd `US2-AS3`).
- **Alternatives considered**: SQLite cho test (khác Postgres ở kiểu `DATE`/`BIGINT`, dễ che lỗi).

## R12. Đồng thời và toàn vẹn

- **Decision**: Chuyển trạng thái bằng câu lệnh có điều kiện (`UPDATE ... WHERE id = ? AND status = 'PENDING'`)
  trong transaction; nếu 0 dòng bị ảnh hưởng thì trả `409 CONFLICT`. Tránh duyệt hai lần hoặc tất toán hai lần.
- **Rationale**: Đơn giản, không cần khoá phân tán.
