# Từ Vibe Coding đến Spec-Driven

> **Code nhanh là kỹ năng. Code đúng là nghề.**

Tài liệu cho buổi chia sẻ *"Từ Vibe Coding đến Spec-Driven Development"* dành cho sinh viên và các bạn mới ra trường.

📽️ **Xem slide:** https://dzungtri.github.io/vibe2specdriven/
*(Phím tắt: `→` / `←` chuyển slide · `O` tổng quan · `F` toàn màn hình)*

## Có gì trong repo

| Thư mục | Nội dung |
|---|---|
| [`slides/`](slides/) | Slide trình bày (HTML, mở bằng trình duyệt) |
| [`spec-driven-starter/`](spec-driven-starter/) | 🎁 **Repo mẫu** để bắt đầu dự án theo Spec-Driven Development: [GitHub Spec Kit](https://github.com/github/spec-kit) + `AGENTS.md` dẫn đường cho người mới |
| [`demo/library-booking/`](demo/library-booking/) | App đặt phòng tự học, **vibe coding bằng 1 prompt** (`node server.js`) |
| [`demo/vibe-camco/`](demo/vibe-camco/) | App cầm cố cổ phiếu, **vibe coding bằng 1 prompt**. Mở `app.js` xem AI đã **tự quyết** những quy tắc tiền bạc nào |

## Dùng repo mẫu

Cần: Python 3.11+, [uv](https://docs.astral.sh/uv/), và một coding agent (Claude Code, GitHub Copilot, Codex, Cursor, Gemini CLI…).

```bash
uv tool install specify-cli            # cài GitHub Spec Kit
cp -R spec-driven-starter my-project && cd my-project
git init
claude                                 # hoặc agent bạn dùng
```

Trong agent, bước đầu tiên là viết **hiến pháp dự án**:
```
/speckit-constitution <các nguyên tắc của dự án bạn>
```
Sau đó cứ nói như đang vibe coding, ví dụ *"làm cho mình app …, code luôn đi"*. `AGENTS.md` sẽ dẫn agent đi đúng quy trình:

```
constitution → specify → clarify → plan → checklist → tasks → analyze → implement → converge
```

Chi tiết: [`spec-driven-starter/README.md`](spec-driven-starter/README.md) · [`spec-driven-starter/docs/cheatsheet.md`](spec-driven-starter/docs/cheatsheet.md) · [Spec Kit Quickstart](https://github.github.io/spec-kit/quickstart.html)

## 🗓️ Thử thách 7 ngày

Lấy một dự án bạn từng vibe coding → `specify init --here` → làm lại **một feature** đi đủ các bước Spec Kit → đổi một quy tắc nghiệp vụ, xem có vỡ gì không.

---
*Các con số nghiệp vụ ngân hàng / chứng khoán trong slide và demo chỉ là **minh hoạ**, không phải quy định thật.*
