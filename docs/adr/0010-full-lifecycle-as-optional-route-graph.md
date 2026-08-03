---
status: accepted
---

# Model the full lifecycle as an optional route graph

Full Lifecycle means that the toolset provides every frontend delivery capability, not that every task must pass through a mandatory pipeline. Users may invoke a suitable skill directly, while each completed skill recommends a context-appropriate allowed next step and stops; when a directly invoked skill encounters missing requirements, architecture decisions, or dependency choices, it recommends the earlier specialist instead of silently expanding its authority.

## Consequences

- Large features can use the complete journey, while small bugs and documentation changes take shorter routes.
- Skills need explicit entry conditions, stop conditions, and allowed transitions.
- The toolset has no hidden gates or automatic orchestration.
