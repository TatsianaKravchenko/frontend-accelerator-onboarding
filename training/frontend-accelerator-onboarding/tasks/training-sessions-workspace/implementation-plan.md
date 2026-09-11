# Implementation Plan: training-sessions-workspace

## Context

No React/TypeScript application exists yet for this task (confirmed in the prior planning pass: the working directory only contains the Frontend Accelerator toolset itself, plus a separate, excluded assessment track). Per explicit developer decision, this plan scaffolds a new, self-contained application from scratch using **Vite + React + TypeScript + Vitest + React Testing Library**.

## Application Root

`training/frontend-accelerator-onboarding/tasks/training-sessions-workspace/app/`

Rationale: the parent folder (`tasks/training-sessions-workspace/`) already holds non-code task artifacts (`requirements.md`, this plan, and later `review.md`, `verification.md`). Placing the Vite scaffold (config files, `node_modules`, build output) in an `app/` subfolder keeps generated project tooling separate from the task's markdown artifacts without inventing an unrelated top-level location. All paths below are relative to this `app/` root unless stated otherwise.

## Current Behavior

Nothing exists yet: no `package.json`, no source tree, no test runner in this folder.

## Intended Behavior

A minimal Vite React/TS app that: loads mock training sessions on mount, lets the trainer filter by status (`All` + one specific status at a time), lets the trainer open a create form, validates and submits a new session against a mock API boundary, and reflects the created session in the visible list — matching `requirements.md` items 1–15.

## Domain Contract (shared types)

Decided now so every later step relies on the same shape (resolves the "status values" open question from `requirements.md` with a reasonable default):

```ts
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface TrainingSession {
  id: string;
  title: string;
  status: SessionStatus;
  startAt: string; // ISO 8601 timestamp
}
```

`SESSION_STATUSES: SessionStatus[] = ['scheduled', 'completed', 'cancelled']` is the single source of truth for filter options and mock seed data, defined alongside the type.

## Mock API Boundary Contract

A single module is the only thing that knows data is mocked; every consumer (hooks, tests) depends on its function signatures, not its internals:

```ts
function fetchSessions(): Promise<TrainingSession[]>;
function createSession(input: { title: string; startAt: string }): Promise<TrainingSession>;
```

- Both functions simulate network latency (small fixed or randomized delay) and can reject with an `Error`.
- A test-only configuration hook (e.g. `configureMockApi({ shouldFail?: boolean; delayMs?: number })`) lets tests force the loading and error paths deterministically instead of relying on timing or randomness.
- This module is the "replaceable request boundary" required by `requirements.md` item 14 — swapping it for a real HTTP client later should not require changes to hooks or components.

## Files To Create

Ordered by dependency. Steps in the same group have no dependency on each other and may be done in any order or in parallel.

### Group 1 — Project scaffold (no dependencies)

1. `app/package.json` — project manifest. Scripts: `dev` (`vite`), `build` (`tsc -b && vite build`), `preview` (`vite preview`), `test` (`vitest run`), `test:watch` (`vitest`). Dependencies: `react`, `react-dom`. Dev dependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom`.
2. `app/tsconfig.json` — TypeScript project config for the app source (React JSX, DOM + ES libs, strict mode on for onboarding-quality code without requiring a repo-wide strict migration elsewhere).
3. `app/tsconfig.node.json` — TypeScript config for `vite.config.ts` itself (standard Vite React-TS scaffold split).
4. `app/vite.config.ts` — Vite config using `@vitejs/plugin-react`, plus a Vitest `test` block (`environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, `globals: true`) so a separate `vitest.config.ts` isn't needed.
5. `app/index.html` — Vite HTML entry, mounts `#root`, loads `/src/main.tsx`.
6. `app/src/vite-env.d.ts` — Vite client type reference (standard scaffold file).
7. `app/src/test/setup.ts` — imports `@testing-library/jest-dom/vitest` so DOM matchers are available in every test.

### Group 2 — Domain layer (depends on Group 1 existing as a project; no code dependency between these two files' content, but both are prerequisites for everything after)

8. `app/src/domain/session.ts` — `SessionStatus`, `TrainingSession`, `SESSION_STATUSES` as specified in the Domain Contract above.
9. `app/src/domain/validation.ts` — pure functions with no UI dependency, independently unit-testable:
   - `validateTitle(rawTitle: string): { valid: true } | { valid: false; message: string }` — trims, checks length 3–80 (`requirements.md` item 9).
   - `validateStartAt(rawStartAt: string, now = new Date()): { valid: true } | { valid: false; message: string }` — checks the value parses to a date and is strictly after `now` (`requirements.md` item 10). `now` is an injectable parameter specifically so tests don't depend on wall-clock time.

### Group 3 — Mock API boundary (depends on Group 2 for the `TrainingSession` type)

10. `app/src/api/mockSessions.ts` — seed data: a small fixed array of `TrainingSession` objects covering at least two different `SessionStatus` values, so the filter has something to filter (`requirements.md` items 2, 5, 6).
11. `app/src/api/sessionsClient.ts` — implements `fetchSessions`, `createSession`, and `configureMockApi` per the Mock API Boundary Contract above. Holds the in-memory session list (seeded from `mockSessions.ts`) as module state so a created session persists for subsequent `fetchSessions` calls within the same app session.

### Group 4 — State management hooks (depends on Group 3)

12. `app/src/hooks/useSessionsList.ts` — owns list state and the status filter:
    - Internal state: `sessions: TrainingSession[]`, `status: 'idle' | 'loading' | 'error' | 'success'`, `error: string | null`, `filter: SessionStatus | 'all'`.
    - Calls `fetchSessions()` once on mount; exposes `retry()` to re-run it (supports the recoverable error state, `requirements.md` item 4).
    - Exposes `filteredSessions` (derived: all sessions when `filter === 'all'`, else sessions matching `filter`) and `setFilter`.
    - Exposes `addSession(session: TrainingSession)` so a freshly created session can be appended to local state immediately without a full refetch (`requirements.md` item 13).
13. `app/src/hooks/useCreateSession.ts` — owns create-form submission state:
    - Internal state: `status: 'idle' | 'submitting' | 'error'`, `error: string | null`.
    - Exposes `submit(input: { title: string; startAt: string }): Promise<TrainingSession | undefined>` that runs `validateTitle`/`validateStartAt` first (returns validation message without calling the API on failure, `requirements.md` item 11), then calls `createSession` guarded so a second call while `status === 'submitting'` is a no-op (`requirements.md` item 12).

### Group 5 — Presentational components (depend on Group 2 for types; can be built in parallel with each other and with Group 4)

14. `app/src/components/StatusFilter.tsx` — renders `All` plus one option per `SESSION_STATUSES` value; controlled via `value`/`onChange` props (`requirements.md` items 5, 6).
15. `app/src/components/SessionsList.tsx` — renders title, status, and start date/time per session; accepts `status`, `error`, and `sessions` props and renders the loading state, the error state (with a retry affordance), or the list accordingly (`requirements.md` items 2, 3, 4).
16. `app/src/components/CreateSessionForm.tsx` — controlled title/date-time inputs, calls a `onSubmit(input)` prop, shows the validation/error message passed in via props, and disables the submit control while a `pending` prop is true (`requirements.md` items 7–12).

### Group 6 — Composition (depends on Groups 4 and 5)

17. `app/src/components/SessionsWorkspace.tsx` — the container: wires `useSessionsList` and `useCreateSession` to `StatusFilter`, `SessionsList`, and `CreateSessionForm`; owns "is the create form open" UI state (`requirements.md` item 7); on successful create, calls `addSession` from `useSessionsList` and closes the form.
18. `app/src/App.tsx` — renders `SessionsWorkspace` (kept as a thin wrapper so `App.tsx` has no session-specific logic).
19. `app/src/main.tsx` — standard Vite React entry point (`createRoot(...).render(<App />)`).

### Group 7 — Tests (each depends only on the specific module(s) it exercises, per the file list below)

20. `app/src/domain/validation.test.ts` — **essential**, protects `validateTitle`/`validateStartAt` (Group 2, step 9): boundary cases for 3/80 character length, whitespace-only/trimmed titles, past/future/invalid dates.
21. `app/src/components/SessionsWorkspace.test.tsx` — **essential behavior-level test required by `requirements.md` item 15**. Renders the full composed workspace with the real mock API boundary (using `configureMockApi` to control timing/failure deterministically) and React Testing Library + `user-event`. Minimum required scenario (pick one, per `TASK.md`'s "may cover filtering or successful creation"):
    - Successful creation: open the create form, fill a valid title and a future date/time, submit, assert the new session's title appears in the rendered list and the form's pending state clears.
    - Additionally recommended (not required to pass onboarding, but cheap given the harness already exists): a filtering scenario — select a specific status and assert only matching sessions render, then select `All` and assert all sessions render again.

## Additional Risk-Based Test Opportunities (not essential; separate from the required test above)

- `app/src/api/sessionsClient.test.ts` — exercise `fetchSessions`/`createSession` directly, including the `configureMockApi({ shouldFail: true })` path, without going through the UI.
- A `SessionsWorkspace` error-state test: force `configureMockApi({ shouldFail: true })` before mount and assert the recoverable error UI renders, then assert retry works after reconfiguring to succeed.
- A `SessionsWorkspace` duplicate-submit test: assert rapid double-submit of the create form results in exactly one created session.

## Verification Commands

None exist yet (the project does not exist). Once Group 1 is complete and dependencies are installed, the following commands (defined in `app/package.json`, step 1) are the verification surface for this task:

- `npm install` — one-time setup inside `app/`, required before anything else can run (not itself a repeatable verification command).
- `npm run dev` — manual check: start the app and exercise list/filter/create in a browser (`TASK.md` "Manual check").
- `npm test` — runs `vitest run`, covering steps 20–21 (and any of the additional tests, if added).
- `npm run build` — optional sanity check that the TypeScript project compiles cleanly.

## Non-Goals Carried Into This Plan

Per `requirements.md`: no session details/drawers/deep links, no search or multi-filter, no pagination, no full API contract, no exhaustive responsive/accessibility work, no full test coverage, no CI/deployment, no strict-mode migration beyond this new app's own `tsconfig.json`. Nothing in the file list above implements any of these.

## Rollback Considerations

Not applicable: this is a new, isolated `app/` folder with no existing consumers or deployed surface to roll back.
