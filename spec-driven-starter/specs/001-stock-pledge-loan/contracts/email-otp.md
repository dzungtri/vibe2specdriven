# Contract: Gửi email OTP qua Amazon SES (constitution III)

**Hệ thống ngoài**: Amazon SES v2, thao tác `SendEmail`, region `ap-southeast-1`.
**Bên gọi**: `apps/api`, qua interface `EmailSender`.

## Interface trong app

```ts
interface EmailSender {
  sendOtp(input: { to: string; code: string; purpose: "LOGIN" | "VERIFY_EMAIL"; expiresInMinutes: number }):
    Promise<{ ok: true; messageId: string } | { ok: false; reason: "REJECTED" | "UNAVAILABLE" }>;
}
```

Có hai bản cài đặt: `SesEmailSender` (dùng thật) và `FakeEmailSender` (cho test và local; lưu email đã gửi vào bộ nhớ để test đọc OTP).

## Dữ liệu gửi đi (SES `SendEmail`)

| Trường | Giá trị |
|---|---|
| `FromEmailAddress` | lấy từ biến môi trường `EMAIL_FROM` (domain đã xác minh SPF, DKIM, DMARC) |
| `Destination.ToAddresses` | `[to]`, đúng 1 địa chỉ |
| `Content.Simple.Subject` | "Mã xác thực của bạn" |
| `Content.Simple.Body.Text` | mã 6 số, mục đích, thời hạn 5 phút, lời nhắc "không chia sẻ mã" |

Trong email không có link đăng nhập, không có mật khẩu.

## Dữ liệu nhận về

- Thành công: `MessageId` (string) → `{ ok: true, messageId }`.

## Mã lỗi SES → hành vi

| Lỗi SES | Ý nghĩa | Kết quả trả về | API trả cho client |
|---|---|---|---|
| `MessageRejected`, `MailFromDomainNotVerifiedException`, `AccountSuspendedException`, `SendingPausedException` | không gửi được (cấu hình hoặc địa chỉ) | `REJECTED`, không thử lại | `503 EMAIL_UNAVAILABLE` |
| `TooManyRequestsException`, `LimitExceededException`, lỗi 5xx, lỗi mạng | tạm thời | thử lại tối đa 2 lần (chờ 200 ms rồi 800 ms), sau đó `UNAVAILABLE` | `503 EMAIL_UNAVAILABLE` |
| quá 5 giây không phản hồi | chậm | huỷ lời gọi, tính là lỗi tạm thời | như trên |

## Hành vi khi lỗi

- OTP chỉ được đánh dấu "đã gửi" (`lastSentAt`) khi kết quả là `ok: true`, để người dùng có thể bấm gửi lại ngay mà không phải chờ 60 giây.
- Ghi AuditLog với `result = ERROR`, kèm tên lỗi SES; **không** ghi mã OTP.
- Tổng thời gian chờ tối đa của một request đăng nhập dành cho email: khoảng 6,5 giây.

## Test hợp đồng (bắt buộc)

1. Gửi thành công → nhận `messageId`; nội dung có đúng mã 6 số và chữ "5 phút".
2. `MessageRejected` → `REJECTED`, chỉ gọi 1 lần.
3. `TooManyRequestsException` 3 lần liên tiếp → gọi đúng 3 lần, kết quả `UNAVAILABLE`.
4. Lỗi tạm thời ở lần 1, thành công ở lần 2 → `ok: true`.
5. Quá 5 giây → `UNAVAILABLE`.

Các test dùng mock `SESv2Client.send`, không gọi AWS thật.
