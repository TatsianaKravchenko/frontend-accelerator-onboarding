---
status: superseded
superseded_by: ADR-0023
---

# Make the first installation atomic on exact-path collisions

Before the first installation writes anything, the installer performs a complete preflight against every target path it intends to own. If any exact target file already exists and no valid Installation Receipt establishes accelerator ownership, the installer reports all conflicting paths and exits without creating, modifying, renaming, moving, or backing up any file.

Existing unrelated files inside `.claude/`, `.agents/`, ruleset directories, or other target parent directories are allowed. A directory is not treated as conflicting merely because it already exists. The project team resolves exact-path collisions manually and reruns the same installation command.

## Considered Options

- Overwriting existing files after confirmation was rejected because first installation has no ownership evidence.
- Automatically merging Markdown or configuration files was rejected because semantic merges are unpredictable.
- Renaming or backing up conflicting files was rejected because it changes project-owned state and creates cleanup work.
- Installing only non-conflicting files was rejected because it leaves a partial toolset with unclear behavior.

## Consequences

- First-install preflight is all-or-nothing: any detected collision causes zero installation writes.
- Preflight reports every exact-path collision in one result so the user can resolve them together.
- No installation directories, adapter files, ruleset templates, or receipt are written when preflight fails.
- A successful installation writes the receipt; later idempotent runs and updates use receipt ownership rather than first-install collision rules.
- These preflight and zero-write guarantees apply to the CLI installer; manual overlay copying remains the user's filesystem operation.
