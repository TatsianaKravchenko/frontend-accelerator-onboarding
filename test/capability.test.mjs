import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { executeManagedCapability } from "../toolchain/lib/capability.mjs";
import { resolveCachePaths, resolveCapabilityPaths } from "../toolchain/lib/cache.mjs";
import { loadManifest } from "../toolchain/lib/manifest.mjs";

const execFile = promisify(execFileCallback);
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function createManagedDocsFixture(t) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator capability target "));
  const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator capability cache "));
  t.after(() => rm(targetRoot, { force: true, recursive: true }));
  t.after(() => rm(cacheRoot, { force: true, recursive: true }));
  await execFile("git", ["init", "--quiet"], { cwd: targetRoot, windowsHide: true });
  await mkdir(path.join(targetRoot, "toolchain"), { recursive: true });
  await copyFile(path.join(sourceRoot, "toolchain", "manifest.json"), path.join(targetRoot, "toolchain", "manifest.json"));

  const loaded = await loadManifest(targetRoot);
  const capability = { name: "docs", ...loaded.manifest.capabilities.docs };
  const cachePaths = resolveCachePaths({ cacheRoot, manifestHash: loaded.hash });
  const paths = resolveCapabilityPaths(cachePaths, capability);
  const entrypoint = path.join(path.dirname(paths.packageJson), "cli.js");
  await mkdir(path.dirname(entrypoint), { recursive: true });
  await writeFile(
    paths.packageJson,
    `${JSON.stringify({ name: capability.package, version: capability.version, bin: { [capability.binary]: "cli.js" } })}\n`,
    "utf8",
  );
  await writeFile(entrypoint, "// fake docs CLI\n", "utf8");
  await writeFile(
    paths.receipt,
    `${JSON.stringify({
      schemaVersion: 1,
      manifestHash: loaded.hash,
      capability: capability.name,
      package: capability.package,
      version: capability.version,
      integrity: capability.integrity,
      binaryPath: path.relative(paths.root, entrypoint).split(path.sep).join("/"),
      platform: process.platform,
      arch: process.arch,
    })}\n`,
    "utf8",
  );
  return { cacheRoot, targetRoot };
}

test("managed capability preserves arguments and the selected tool exit status", async (t) => {
  const fixture = await createManagedDocsFixture(t);
  const toolArgs = ["docs", "/react", "query?a=1&b=2"];
  const result = await executeManagedCapability({
    ...fixture,
    name: "docs",
    args: toolArgs,
    runner: async (command, args) => {
      assert.equal(command, process.execPath);
      assert.deepEqual(args.slice(1), toolArgs);
      return { code: 7, signal: null, stdout: "tool output", stderr: "tool error" };
    },
  });
  assert.deepEqual(result, { code: 7, signal: null, stdout: "tool output", stderr: "tool error" });
});
