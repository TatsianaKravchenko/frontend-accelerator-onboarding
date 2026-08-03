---
status: accepted
---

# Keep missing backend contracts explicitly provisional

API Integration must not present an invented endpoint or payload as backend truth. When a contract is missing or incomplete, it separates confirmed, assumed, proposed, and blocked elements, may create a frontend contract proposal and provisional mock schema in the Task Workspace, and recommends backend clarification before confirmed API truth is written to a Living Specification.

## Consequences

- Provisional mocks and types must be visibly labelled and traceable to unresolved assumptions.
- Living API integration specifications distinguish confirmed contracts from proposals.
- API Integration may describe frontend needs but has no authority to commit backend behavior.
