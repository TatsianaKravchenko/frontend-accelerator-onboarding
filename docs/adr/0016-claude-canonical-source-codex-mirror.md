---
status: accepted
---

# Use Claude as canonical source and generate the Codex mirror

The first version supports both Claude Code and Codex while following the existing frontend accelerator pattern. `.claude/commands/` is the canonical command catalog, `.claude/agents/` is the canonical role source, and `.claude/skills/` is the canonical skill source. Shared workflow content remains portable even though its source uses the Claude-compatible repository layout.

Claude Code reads the canonical files directly. Codex receives generated project-local artifacts under `.agents/skills/` plus `.agents/codex-agents.toml`. The generated `.agents/` tree is committed to the toolset repository as a ready-to-copy artifact. Toolset maintainers regenerate it from `.claude/` through `npm run sync:agents`; downstream developers do not run this command during installation or normal use. These mirrors contain no independent delivery policy. To use isolated Codex roles, the developer manually includes the generated agent definitions in user-global Codex configuration and enables the runtime's multi-agent capability; copy installation never edits global configuration. Invocation syntax and runtime capabilities may differ, but `coder`, `architect`, and every other role retain the same meaning, one-agent/one-skill/STOP boundary, and allowed lifecycle transitions.

## Considered Options

- A third runtime-neutral core directory was rejected because it adds indirection without solving a demonstrated problem.
- Supporting only Claude Code was rejected because the workflow itself is not Claude-specific and the existing frontend accelerator already demonstrates a Codex mirror pattern.
- Maintaining separate Claude and Codex command, agent, and skill trees by hand was rejected because duplicated policy would drift.

## Consequences

- The product has one command catalog, one role catalog, one skill catalog, and one route graph under `.claude/`.
- `.agents/skills/` and the Codex agent configuration are committed generated mirrors and are never edited by hand.
- The installer writes the canonical `.claude/` files and generated `.agents/` mirrors by default after one preview and confirmation; it does not ask the developer to choose a runtime.
- Toolset maintainers run `npm run sync:agents` to regenerate Codex mirrors from the canonical Claude-compatible source before release; the command is not part of downstream installation or usage.
- Downstream projects adopt newer committed mirror files together with the rest of the reviewed project payload.
- Copy installation never changes user-global Claude or Codex configuration; Codex activation remains an explicit developer step.
- Cross-runtime tests verify semantic parity without requiring identical runtime internals. ADR-0026 extends that parity contract to portable runtime hooks.
- Capability gaps are reported as runtime limitations rather than silently changing the workflow.
