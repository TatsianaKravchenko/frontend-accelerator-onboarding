import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const catalog = [
  "requirements-analyst",
  "brainstorm",
  "writing-plans",
  "architect",
  "api-integration",
  "ui-designer",
  "git-worktrees",
  "coder",
  "code-reviewer",
  "test-generator",
  "browser-verify",
  "debugger",
  "verify",
  "docs-generator",
  "finishing-branch",
  "release",
  "reflect",
  "skill-creator",
];

const transitions = {
  "requirements-analyst": ["brainstorm", "architect", "api-integration", "ui-designer", "writing-plans"],
  brainstorm: ["requirements-analyst", "architect", "api-integration", "ui-designer", "writing-plans"],
  architect: ["api-integration", "ui-designer", "writing-plans"],
  "api-integration": ["architect", "ui-designer", "writing-plans"],
  "ui-designer": ["architect", "api-integration", "writing-plans"],
  "writing-plans": ["git-worktrees", "coder"],
  "git-worktrees": ["coder"],
  coder: ["code-reviewer", "test-generator", "browser-verify", "debugger", "verify"],
  "code-reviewer": ["coder", "test-generator", "browser-verify", "verify"],
  "test-generator": ["code-reviewer", "browser-verify", "debugger", "verify"],
  "browser-verify": ["coder", "debugger", "verify"],
  debugger: ["coder", "test-generator", "code-reviewer", "browser-verify", "verify"],
  verify: ["coder", "debugger", "test-generator", "browser-verify", "docs-generator", "finishing-branch"],
  "docs-generator": ["verify", "finishing-branch"],
  "finishing-branch": ["release"],
  release: [],
  reflect: [],
  "skill-creator": [],
};

function parseFrontmatter(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  assert.ok(match, `${file}: missing YAML frontmatter`);
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    const value = rawValue.trim();
    data[key] = value.startsWith("[")
      ? value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean)
      : value.replace(/^['"]|['"]$/g, "");
  }
  return { body: match[2], data };
}

async function markdownNames(directory) {
  return (await readdir(directory))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -3))
    .sort();
}

test("the public catalog has exactly 18 one-to-one slices", async () => {
  const commands = await markdownNames(path.join(root, ".claude", "commands"));
  const agents = await markdownNames(path.join(root, ".claude", "agents"));
  const skills = (await readdir(path.join(root, ".claude", "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(commands, [...catalog].sort());
  assert.deepEqual(agents, [...catalog].sort());
  assert.deepEqual(skills, [...catalog].sort());
});

test("each command spawns one matching agent and declares the accepted graph", async () => {
  for (const name of catalog) {
    const file = path.join(root, ".claude", "commands", `${name}.md`);
    const { body, data } = parseFrontmatter(await readFile(file, "utf8"), file);
    assert.equal(data.name, name);
    assert.equal(data.spawns, name);
    assert.deepEqual(data["flow-next"] ?? [], transitions[name]);
    assert.match(body, /\$ARGUMENTS/);
    assert.match(body, new RegExp(`subagent_type:\\s*${name}`));
    assert.doesNotMatch(body, /automatically (?:run|invoke|chain)/i);
  }
});

test("each agent invokes one matching skill and stops", async () => {
  for (const name of catalog) {
    const file = path.join(root, ".claude", "agents", `${name}.md`);
    const { body, data } = parseFrontmatter(await readFile(file, "utf8"), file);
    assert.equal(data.name, name);
    assert.equal(data.invokes, name);
    assert.match(body, new RegExp(`(?:invoke|execute).*\\b${name}\\b`, "i"));
    assert.match(body, /\bSTOP\b/);
    assert.match(body, /never (?:invoke|start|run) the next command/i);
  }
});

test("each skill has matching identity and allowed transitions", async () => {
  for (const name of catalog) {
    const file = path.join(root, ".claude", "skills", name, "SKILL.md");
    const { body, data } = parseFrontmatter(await readFile(file, "utf8"), file);
    assert.equal(data.name, name);
    assert.deepEqual(data["flow-next"] ?? [], transitions[name]);
    assert.match(body, /## Stop Contract/);
    assert.match(body, /STOP/);
  }
});

test("removed backend and compatibility command names stay absent", async () => {
  const names = await markdownNames(path.join(root, ".claude", "commands"));
  for (const banned of ["coder-frontend", "api-designer", "frontend-design", "review-pr", "accelerator-update"]) {
    assert.ok(!names.includes(banned), `banned command exists: ${banned}`);
  }
});
