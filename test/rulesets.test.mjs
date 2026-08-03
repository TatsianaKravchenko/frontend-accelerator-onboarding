import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rulesetsRoot = path.join(root, "rulesets");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    if (entry.isFile()) files.push(fullPath);
  }
  return files.sort();
}

function layerRootFor(file) {
  for (const layer of ["common", "framework", "project"]) {
    const candidate = path.join(rulesetsRoot, layer);
    if (file === candidate || file.startsWith(`${candidate}${path.sep}`)) return candidate;
  }
  throw new Error(`No ruleset layer for ${file}`);
}

function markdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/g)].map((match) => match[1]);
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

test("all ruleset index references exist and stay inside their layer", async () => {
  const indexes = (await walk(rulesetsRoot)).filter((file) => path.basename(file) === "INDEX.md");
  assert.ok(indexes.length >= 13, "expected bundled Common and Framework indexes");

  for (const index of indexes) {
    const layerRoot = layerRootFor(index);
    for (const reference of markdownLinks(await readFile(index, "utf8"))) {
      const filePart = reference.split("#", 1)[0];
      const target = path.resolve(path.dirname(index), filePart);
      assert.ok(target.startsWith(`${layerRoot}${path.sep}`), `${index}: reference escapes layer: ${reference}`);
      await assert.doesNotReject(readFile(target, "utf8"), `${index}: missing reference ${reference}`);
    }
  }
});

test("the pinned Web Interface Guidelines snapshot is offline and source documented", async () => {
  const directory = path.join(rulesetsRoot, "common", "shared", "web-interface-guidelines");
  const source = await readFile(path.join(directory, "SOURCE.md"), "utf8");
  assert.match(source, /4e799d45c17aec1498c269287a83b9dba22b966b/);
  assert.match(source, /License: MIT/);
  assert.equal(await sha256(path.join(directory, "command.md")), "eea73cb6dd46fee9faec9973e8e7fe198b5f07ec326f14d276a56e50287e1cab");
  assert.equal(await sha256(path.join(directory, "LICENSE")), "6cd1609c9c12233507cdd2ce0d32e9a721e3c27494951be06b90090deeeb7af2");

  for (const section of ["ui-designer", "coder", "code-reviewer", "browser-verify"]) {
    const index = await readFile(path.join(rulesetsRoot, "common", section, "INDEX.md"), "utf8");
    assert.match(index, /shared\/web-interface-guidelines\/command\.md/);
  }
});

test("the React snapshot contains 21 portable donor files and excludes the stack-bound rule", async () => {
  const directory = path.join(rulesetsRoot, "framework", "shared", "react-best-practices");
  const ruleFiles = (await readdir(path.join(directory, "rules"))).filter((file) => file.endsWith(".md")).sort();
  assert.equal(ruleFiles.length, 21);
  assert.ok(!ruleFiles.includes("client-tanstack-query-dedup.md"));

  const source = await readFile(path.join(directory, "SOURCE.md"), "utf8");
  assert.match(source, /9b02938281271fb98b97ef8447281b38ab5dd490/);
  assert.match(source, /Local modifications to selected files: none/);
  assert.match(source, /client-tanstack-query-dedup\.md/);

  const forbidden = /TanStack Query|services\/api|src\/features|src\/shared|ED small|shadcn\/Tailwind|project-profile/i;
  for (const file of ruleFiles) {
    assert.doesNotMatch(await readFile(path.join(directory, "rules", file), "utf8"), forbidden, `${file} is stack-bound`);
  }
});

test("composition rules come from the clean source and keep version gating explicit", async () => {
  const directory = path.join(rulesetsRoot, "framework", "shared", "composition-patterns");
  const ruleFiles = (await readdir(path.join(directory, "rules"))).filter((file) => file.endsWith(".md")).sort();
  assert.equal(ruleFiles.length, 8);
  const combined = await Promise.all(ruleFiles.map((file) => readFile(path.join(directory, "rules", file), "utf8")));
  assert.doesNotMatch(combined.join("\n"), /Accelerator Checks/);

  const source = await readFile(path.join(directory, "SOURCE.md"), "utf8");
  assert.match(source, /Version: `1\.0\.0`/);
  assert.match(source, /Declared license: MIT/);
  const architectIndex = await readFile(path.join(rulesetsRoot, "framework", "architect", "INDEX.md"), "utf8");
  assert.match(architectIndex, /React 19 or later only/);
});

test("the initial Project Ruleset has guidance but no active project policy", async () => {
  const entries = await readdir(path.join(rulesetsRoot, "project"));
  assert.deepEqual(entries, ["README.md"]);
  const readme = await readFile(path.join(rulesetsRoot, "project", "README.md"), "utf8");
  assert.match(readme, /arbitrary direct Markdown files/);
  assert.match(readme, /does not infer rules automatically/);
});
