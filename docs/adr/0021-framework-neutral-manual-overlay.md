---
status: superseded
superseded_by: ADR-0023
---

# Keep the manual overlay framework-neutral

The complete manual-install `overlay/` contains the managed Common Ruleset and empty project-owned `rulesets/framework/` and `rulesets/project/` directories. It does not install React guidance by default. The release places the generic React Framework Ruleset beside the overlay as a separate ready-to-copy directory whose contents a React project may copy into `rulesets/framework/`.

The CLI installer uses the same neutral baseline. It detects React only when the resolved Application Root `package.json` contains the exact `react` key in `dependencies` or `devDependencies`; it does not scan source files or infer from indirect repository evidence. A positive detection or explicit user selection seeds the React rules into `rulesets/framework/` as a one-time project-owned copy. Angular, Vue, unknown, and ambiguous projects remain framework-unconfigured and continue through repository evidence, Common and Project Rulesets, and general frontend best practices.

## Considered Options

- Bundling React rules inside the manual overlay was rejected because copying the overlay into a non-React project could silently activate JSX and React guidance.
- Shipping separate installed framework-pack directories and a selector registry was rejected because the project needs only one active convention-based `rulesets/framework/` directory.
- Generating framework rules from source code was rejected because inferred conventions are not durable project policy.

## Consequences

- Manual React installation is two copy operations: the complete overlay, then the optional React rules directory.
- CLI React installation remains one command because detection or explicit selection performs the second copy.
- Seeded React rules are absent from `managedFiles` and are never overwritten by accelerator updates.
- The release may contain optional source material outside `overlay/`; only the single active ruleset is copied into the downstream repository.
