---
status: accepted
---

# Keep the initial React framework ruleset project-agnostic

The initial Framework Ruleset provides generic React and TypeScript guidance for components, composition, hooks, state, effects, rendering, asynchronous behavior, performance, accessibility, and testing. It must not require the Frontend Starter Accelerator's ED small architecture, `services/api`, TanStack Query, shadcn/Tailwind, `en`/`ru` i18n, Vite-only or Next-only layout, or repository-specific paths; those concerns belong to Project Rulesets or optional presets.

## Consequences

- Donor rules are curated and classified at file level; selected best-practice files are copied unchanged according to ADR-0024 rather than rewritten or consolidated.
- The first donor pass keeps React and TypeScript guidance for rendering, state, effects, component composition, asynchronous behavior, bundle splitting, accessibility, and React testing.
- Files that require Vite, TanStack Query, shadcn/Tailwind, ED small, mandatory i18n, or repository-specific paths are excluded whole from the bundled Framework Ruleset even when they appear in the donor accelerator.
- React guidance must remain usable in both SPA and framework-based React repositories unless a rule explicitly routes to a detected environment.
- Project architecture and library choices cannot leak into the replaceable Framework Ruleset.
