---
status: accepted
---

# Execute branch finishing actions only after explicit selection

Finishing Branch may push and create a pull request, merge locally, preserve the branch and worktree, or clean up work that is already integrated, but only after showing the branch, base, commits, verification state, and exact effects and receiving an explicit user choice. Force push is forbidden, and discarding unmerged work is not a normal finishing option; destructive deletion requires a separate direct request and exact confirmation.

## Consequences

- A successful applicable Verify result is required before integration actions.
- Pull request title and body are shown for approval before creation.
- Finishing Branch retains useful git/PR automation without silently integrating or deleting work.
