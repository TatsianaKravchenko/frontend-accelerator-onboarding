---
status: superseded
superseded_by: ADR-0025
---

# Provide an optional copy-only project installer

The toolset repository itself contains the installable `.claude/`, `.agents/`, and `rulesets/` directories. Manual copying is a first-class installation path. As a convenience, a small Node CLI runnable from GitHub or a local package path through `npx` copies the same files into an existing repository without requiring public npm publication.

The CLI treats its current working directory as the target Git root. It enumerates every source file, previews the target paths, reports all exact-path conflicts, asks for confirmation, and then copies. If any exact target file already exists, it exits before writing anything. Existing parent directories and unrelated sibling files are allowed.

## Consequences

- The CLI is first-copy convenience, not an adoption engine, package manager, or updater.
- It does not search parent directories, accept `--target`, detect frameworks, resolve an Application Root, merge files, create backups, or maintain hidden installation state.
- It never changes application source, dependencies, hooks, root `AGENTS.md` or `CLAUDE.md`, local settings, or user-global runtime configuration.
- Manual copy and CLI copy install the same three directories; manual conflict handling remains the developer's responsibility.
- Later toolset upgrades are manual and use normal version-control diff and review.
