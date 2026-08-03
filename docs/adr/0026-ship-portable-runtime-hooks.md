---
status: accepted
---

# Ship portable runtime hooks

The toolset ships runtime-specific Claude Code and Codex registrations backed by shared cross-platform Node handlers. Its first required guardrail is the Changed-File Lint Gate: PostToolUse records only files changed by the current agent session, and Stop applies the project's existing lint capability before successful completion without installing dependencies, running autofix, or treating unrelated working-tree changes as agent output.

Hook trust remains controlled by each runtime and is never granted or bypassed by the installer. A lightweight Hook Activation Proof lets Runtime Doctor distinguish a configured hook from one that has actually executed for the current Runtime Toolchain Manifest; Semantic Runtime Parity requires equivalent guardrail outcomes, not identical registration syntax.

## Considered Options

- Keeping safety instruction-only was rejected because deterministic checks should not depend on the model choosing to run them.
- Copying the donor accelerator's shell hooks was rejected because portable Node handlers avoid Bash, jq, and OS-specific command assumptions.
- Running lint after every edit was rejected because it is noisy and unnecessarily expensive.
- Automatically trusting hooks was rejected because it bypasses a runtime security boundary.

## Consequences

- Missing project lint capability is reported as a degraded guardrail rather than silently passing.
- Hook configuration may require the Copy Installer's narrow Hook Registration Merge.
- Claude Code and Codex users review new or changed hooks through their runtime trust flow before Runtime Doctor can report them active.
- ADR-0017 is superseded.
