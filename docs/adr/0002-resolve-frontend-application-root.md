---
status: accepted
---

# Resolve the frontend application root instead of requiring a fixed directory

The toolset must not inherit Accelerator Mini's mandatory `frontend/` directory. In a single-application repository the Application Root is the Repository Root; in a monorepo the session scanner resolves the only frontend application or requires the user to select one when multiple candidates exist, and every skill operates on that resolved root rather than embedding layout-specific paths.

## Consequences

- Skills and rulesets cannot assume `frontend/`, `web/`, `apps/*`, or a root `package.json`.
- Application-root resolution is shared workflow context, not framework-specific policy.
- Ambiguous monorepos require explicit user selection rather than a silent guess.
