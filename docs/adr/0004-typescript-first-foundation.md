---
status: accepted
---

# Use TypeScript as the fixed language foundation for the first version

The first version is framework-neutral but TypeScript-first: strict TypeScript guidance belongs to the Common Ruleset and React, Angular, or future framework packs may rely on it. A replaceable language layer and guaranteed JavaScript-project support are deferred to avoid adding another abstraction before there is a demonstrated need.

## Consequences

- Common coding guidance may assume TypeScript and strict typing.
- Framework pack authors do not need to duplicate baseline TypeScript rules.
- JavaScript-only repositories are outside the guaranteed support boundary of the first version.
