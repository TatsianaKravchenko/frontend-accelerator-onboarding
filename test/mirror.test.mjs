import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectMirrorDifferences, generateAgentToml, syncAgents } from "../scripts/sync-agents.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the committed Codex mirror is current and contains all canonical agents", async () => {
  assert.deepEqual(await collectMirrorDifferences(root), []);
  const toml = await readFile(path.join(root, ".agents", "codex-agents.toml"), "utf8");
  const names = [...toml.matchAll(/^\[agents\.([^\]]+)\]$/gm)].map((match) => match[1]);
  assert.equal(names.length, 18);
  assert.ok(names.includes("coder"));
  assert.ok(names.includes("architect"));
  assert.ok(names.includes("browser-verify"));
  assert.match(toml, /Maintainers regenerate with: npm run sync:agents/);
});

test("mirror generation is deterministic", async () => {
  assert.equal(await generateAgentToml(root), await generateAgentToml(root));
});

test("check mode detects stale skill and agent mirrors without repairing them", async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "frontend accelerator mirror "));
  context.after(() => rm(temporaryRoot, { force: true, recursive: true }));

  const skillDirectory = path.join(temporaryRoot, ".claude", "skills", "demo");
  const agentDirectory = path.join(temporaryRoot, ".claude", "agents");
  await mkdir(skillDirectory, { recursive: true });
  await mkdir(agentDirectory, { recursive: true });
  await writeFile(path.join(skillDirectory, "SKILL.md"), "# Demo\n", "utf8");
  await writeFile(
    path.join(agentDirectory, "demo.md"),
    [
      "---",
      "name: demo",
      'description: "Demo agent"',
      "tools: Read",
      "invokes: demo",
      "---",
      "",
      "Invoke demo and STOP.",
      "",
    ].join("\n"),
    "utf8",
  );

  await syncAgents(temporaryRoot);
  await syncAgents(temporaryRoot, { check: true });

  const mirroredSkill = path.join(temporaryRoot, ".agents", "skills", "demo", "SKILL.md");
  await writeFile(mirroredSkill, "# Stale\n", "utf8");
  await assert.rejects(syncAgents(temporaryRoot, { check: true }), /stale mirror skill file/);
  assert.equal(await readFile(mirroredSkill, "utf8"), "# Stale\n");

  await syncAgents(temporaryRoot);
  await writeFile(path.join(temporaryRoot, ".agents", "codex-agents.toml"), "stale\n", "utf8");
  await assert.rejects(syncAgents(temporaryRoot, { check: true }), /stale Codex agent TOML/);
});
