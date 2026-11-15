# 🧭 spec-driven-starter

> Repo mẫu để **chuyển từ vibe coding sang spec-driven development**, dành cho sinh viên và bạn mới ra trường.
> Lõi là **[GitHub Spec Kit](https://github.com/github/spec-kit)**, cộng thêm một lớp `AGENTS.md` mỏng để agent **tự dẫn người mới đi đúng quy trình**.

```
Vibe coding:  ý tưởng ─────────────────────────────────────────▶ code ──▶ 🤞
Spec Kit:     ý tưởng ─▶ specify ─▶ clarify ─▶ plan ─▶ tasks ─▶ implement ─▶ converge ─▶ ✅
```

## ⚡ Bắt đầu

```bash
# Cần: Python 3.11+, uv, và một coding agent (Claude Code, Copilot, Codex, Cursor, Gemini…)
uv tool install specify-cli
git clone <url-repo-nay> my-project && cd my-project
claude                         # hoặc agent bạn dùng
```

Rồi cứ nói như đang vibe coding:
```
> làm cho mình app đặt phòng tự học cho thư viện trường, code luôn đi
```
Agent sẽ **không** lao vào code. Nó viết spec, hỏi bạn vài câu, chờ bạn duyệt, lên plan, chia task, rồi mới code.

Không biết làm gì tiếp? Hỏi: *"mình đang ở bước nào?"*

## 🗺️ Luồng Spec Kit

| Bước | Lệnh | Kết quả |
|---|---|---|
| 0 | `/speckit-constitution` | `.specify/memory/constitution.md`: nguyên tắc dự án (đã có sẵn bản mẫu) |
| 1 | `/speckit-specify <cái gì, vì sao>` | `specs/001-…/spec.md`: user stories, FR, SC |
| 2 | `/speckit-clarify` | Hết `[NEEDS CLARIFICATION]` → **bạn duyệt** |
| 3 | `/speckit-plan <công nghệ>` | `plan.md`, `data-model.md`, `contracts/`… |
| 4 | `/speckit-tasks` + `/speckit-analyze` | `tasks.md` theo user story + báo cáo nhất quán |
| 5 | `/speckit-implement` | Code + test, theo phase |
| 6 | `/speckit-converge` | Lặp tới khi **Converged** |

Chi tiết: [docs/cheatsheet.md](docs/cheatsheet.md) · Luật cho agent: [AGENTS.md](AGENTS.md)

## 🎸 Vibe coding có bị cấm không?

**Không.** Muốn thử nhanh thì làm trong `spikes/`. Ý tưởng đáng giữ thì đưa vào `/speckit-specify` và xây lại cho đúng.

> **Vibe để học nhanh. Spec để xây chắc.**
