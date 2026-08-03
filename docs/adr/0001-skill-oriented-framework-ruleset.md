---
status: accepted
---

# Organize the active framework ruleset by skill

The toolset keeps commands, agents, and skills framework-neutral and uses one project-owned active Framework Ruleset, initially populated with React guidance. Common, Framework, and Project Rulesets live at Repository Root under `rulesets/common/`, `rulesets/framework/`, and `rulesets/project/`; they use stable skill names and may include a shared section. Each skill loads matching sections in `common -> framework -> project` order. A provided section may expose an `INDEX.md` routing matrix that selects the smallest relevant set from its own files and the current Ruleset's `shared/` directory; without an index, its direct Markdown files are loaded in lexical order. Another framework may replace the whole Framework Ruleset or add only the sections it needs, allowing skills to use focused guidance without embedding React, Angular, or Vue knowledge in the workflow.

## Considered Options

- A topic-oriented ruleset was rejected because every skill would need its own routing map across overlapping topics.
- Bundling multiple selectable framework packs was deferred because the first version needs a simple replacement contract rather than a framework registry and selection mechanism.
- Recursively loading every rule file was rejected because large framework packs would consume context with guidance unrelated to the current task.
- A mandatory framework manifest and eager whole-pack validator were rejected because skill-local conventions are sufficient for the first version.

## Consequences

- Framework pack authors must preserve the agreed directory name for each skill section they choose to provide.
- Common guidance spans the full frontend lifecycle rather than serving implementation alone.
- Only content-producing or assessing skills are ruleset-aware; workflow and operational utilities do not require empty ruleset sections.
- Cross-skill framework guidance and unchanged vendored snapshots belong in `shared`; skill-specific authored guidance belongs in the matching skill section.
- Bundled sections provide `INDEX.md`; simple project sections may omit it and expose direct Markdown files in lexical order.
- Rule filenames are defined by the pack and are never hardcoded in agents or skills; indexes may reference only files inside the current Ruleset root.
- Replacing `rulesets/framework/` means supplying compatible stable skill sections. Arbitrary direct Markdown files are valid when a section has no index.
- Project rules may specialize framework rules, and framework rules may specialize common guidance.
- Non-overridable safety, permissions, and agent behavior remain in policy files and runtime-native controls rather than rulesets.
- The first version has no automatic updater; downstream projects compare and adopt newer rules manually.
- A missing matching Framework Ruleset section is treated as unavailable optional guidance, not an error; the skill proceeds from repository evidence, other loaded rules, and general frontend best practices.
- If an `INDEX.md` exists but selects a missing or unreadable rule file, the skill stops with a clear configuration error instead of silently ignoring the broken rule.
