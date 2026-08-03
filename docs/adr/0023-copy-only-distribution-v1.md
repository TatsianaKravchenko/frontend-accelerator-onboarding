---
status: superseded
superseded_by: ADR-0025
---

# Use copy-only distribution in the first version

The toolset repository itself contains the ready-to-copy `.claude/`, `.agents/`, and `rulesets/` directories. A developer installs the toolset by copying those three directories into the target Git root. An optional Node CLI invoked through `npx` performs the same copy operation: it lists exact target files, reports exact-path conflicts, asks for confirmation, and copies the files. It does not migrate, merge, back up, register, or update an installation.

The bundled `rulesets/framework/` contains the generic React and TypeScript ruleset by default. A non-React project replaces or removes that directory before relying on framework-specific guidance. Commands and agents do not detect the framework during installation; missing framework skill sections remain valid and fall back to repository evidence, Common and Project Rulesets, and general frontend best practices.

The first version has no installation overlay, receipt, checksum registry, ownership registry, framework seed, automatic framework detection, or automatic accelerator update. All copied files become ordinary project files. Toolset upgrades are manual: obtain a newer version, inspect its diff, and copy selected files under normal version-control review.

## Considered Options

- A framework-neutral overlay plus optional React seed was rejected because it adds a second distribution shape and a selection step to a React-first toolset.
- An installation receipt with checksums and atomic updates was rejected because it turns a folder toolkit into a package manager.
- Automatic merge, backup, migration, and framework detection were rejected because the developer already controls the target repository and its version history.

## Consequences

- Manual copy is a first-class installation path; the CLI is only convenience automation for the same operation.
- The CLI is first-copy only and refuses exact target-file conflicts without writing anything. Manual copying remains fully user-controlled.
- There is no `accelerator-update` command in the first version.
- The installer never changes application source, dependencies, hooks, root agent instructions, or user-global runtime configuration.
- Codex users still perform the runtime-required manual global configuration step described by the Codex mirror documentation.
