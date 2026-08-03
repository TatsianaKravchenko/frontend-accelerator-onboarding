---
status: accepted
---

# Recommend the next manual step from task context

Skills declare allowed next steps and recommend the most relevant one from their result instead of enforcing one static successor. The current agent always stops and the user explicitly starts the next command, preserving Accelerator Mini's manual flow while allowing API work, UI work, refactors, failures, and verification needs to take different paths.

## Consequences

- A recommendation is not workflow execution or orchestration.
- Skill contracts must define allowed transitions and the conditions for recommending them.
- Context summaries must explain why a particular next step was suggested.
