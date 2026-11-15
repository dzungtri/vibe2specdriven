# CầmCố+ — Vay cầm cố cổ phiếu, tính lãi theo ngày

Ứng dụng web chạy hoàn toàn trên trình duyệt: không cần cài đặt, không cần build, không cần Internet.

## Chạy
Mở trực tiếp file `index.html` trong trình duyệt (Chrome/Safari/Edge), hoặc chạy:

```bash
open index.html                # macOS
# hoặc chạy qua server tĩnh:
python3 -m http.server 8080    # rồi vào http://localhost:8080
```

## Tính năng
- **Tổng quan**: tổng dư nợ, lãi tích lũy, lãi/ngày, LTV tổng hợp, hạn mức còn vay được, biểu đồ lãi phát sinh 60 ngày, cảnh báo (call margin, quá hạn, sắp đáo hạn).
- **Danh mục cổ phiếu**: số lượng sở hữu / đang cầm cố / khả dụng, giá, tỷ lệ cho vay theo mã, mô phỏng phiên giao dịch ±7%.
- **Khoản vay**: tạo hợp đồng (chọn ngân hàng, cổ phiếu phong tỏa, hạn mức tự tính), trả nợ một phần, tất toán, giải chấp, xuất CSV bảng lãi ngày.
- **Kịch bản giá**: thử giá giảm/tăng X% → LTV và trạng thái của từng khoản vay.
- **Máy tính lãi** và **so sánh ngân hàng**.
- **Ngày tính lãi** chỉnh được (lùi/tiến/+30 ngày) để xem lãi chạy theo thời gian.

## Cách tính
- Lãi ngày = Dư nợ gốc × Lãi suất năm ÷ 365 (tính theo số ngày thực tế, lãi đơn, không nhập gốc).
- Lãi được cộng dồn đến hết ngày trước ngày tính lãi.
- Quá hạn: lãi suất × hệ số phạt của ngân hàng (mặc định 150%).
- Mỗi khoản thanh toán trừ vào lãi chưa trả trước, phần còn lại trừ vào gốc.
- Hạn mức vay = Σ (SL cầm cố × Giá × Tỷ lệ cho vay của mã).
- LTV = (Gốc + Lãi chưa trả) ÷ Giá trị cổ phiếu cầm cố; so với ngưỡng cảnh báo / xử lý của từng ngân hàng.

Dữ liệu lưu trong `localStorage` của trình duyệt. Nút "Khôi phục dữ liệu mẫu" ở thanh bên để reset.
