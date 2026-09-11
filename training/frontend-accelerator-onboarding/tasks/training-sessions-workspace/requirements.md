# Requirements: training-sessions-workspace

## Goal

Build a small frontend workspace that lets a trainer view, filter, and create training sessions, using mock data behind a replaceable request boundary.

## Functional Requirements

### Sessions list

1. On opening the workspace, the system loads training sessions from a mock API and displays them as a list.
2. Each session in the list shows its title, status, and start date/time.
3. While the sessions request is pending, the system shows a loading state.
4. If the sessions request fails, the system shows one understandable, recoverable error state (the user can tell what happened and can retry or otherwise recover).
5. The list provides a status filter with an `All` option and at least one specific status option.
6. Selecting a filter option shows only sessions matching that selection (or all sessions when `All` is selected).

### Create session

7. The user can open a create form from the workspace.
8. The create form accepts a session title and a session date/time.
9. The title is required and must be between 3 and 80 characters after trimming whitespace.
10. The date/time is required and must be in the future.
11. If the submitted title or date/time is invalid, the system shows a useful validation message and does not submit.
12. While a create request is pending, the system prevents duplicate submission (e.g., a second submit of the same form cannot fire a second request).
13. On successful creation, the newly created session appears in the visible sessions list without requiring a manual page reload.

### Mock data boundary

14. All session data (listing and creation) is served through a mock API reached via an HTTP client or equivalent replaceable request boundary, not a real backend service.

### Testing

15. At least one behavior-level automated test exists covering the main flow (filtering or successful creation).

## Non-Goals (explicitly out of scope)

- Session details, drawers, or deep links.
- Search or multiple simultaneous filters.
- Pagination.
- A complete API contract or scenario matrix.
- Desktop/mobile screenshot sets.
- Exhaustive responsive and accessibility validation.
- Full test coverage.
- CI, deployment, or a public URL.
- Strict TypeScript migration or unrelated refactoring.

## Assumptions

- "One status filter" is read as: the filter control offers an `All` option plus one or more discrete status values to filter by (not a literal single non-`All` status). This should be confirmed with the task owner if it materially changes scope.

## Open Questions

- What specific status values exist for a training session (e.g., Scheduled, Completed, Cancelled)? Not specified in the task; needed before the filter and mock data can be finalized.

## Readiness

Requirements are sufficient to proceed to planning (`writing-plans`), pending confirmation of the open question about concrete status values (a reasonable default may be chosen during planning if the task owner has no preference).
