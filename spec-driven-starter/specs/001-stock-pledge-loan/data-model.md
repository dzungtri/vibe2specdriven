# Data Model: Cầm cố cổ phiếu vay tiền

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Quy ước: tiền là `BIGINT` VND; lãi suất là `INT` basis point (bp); ngày nghiệp vụ là `DATE` theo `Asia/Ho_Chi_Minh`;
thời điểm hệ thống là `TIMESTAMPTZ`. Khoá chính là UUID.

## Entities

### User (Tài khoản)

| Field | Type | Rule |
|---|---|---|
| id | UUID | |
| email | TEXT | bắt buộc, duy nhất (so sánh không phân biệt hoa thường), đúng định dạng email (FR-014) |
| passwordHash | TEXT | argon2id; mật khẩu gốc ≥ 8 ký tự (FR-015) |
| role | ENUM `CUSTOMER` \| `STAFF` | khách tự đăng ký thì là `CUSTOMER`; `STAFF` chỉ tạo bằng script quản trị (FR-000) |
| emailVerifiedAt | TIMESTAMPTZ? | phải có giá trị thì khách mới gửi được yêu cầu vay (FR-014) |
| createdAt | TIMESTAMPTZ | |

### Borrower (Người vay)

| Field | Type | Rule |
|---|---|---|
| id | UUID | |
| userId | UUID → User | 1–1 với User có role `CUSTOMER`; giữ thông tin mới nhất để điền sẵn form, khoản vay dùng bản sao riêng |
| fullName | TEXT | 1–100 ký tự |
| idNumber | TEXT | số CCCD/giấy tờ, 9–12 chữ số; dữ liệu nhạy cảm, không ghi ra log (constitution IV) |
| phone | TEXT | số điện thoại Việt Nam, 10 chữ số, bắt đầu bằng 0 |

### Loan (Khoản vay / Hợp đồng)

| Field | Type | Rule |
|---|---|---|
| id | UUID | |
| borrowerId | UUID → Borrower | |
| borrowerFullName, borrowerIdNumber, borrowerPhone | TEXT | **bản sao** lúc gửi yêu cầu, không bao giờ sửa (FR-004 cùng định dạng như Borrower; spec Key Entities) |
| requestedDate | DATE | ngày khách gửi yêu cầu (giờ Việt Nam) |
| principal | BIGINT | > 0; ≤ hạn mức FR-003 lúc gửi **và** lúc duyệt |
| annualRateBp | INT? | đặt lúc duyệt; 1 ≤ bp ≤ 2000 (FR-004, trần 20%/năm) |
| disbursementDate | DATE? | đặt lúc duyệt; requestedDate ≤ disbursementDate ≤ hôm nay (FR-004) |
| status | ENUM | `PENDING` \| `REJECTED` \| `ACTIVE` \| `SETTLED` |
| rejectReason | TEXT? | bắt buộc khi `REJECTED`, 1–500 ký tự |
| approvedBy | UUID? → User(STAFF) | |
| settledDate | DATE? | ≥ disbursementDate |
| createdAt / updatedAt | TIMESTAMPTZ | |

"Cảnh báo" **không** là một trạng thái lưu trong DB. Nó được tính lúc đọc cho các khoản `ACTIVE` (FR-009, Edge Cases):
dư nợ tăng mỗi ngày nên lưu sẵn sẽ nhanh chóng sai.

### PledgedStock (Cổ phiếu cầm cố)

| Field | Type | Rule |
|---|---|---|
| id | UUID | |
| loanId | UUID → Loan | một khoản vay có 1..n dòng |
| symbol | TEXT | đúng 3 ký tự chữ in hoa hoặc chữ số; phải có giá tham chiếu lúc gửi yêu cầu; không trùng trong cùng khoản vay; 1–20 dòng mỗi khoản vay (FR-004) |
| quantity | BIGINT | số nguyên > 0 |
| status | ENUM | `PLEDGED` \| `RELEASED` |

### StockPrice (Giá tham chiếu)

| Field | Type | Rule |
|---|---|---|
| symbol | TEXT | khoá chính, đúng 3 ký tự chữ in hoa hoặc chữ số |
| price | BIGINT | VND/cp, > 0 |
| updatedBy | UUID → User(STAFF) | |
| updatedAt | TIMESTAMPTZ | |

Chỉ giữ giá mới nhất. Lịch sử thay đổi giá nằm trong AuditLog (YAGNI).

### Settlement (Giao dịch tất toán)

| Field | Type | Rule |
|---|---|---|
| id | UUID | |
| loanId | UUID → Loan | duy nhất (mỗi khoản vay tất toán một lần) |
| settledDate | DATE | ≥ disbursementDate |
| principal | BIGINT | = Loan.principal |
| interest | BIGINT | = lãi FR-005 đến settledDate |
| amountReceived | BIGINT | ≥ principal + interest (FR-007) |
| recordedBy | UUID → User(STAFF) | |

### Session, OtpChallenge (xác thực)

- **Session**: `id`, `userId`, `tokenHash` (SHA-256, duy nhất), `lastUsedAt`, `expiresAt` (= lastUsedAt + 30 ngày, FR-015), `createdAt`.
- **OtpChallenge**: `id`, `userId`, `purpose` (`LOGIN` \| `VERIFY_EMAIL`), `codeHash`, `expiresAt` (= tạo + 5 phút),
  `attempts` (sai ≥ 5 thì huỷ), `consumedAt`, `lastSentAt` (gửi lại sau ≥ 60 giây). Tất cả theo FR-015.

### AuditLog (Nhật ký, FR-012)

`id`, `actorUserId`, `action` (`LOAN_REQUESTED`, `LOAN_APPROVED`, `LOAN_REJECTED`, `LOAN_SETTLED`, `PRICE_UPDATED`,
`LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `OTP_FAILED`, `STAFF_CREATED`), `targetId`, `result` (`OK`/`DENIED`/`ERROR`), `details` (JSON, không chứa mật khẩu,
OTP, token hay số giấy tờ), `createdAt`. Chỉ được thêm, không sửa, không xoá.

## Quan hệ

```text
User 1─1 Borrower 1─n Loan 1─n PledgedStock n─1 StockPrice (theo symbol)
Loan 1─0..1 Settlement
User 1─n Session, User 1─n OtpChallenge, User 1─n AuditLog
```

## Chuyển trạng thái Loan

```text
            khách gửi (FR-001)
                  │
                  ▼
             ┌─PENDING─┐
nhân viên từ chối      nhân viên duyệt (FR-001a: rate, ngày giải ngân, kiểm lại hạn mức)
     ▼                         ▼
 REJECTED                   ACTIVE ── tính lãi hằng ngày; "Cảnh báo" tính khi đọc
                               │ nhân viên tất toán (FR-007: thu ≥ gốc + lãi)
                               ▼
                            SETTLED  (PledgedStock → RELEASED, ngừng tính lãi)
```

Không có chuyển trạng thái nào khác; `REJECTED` và `SETTLED` là trạng thái cuối.

## Hàm nghiệp vụ trong `packages/domain` (không phụ thuộc DB)

| Hàm | Công thức | Nguồn |
|---|---|---|
| `collateralValue(stocks, prices)` | Σ quantity × price | FR-002 |
| `maxPrincipal(value)` | floor(value × 50 / 100) | FR-003 |
| `interestDays(disbursement, asOf)` | asOf − disbursement (lỗi nếu < 0) | FR-005 |
| `accruedInterest(principal, bp, days)` | floor(principal × bp × days / 3 650 000) | FR-005 |
| `dailyInterestDisplay(principal, bp)` | floor(principal × bp / 3 650 000) | FR-005 |
| `isWarning(debt, value)` | debt × 100 ≥ value × 70 | FR-003, FR-009 |
