---
status: accepted
---

# Limit Reflect writes to approved project rules

Reflect may analyze an incident and draft a durable rule, but it writes only to the Project Ruleset and only after explicit user approval. Gaps in Common or Framework Rulesets become proposals for their owners, while `AGENTS.md`, skills, and managed rules remain unchanged by Reflect so a downstream correction cannot silently mutate core behavior or a reusable framework pack.

## Consequences

- Reflect remains a manual utility rather than automatic learning.
- Proposed common or framework improvements require a separate owner-controlled change.
- One-off incidents should not become project rules without demonstrated recurrence or an explicit user decision.
