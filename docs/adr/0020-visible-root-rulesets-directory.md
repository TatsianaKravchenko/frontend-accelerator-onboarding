---
status: accepted
---

# Keep rulesets in a visible repository-root directory

Every copy contains one visible `rulesets/` directory at the Repository Root:

```text
rulesets/
├── common/       # bundled framework-neutral baseline
├── framework/    # bundled React-first pack; replaceable
└── project/      # local project guidance
```

Ruleset-aware skills resolve these paths from the Repository Root even when the selected Application Root is nested inside a monorepo. The toolset does not hide rules under `.accelerator/`, require a global `rulesets.yml`, or maintain multiple installed framework packs.

## Considered Options

- `.accelerator/rulesets/` was rejected because framework replacement is a normal developer task and should remain easy to discover.
- Application-local rulesets were rejected because one copied workflow needs one unambiguous policy location at repository scope.
- A ruleset registry file was rejected because the convention-only directory contract is sufficient for the first version.

## Consequences

- React projects can use the bundled framework pack immediately.
- Angular, Vue, and other projects replace or remove `rulesets/framework/` before relying on framework-specific guidance.
- Missing framework skill sections are valid and fall back to repository evidence, Common and Project Rulesets, and general frontend best practices.
- After copying, every ruleset file is controlled by the downstream project; later upgrades are manual.
- Existing unrelated files under `rulesets/` may coexist during CLI installation; only exact target-file collisions stop the copy.
