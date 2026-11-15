# Cheatsheet: Từ Vibe Coding đến Spec-Driven (với Spec Kit)

## 1. Luồng lệnh (gõ trong chat của agent)

```
/speckit-constitution   ← 1 lần / dự án: nguyên tắc
/speckit-specify  <mô tả: CÁI GÌ & VÌ SAO, không nói công nghệ>
/speckit-clarify        ← AI hỏi ≤ 5 câu → bạn DUYỆT spec
/speckit-plan     <công nghệ, kiến trúc, ràng buộc>
/speckit-checklist      ← (tuỳ chọn) "unit test cho yêu cầu"
/speckit-tasks
/speckit-analyze        ← soát spec ↔ plan ↔ tasks trước khi code
/speckit-implement      ← theo phase; feature lớn thì chia nhiều lần
/speckit-converge       ← lặp implement ↔ converge tới khi "Converged"
```
> Claude Code / Copilot: `/speckit-…` · Codex: `$speckit-…` · Không nhớ tên lệnh? Cứ nói tự nhiên, AGENTS.md sẽ dẫn agent.

## 2. Khi nào vibe, khi nào spec?

| Vibe là đủ 🎸 | Cần spec 📐 |
|---|---|
| Học thư viện mới | Có người dùng / dữ liệu thật |
| Prototype hỏi ý kiến | Làm nhóm ≥ 2 người |
| Hackathon, demo 1 lần | Sống > 1–2 tuần |
| Script dùng 1 lần | Đồ án phải bảo vệ |

> **"Nếu ngày mai có bug, mình có giải thích được code này làm gì và vì sao không?"** Không → cần spec.

## 3. Yêu cầu: mơ hồ vs kiểm chứng được

| ❌ Mơ hồ | ✅ Kiểm chứng được |
|---|---|
| Đặt phòng phải nhanh | SC-001: đặt xong trong < 60 giây |
| Không cho đặt trùng | Given P2 đã đặt 14–16h, When người khác đặt P2 15–17h, Then từ chối |
| Giao diện thân thiện | Người mới đặt xong trong ≤ 3 bước, không cần hướng dẫn |
| Hỗ trợ nhiều người | 2 yêu cầu đặt cùng phòng/giờ đồng thời → đúng 1 thành công |

Từ cảnh báo 🚩: *nhanh, dễ, đẹp, thân thiện, nhiều, hợp lệ, tốt* → hỏi "con số là bao nhiêu?"

## 4. Prompt mẫu hữu ích

- "Đừng code. Hỏi mình tối đa 5 câu về chỗ còn mơ hồ, mỗi câu kèm gợi ý A/B/C."
- "Mình muốn đổi giới hạn thành 3 lượt/ngày. Cập nhật spec trước, rồi mới sửa code."
- "Implement chỉ phase Setup và User Story 1. Viết test trước, chạy cho fail, rồi mới code."
- "Mình đang ở bước nào? Bước tiếp theo là gì?"

## 5. Năm cái bẫy

1. **Spec tiểu thuyết:** dài quá không ai đọc → 1–2 trang mỗi feature
2. **Spec chết:** code đi một đằng → đổi hành vi thì đổi spec trước
3. **Spec ôm công nghệ** → để dành cho `plan`
4. **Để AI tự duyệt** → duyệt là việc của bạn
5. **Waterfall trá hình** → từng feature, từng user story
