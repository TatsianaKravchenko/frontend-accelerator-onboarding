---
status: accepted
---

# Provision a minimum Runtime Toolchain

The toolset guarantees executable capabilities rather than distributing instructions alone. A project-owned Runtime Toolchain Manifest pins compatible tools, Runtime Setup provisions them into a reconstructible user-local Runtime Toolchain Cache, and Runtime Doctor reports readiness without changing state; `agent-browser` is required, Context7 is recommended, and RTK plus code-graph tooling remain outside the first implementation. The accelerator CLI and its managed toolchain require Node.js 24 or newer; this requirement applies to the accelerator runtime, not to the target application's Node.js version.

The Copy Installer remains separate from Runtime Setup and never changes application dependencies, lockfiles, or global PATH state. Ordinary payload files stay copy-only, while recognized Claude Code and Codex hook configuration is the only structured-merge exception: the installer previews an append-only, duplicate-free registration change and writes nothing on parse or semantic conflicts.

## Considered Options

- Global tool installation was rejected because it is not project-pinned and can create cross-project version conflicts.
- Application dev dependencies were rejected because repository roots may not be package roots and the accelerator must not modify application package manifests or lockfiles.
- RTK was deferred because command rewriting differs across runtimes and can hide diagnostic context.
- CodeGraph and Graphify were deferred because indexing, MCP registration, hook ownership, storage, and privacy form a separate subsystem.

## Consequences

- `frontend-accelerator install`, `frontend-accelerator setup`, and `frontend-accelerator doctor` are distinct commands with distinct effects.
- The package declares Node.js 24 or newer even when the target application supports an older Node.js release.
- Required capability failures block executable readiness; recommended capability failures produce a degraded status.
- New manifest versions may provision new cache entries without mutating application dependencies.
- ADR-0014 and ADR-0023 are superseded.
