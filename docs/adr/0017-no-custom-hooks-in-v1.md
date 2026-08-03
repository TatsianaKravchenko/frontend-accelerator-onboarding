---
status: superseded
superseded_by: ADR-0026
---

# Ship the first version without custom hooks

The first version does not install custom Claude or Codex hooks. It does not copy Accelerator Mini's session-context hook, command rewriters, naming or shell validators, loop detection, desktop notifications, or Stop hooks. Manual Flow and its one-agent/one-skill/STOP boundary remain explicit agent behavior rather than a hook-enforced pipeline.

Safety relies on the runtime's native permissions and sandbox, scoped role instructions, read-only role boundaries, and explicit user approval for destructive, external, or user-global actions. Checks and diagnostics run only when the user invokes the relevant command or approves an agent request; the toolset does not intercept every tool call.

## Considered Options

- Copying all Accelerator Mini hooks was rejected because several are convenience features, runtime-specific, or unrelated to the frontend lifecycle.
- Building equivalent hook systems for Claude and Codex was rejected because it would add platform-specific maintenance without changing the core Manual Flow.
- Shipping one mandatory safety hook was deferred until a demonstrated failure shows that runtime permissions and agent instructions are insufficient.

## Consequences

- The installer does not add hook registrations or install hook scripts.
- Claude and Codex share the same workflow without requiring hook parity.
- Runtime-native approval and sandbox behavior may differ and must be described honestly.
- A role or skill cannot claim that STOP, read-only behavior, or command safety is mechanically enforced by a custom hook.
- Future hooks require a separate decision based on an observed problem and should be optional unless the safety case proves otherwise.
