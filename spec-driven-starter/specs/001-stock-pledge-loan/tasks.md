---

description: "Task list for feature 001-stock-pledge-loan"
---

# Tasks: Cầm cố cổ phiếu vay tiền, tính lãi hằng ngày

**Input**: Design documents from `/specs/001-stock-pledge-loan/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, contracts/email-otp.md, quickstart.md

**Tests**: BẮT BUỘC theo constitution II (test trước, chạy đỏ trước khi viết code). Mỗi kịch bản Given/When/Then có ít
nhất một test. Tên test bắt đầu bằng mã kịch bản, ví dụ `US2-AS1: ...`. Không sửa hoặc xoá test để cho pass.

**Organization**: Task được nhóm theo user story để mỗi story làm và test được độc lập.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: Story mà task thuộc về (US1..US4)

## Quy ước bắt buộc cho mọi task

- Tiền là `bigint` VND; lãi suất là basis point (bp); không dùng `number` cho tiền (research R1).
- Mọi "ngày" nghiệp vụ là ngày lịch `Asia/Ho_Chi_Minh` (research R2).
- Hằng số nghiệp vụ có chú thích trỏ về FR, ví dụ `// FR-003: hạn mức 50%`.
- Công thức tiền **chỉ** nằm trong `packages/domain`; api/web/mobile import, không tự tính lại.
- Lỗi API theo schema `Error` trong `contracts/openapi.yaml` (`code`, `message` tiếng Việt, `field?`, `details?`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khởi tạo monorepo và công cụ

- [ ] T001 Tạo monorepo pnpm: `pnpm-workspace.yaml` (packages `packages/*`, `apps/*`, `infra`), `package.json` gốc với script `dev`, `test`, `lint`, `typecheck`; `.nvmrc` = 22; thêm `node_modules`, `.env`, `dist`, `.expo` vào `.gitignore`
- [ ] T002 [P] Tạo `tsconfig.base.json` ở gốc (`strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`) để các package kế thừa
- [ ] T003 [P] Cấu hình ESLint (flat config) + Prettier ở gốc trong `eslint.config.js` và `.prettierrc`; thêm rule `no-restricted-syntax` cấm `parseFloat`/`Number(`/`Math.round` trong `packages/domain/src/loan-math.ts` và `packages/domain/src/money.ts` (các giá trị tiền phải đi qua `money.ts`; không chặn việc parse tham số phân trang)
- [ ] T004 [P] Khởi tạo `packages/domain` (TypeScript thuần, không phụ thuộc I/O) với `package.json`, `tsconfig.json`, `vitest.config.ts`, phụ thuộc duy nhất là `zod`
- [ ] T005 [P] Khởi tạo `apps/api`: Fastify 5, Zod, Prisma, `@node-rs/argon2`, `@aws-sdk/client-sesv2`, Vitest; `apps/api/package.json` có script `dev`, `test`, `db:migrate`, `seed:staff`
- [ ] T006 [P] Khởi tạo `apps/web` bằng Vite React TS, cài Tailwind CSS + shadcn/ui (`components.json`), React Router, TanStack Query, React Hook Form + `@hookform/resolvers`, Vitest + Testing Library trong `apps/web/`
- [ ] T007 [P] Khởi tạo `apps/mobile` bằng Expo (TypeScript, Expo Router), cài TanStack Query, `expo-secure-store`, jest-expo + `@testing-library/react-native` trong `apps/mobile/`
- [ ] T008 [P] Khởi tạo `infra` với AWS CDK v2 TypeScript (`infra/bin/app.ts`, `infra/cdk.json`) — chưa có stack
- [ ] T009 [P] Tạo `docker-compose.yml` ở gốc: `postgres:16` (db `pledge`, db test `pledge_test`) và `axllent/mailpit` (SMTP 1025, UI 8025)
- [ ] T010 [P] Tạo `.env.example` ở gốc: `DATABASE_URL`, `DATABASE_URL_TEST`, `EMAIL_DRIVER=fake|ses`, `EMAIL_FROM`, `AWS_REGION=ap-southeast-1`, `SESSION_COOKIE_SECURE`, `WEB_ORIGIN`, `VITE_API_URL`, `EXPO_PUBLIC_API_URL` — không chứa giá trị bí mật thật

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain cơ bản, DB, xác thực (FR-000, FR-013–FR-015), giá cổ phiếu, khung web/mobile — mọi story đều cần

**⚠️ CRITICAL**: Không làm story nào trước khi phase này xong

### Cổng xác nhận

- [x] T011 Xác nhận FR-015 với người dùng (OTP 6 số, hiệu lực 5 phút, dùng 1 lần, sai 5 lần thì huỷ, gửi lại sau ≥ 60 giây, mật khẩu ≥ 8 ký tự, phiên hết hạn sau 30 ngày không hoạt động) và ghi vào `specs/001-stock-pledge-loan/spec.md` — đã xong 2026-11-15

### Domain dùng chung (test trước)

- [ ] T012 [P] Viết test `packages/domain/tests/money.test.ts`: parse chuỗi VND `"^[0-9]{1,15}$"` → bigint, từ chối số âm/thập phân/rỗng; `percentToBp("12")=1200n`, `percentToBp("12.5")=1250n`, `percentToBp("20.01")=2001n`, từ chối quá 2 chữ số thập phân; format hiển thị `10098630n → "10.098.630 đ"`
- [ ] T013 [P] Viết test `packages/domain/tests/dates.test.ts`: `todayInVietnam(new Date("2026-11-14T17:30:00Z"))` = `"2026-11-15"`; `interestDays("2028-01-01","2029-01-01")=366`; `interestDays(D,D)=0`; asOf trước disbursement ném lỗi `AS_OF_BEFORE_DISBURSEMENT`
- [ ] T014 [P] Cài đặt `packages/domain/src/money.ts` cho đến khi T012 xanh
- [ ] T015 [P] Cài đặt `packages/domain/src/dates.ts` (chỉ dùng `Intl.DateTimeFormat` với `timeZone: "Asia/Ho_Chi_Minh"`, không thêm thư viện) cho đến khi T013 xanh
- [ ] T016 [P] Viết test + cài đặt `packages/domain/src/loan-status.ts`: chỉ cho phép `PENDING→ACTIVE`, `PENDING→REJECTED`, `ACTIVE→SETTLED`; mọi chuyển khác trả false (data-model "Chuyển trạng thái Loan"), test ở `packages/domain/tests/loan-status.test.ts`
- [ ] T017 [P] Tạo `packages/domain/src/schemas.ts` với Zod schema dùng chung khớp `contracts/openapi.yaml`: `email` (format email), `password` (`minLength: 8, maxLength: 128`), `otpCode` (`^[0-9]{6}$`), `symbol` (`^[A-Z0-9]{3}$`), `money` (`^[0-9]{1,15}$`), `quantity` (`^[1-9][0-9]{0,11}$`), `fullName` (1–100 ký tự), `idNumber` (`^[0-9]{9,12}$`), `phone` (`^0[0-9]{9}$`), `rejectReason` (1–500 ký tự), `annualRatePercent` (`^[0-9]{1,2}(\.[0-9]{1,2})?$`); test ở `packages/domain/tests/schemas.test.ts`

### Database

- [ ] T018 Viết `apps/api/prisma/schema.prisma` đủ mọi entity trong `data-model.md`: User (`email` duy nhất không phân biệt hoa thường — lưu dạng lowercase; `role` enum `CUSTOMER | STAFF`; `emailVerifiedAt` nullable), Borrower (1–1 User), Loan (`borrowerFullName`, `borrowerIdNumber`, `borrowerPhone` — bản sao lúc gửi yêu cầu, không bao giờ sửa; `requestedDate @db.Date`; `principal BigInt`, `annualRateBp Int?`, `disbursementDate @db.Date?`, `status` enum `PENDING | REJECTED | ACTIVE | SETTLED`, `rejectReason?`, `approvedBy?`, `settledDate @db.Date?`), PledgedStock (`quantity BigInt`, `status` enum `PLEDGED | RELEASED`, unique `(loanId, symbol)`), StockPrice (`symbol` khoá chính, `price BigInt`), Settlement (`loanId` duy nhất, các trường tiền BigInt), Session (`tokenHash` duy nhất, `expiresAt`, `lastUsedAt`), OtpChallenge (`purpose` enum `LOGIN | VERIFY_EMAIL`, `codeHash`, `expiresAt`, `attempts Int @default(0)`, `consumedAt?`, `lastSentAt?`), AuditLog (`action` enum theo data-model, `action` gồm cả `STAFF_CREATED`, `result` enum `OK | DENIED | ERROR`, `details Json`); tạo migration đầu tiên trong `apps/api/prisma/migrations/`
- [ ] T019 Tạo `apps/api/src/db.ts` (Prisma client dùng chung) và `apps/api/tests/helpers/db.ts` (reset DB test `pledge_test` trước mỗi file test, factory tạo user/staff/price/loan)

### Khung API

- [ ] T020 [P] Tạo `apps/api/src/plugins/error-handler.ts`: chuyển ZodError → `400 VALIDATION_ERROR` kèm `field`; lỗi nghiệp vụ (`AppError(code, status, message, details)`) → đúng schema `Error`; lỗi lạ → 500 không lộ stack; test ở `apps/api/tests/unit/error-handler.test.ts`
- [ ] T021 [P] Tạo `apps/api/src/modules/audit/audit.service.ts` ghi AuditLog chỉ thêm; hàm lọc `details` loại bỏ khoá `password`, `code`, `otp`, `token`, `idNumber` (constitution IV, FR-012); test ở `apps/api/tests/unit/audit.test.ts` chứng minh các khoá đó không bị ghi
- [ ] T022 [P] Cấu hình logger Fastify trong `apps/api/src/server.ts` với `redact` cho `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.code`, `*.idNumber`; thêm `@fastify/cookie`, CORS chỉ cho `WEB_ORIGIN`; route gốc `/api/v1`

### Email OTP (constitution III — test hợp đồng trước)

- [ ] T023 [P] Viết test hợp đồng `apps/api/tests/contract/ses-email-sender.test.ts` theo đủ 5 mục "Test hợp đồng" trong `contracts/email-otp.md` (mock `SESv2Client.send`; dùng fake timers cho timeout 5 giây và retry 200 ms/800 ms)
- [ ] T024 Cài đặt `apps/api/src/email/email-sender.ts` (interface `EmailSender`), `apps/api/src/email/ses-email-sender.ts` (đúng bảng mã lỗi trong `contracts/email-otp.md`), `apps/api/src/email/fake-email-sender.ts` (lưu email trong bộ nhớ, có `lastOtpFor(email)`), chọn bản theo `EMAIL_DRIVER`, cho đến khi T023 xanh

### Xác thực (FR-000, FR-013, FR-014, FR-015)

- [ ] T025 [P] Viết test tích hợp `apps/api/tests/integration/auth.test.ts`: đăng ký → OTP `VERIFY_EMAIL` → xác minh → `emailVerified: true`; email trùng → `409 EMAIL_TAKEN`; đăng nhập sai mật khẩu và email không tồn tại cùng trả `401 INVALID_CREDENTIALS` cùng thông báo; đăng nhập đúng → `202` có `challengeId` → OTP đúng → `200` (web: có `Set-Cookie session` HttpOnly; mobile: có `token`); OTP sai trả `attemptsLeft` giảm dần, lần sai thứ 5 → `OTP_LOCKED`; OTP quá 5 phút → `OTP_EXPIRED`; OTP đã dùng không dùng lại được; gửi lại trước 60 giây → `429 OTP_RESEND_TOO_SOON` có `retryAfterSeconds`; SES lỗi → `503 EMAIL_UNAVAILABLE` và có thể gửi lại ngay; logout làm token hết hiệu lực; `/me` không có phiên → `401`; AuditLog có `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `OTP_FAILED`
- [ ] T026 Cài đặt `apps/api/src/modules/auth/password.ts` (argon2id) và `apps/api/src/modules/auth/otp.service.ts` (sinh 6 số bằng `crypto.randomInt`, lưu SHA-256, `expiresAt` = +5 phút, đếm `attempts`, quy tắc gửi lại 60 giây — hằng số chú thích `// FR-015`)
- [ ] T027 Cài đặt `apps/api/src/modules/auth/session.service.ts`: token 32 byte ngẫu nhiên, DB chỉ lưu SHA-256, hết hạn sau 30 ngày không hoạt động (`// FR-015`), cập nhật `lastUsedAt`
- [ ] T028 Cài đặt `apps/api/src/modules/auth/auth.routes.ts` cho `POST /auth/register`, `/auth/login`, `/auth/otp/verify`, `/auth/otp/resend`, `/auth/logout`, `GET /me` đúng `contracts/openapi.yaml`, cho đến khi T025 xanh
- [ ] T029 Cài đặt `apps/api/src/plugins/auth-guard.ts`: đọc cookie `session` hoặc `Authorization: Bearer`; decorator `requireRole("CUSTOMER" | "STAFF")`, `requireVerifiedEmail()` (→ `403 EMAIL_NOT_VERIFIED`); test ở `apps/api/tests/integration/auth-guard.test.ts`
- [ ] T030 [P] Viết `apps/api/scripts/seed-staff.ts`: nhận email, tạo User role `STAFF` đã xác minh với mật khẩu tạm ngẫu nhiên in ra màn hình một lần (FR-000); ghi AuditLog `STAFF_CREATED` (constitution IV "thay đổi quyền", FR-012), không ghi mật khẩu; test ở `apps/api/tests/integration/seed-staff.test.ts` (tạo được STAFF, email trùng báo lỗi, có AuditLog, log không chứa mật khẩu)

### Giá cổ phiếu (cần cho US1; FR-008 phần lưu giá)

- [ ] T031 [P] Viết test `apps/api/tests/integration/prices.test.ts`: STAFF `PUT /stock-prices` 1..500 dòng lưu đúng, ghi `updatedBy` và AuditLog `PRICE_UPDATED`; CUSTOMER gọi PUT → `403`; giá `"0"` hoặc symbol `"ab"` → `400`; cập nhật mã không thuộc khoản vay nào vẫn lưu (Edge Case); `GET /stock-prices` trả danh sách
- [ ] T032 Cài đặt `apps/api/src/modules/prices/prices.routes.ts` + `prices.service.ts` (upsert trong một transaction) cho đến khi T031 xanh

### Khung web và mobile

- [ ] T033 [P] Tạo `apps/web/src/lib/api-client.ts` (fetch với `credentials: "include"`, parse `Error` thành exception có `code`/`field`) và `apps/web/src/lib/query-client.ts`
- [ ] T034 [P] Tạo `apps/mobile/src/lib/api-client.ts` (Bearer token từ `expo-secure-store`) và `apps/mobile/src/lib/session.ts` (lưu/xoá token)
- [ ] T035 Tạo màn hình web xác thực trong `apps/web/src/features/auth/`: Đăng ký, Đăng nhập, Nhập OTP (đếm ngược gửi lại 60 giây, hiển thị `attemptsLeft`), dùng shadcn `Form`, `Input`, `Button`, `InputOTP`; route bảo vệ theo vai trò trong `apps/web/src/routes/`; test ở `apps/web/tests/auth.test.tsx`
- [ ] T036 [P] Tạo màn hình mobile xác thực trong `apps/mobile/app/(auth)/` (register, login, otp) và layout chuyển hướng khi chưa đăng nhập; test ở `apps/mobile/tests/auth.test.tsx`
- [ ] T037 [P] Tạo màn hình web nhân viên "Giá cổ phiếu" trong `apps/web/src/features/staff-prices/` (bảng giá + form nhập nhiều dòng `symbol`, `price`); test ở `apps/web/tests/staff-prices.test.tsx`

**Checkpoint**: Đăng ký/đăng nhập OTP chạy trên web và mobile; nhân viên nhập được giá. Bắt đầu các story.

---

## Phase 3: User Story 1 — Khách đăng ký vay online, nhân viên duyệt và giải ngân (Priority: P1) 🎯 MVP

**Goal**: Khách gửi yêu cầu vay có cầm cố cổ phiếu (kiểm tra hạn mức 50%), nhân viên duyệt (lãi suất ≤ 20%/năm, ngày giải ngân) hoặc từ chối.

**Independent Test**: Khách gửi yêu cầu 1.000 cp ABC giá 20.000 đ, vay 10.000.000 đ → "Chờ duyệt"; nhân viên duyệt 12%/năm → "Đang vay" với đúng giá trị tài sản, gốc, lãi suất, ngày giải ngân.

### Tests for User Story 1 ⚠️ (viết trước, phải đỏ)

- [ ] T038 [P] [US1] Viết test `packages/domain/tests/loan-math.collateral.test.ts`: `collateralValue` 1.000 × 20.000 = 20.000.000n; nhiều mã cộng đúng (Edge Case nhiều mã); `maxPrincipal(20_000_000n) = 10_000_000n`; `maxPrincipal(20_000_001n) = 10_000_000n` (làm tròn xuống, FR-003)
- [ ] T039 [P] [US1] Viết test tích hợp `apps/api/tests/integration/us1-loan-request.test.ts`: `US1-AS1` tạo PENDING; `US1-AS2` vay 10.000.001 → `422 OVER_LIMIT` có `maxPrincipal: "10000000"`; `US1-AS3` STAFF duyệt 12 + ngày D → ACTIVE, `annualRateBp=1200`, AuditLog `LOAN_APPROVED`; `US1-AS4` từ chối có lý do → REJECTED, khách thấy `rejectReason`; `US1-AS5` quantity `"0"`/`"1.5"`, principal `"0"`, mã chưa có giá → `400`/`422 NO_PRICE`; `US1-AS6` duyệt 20 → OK, 20.01 → `400`, 0 → `400`; `US1-AS7` khách B xem khoản vay của khách A → `404`; khách chưa xác minh email → `403 EMAIL_NOT_VERIFIED`; ngày giải ngân ở tương lai → `400`; giá giảm giữa lúc gửi và lúc duyệt làm vượt hạn mức → duyệt bị `422 OVER_LIMIT` (Edge Case); duyệt 2 lần đồng thời → một cái `200`, một cái `409 INVALID_STATE`; mã cổ phiếu trùng trong một yêu cầu → `400`; 21 mã → `400` (tối đa 20, FR-004); `US1-AS8` ngày giải ngân trước `requestedDate` hoặc sau hôm nay → `400`; khách gửi yêu cầu thứ hai với họ tên khác → khoản vay cũ vẫn giữ họ tên cũ (bản sao, Edge Case)

### Implementation for User Story 1

- [ ] T040 [US1] Cài đặt `collateralValue`, `maxPrincipal` trong `packages/domain/src/loan-math.ts` (chú thích `// FR-002`, `// FR-003: 50%`) cho đến khi T038 xanh
- [ ] T041 [US1] Cài đặt `apps/api/src/modules/loans/loans.service.ts` — `requestLoan`: yêu cầu `requireVerifiedEmail`; tạo hoặc cập nhật Borrower của user (`fullName` 1–100 ký tự, `idNumber` `^[0-9]{9,12}$`, `phone` `^0[0-9]{9}$`) **và** chép bản sao vào `Loan.borrowerFullName/borrowerIdNumber/borrowerPhone`; đặt `requestedDate` = hôm nay giờ Việt Nam; 1–20 mã không trùng; mọi `symbol` phải có StockPrice; tính `collateralValue`/`maxPrincipal` từ `packages/domain`; tạo Loan PENDING + PledgedStock PLEDGED trong một transaction; AuditLog `LOAN_REQUESTED`
- [ ] T042 [US1] Trong `apps/api/src/modules/loans/loans.service.ts` thêm `approveLoan` (rate `percentToBp`, 1 ≤ bp ≤ 2000 — `// FR-004: trần 20%/năm, BLDS 2015 Đ.468`; `requestedDate` ≤ ngày giải ngân ≤ hôm nay theo giờ Việt Nam (`// FR-004`); kiểm lại hạn mức theo giá hiện tại; `UPDATE ... WHERE status='PENDING'`, 0 dòng → `409`) và `rejectLoan` (`reason` 1–500 ký tự); ghi AuditLog
- [ ] T043 [US1] Cài đặt `apps/api/src/modules/loans/loans.routes.ts`: `POST /loans`, `GET /loans` (CUSTOMER chỉ của mình; lọc `status`, phân trang `cursor`/`limit` ≤ 100), `GET /loans/{loanId}` (không phải của mình → 404), `POST /loans/{loanId}/approve`, `POST /loans/{loanId}/reject`, response đúng `Loan`/`LoanSummary` trong `contracts/openapi.yaml` (tiền dạng chuỗi), cho đến khi T039 xanh
- [ ] T044 [P] [US1] Màn hình web khách trong `apps/web/src/features/customer-loans/`: "Gửi yêu cầu vay" (thông tin người vay, thêm/xoá dòng cổ phiếu, hiển thị giá trị tài sản và hạn mức tính trực tiếp bằng `packages/domain`, báo lỗi `OVER_LIMIT`), "Khoản vay của tôi" (danh sách + chi tiết, lý do từ chối); test `apps/web/tests/customer-loans.test.tsx`
- [ ] T045 [P] [US1] Màn hình mobile khách trong `apps/mobile/app/(customer)/request.tsx` và `apps/mobile/app/(customer)/loans/index.tsx`, `[id].tsx` với cùng hành vi như T044; test `apps/mobile/tests/customer-loans.test.tsx`
- [ ] T046 [P] [US1] Màn hình web nhân viên trong `apps/web/src/features/staff-review/`: danh sách "Chờ duyệt", chi tiết, form duyệt (lãi suất %/năm, ngày giải ngân mặc định hôm nay) và form từ chối (lý do); test `apps/web/tests/staff-review.test.tsx`
- [ ] T047 [P] [US1] Màn hình web nhân viên "Tất cả khoản vay" trong `apps/web/src/features/staff-loans/`: bảng mọi khoản vay (tên người vay từ bản sao, gốc, trạng thái, giá trị tài sản), bộ lọc trạng thái `PENDING | REJECTED | ACTIVE | SETTLED | WARNING` (FR-010), phân trang, link sang chi tiết/duyệt/tất toán; test `apps/web/tests/staff-loans.test.tsx`

**Checkpoint**: US1 chạy độc lập — kịch bản quickstart 1–6, 11.

---

## Phase 4: User Story 2 — Xem lãi cộng dồn theo ngày (Priority: P1)

**Goal**: Khách (khoản của mình) và nhân viên (mọi khoản) xem số ngày, lãi mỗi ngày, tổng lãi, tổng phải trả đến ngày chọn.

**Independent Test**: Khoản vay 10.000.000 đ, 12%/năm, xem tại D+30 → 30 ngày, lãi 98.630 đ, tổng 10.098.630 đ.

### Tests for User Story 2 ⚠️

- [ ] T048 [P] [US2] Viết test `packages/domain/tests/loan-math.interest.test.ts`: `US2-AS1` `accruedInterest(10_000_000n, 1200, 30) = 98_630n`; `US2-AS2` 0 ngày = 0n; `US2-AS3` 366 ngày = 1_203_287n; `dailyInterestDisplay(10_000_000n, 1200) = 3_287n`; chứng minh tổng lãi ≠ cộng các lãi ngày đã làm tròn (30 × 3.287 = 98.610 ≠ 98.630) — FR-005 làm tròn một lần ở cuối; trần 2000 bp × 15 chữ số tiền không tràn
- [ ] T049 [P] [US2] Viết test tích hợp `apps/api/tests/integration/us2-interest.test.ts`: `US2-AS1..3` qua `GET /loans/{id}/interest?asOf=`; `US2-AS4` asOf trước giải ngân → `400 AS_OF_BEFORE_DISBURSEMENT`; không truyền asOf → dùng hôm nay giờ Việt Nam; khoản PENDING/SETTLED → `409 INVALID_STATE`; khách khác → `404`

### Implementation for User Story 2

- [ ] T050 [US2] Cài đặt `accruedInterest`, `dailyInterestDisplay` trong `packages/domain/src/loan-math.ts` (`floor(principal × bp × days / 3_650_000)`, chú thích `// FR-005`) cho đến khi T048 xanh
- [ ] T051 [US2] Thêm `getInterestQuote` vào `apps/api/src/modules/loans/loans.service.ts` và route `GET /loans/{loanId}/interest` vào `loans.routes.ts`, response `InterestQuote`, cho đến khi T049 xanh
- [ ] T052 [P] [US2] Thêm khối "Lãi đến ngày" (chọn ngày, mặc định hôm nay) vào chi tiết khoản vay web `apps/web/src/features/customer-loans/` và dùng lại cho nhân viên; test `apps/web/tests/interest.test.tsx`
- [ ] T053 [P] [US2] Thêm khối "Lãi đến ngày" vào `apps/mobile/app/(customer)/loans/[id].tsx`; test `apps/mobile/tests/interest.test.tsx` chứng minh hiển thị đúng số API trả (FR-016)

**Checkpoint**: US1 + US2 chạy — kịch bản quickstart 7.

---

## Phase 5: User Story 3 — Tất toán khoản vay và trả lại cổ phiếu (Priority: P2)

**Goal**: Nhân viên tất toán khi thu đủ gốc + lãi; hợp đồng "Đã tất toán", cổ phiếu "Đã giải chấp", ngừng tính lãi.

**Independent Test**: Khoản vay ở US2, tất toán tại D+30 với 10.098.630 đ → SETTLED, cổ phiếu RELEASED.

### Tests for User Story 3 ⚠️

- [ ] T054 [P] [US3] Viết test tích hợp `apps/api/tests/integration/us3-settle.test.ts`: `US3-AS1` thu đúng tổng → SETTLED, PledgedStock RELEASED, Settlement lưu `principal`, `interest`, `amountReceived`, AuditLog `LOAN_SETTLED`; thu nhiều hơn tổng vẫn được (FR-007 "≥"); `US3-AS2` thiếu 1 đ → `422 INSUFFICIENT_AMOUNT` `shortfall: "1"`; `US3-AS3` tất toán lại → `409`; tất toán cùng ngày giải ngân → lãi 0 (Edge Case); `settledDate` trước ngày giải ngân → `400`; sau tất toán `GET /interest` → `409` (ngừng tính lãi); CUSTOMER gọi → `403`

### Implementation for User Story 3

- [ ] T055 [US3] Thêm `settleLoan` vào `apps/api/src/modules/loans/loans.service.ts` (lãi từ `accruedInterest` của `packages/domain`; một transaction: tạo Settlement, `UPDATE Loan ... WHERE status='ACTIVE'`, PledgedStock → RELEASED) và route `POST /loans/{loanId}/settle`, cho đến khi T054 xanh
- [ ] T056 [P] [US3] Màn hình web nhân viên `apps/web/src/features/staff-settle/` (mở từ danh sách T047): chọn ngày, hiển thị tổng phải trả (gọi `/interest`), nhập số tiền thu, báo `shortfall`; test `apps/web/tests/staff-settle.test.tsx`
- [ ] T057 [P] [US3] Hiển thị trạng thái "Đã tất toán", thông tin Settlement và "Đã giải chấp" ở chi tiết khoản vay web (`apps/web/src/features/customer-loans/`) và mobile (`apps/mobile/app/(customer)/loans/[id].tsx`)

**Checkpoint**: US1–US3 chạy — kịch bản quickstart 9–10.

---

## Phase 6: User Story 4 — Cảnh báo khi giá cổ phiếu giảm (Priority: P3)

**Goal**: Khoản ACTIVE có dư nợ (gốc + lãi cộng dồn) ≥ 70% giá trị tài sản được đánh dấu cảnh báo, tính lúc đọc.

**Independent Test**: Khoản vay 10.000.000 đ, lãi 0, 1.000 cp ABC; giá 14.285 → cảnh báo; 14.286 → không.

### Tests for User Story 4 ⚠️

- [ ] T058 [P] [US4] Viết test `packages/domain/tests/loan-math.warning.test.ts`: `isWarning(10_000_000n, 14_285_000n) = true`; `isWarning(10_000_000n, 14_286_000n) = false`; đúng 70% (`7_000_000n`, `10_000_000n`) = true (FR-003 "≥"); `debtToCollateralPercent` trả chuỗi 2 chữ số thập phân `"70.00"` chỉ để hiển thị
- [ ] T059 [P] [US4] Viết test tích hợp `apps/api/tests/integration/us4-warning.test.ts`: `US4-AS1` hạ giá 14.285 → `GET /loans?status=WARNING` có khoản vay, `warning: true`, có `debtToCollateralPercent`; `US4-AS2` giá 14.286 → không có; `US4-AS3` tăng giá lại → hết cảnh báo; giá không đổi nhưng lãi tăng qua thời gian làm vượt ngưỡng → có cảnh báo (Edge Case); khoản PENDING/SETTLED không bao giờ có cảnh báo; CUSTOMER chỉ thấy cảnh báo của khoản mình

### Implementation for User Story 4

- [ ] T060 [US4] Cài đặt `isWarning` (`debt × 100 ≥ value × 70`, `// FR-003: ngưỡng 70%`) và `debtToCollateralPercent` trong `packages/domain/src/loan-math.ts` cho đến khi T058 xanh
- [ ] T061 [US4] Thêm `listWarnings` vào `apps/api/src/modules/loans/loans.service.ts`: đọc khoản ACTIVE kèm cổ phiếu + giá theo lô 1.000, tính bằng `packages/domain` (research R10), và gắn `warning`/`debtToCollateralPercent` cho mọi `LoanSummary` ACTIVE; hỗ trợ `status=WARNING` trong `GET /loans`, cho đến khi T059 xanh
- [ ] T062 [P] [US4] Màn hình web nhân viên `apps/web/src/features/staff-warnings/` (danh sách cảnh báo, tỷ lệ, link chi tiết) + badge "Cảnh báo" trong danh sách "Tất cả khoản vay" (T047); test `apps/web/tests/staff-warnings.test.tsx`
- [ ] T063 [P] [US4] Badge "Cảnh báo" và tỷ lệ ở danh sách/chi tiết khoản vay mobile `apps/mobile/app/(customer)/loans/`

**Checkpoint**: Mọi story chạy — kịch bản quickstart 8.

---

## Phase 7: Hạ tầng AWS (research R9)

**Purpose**: Deploy staging; không đổi hành vi

- [ ] T064 [P] Tạo `apps/api/Dockerfile` (multi-stage, Node 22 alpine, chạy `prisma migrate deploy` trước khi start, user không phải root) và health check `GET /api/v1/health` trong `apps/api/src/server.ts`
- [ ] T065 [P] Tạo `infra/lib/network-stack.ts` (VPC 2 AZ, subnet public/private, NAT 1 cái cho staging)
- [ ] T066 Tạo `infra/lib/database-stack.ts` (RDS PostgreSQL 16 Multi-AZ `db.t4g.medium`, backup 7 ngày, mật khẩu trong Secrets Manager, chỉ mở cho security group của API)
- [ ] T067 Tạo `infra/lib/api-stack.ts` (ECS Fargate 0,5 vCPU/1 GB, 2–6 task tự giãn theo CPU 60%, ALB HTTPS, AWS WAF có rule rate-based cho `/api/v1/auth/*`, biến môi trường + secrets, log CloudWatch 30 ngày)
- [ ] T068 [P] Tạo `infra/lib/web-stack.ts` (S3 private + CloudFront OAC, SPA fallback `index.html`, `/api/*` chuyển tới ALB)
- [ ] T069 [P] Tạo `infra/lib/email-stack.ts` (SES email identity cho domain + DKIM; quyền `ses:SendEmail` cho task role của API); API ghi metric CloudWatch `OtpEmailSent`/`OtpEmailFailed` và thời gian gửi; alarm khi tỷ lệ lỗi > 5% trong 5 phút hoặc p95 thời gian gửi > 60 giây (SC-006)
- [ ] T070 Cấu hình EAS cho mobile trong `apps/mobile/eas.json` (profile `preview`, `production`, `EXPO_PUBLIC_API_URL` theo môi trường)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T071 [P] Viết test `apps/api/tests/contract/openapi-conformance.test.ts`: kiểm tra response của mọi endpoint trong các test tích hợp khớp `specs/001-stock-pledge-loan/contracts/openapi.yaml`
- [ ] T072 [P] Viết script tải `tests/load/k6-loans.js` theo mục "Kiểm tra tải" trong `quickstart.md` (200 request/giây, 10 phút, p95 < 1 giây, lỗi < 0,1%) — SC-005
- [ ] T073 Rà bảo mật: không có bí mật trong repo (`git grep` theo mẫu khoá AWS), log không chứa `idNumber`/OTP/token, cookie `Secure` khi production, header bảo mật (`@fastify/helmet`) trong `apps/api/src/server.ts`
- [ ] T074 [P] Viết `README.md` ở gốc: cấu trúc monorepo, cách chạy local và test (trỏ `specs/001-stock-pledge-loan/quickstart.md`)
- [ ] T075 Chạy toàn bộ `pnpm test` + `pnpm typecheck` + `pnpm lint` xanh, rồi chạy tay 12 kịch bản trong `specs/001-stock-pledge-loan/quickstart.md` và ghi kết quả

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: bắt đầu ngay
- **Foundational (Phase 2)**: sau Setup; T011 (xác nhận FR-015) đã xong; Phase 2 chặn mọi story
- **US1 (Phase 3)**: sau Phase 2
- **US2 (Phase 4)**: sau Phase 2; test tích hợp cần tạo khoản ACTIVE — dùng factory trong `apps/api/tests/helpers/db.ts`, không phụ thuộc màn hình US1. Màn hình T052/T053 gắn vào trang chi tiết của T044/T045
- **US3 (Phase 5)**: cần `accruedInterest` (T050) của US2
- **US4 (Phase 6)**: cần `accruedInterest` (T050) và giá (T032)
- **AWS (Phase 7)**: sau khi có API chạy được (cuối Phase 3 là đủ để deploy MVP)
- **Polish (Phase 8)**: sau các story muốn phát hành

### Within Each User Story

- Test domain + test tích hợp viết trước và chạy **đỏ**
- `packages/domain` → service API → routes → màn hình web/mobile
- `loans.service.ts` và `loans.routes.ts` được nhiều story sửa → các task trên cùng file chạy tuần tự

### Parallel Opportunities

- Phase 1: T002–T010 song song sau T001
- Phase 2: T012/T013/T016/T017 song song; T020/T021/T022/T023 song song; T033/T034 song song
- Trong story: test `[P]` song song; màn hình web và mobile `[P]` song song sau khi API xong
- Phase 7: T064/T065/T068/T069 song song

---

## Parallel Example: User Story 1

```bash
# Viết test trước, song song:
Task: "T038 test collateralValue/maxPrincipal in packages/domain/tests/loan-math.collateral.test.ts"
Task: "T039 integration test US1 in apps/api/tests/integration/us1-loan-request.test.ts"

# Sau T043 (API xong), làm UI song song:
Task: "T044 web customer screens in apps/web/src/features/customer-loans/"
Task: "T045 mobile customer screens in apps/mobile/app/(customer)/"
Task: "T046 web staff review in apps/web/src/features/staff-review/"
Task: "T047 web staff all-loans list in apps/web/src/features/staff-loans/"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2
2. Phase 3 (US1) + Phase 4 (US2) — cả hai đều P1: tạo khoản vay **và** thấy lãi mới là sản phẩm có giá trị
3. **DỪNG, kiểm chứng** kịch bản quickstart 1–7, 11; chạy `speckit-converge`
4. Deploy staging (Phase 7)

### Incremental Delivery

1. MVP (US1 + US2) → demo
2. US3 tất toán → demo
3. US4 cảnh báo → demo
4. Polish + kiểm tra tải → sẵn sàng production

### Theo AGENTS.md

- Implement theo từng phase, **phiên mới cho mỗi đợt lớn**; kiểm tra xong phase mới sang phase tiếp.
- Chỉ "xong" khi `speckit-converge` báo **Converged**.

---

## Notes

- [P] = khác file, không phụ thuộc task chưa xong
- [Story] = truy vết về user story trong spec.md
- Commit sau mỗi task hoặc nhóm task logic
- Tránh: task mơ hồ, nhiều task sửa cùng file song song, tự đặt giá trị nghiệp vụ không có trong spec
