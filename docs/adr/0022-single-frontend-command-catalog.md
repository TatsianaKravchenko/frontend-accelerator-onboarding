---
status: accepted
---

# Use one frontend-native command catalog

The first version exposes exactly these 18 public commands:

```text
requirements-analyst
brainstorm
writing-plans
architect
api-integration
ui-designer
git-worktrees
coder
code-reviewer
test-generator
browser-verify
debugger
verify
docs-generator
finishing-branch
release
reflect
skill-creator
```

Each command maps one-to-one to an isolated agent and one skill with the same canonical name, then stops. `coder` is frontend-native, so there is no `coder-frontend`. `api-integration` replaces backend-authoring `api-designer`; `ui-designer` replaces `frontend-design`; and `code-reviewer` accepts a local diff, branch diff, or pull request, so there is no separate `review-pr` command or compatibility alias.

The optional route graph controls only which next commands an agent may recommend. It never blocks a user from manually invoking another command:

| Completed command | Allowed next-step recommendations |
| --- | --- |
| `requirements-analyst` | `brainstorm`, `architect`, `api-integration`, `ui-designer`, `writing-plans` |
| `brainstorm` | `requirements-analyst`, `architect`, `api-integration`, `ui-designer`, `writing-plans` |
| `architect` | `api-integration`, `ui-designer`, `writing-plans` |
| `api-integration` | `architect`, `ui-designer`, `writing-plans` |
| `ui-designer` | `architect`, `api-integration`, `writing-plans` |
| `writing-plans` | `git-worktrees`, `coder` |
| `git-worktrees` | `coder` |
| `coder` | `code-reviewer`, `test-generator`, `browser-verify`, `debugger`, `verify` |
| `code-reviewer` | `coder`, `test-generator`, `browser-verify`, `verify` |
| `test-generator` | `code-reviewer`, `browser-verify`, `debugger`, `verify` |
| `browser-verify` | `coder`, `debugger`, `verify` |
| `debugger` | `coder`, `test-generator`, `code-reviewer`, `browser-verify`, `verify` |
| `verify` | On failure: `coder`, `debugger`, `test-generator`, `browser-verify`; on success: `docs-generator`, `finishing-branch` |
| `docs-generator` | `verify`, `finishing-branch` |
| `finishing-branch` | `release` when a release is intended; otherwise terminal |
| `release` | Terminal |
| `reflect` | Terminal; the user may manually rerun the command whose behavior was corrected |
| `skill-creator` | Terminal |

## Consequences

- Public terminology stays frontend-native and contains no backend or parallel frontend lane.
- Claude slash-command wrappers and Codex mirrors expose the same canonical names even if invocation syntax differs.
- Adding, renaming, or splitting a public command requires an explicit catalog change rather than an implicit skill alias.
- Maintenance utilities remain standalone and do not become orchestrators.
