---
status: accepted
---

# Vendor established best-practice rules unchanged

Established external or donor best-practice rule bodies are copied into the Common or Framework Ruleset as unchanged, pinned snapshots. The toolset authors own the skill-local `INDEX.md` routing files, source manifests, and genuinely toolset-specific rules, but they do not rewrite, consolidate, or silently improve vendored rule bodies.

Cross-skill snapshots live under the ruleset's `shared/` directory. Skill indexes may reference files within their own section or within `shared/`, but never outside the current ruleset root. Each vendored collection includes a `SOURCE.md` with its origin, pinned revision or retrieval date, included and excluded files, and any required license or attribution.

The initial Common Ruleset vendors a pinned upstream Web Interface Guidelines snapshot for `ui-designer`, `coder`, `code-reviewer`, and `browser-verify`. It is available offline; agents do not fetch the latest rules during normal use.

The initial React Framework Ruleset vendors compatible React best-practice files unchanged. The current Frontend Starter Accelerator audit identified 21 of its 22 React SPA rule files as portable candidates; `client-tanstack-query-dedup.md` is excluded because it requires TanStack Query and repository-specific layering. Adapted composition files that contain starter-specific checks are not edited in place: use clean upstream originals unchanged or exclude the file.

## Considered Options

- Rewriting and consolidating donor rules was rejected because it weakens provenance, creates a new interpretation to maintain, and risks changing established best practices.
- Loading rules from the internet on every run was rejected because copy-only installation must remain deterministic and usable offline.
- Copying every donor file was rejected because stack-specific rules would silently impose Vite, TanStack Query, shadcn/Tailwind, ED small, mandatory i18n, or fixed project paths.

## Consequences

- Selection is curated, but selected rule bodies remain byte-for-byte unchanged.
- Incompatible rules are excluded whole rather than surgically rewritten.
- Routing behavior belongs to authored `INDEX.md` files and may differ by skill without duplicating the vendored rules.
- Snapshot updates are explicit maintainer changes with source and license review; there is no automatic sync or runtime fetch.
- Framework replacement remains simple because the entire `rulesets/framework/` directory, including its vendored snapshots and indexes, is project-controlled after copying.
