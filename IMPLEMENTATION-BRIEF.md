# Frontend Accelerator Toolset v1 Implementation Brief

Status: implementation and Windows managed-browser smoke verified; host activation and hosted cross-platform CI pending

## Objective

Build a frontend-native agent toolset derived from Accelerator Mini's manual interaction model and backed by a minimum executable Runtime Toolchain:

```text
user command -> one isolated agent -> one skill -> STOP
```

The toolset must work in existing TypeScript frontend repositories without introducing an application starter, backend lane, orchestrator, governance pipeline, automatic memory, application dependency mutation, or global tool installation.

The canonical product decisions are in `CONTEXT.md` and accepted ADRs under `docs/adr/`. If this brief conflicts with either, the accepted ADR wins and this brief must be corrected before implementation continues.

## User Outcome

A developer can:

1. Install `.claude/`, `.agents/`, `rulesets/`, and `toolchain/` into the Git root of an existing frontend repository.
2. Review the narrow Claude Code and Codex hook-registration merge before it is written.
3. Separately provision pinned runtime tools into a reconstructible user-local cache.
4. Diagnose required, recommended, hook-activation, and lint readiness without changing state.
5. Invoke any of the 18 frontend lifecycle commands directly and let one isolated role execute one matching skill and stop.
6. Keep, replace, or remove the bundled Framework Ruleset without breaking the workflow.
7. Add arbitrary project rules under `rulesets/project/` without changing commands, agents, or skills.

The package exposes `install`, `setup`, and `doctor`. Public npm publication is not required.

## Required Command Catalog

Implement exactly these public commands, with one command file, one agent file, and one skill directory for each name:

```text
requirements-analyst
brainstorm
writing-plans
architect
api-integration
ui-designer
git-worktrees
coder
code-reviewer
test-generator
browser-verify
debugger
verify
docs-generator
finishing-branch
release
reflect
skill-creator
```

Do not add aliases for `coder-frontend`, `api-designer`, `frontend-design`, `review-pr`, or `accelerator-update`.

## Repository Shape

The completed source repository should have this shape:

```text
frontend-accelerator-toolset/
|-- .claude/
|   |-- commands/
|   |   `-- <18 canonical command files>.md
|   |-- agents/
|   |   `-- <18 canonical agent files>.md
|   `-- skills/
|       |-- requirements-analyst/SKILL.md
|       |-- brainstorm/SKILL.md
|       |-- writing-plans/SKILL.md
|       |-- architect/SKILL.md
|       |-- api-integration/SKILL.md
|       |-- ui-designer/SKILL.md
|       |-- git-worktrees/SKILL.md
|       |-- coder/SKILL.md
|       |-- code-reviewer/SKILL.md
|       |-- test-generator/SKILL.md
|       |-- browser-verify/SKILL.md
|       |-- debugger/SKILL.md
|       |-- verify/SKILL.md
|       |-- docs-generator/SKILL.md
|       |-- finishing-branch/SKILL.md
|       |-- release/SKILL.md
|       |-- reflect/SKILL.md
|       `-- skill-creator/SKILL.md
|-- .agents/
|   |-- skills/                  # generated copy of .claude/skills
|   `-- codex-agents.toml        # generated from .claude/agents
|-- rulesets/
|   |-- common/
|   |-- framework/
|   `-- project/README.md
|-- toolchain/
|   |-- manifest.json
|   |-- bin/                    # project-owned capability adapters and Doctor
|   |-- hooks/                  # shared portable hook entry point
|   |-- lib/                    # manifest, cache, setup, Doctor, and lint logic
|   `-- registrations/          # logical Claude Code and Codex registrations
|-- bin/
|   `-- frontend-accelerator.mjs
|-- scripts/
|   `-- sync-agents.mjs
|-- test/
|   |-- catalog.test.mjs
|   |-- mirror.test.mjs
|   |-- rulesets.test.mjs
|   |-- installer.test.mjs
|   |-- manifest.test.mjs
|   |-- setup.test.mjs
|   |-- doctor.test.mjs
|   |-- hook-merge.test.mjs
|   `-- lint-gate.test.mjs
|-- .github/workflows/check.yml
|-- package-lock.json
|-- package.json
|-- README.md
|-- CONTEXT.md
|-- IMPLEMENTATION-BRIEF.md
`-- docs/adr/
```

Do not include root `AGENTS.md`, root `CLAUDE.md`, an updater, an application scaffold, application dependencies, or global configuration in the payload. Runtime receipts and activation/session state belong only in the user-local Runtime Toolchain Cache.

## Canonical Workflow Contract

### Commands

Each `.claude/commands/<name>.md` must:

- identify the matching agent `<name>`;
- pass the user's arguments through without expanding the role;
- spawn only that isolated agent;
- perform no delivery work itself;
- contain no automatic invocation of a second command or skill.

### Agents

Each `.claude/agents/<name>.md` must:

- use canonical `name: <name>` frontmatter;
- describe a frontend-native role without backend assumptions;
- invoke exactly the matching `<name>` skill;
- define the role's read/write and external-action boundaries;
- require a concise context summary, evidence, and a contextual next-step recommendation;
- explicitly STOP after the one skill completes;
- never start the recommended command itself.

Do not hardcode Claude model tiers in v1. Let each runtime use its configured model.

### Skills

Each `.claude/skills/<name>/SKILL.md` must define:

- purpose and frontend-native authority;
- entry conditions and required context;
- Application Root resolution behavior;
- applicable ruleset sections;
- ordered procedure;
- allowed writes and prohibited actions;
- verification expectations;
- stop conditions;
- allowed next-step recommendations and conditions for choosing among them.

Skills are stable procedures. They must not embed React, Angular, Vue, Vite, TanStack Query, shadcn, ED small, mandatory i18n, or fixed repository paths. Framework and project coding guidance belongs in `rulesets/`.

## Route Graph

Implement the allowed recommendation graph from ADR-0022 exactly. The graph controls recommendations only; it never blocks a user from invoking another public command manually.

At minimum, enforce these terminal and conditional rules:

- Every command stops after its skill.
- `verify` recommends repair roles on failure and `docs-generator` or `finishing-branch` on success.
- `finishing-branch` recommends `release` only when release work is intended.
- `release`, `reflect`, and `skill-creator` are terminal.
- A role encountering a decision outside its authority recommends the appropriate earlier specialist and stops.

Store transition metadata in canonical command or skill frontmatter so tests can validate the graph without parsing prose. Do not create a runtime orchestrator or global workflow engine.

## Role Boundaries

Implement the following minimum behavior:

| Role | Required boundary |
| --- | --- |
| `requirements-analyst` | Clarifies scope, acceptance criteria, constraints, and open questions; creates or updates task requirements, not production code. |
| `brainstorm` | Explores users, flows, states, alternatives, and success criteria; does not choose technical architecture. |
| `writing-plans` | Produces a file-level implementation plan with tests and verification; does not implement it. |
| `architect` | Owns frontend boundaries, routing, state ownership, data flow, failure boundaries, performance, security, and testability; a new dependency requires human selection. |
| `api-integration` | Defines frontend consumption of backend contracts; never designs or modifies backend endpoints. Missing contracts remain visibly provisional. |
| `ui-designer` | Produces context-appropriate UI/interaction design and preserves existing design systems; writes no production UI code. |
| `git-worktrees` | Creates or selects an isolated worktree only after showing the intended path and branch effect. |
| `coder` | Implements frontend production behavior and the tests directly required by that behavior. |
| `code-reviewer` | Read-only review of a local diff, branch diff, or PR; reports prioritized findings and never fixes them. |
| `test-generator` | Adds risk-based regression, edge, integration, component, or end-to-end coverage beyond Coder's essential tests. |
| `browser-verify` | Observes rendered behavior and returns evidence; never edits production code. Starting a discovered dev server requires approval, and it may stop only a server it started. |
| `debugger` | Reproduces and proves a root cause, then applies one minimal fix with regression coverage when appropriate. |
| `verify` | Read-only verdict over existing project checks; does not install tooling or repair failures. |
| `docs-generator` | Updates living specs and affected project documentation from verified truth; does not edit production code or rulesets. |
| `finishing-branch` | Performs only the explicitly selected git/PR action after successful verification; no force push or implicit cleanup. |
| `release` | Prepares release artifacts and publishes only to confirmed GitHub repositories through `gh`, with separate confirmations for writes and publication. |
| `reflect` | Drafts a durable correction and writes only to `rulesets/project/` after explicit approval. |
| `skill-creator` | Creates or improves a project-local skill without changing the public command catalog or core policy silently. |

## Repository And Application Roots

All skills distinguish the Repository Root from the Application Root.

Resolution order:

1. Use an explicit Application Root supplied by the user when it resolves inside the Repository Root.
2. Use the Repository Root when it is the only frontend application candidate.
3. In a monorepo, inspect repository evidence for frontend application candidates.
4. If exactly one candidate exists, use it.
5. If multiple candidates remain, report them and require explicit selection instead of guessing.

Skills must not assume `frontend/`, `web/`, `apps/*`, a root `package.json`, a dev-server port, or a framework-specific command. Installation performs no framework or Application Root detection.

## Task And Living Specification Model

Retain Mini's lightweight documentation model without copying its backend content or adopting the Frontend Starter Accelerator governance system.

Runtime artifacts use:

```text
tasks/TASK-NNN/
|-- requirements.md
|-- brainstorm.md             # only when used
|-- architecture.md           # task-specific decisions
|-- api-integration.md        # may contain provisional contracts
|-- ui-design.md
|-- implementation-plan.md
`-- verification.md

specs/
|-- MANIFEST.md
|-- architecture.md
|-- api-integration.md
|-- ui-design.md
`-- implementation.md
```

These root directories are not part of the installer payload. Skills create the minimum required files lazily from templates stored inside their own `.claude/skills/<name>/` directories.

Rules:

- `tasks/TASK-NNN/` is temporary handoff context and may be removed after completion.
- `specs/` contains current product and implementation truth, not a task history.
- A direct invocation may operate without creating a task workspace when no durable handoff is needed.
- Confirmed architecture, integration, UI, and implementation decisions update the matching living spec.
- Provisional backend assumptions stay labelled in the task workspace and are not promoted to confirmed API truth.
- Do not create `ai/context`, G0-G5 metadata, governance task types, memory-sync reports, or a second documentation system.

## Ruleset Contract

Ruleset-aware skills load applicable guidance in this order:

1. `rulesets/common/<skill>/`
2. `rulesets/framework/<skill>/`
3. `rulesets/project/<skill>/`

Later layers may specialize earlier guidance. Skill authority, safety boundaries, explicit approval requirements, and STOP behavior cannot be overridden by any ruleset.

Each Ruleset may contain `shared/` vendored or cross-skill rules. Authored skill indexes may reference shared files inside the same Ruleset root; they must never escape that root.

For each layer:

- a missing skill section is valid and is skipped;
- when `INDEX.md` exists, read it and only the rule files it routes for the current work;
- every file referenced by an existing `INDEX.md` must exist and be readable, otherwise report a ruleset configuration error;
- when a section exists without `INDEX.md`, read its direct Markdown files in lexical order;
- arbitrary rule filenames are valid;
- do not recursively load an entire ruleset when a smaller matching set is available.

If no API integration, framework, or project section exists, the agent continues from repository evidence, loaded rules, and general frontend best practices. Missing optional rules are never an execution error.

### Common Ruleset Inventory

Keep authored Common guidance compact, and keep established external guidance as unchanged pinned snapshots:

```text
rulesets/common/
|-- README.md
|-- shared/
|   `-- web-interface-guidelines/
|       |-- SOURCE.md
|       `-- command.md          # unchanged pinned upstream snapshot
|-- architect/
|-- api-integration/
|-- ui-designer/
|-- coder/
|-- code-reviewer/
|-- test-generator/
|-- browser-verify/
`-- debugger/
```

The bundled indexes for `ui-designer`, `coder`, `code-reviewer`, and `browser-verify` route relevant work to the shared Web Interface Guidelines snapshot. Vendor the upstream Vercel guidelines unchanged, record the exact URL plus pinned revision or retrieval date in `SOURCE.md`, preserve required license or attribution, and keep the snapshot available offline. Do not copy the Frontend Starter Accelerator's adapted `web-design-guidelines/SKILL.md`, because its routing wrapper contains starter-specific shadcn, i18n, and React SPA assumptions. Do not fetch the latest guidelines during normal agent execution.

Other Common sections may contain concise toolset-authored rules covering:

- strict TypeScript and repository-convention discovery;
- frontend boundaries, state ownership, data flow, failure handling, performance, security, and testability;
- confirmed versus provisional API contracts, client errors, auth behavior, caching assumptions, and mocks;
- product-context UI and complete loading/empty/error/permission states;
- implementation discipline and essential behavior tests;
- evidence-first review and risk-based testing;
- browser evidence, dynamic dev-server URL discovery, console/network checks, and server ownership;
- reproduce-hypothesize-prove debugging and minimal regression-protected fixes.

### Bundled React Framework Ruleset

The bundled `rulesets/framework/` is React and TypeScript specific but project agnostic. Selection is curated at file level, while selected established rule bodies remain unchanged:

```text
rulesets/framework/
|-- README.md
|-- shared/
|   |-- react-best-practices/
|   |   |-- SOURCE.md
|   |   `-- rules/              # unchanged compatible donor files
|   `-- composition-patterns/   # only clean unchanged upstream files
|       |-- SOURCE.md
|       `-- rules/
|-- architect/INDEX.md
|-- coder/INDEX.md
|-- code-reviewer/INDEX.md
|-- test-generator/INDEX.md
`-- debugger/INDEX.md
```

Start from the Frontend Starter Accelerator's React SPA best-practice rules. The current audit identified 21 of 22 files as portable candidates. Copy each selected file byte-for-byte after verifying source and license information. Exclude `client-tanstack-query-dedup.md` whole because it requires TanStack Query and the donor repository's `services/api` plus feature-model layering.

Do not surgically remove Vite, Next.js, RSC, SWR, TanStack Query, shadcn/Tailwind, ED small, mandatory i18n, test-runner, or repository-path assumptions from a vendored rule. If a file contains an incompatible assumption, exclude the whole file or vendor a clean upstream original unchanged. For composition guidance, use clean upstream files unchanged; do not copy and edit the donor accelerator versions that contain `Accelerator Checks`.

Our authored `INDEX.md` files classify the current task and route only the relevant shared rules. They may route the same unchanged rule to multiple roles without duplicating its body. Snapshot updates are explicit maintainer changes; there is no automatic synchronization or runtime web fetch.
### Project Ruleset

Ship only `rulesets/project/README.md`. It explains:

- teams may create matching skill-section directories;
- arbitrary Markdown rule filenames are supported;
- `INDEX.md` is recommended when a section contains multiple rules;
- project rules may define architecture, libraries, naming, styling, testing, and domain conventions;
- rules are ordinary project files after copying;
- replacing or removing the bundled framework directory is allowed.

Do not generate project rules from source code automatically.

## Codex Mirror

`.claude/` is the only hand-edited workflow source.

Implement one maintainer command:

```text
npm run sync:agents
```

It must:

1. Replace `.agents/skills/` with an exact copy of `.claude/skills/`.
2. Generate `.agents/codex-agents.toml` from `.claude/agents/*.md`.
3. Produce deterministic, sorted output.
4. Support `--check` and exit non-zero when either generated mirror is stale.
5. Preserve role descriptions, read/write intent, and full instructions without creating independent Codex policy.

Commit the generated `.agents/` tree. Downstream users copy it and never run `sync:agents` as part of installation or normal use.

Document the one manual Codex activation step: include the generated agent definitions in the user-global Codex configuration and enable the runtime's multi-agent capability. The toolset must never edit that configuration.

## Installer And Runtime Toolchain

The package exposes one CLI with three effect-separated commands:

```text
frontend-accelerator install [--yes]
frontend-accelerator setup [--yes]
frontend-accelerator doctor [--json]
```

All commands use `process.cwd()` and require it to be the Git root itself. They do not accept a target path.

`install` must:

1. Resolve the source payload relative to the installed CLI package.
2. Preflight all files under `.claude/`, `.agents/`, `rulesets/`, and `toolchain/` before writing.
3. Preserve the exact-path collision rule for ordinary payload files.
4. Perform structured merge only for recognized `.claude/settings.json` and `.codex/hooks.json` registrations.
5. Preserve unrelated settings and hooks, avoid duplicate accelerator registrations, and treat changed accelerator-owned semantics as conflict.
6. Write nothing when any copy collision, malformed JSON document, or hook semantic conflict exists.
7. Preview `COPY`, `CREATE`, `MERGE`, and `UNCHANGED` operations before confirmation.
8. Never grant or bypass runtime hook trust.

`setup` must:

1. Require Node.js 24 or newer for the accelerator without changing the target application's Node range.
2. Load exact `agent-browser` and Context7 pins plus integrity values from `toolchain/manifest.json`.
3. Provision each capability through a cache-local staging directory with lifecycle scripts disabled.
4. Compare the resolved package-lock integrity before capability-specific atomic promotion.
5. Treat `agent-browser` as required and Context7 as recommended.
6. Keep application package manifests, lockfiles, `node_modules`, global PATH, and shell profiles unchanged.

`doctor` must:

1. Read Node, manifest, cache receipt/package/binary, hook registration, Hook Activation Proof, and lint capability state.
2. Use only non-mutating executable version probes.
3. Report `READY`, `DEGRADED`, or `BLOCKED`, with hook sub-statuses `NOT_CONFIGURED`, `PENDING_ACTIVATION`, `ACTIVE`, and `STALE`.
4. Never install, repair, clean, trust, or rewrite state.

The project-owned `toolchain/bin/doctor.mjs`, `agent-browser.mjs`, and `ctx7.mjs` adapters resolve only the manifest-selected cache entry. They never fall back to global executables.

## Verification And Tests

Use Node's built-in test runner and temporary fixture repositories. Avoid adding a testing framework only for maintainer scripts.

### Catalog Tests

- exactly 18 canonical command names exist;
- every name has one command, one agent, and one skill;
- command, agent, and skill names match exactly;
- no banned alias or backend lane exists;
- every command spawns only its matching agent;
- every agent invokes only its matching skill and contains an explicit STOP contract;
- every transition points to a canonical command and matches ADR-0022;
- terminal commands have no automatic successor;
- framework-specific product policy does not appear in stable skills.

### Ruleset Tests

- required Common and React section indexes reference existing files;
- arbitrary filenames are accepted;
- an absent Framework Ruleset is valid;
- an absent optional skill section is valid, including API integration;
- a broken reference in an existing `INDEX.md` fails validation with the exact path;
- the Project Ruleset initially contains no active project-specific policy;
- every vendored collection has source, revision/date, inclusion/exclusion, and license/attribution metadata;
- selected vendored rule bodies match their pinned snapshots unchanged;
- incompatible files such as `client-tanstack-query-dedup.md` are excluded whole rather than edited;
- the Web Interface Guidelines snapshot is available offline and no normal skill execution requires a runtime fetch.

### Mirror Tests

- `npm run sync:agents` produces deterministic output;
- `npm run check:agents` passes on committed mirrors;
- changing a canonical skill makes `--check` fail;
- changing a canonical agent makes `--check` fail;
- regenerated `.agents/skills/` exactly matches `.claude/skills/`;
- all 18 agents appear in generated TOML.

### Installer Tests

- successful four-directory payload installation into an empty Git root;
- source and target paths containing spaces;
- target is not a Git root;
- command is run from a Git subdirectory;
- one exact collision;
- multiple exact collisions are all reported;
- collisions cause zero writes;
- unrelated files and hook settings are preserved;
- current Claude Code and Codex registrations are created or merged once;
- malformed JSON, duplicate owned registrations, and changed owned semantics cause zero writes;
- declined confirmation causes zero writes;
- no root `AGENTS.md`, root `CLAUDE.md`, application dependency, or global configuration is changed.

### Runtime Toolchain And Hook Tests

- manifest pins, schema validation, deterministic hashing, and Node.js 24 boundary;
- Windows, macOS, Linux/XDG, override, manifest, platform, and architecture cache isolation;
- exact setup integrity, capability-specific atomic promotion, idempotence, required failure, and recommended degradation;
- Doctor readiness, activation status, stable JSON/human data, exit severity, and read-only behavior;
- current-session changed-file attribution excluding unchanged preexisting dirty files;
- one existing lint invocation, explicit missing-lint degradation, failure continuation, and unchanged Stop-loop suppression;
- project-owned browser and Context7 adapter references with no global or Playwright fallback;
- Node.js 24 CI on Windows, Linux, and macOS without live downloads.

### Manual Runtime Smoke

Current verification boundary: the repository test suite, mirror check, package dry-run, Windows setup/cache reuse, Doctor capability probes, and managed `open about:blank` -> `snapshot` -> `close` sequence pass on Node.js 24.18.0. Actual Claude Code and Codex trust/activation, one host-driven lint Stop, and hosted Linux/macOS CI remain release evidence rather than completed implementation proof.

Document and perform one Claude Code and one Codex smoke run in a disposable TypeScript frontend fixture:

1. Invoke `coder` and verify command -> isolated agent -> coder skill -> STOP.
2. Verify the agent recommends but does not invoke a next command.
3. Remove `rulesets/framework/` and verify the same command continues without a framework error.
4. Add a project rule with an arbitrary filename and verify the matching skill reads it.
5. Create two frontend app candidates and verify the skill requests an Application Root selection.
6. Run `setup`, open `about:blank` through the project-owned browser adapter, capture a snapshot, and close the owned session.
7. Review hooks through `/hooks` in both runtimes and verify Doctor changes from `PENDING_ACTIVATION` to `ACTIVE`.
8. Make a harmless current-session edit and verify the existing lint script runs once at Stop.

If the local runtime cannot execute one smoke test, record it as an explicit unverified runtime gap rather than claiming parity.

## Implementation Sequence

Keep changes reviewable and complete each stage before starting the next.

### Stage 1: Foundation And Contracts

- Add `package.json`, README skeleton, canonical catalog metadata, and Node tests.
- Define reusable command, agent, and skill templates.
- Implement catalog and transition validation.
- Implement Application Root and ruleset-loading contracts in shared skill wording.

Exit criteria: catalog tests can validate representative placeholder slices without any installer or Codex mirror.

### Stage 2: Full Canonical Lifecycle

- Implement all 18 `.claude/commands`, agents, and skills.
- Port useful Mini procedures, but rewrite every backend, NestJS, fixed-directory, duplicated frontend-lane, hook, and automatic-flow assumption.
- Add task and living-spec templates inside the responsible skills.

Exit criteria: all 18 vertical slices satisfy one-command/one-agent/one-skill/STOP and the complete route graph validates.

### Stage 3: Common And React Rulesets

- Write compact toolset-authored Common rules and vendor a pinned Web Interface Guidelines snapshot unchanged.
- Copy compatible React donor or clean upstream rule files unchanged, excluding incompatible files whole.
- Add authored routing indexes, source manifests, required attribution, the Project Ruleset README, and validation fixtures.

Exit criteria: unchanged React and Web guideline snapshots route correctly, source metadata is complete, framework removal works, arbitrary project rule names work, and broken indexes fail clearly.

### Stage 4: Committed Codex Mirror

- Implement the single `sync:agents` maintainer command.
- Generate and commit `.agents/skills/` and `.agents/codex-agents.toml`.
- Add stale-mirror tests and Codex activation documentation.

Exit criteria: `npm run check:agents` is clean and the generated catalog has semantic parity with `.claude/`.

### Stage 5: Installer, Runtime Toolchain, Hooks, And End-To-End Verification

- Implement `install`, `setup`, and read-only `doctor` in one CLI.
- Add the project manifest, managed user cache, pinned browser/Context7 adapters, and capability-specific atomic setup.
- Add the narrow hook registration merge, Hook Activation Proof, and Changed-File Lint Gate.
- Connect browser verification and current documentation consumers to project-owned adapters.
- Add conflict, zero-write, cache, setup, Doctor, hook, lint, paths-with-spaces, and cross-platform tests.
- Finish CLI, trust, recovery, framework-replacement, and live-smoke instructions.

Exit criteria: a clean existing frontend repository can install the project payload, explicitly provision executable capabilities, diagnose readiness without mutation, activate portable hooks through runtime trust, and run real browser verification without application or global dependency changes.

## Acceptance Criteria

1. The repository contains exactly 18 public frontend-native command-agent-skill slices.
2. Every invocation follows command -> matching isolated agent -> matching skill -> STOP.
3. No backend lane, orchestrator, G0-G5 flow, automatic chaining, or automatic memory exists.
4. Skills remain framework-neutral and load available Common, Framework, and Project rule sections.
5. Missing optional sections, including API integration and the entire Framework Ruleset, do not fail execution.
6. The bundled framework pack contains unchanged, source-documented React and TypeScript best-practice snapshots; incompatible project-stack files are excluded whole rather than rewritten.
7. Coder implements essential behavior tests; Test Generator expands coverage rather than replacing that responsibility.
8. Read-only review and verification roles do not modify production code.
9. Browser Verify asks before starting a discovered dev server, uses the actual URL and required project-owned `agent-browser` adapter, and stops only its own server/session.
10. Reflect writes only approved project rules.
11. `.claude/` is canonical and committed `.agents/` is reproducibly generated by one maintainer command.
12. Installation copies `.claude/`, `.agents/`, `rulesets/`, and `toolchain/`, while the recognized hook configs are the only structured-merge targets.
13. Installer collisions and hook parse/semantic conflicts produce zero writes; unrelated runtime settings and hooks are preserved.
14. Setup provisions exact `agent-browser` and Context7 pins only in the accelerator user cache and leaves the application/global dependency state unchanged.
15. Doctor is read-only and distinguishes required, recommended, configured, active, stale, and lint-degraded states.
16. Claude Code and Codex registrations use shared portable Node behavior, runtime-controlled trust, Hook Activation Proof, and one current-session Changed-File Lint Gate.
17. Rulesets remain canonical; no `.claude/rules/` mirror is generated.
18. Paths containing spaces work on Windows and the Node.js 24 CI matrix covers Windows, Linux, and macOS.
19. Automated catalog, ruleset, mirror, installer, toolchain, Doctor, hook, and lint tests pass.
20. README documents the three-command lifecycle, state changes, cache, trust, adapters, framework replacement, and known live-smoke limitations.

## Non-Goals

- Creating or modifying a frontend application.
- Shipping backend implementation guidance.
- Supporting JavaScript-only projects as a guaranteed v1 target.
- Shipping maintained Angular, Vue, Svelte, or other framework packs.
- Detecting or selecting frameworks during installation.
- Installing or configuring Vite, React, TypeScript, test runners, design systems, API libraries, or state libraries.
- Publishing to public npm as a prerequisite.
- Automatic updates, broad migration/merge, backup, ownership tracking, or application checksums.
- Editing root `AGENTS.md`, root `CLAUDE.md`, runtime-global configuration, or project package files.
- Automatically trusting or bypassing Claude Code or Codex hooks.
- RTK, CodeGraph, Graphify, a second Playwright provider, or generated `.claude/rules/`.
- Automated workflow orchestration, approvals, governance tickets, repo memory, or self-running next steps.
- GitLab or Bitbucket release publication in v1.

## Definition Of Done

The implementation is complete only when:

- all acceptance criteria are satisfied;
- `npm run check` passes from the toolset repository;
- generated mirrors are clean after a fresh `npm run sync:agents`;
- installer tests prove zero writes on copy/hook conflicts and declined confirmation;
- setup/Doctor/hook/lint tests prove cache isolation, read-only diagnostics, activation states, attribution, and loop suppression;
- the paths-with-spaces Windows case passes;
- available Claude and Codex smoke results are recorded honestly;
- documentation contains no instructions for an updater, framework detector, backend lane, orchestrator, global executable fallback, or automatic trust bypass;
- vendored Web and React rule bodies remain unchanged from their documented pinned sources;
- no required work remains hidden behind placeholder skills or TODO-only rules.
