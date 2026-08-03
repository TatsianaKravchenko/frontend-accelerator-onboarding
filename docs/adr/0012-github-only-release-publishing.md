---
status: accepted
---

# Support GitHub release publishing only in the first version

Release publishing in the first version targets GitHub through `gh` when the repository remote confirms GitHub and authentication is available. Other repositories may receive locally prepared version, changelog, and release-note artifacts, but publication is reported as blocked; GitLab and Bitbucket provider abstractions are deferred.

## Consequences

- Changelog writes and final tag/push/release publication require separate explicit confirmations.
- Default branch, version source, and package location are discovered from the project rather than assumed.
- Non-GitHub projects can use the rest of the lifecycle without pretending that release publication succeeded.
