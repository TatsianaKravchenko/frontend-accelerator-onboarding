import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { resolveCachePaths } from "../toolchain/lib/cache.mjs";
import { runChangedFileLintGate } from "../toolchain/lib/lint-gate.mjs";
import { readSessionState, recordPostToolState, recordPreToolState } from "../toolchain/lib/session-state.mjs";

const execFile = promisify(execFileCallback);

async function createRepository(t) {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator lint repo "));
  const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator lint cache "));
  t.after(() => rm(repositoryRoot, { force: true, recursive: true }));
  t.after(() => rm(cacheRoot, { force: true, recursive: true }));
  await execFile("git", ["init", "--quiet"], { cwd: repositoryRoot, windowsHide: true });
  await writeFile(
    path.join(repositoryRoot, "package.json"),
    `${JSON.stringify({ private: true, scripts: { lint: "fake-lint" } }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(repositoryRoot, "tracked.js"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(repositoryRoot, "unrelated.js"), "export const unrelated = 1;\n", "utf8");
  await execFile("git", ["add", "."], { cwd: repositoryRoot, windowsHide: true });
  await execFile(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "fixture"],
    { cwd: repositoryRoot, windowsHide: true },
  );
  return {
    repositoryRoot,
    cachePaths: resolveCachePaths({ cacheRoot, manifestHash: "manifest" }),
  };
}

function context(fixture, overrides = {}) {
  return {
    ...fixture,
    manifestHash: "manifest",
    runtime: "codex",
    sessionId: "session",
    toolUseId: "tool-1",
    toolInput: {},
    stopHookActive: false,
    ...overrides,
  };
}

test("lint gate attributes only files changed across the current tool call and runs once", async (t) => {
  const fixture = await createRepository(t);
  await writeFile(path.join(fixture.repositoryRoot, "unrelated.js"), "export const unrelated = 2;\n", "utf8");
  const hookContext = context(fixture);
  await recordPreToolState(hookContext);
  await writeFile(path.join(fixture.repositoryRoot, "tracked.js"), "export const value = 2;\n", "utf8");
  await recordPostToolState(hookContext);

  const calls = [];
  const runner = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    return { code: 0, signal: null, stdout: "ok", stderr: "" };
  };
  const first = await runChangedFileLintGate(hookContext, { runner });
  const second = await runChangedFileLintGate(hookContext, { runner });
  const session = await readSessionState(hookContext);
  assert.equal(first.status, "pass");
  assert.equal(second.status, "pass");
  assert.deepEqual(Object.keys(session.state.changed), ["tracked.js"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ["run", "lint"]);
});

test("edit hooks prefer explicit in-root paths and session state stores no raw repository root", async (t) => {
  const fixture = await createRepository(t);
  await writeFile(path.join(fixture.repositoryRoot, "unrelated.js"), "preexisting dirty\n", "utf8");
  const hookContext = context(fixture, { toolInput: { file_path: path.join(fixture.repositoryRoot, "tracked.js") } });
  await recordPreToolState(hookContext);
  await writeFile(path.join(fixture.repositoryRoot, "tracked.js"), "explicit change\n", "utf8");
  await recordPostToolState(hookContext);
  const session = await readSessionState(hookContext);
  assert.deepEqual(Object.keys(session.state.changed), ["tracked.js"]);
  assert.equal(JSON.stringify(session.state).includes(fixture.repositoryRoot), false);
  assert.match(session.state.repositoryHash, /^[a-f0-9]{64}$/);
});

test("explicit paths outside the Git root are ignored without reading or linting them", async (t) => {
  const fixture = await createRepository(t);
  const outside = path.join(path.dirname(fixture.repositoryRoot), "outside-hook-target.js");
  t.after(() => rm(outside, { force: true }));
  await writeFile(outside, "before\n", "utf8");
  const hookContext = context(fixture, { toolInput: { file_path: outside } });
  await recordPreToolState(hookContext);
  await writeFile(outside, "after\n", "utf8");
  await recordPostToolState(hookContext);
  const result = await runChangedFileLintGate(hookContext, {
    runner: async () => {
      throw new Error("outside-root changes must not run lint");
    },
  });
  assert.equal(result.status, "pass");
});

test("lint failure blocks once and unchanged Stop does not rerun or loop", async (t) => {
  const fixture = await createRepository(t);
  const hookContext = context(fixture);
  await recordPreToolState(hookContext);
  await writeFile(path.join(fixture.repositoryRoot, "tracked.js"), "broken\n", "utf8");
  await recordPostToolState(hookContext);
  let calls = 0;
  const runner = async () => {
    calls += 1;
    return { code: 2, signal: null, stdout: "", stderr: "lint error" };
  };

  const first = await runChangedFileLintGate(hookContext, { runner });
  const second = await runChangedFileLintGate(context(fixture, { stopHookActive: true }), { runner });
  assert.equal(first.status, "fail");
  assert.equal(first.block, true);
  assert.equal(second.status, "fail");
  assert.equal(second.block, false);
  assert.equal(calls, 1);
});

test("missing lint capability is explicit degradation, not a false pass", async (t) => {
  const fixture = await createRepository(t);
  await writeFile(path.join(fixture.repositoryRoot, "package.json"), '{"private":true}\n', "utf8");
  const hookContext = context(fixture);
  await recordPreToolState(hookContext);
  await writeFile(path.join(fixture.repositoryRoot, "tracked.js"), "changed\n", "utf8");
  await recordPostToolState(hookContext);
  const result = await runChangedFileLintGate(hookContext, {
    runner: async () => {
      throw new Error("missing lint must not spawn");
    },
  });
  assert.equal(result.status, "degraded");
  assert.match(result.message, /no existing lint script/);
});

test("missing PreToolUse evidence remains degraded at Stop", async (t) => {
  const fixture = await createRepository(t);
  const hookContext = context(fixture);
  const post = await recordPostToolState(hookContext);
  assert.equal(post.status, "degraded");
  const result = await runChangedFileLintGate(hookContext, {
    runner: async () => {
      throw new Error("incomplete attribution must not run lint as if it were complete");
    },
  });
  assert.equal(result.status, "degraded");
  assert.match(result.message, /attribution was incomplete/);
});

test("shell attribution records created, deleted, and renamed paths", async (t) => {
  const fixture = await createRepository(t);
  const hookContext = context(fixture);
  await recordPreToolState(hookContext);
  await writeFile(path.join(fixture.repositoryRoot, "new-file.js"), "created\n", "utf8");
  await rm(path.join(fixture.repositoryRoot, "tracked.js"));
  await rename(
    path.join(fixture.repositoryRoot, "unrelated.js"),
    path.join(fixture.repositoryRoot, "renamed.js"),
  );
  await recordPostToolState(hookContext);

  const session = await readSessionState(hookContext);
  assert.deepEqual(Object.keys(session.state.changed).sort(), [
    "new-file.js",
    "renamed.js",
    "tracked.js",
    "unrelated.js",
  ]);
});

test("changes owned by multiple package lint roots degrade without running either lint", async (t) => {
  const fixture = await createRepository(t);
  await writeFile(path.join(fixture.repositoryRoot, "package.json"), '{"private":true}\n', "utf8");
  const files = [];
  for (const packageName of ["a", "b"]) {
    const packageRoot = path.join(fixture.repositoryRoot, "packages", packageName);
    await mkdir(packageRoot, { recursive: true });
    await writeFile(
      path.join(packageRoot, "package.json"),
      '{"private":true,"scripts":{"lint":"fake-lint"}}\n',
      "utf8",
    );
    const file = path.join(packageRoot, "index.js");
    await writeFile(file, "before\n", "utf8");
    files.push(file);
  }
  const hookContext = context(fixture, { toolInput: { paths: files } });
  await recordPreToolState(hookContext);
  for (const file of files) await writeFile(file, "after\n", "utf8");
  await recordPostToolState(hookContext);

  const result = await runChangedFileLintGate(hookContext, {
    runner: async () => {
      throw new Error("ambiguous lint capability must not spawn");
    },
  });
  assert.equal(result.status, "degraded");
  assert.match(result.message, /multiple lint package roots/);
});
