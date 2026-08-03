---
status: superseded
superseded_by: ADR-0023
---

# Leave non-React projects framework-unconfigured

The first release installs the bundled React Framework Ruleset only when React is detected or explicitly selected. Angular, Vue, unknown, or ambiguous projects receive the Framework Ruleset skeleton in an unconfigured state, preventing React and JSX guidance from being applied to another framework. Missing framework guidance does not block a skill: it proceeds from repository evidence, available Common and Project Rulesets, and general frontend best practices. Projects may add framework sections gradually as the team needs them.

## Consequences

- Framework detection influences only safe pack seeding and never rewrites application code.
- Detection reads only the resolved Application Root `package.json`; the exact `react` key in `dependencies` or `devDependencies` enables the React seed.
- Missing, ambiguous, workspace-root-only, or otherwise indirect evidence defaults to unconfigured state without source-code scanning. The user may still select React explicitly.
- Framework guidance is optional per skill; for example, `api-integration` may run without a framework-specific section.
- An absent skill section is not an error and does not require a global `ruleset.yml` manifest.
- A present `INDEX.md` with missing or unreadable selected rules is a configuration error because declared project guidance must not be ignored silently.
- The manual-install overlay is framework-neutral; React guidance is a separate optional seed, while the CLI seeds it only after confident detection or explicit selection.
