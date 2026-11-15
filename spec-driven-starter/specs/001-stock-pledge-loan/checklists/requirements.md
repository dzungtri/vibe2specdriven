# Specification Quality Checklist: Cầm cố cổ phiếu vay tiền, tính lãi hằng ngày

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-15
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 2026-11-15: Đã chốt 3 câu hỏi: Q1 = B (khách tự đăng ký online, nhân viên duyệt), Q2 = A (vay tối đa 50%, cảnh báo ở 70%, chỉ hiện cảnh báo), Q3 = A (%/năm, chia 365, không tính ngày tất toán, làm tròn xuống một lần).
- Ví dụ số trong US2 và US4 đã được kiểm lại bằng phép tính chính xác (decimal).
- 2026-11-15 (clarify): Chốt trần lãi suất 20%/năm (Bộ luật Dân sự 2015, Điều 468). Người dùng dừng clarify sau 1 câu; các điểm còn để lại được ghi ở báo cáo clarify.
