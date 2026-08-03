---
status: accepted
---

# Keep root agent instruction files project-owned

The copy source and Copy Installer never create, modify, or delete root `AGENTS.md` or `CLAUDE.md`. They do not append a managed block or require either file to exist. The project team remains free to create, edit, or delete these files at any time. The toolset remains self-contained in its canonical `.claude/` command, agent, and skill files, generated `.agents/` Codex mirror, and rulesets.

Existing repository instructions continue to apply through the normal runtime instruction hierarchy. They may add project context or stricter constraints, and the toolset must respect them, but adoption does not claim ownership of their content.

## Considered Options

- Creating root instruction files when absent was rejected because the runtime-specific command and skill discovery paths are sufficient.
- Appending a managed marker block was rejected because editing an existing source-of-truth file introduces merge and ownership ambiguity.
- Replacing root files with toolset templates was rejected because it could destroy project policy during adoption.

## Consequences

- Root `AGENTS.md` and `CLAUDE.md` are always project-owned and absent from the copy source.
- The Copy Installer preview reports no writes to those paths.
- The toolset cannot depend on a root instruction file to route commands, load rulesets, or enforce Manual Flow.
- Conflicts between existing project instructions and toolset behavior are surfaced to the user rather than repaired by rewriting project instructions.
