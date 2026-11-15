# Quickstart: Kiểm chứng feature 001 end-to-end

Tài liệu này hướng dẫn **chạy và kiểm chứng**, không chứa code cài đặt. Hợp đồng API nằm ở
[contracts/openapi.yaml](./contracts/openapi.yaml), dữ liệu ở [data-model.md](./data-model.md).

## Cần có

- Node.js 22 LTS, pnpm 9+, Docker Desktop
- (Mobile) app Expo Go trên điện thoại hoặc trình giả lập iOS/Android
- (Deploy) tài khoản AWS và AWS CLI đã cấu hình. **Không** commit khoá: dùng `.env` (đã nằm trong gitignore), xem `.env.example`

## Chạy local

```bash
pnpm install
cp .env.example .env               # EMAIL_DRIVER=fake để OTP in ra log và hiện trong Mailpit
docker compose up -d               # PostgreSQL 16 + Mailpit (http://localhost:8025)
pnpm --filter api db:migrate
pnpm --filter api seed:staff staff@example.test   # tạo tài khoản nhân viên, in mật khẩu tạm
pnpm dev                           # API :3000, web :5173
pnpm --filter mobile start         # quét QR bằng Expo Go
```

## Chạy test (phải xanh hết)

```bash
pnpm test              # domain + api + web + mobile
pnpm --filter domain test   # công thức tiền: US2-AS1..3, FR-003, FR-005, biên
pnpm --filter api test      # integration với Postgres thật + contract SES (mock)
```

## Kịch bản kiểm chứng thủ công (theo spec)

| # | Làm | Kỳ vọng | Spec |
|---|---|---|---|
| 1 | Đăng nhập web bằng nhân viên, vào "Giá cổ phiếu", nhập ABC = 20000 | Lưu thành công | FR-008 |
| 2 | Trên mobile, khách đăng ký bằng email mới, nhập OTP lấy từ Mailpit | Email được xác minh, vào được app | FR-014 |
| 3 | Khách gửi yêu cầu: ABC × 1000, vay 10000001 | Bị từ chối, báo hạn mức 10.000.000 đ | US1-AS2 |
| 4 | Gửi lại với số tiền vay 10000000 | Trạng thái "Chờ duyệt" | US1-AS1 |
| 5 | Nhân viên duyệt với lãi suất 20.01 | Bị từ chối, báo trần 20%/năm | US1-AS6 |
| 6 | Duyệt với lãi suất 12, ngày giải ngân là 30 ngày trước hôm nay | "Đang vay" | US1-AS3 |
| 7 | Khách mở khoản vay trên mobile, nhân viên mở trên web | Cả hai thấy 30 ngày, lãi 98.630 đ, tổng 10.098.630 đ | US2-AS1, FR-016 |
| 8 | Nhân viên đổi giá ABC = 14285 rồi mở danh sách "Cảnh báo" | Khoản vay có trong danh sách (lãi đã cộng nên tỷ lệ > 70%) | US4-AS1 |
| 9 | Tất toán hôm nay với số tiền 10098629 | Bị từ chối, báo thiếu 1 đ | US3-AS2 |
| 10 | Tất toán với số tiền 10098630 | "Đã tất toán", cổ phiếu "Đã giải chấp" | US3-AS1 |
| 11 | Đăng nhập bằng một khách khác, mở URL khoản vay ở bước 4 | 404 | US1-AS7, FR-013 |
| 12 | Nhập sai OTP 5 lần | OTP bị huỷ, phải đăng nhập lại | FR-015 |

## Deploy (môi trường staging)

```bash
pnpm --filter infra cdk deploy --all -c env=staging
```

Kiểm tra sau khi deploy: `GET /api/v1/me` trả 401 khi chưa đăng nhập; chạy lại kịch bản 2, 4, 7 trên staging.
Trước khi chạy thật cần: SES đã có production access, domain gửi mail đã xác minh, và hồ sơ pháp lý về dữ liệu đã xong
(xem research.md R9).

## Kiểm tra tải (SC-005)

Chạy k6 hoặc Artillery trên staging với 200 request/giây trong 10 phút, theo tỷ lệ 70% xem khoản vay/lãi, 20% danh sách,
10% đăng nhập (dùng FakeEmailSender trên staging để không tốn SES). Đạt khi p95 < 1 giây và lỗi < 0,1%.
