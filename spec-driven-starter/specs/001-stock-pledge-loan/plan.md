# Implementation Plan: Cầm cố cổ phiếu vay tiền, tính lãi hằng ngày

**Branch**: `001-stock-pledge-loan` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-stock-pledge-loan/spec.md`

## Summary

Khách đăng ký, đăng nhập (email + mật khẩu + OTP qua email) trên web hoặc mobile, gửi yêu cầu vay có cầm cố cổ phiếu
và xem lãi cộng dồn hằng ngày. Nhân viên dùng web để duyệt hoặc từ chối, cập nhật giá, theo dõi cảnh báo và tất toán.

Hướng kỹ thuật:
- Toàn bộ quy tắc tiền (FR-002, FR-003, FR-005, FR-009) nằm trong một package TypeScript thuần `packages/domain`,
  tính bằng số nguyên `bigint`. API, web và mobile cùng dùng package này.
- Một REST API Fastify với PostgreSQL chạy trên AWS (ECS Fargate, RDS, S3/CloudFront, SES).
- Web dùng React + shadcn/ui; mobile dùng Expo (React Native).

Chi tiết lý do của từng lựa chọn: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) trên Node.js 22 LTS (API, tooling); React 19 (web); React Native qua Expo SDK hiện hành (mobile)

**Primary Dependencies**:
- API: Fastify 5, Zod, Prisma, `@node-rs/argon2`, `@aws-sdk/client-sesv2`
- Web: Vite, React Router, TanStack Query, React Hook Form, shadcn/ui + Tailwind CSS
- Mobile: Expo, Expo Router, TanStack Query, `expo-secure-store`
- Infra: AWS CDK v2

**Storage**: PostgreSQL 16 (Amazon RDS Multi-AZ). Tiền `BIGINT` VND, lãi suất `INT` basis point, ngày nghiệp vụ `DATE` (Asia/Ho_Chi_Minh)

**Testing**:
- Vitest cho domain, API và web; jest-expo + React Native Testing Library cho mobile
- Test tích hợp API chạy với Postgres thật (docker compose)
- Test hợp đồng SES dùng mock

**Target Platform**:
- API: Linux container trên ECS Fargate, `ap-southeast-1`
- Web: trình duyệt hiện đại (2 phiên bản gần nhất)
- Mobile: iOS 16+ và Android 10+

**Project Type**: Web + mobile + API (monorepo pnpm)

**Performance Goals**: 500.000 người dùng/tháng, ước lượng khoảng 200 request/giây lúc cao điểm (research R9); OTP đến hộp thư trong 1 phút ở 95% lần gửi (SC-006)

**Constraints**:
- p95 < 1 giây cho thao tác xem/gửi (SC-005)
- Tiền chính xác tuyệt đối, không dùng số thực (constitution II)
- Không có bí mật trong repo (constitution IV)
- Mọi "ngày" tính theo múi giờ Việt Nam

**Scale/Scope**: khoảng 500.000 khách hoạt động mỗi tháng, ước tính khoảng 50.000 khoản vay đang hoạt động; khoảng 12 màn hình web, khoảng 7 màn hình mobile, 15 thao tác API (+ `/health`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá trước Phase 0 | Sau Phase 1 |
|---|---|---|
| **I. Quy tắc nghiệp vụ lấy từ spec** | Các con số tiền (50%, 70%, 20%/năm, chia 365, làm tròn xuống) đều có trong spec. Thông số OTP, mật khẩu, thời hạn session (FR-015) và các giới hạn dữ liệu nhập (FR-004) đã được người dùng xác nhận và ghi vào spec (2026-11-15). | ✅ PASS. Hằng số trong code phải có chú thích trỏ về FR tương ứng. |
| **II. Test trước** | Công thức tiền tách riêng trong `packages/domain`, test được không cần DB; mọi kịch bản Given/When/Then đều có test đặt tên theo mã kịch bản; tiền dùng `bigint`. | ✅ PASS: data-model liệt kê các hàm cần test, quickstart liệt kê kịch bản. |
| **III. Hợp đồng API trước khi tích hợp** | Hệ thống ngoài duy nhất là Amazon SES. | ✅ PASS: có [contracts/email-otp.md](./contracts/email-otp.md) ghi rõ mã lỗi, timeout, retry và test bằng mock. API của chính app có [contracts/openapi.yaml](./contracts/openapi.yaml). |
| **IV. Bảo mật cơ bản** | Bí mật nằm trong Secrets Manager và `.env` (gitignore) kèm `.env.example`; mọi input kiểm tra bằng Zod; mật khẩu băm argon2id; OTP và session token chỉ lưu dạng hash; có AuditLog; không ghi số giấy tờ ra log. | ✅ PASS |
| **V. Đơn giản trước** | ⚠️ 3 ứng dụng client/server, AWS và IaC phức tạp hơn mức "dự án sinh viên". Đây là yêu cầu trực tiếp của người dùng (web + mobile + AWS + 500K người dùng/tháng), xem Complexity Tracking. Các chỗ đã giữ đơn giản: một API monolith, một app web cho cả 2 vai trò, không cache, không queue, không microservice. | ✅ PASS có giải trình |

**Gate**: Không có vi phạm chưa giải trình. Spec không còn `[NEEDS CLARIFICATION]`. → Được sang Phase 0 và Phase 1.

## Project Structure

### Documentation (this feature)

```text
specs/001-stock-pledge-loan/
├── plan.md              # File này
├── research.md          # Phase 0: các quyết định kỹ thuật
├── data-model.md        # Phase 1: thực thể, trạng thái, hàm nghiệp vụ
├── quickstart.md        # Phase 1: cách chạy và kiểm chứng
├── contracts/
│   ├── openapi.yaml     # REST API dùng chung cho web và mobile
│   └── email-otp.md     # Hợp đồng với Amazon SES
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks), chưa tạo
```

### Source Code (repository root)

```text
packages/
└── domain/                    # TS thuần, không I/O. Nguồn sự thật duy nhất cho công thức tiền
    ├── src/
    │   ├── money.ts           # parse/format VND, bp ↔ %
    │   ├── dates.ts           # ngày lịch Asia/Ho_Chi_Minh, interestDays
    │   ├── loan-math.ts       # collateralValue, maxPrincipal, accruedInterest, isWarning
    │   ├── loan-status.ts     # bảng chuyển trạng thái hợp lệ
    │   └── schemas.ts         # Zod schema dùng chung (input form + API)
    └── tests/

apps/
├── api/
│   ├── prisma/schema.prisma   # + migrations/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/          # register, login, otp, session
│   │   │   ├── loans/         # request, approve, reject, settle, interest, list/warning
│   │   │   ├── prices/
│   │   │   └── audit/
│   │   ├── email/             # EmailSender, SesEmailSender, FakeEmailSender
│   │   ├── plugins/           # auth guard, error handler, request logging
│   │   └── server.ts
│   ├── scripts/seed-staff.ts
│   └── tests/
│       ├── contract/          # SES contract, OpenAPI response conformance
│       └── integration/       # theo user story, Postgres thật
├── web/
│   ├── src/
│   │   ├── components/ui/     # shadcn/ui
│   │   ├── features/          # auth, customer-loans, staff-review, staff-prices, staff-warnings, staff-settle
│   │   ├── lib/api-client.ts
│   │   └── routes/
│   └── tests/
└── mobile/
    ├── app/                   # Expo Router: (auth)/, (customer)/loans, request
    ├── src/lib/api-client.ts
    └── tests/

infra/
└── lib/                       # CDK stacks: network, database, api (ECS+ALB+WAF), web (S3+CloudFront), email (SES)

docker-compose.yml             # postgres + mailpit cho local và test
.env.example
pnpm-workspace.yaml
```

**Structure Decision**: Monorepo pnpm gồm `packages/domain`, `apps/api`, `apps/web`, `apps/mobile` và `infra`.
`packages/domain` là nơi duy nhất chứa công thức tiền; ba app không tự tính lại.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 3 app (api, web, mobile) + 1 package dùng chung | Người dùng yêu cầu web + mobile (FR-016) và TypeScript ở cả hai phía | Chỉ làm web responsive: trái yêu cầu rõ ràng là có app mobile React Native |
| Hạ tầng AWS nhiều dịch vụ (ECS, RDS, ALB, WAF, S3, CloudFront, SES) + CDK | Người dùng chọn AWS; 500K người dùng/tháng cần DB Multi-AZ, tự giãn và chống dò mật khẩu | Một VM EC2 chạy tất cả: không có HA, phải tự vá; Lambda: khó chạy local giống thật và cần RDS Proxy (research R9) |
| Xác thực tự viết (OTP + session) | FR-014 chỉ cho email/mật khẩu + OTP qua email | Cognito: luồng OTP email cần custom auth Lambda, khó test và khó hiểu hơn khoảng 4 bảng + 1 module (research R5) |
| Thêm phụ thuộc argon2, Prisma, TanStack Query | Lý do từng thứ ở research R4, R7, R8 | Thư viện chuẩn Node không có băm mật khẩu argon2; viết SQL tay và tự quản lý cache gọi API dễ sai hơn |

## Rủi ro và việc người dùng cần quyết

1. ~~Xác nhận FR-015 và thời hạn session~~ — đã xác nhận 2026-11-15.
2. **Pháp lý dữ liệu**: lưu dữ liệu ở AWS Singapore liên quan Nghị định 13/2023 và Nghị định 53/2022 (R9).
3. **SES production access** và xác minh domain gửi mail phải làm trước khi chạy thật (R6).
4. **Phát hành app**: cần tài khoản Apple Developer và Google Play; xét duyệt app tài chính có thể mất nhiều tuần.
