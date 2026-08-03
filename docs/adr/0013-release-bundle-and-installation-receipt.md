---
status: superseded
superseded_by: ADR-0023
---

# Distribute versioned release bundles with a minimal installation receipt

The toolset is distributed as versioned GitHub release bundles rather than requiring public npm publication. Each complete installation includes `.accelerator/installation.json` with exactly two fields: `version`, containing the installed toolset version, and `managedFiles`, mapping every accelerator-managed path to its installed SHA-256 checksum. Project-owned paths are omitted. The receipt contains no project profile, framework choice, history, timestamps, or workflow metadata.

Before an update writes anything, it validates every path and checksum in the current receipt and checks new target paths for collisions. Any missing file, changed checksum, invalid receipt, or target conflict reports all affected paths and cancels the complete update with no writes. A clean update replaces managed runtime files and Common Ruleset files, regenerates the Codex mirror, and writes the new receipt only after the file update succeeds.

Every release bundle includes a complete framework-neutral manual-install `overlay/` with its precomputed receipt. Copying the whole overlay produces the same registered managed file set as the CLI installer; incomplete or checksum-invalid manual copies are refused by update. Optional project-owned framework seeds live outside the overlay and outside `managedFiles`.

## Consequences

- A locally modified managed file becomes an explicit conflict and is never silently overwritten.
- Updates have no force or partial mode; the user resolves conflicts manually and reruns the same update command.
- Updates cannot replace whole `.claude/` or `.agents/` directories or use destructive directory resets.
- Framework and Project Rulesets, tasks, living specifications, local settings, root agent instructions, and other project-owned files are absent from `managedFiles` and never overwritten.
- The receipt is an update safety record, not a project configuration or memory system.
