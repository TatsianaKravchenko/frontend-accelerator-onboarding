import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { resolveCachePaths, resolveCapabilityPaths } from "../toolchain/lib/cache.mjs";
import { doctorExitCode, formatDoctorReport, runDoctor } from "../toolchain/lib/doctor.mjs";
import { loadManifest } from "../toolchain/lib/manifest.mjs";
import {
  loadRegistration,
  mergeRegistrationDocument,
  registrationDigest,
  serializeRegistrationDocument,
} from "../toolchain/lib/registrations.mjs";
import { writeActivationProof } from "../toolchain/lib/session-state.mjs";

const execFile = promisify(execFileCallback);
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function walk(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(fullPath, base)));
    if (entry.isFile()) result.push([path.relative(base, fullPath), await readFile(fullPath, "utf8")]);
  }
  return result.sort(([left], [right]) => left.localeCompare(right));
}

async function createReadyFixture(t) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator doctor target "));
  const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator doctor cache "));
  t.after(() => rm(targetRoot, { force: true, recursive: true }));
  t.after(() => rm(cacheRoot, { force: true, recursive: true }));
  await execFile("git", ["init", "--quiet"], { cwd: targetRoot, windowsHide: true });
  await mkdir(path.join(targetRoot, "toolchain", "registrations"), { recursive: true });
  await copyFile(path.join(sourceRoot, "toolchain", "manifest.json"), path.join(targetRoot, "toolchain", "manifest.json"));
  for (const runtime of ["claude", "codex"]) {
    await copyFile(
      path.join(sourceRoot, "toolchain", "registrations", `${runtime}-hooks.json`),
      path.join(targetRoot, "toolchain", "registrations", `${runtime}-hooks.json`),
    );
    const registration = await loadRegistration(sourceRoot, runtime);
    const target = path.join(targetRoot, ...registration.target.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(
      target,
      serializeRegistrationDocument(mergeRegistrationDocument({}, registration).document),
      "utf8",
    );
  }
  await writeFile(
    path.join(targetRoot, "package.json"),
    `${JSON.stringify({ private: true, scripts: { lint: "eslint ." } }, null, 2)}\n`,
    "utf8",
  );

  const loaded = await loadManifest(targetRoot);
  const cachePaths = resolveCachePaths({ cacheRoot, manifestHash: loaded.hash });
  for (const [name, definition] of Object.entries(loaded.manifest.capabilities)) {
    const capability = { name, ...definition };
    const paths = resolveCapabilityPaths(cachePaths, capability);
    await mkdir(path.dirname(paths.packageJson), { recursive: true });
    await writeFile(
      paths.packageJson,
      `${JSON.stringify({ name: capability.package, version: capability.version, bin: { [capability.binary]: "cli.js" } })}\n`,
      "utf8",
    );
    await writeFile(path.join(path.dirname(paths.packageJson), "cli.js"), "// fake executable\n", "utf8");
    const receipt = {
      schemaVersion: 1,
      manifestHash: loaded.hash,
      capability: name,
      package: capability.package,
      version: capability.version,
      integrity: capability.integrity,
      binaryPath: path.relative(paths.root, path.join(path.dirname(paths.packageJson), "cli.js")).split(path.sep).join("/"),
      platform: process.platform,
      arch: process.arch,
    };
    if (name === "browser") {
      const browserExecutable = path.join(paths.browserArtifactsRoot, "chrome-123", process.platform === "win32" ? "chrome.exe" : "chrome");
      await mkdir(path.dirname(browserExecutable), { recursive: true });
      await writeFile(browserExecutable, "fake chrome\n", "utf8");
      receipt.browserExecutablePath = path.relative(paths.root, browserExecutable).split(path.sep).join("/");
    }
    await writeFile(
      paths.receipt,
      `${JSON.stringify(receipt, null, 2)}\n`,
      "utf8",
    );
  }
  return { cachePaths, cacheRoot, loaded, targetRoot };
}

async function activate(fixture, runtime, manifestHash = fixture.loaded.hash) {
  const registration = await loadRegistration(fixture.targetRoot, runtime);
  await writeActivationProof({
    cachePaths: fixture.cachePaths,
    repositoryRoot: fixture.targetRoot,
    runtime,
    manifestHash,
    registrationId: registration.registrationId,
    registrationDigest: registrationDigest(registration),
  });
}

const versionRunner = async (command, args, options) => {
  assert.equal(command, process.execPath);
  assert.match(args[0], /cli\.js$/);
  assert.equal(args[1], "--version");
  if (args[0].includes("agent-browser")) {
    assert.match(options.env.AGENT_BROWSER_EXECUTABLE_PATH, /browser-artifacts/);
  }
  return { code: 0, signal: null, stdout: "0.0.0", stderr: "" };
};

test("Doctor is read-only and distinguishes pending activation from ready", async (t) => {
  const fixture = await createReadyFixture(t);
  const before = await walk(fixture.targetRoot);
  const pending = await runDoctor({
    targetRoot: fixture.targetRoot,
    cacheRoot: fixture.cacheRoot,
    nodeVersion: "24.0.0",
    runner: versionRunner,
  });
  assert.equal(pending.status, "DEGRADED");
  assert.equal(pending.checks.find((check) => check.id === "hooks:claude").details.status, "PENDING_ACTIVATION");
  assert.deepEqual(await walk(fixture.targetRoot), before);

  await activate(fixture, "claude");
  await activate(fixture, "codex");
  const ready = await runDoctor({
    targetRoot: fixture.targetRoot,
    cacheRoot: fixture.cacheRoot,
    nodeVersion: "24.0.0",
    runner: versionRunner,
  });
  assert.equal(ready.status, "READY");
  assert.ok(ready.checks.every((check) => check.status === "PASS"));
});

test("Doctor reports stale activation and unsupported Node without repairing either", async (t) => {
  const fixture = await createReadyFixture(t);
  await activate(fixture, "claude", "old-manifest");
  await activate(fixture, "codex");
  const report = await runDoctor({
    targetRoot: fixture.targetRoot,
    cacheRoot: fixture.cacheRoot,
    nodeVersion: "22.15.1",
    runner: versionRunner,
  });
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.checks.find((check) => check.id === "node").status, "BLOCKED");
  assert.equal(report.checks.find((check) => check.id === "hooks:claude").details.status, "STALE");
});

test("Doctor blocks when a receipt points to a missing managed browser artifact", async (t) => {
  const fixture = await createReadyFixture(t);
  const receiptPath = path.join(fixture.cachePaths.capabilitiesRoot, "browser", "accelerator-receipt.json");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  await rm(path.join(fixture.cachePaths.capabilitiesRoot, "browser", ...receipt.browserExecutablePath.split("/")));
  const report = await runDoctor({
    targetRoot: fixture.targetRoot,
    cacheRoot: fixture.cacheRoot,
    nodeVersion: "24.0.0",
    runner: versionRunner,
  });
  assert.equal(report.checks.find((check) => check.id === "capability:browser").status, "BLOCKED");
});

test("Doctor distinguishes missing registration from a conflicting hook document", async (t) => {
  const fixture = await createReadyFixture(t);
  const claude = await loadRegistration(fixture.targetRoot, "claude");
  const codex = await loadRegistration(fixture.targetRoot, "codex");
  await rm(path.join(fixture.targetRoot, ...claude.target.split("/")));
  await writeFile(path.join(fixture.targetRoot, ...codex.target.split("/")), "{ invalid json\n", "utf8");

  const report = await runDoctor({
    targetRoot: fixture.targetRoot,
    cacheRoot: fixture.cacheRoot,
    nodeVersion: "24.0.0",
    runner: versionRunner,
  });
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.checks.find((check) => check.id === "hooks:claude").details.status, "NOT_CONFIGURED");
  assert.equal(report.checks.find((check) => check.id === "hooks:codex").details.status, "CONFLICT");
});

test("Doctor human and JSON rendering preserve one stable report and exit-code contract", async (t) => {
  const fixture = await createReadyFixture(t);
  const degraded = await runDoctor({
    targetRoot: fixture.targetRoot,
    cacheRoot: fixture.cacheRoot,
    nodeVersion: "24.0.0",
    runner: versionRunner,
  });
  const snapshot = structuredClone(degraded);
  const human = formatDoctorReport(degraded);
  const json = JSON.stringify(degraded);
  assert.deepEqual(degraded, snapshot);
  assert.deepEqual(JSON.parse(json), snapshot);
  assert.match(human, /Frontend Accelerator Doctor: DEGRADED/);
  assert.equal(doctorExitCode(degraded), 0);
  assert.equal(doctorExitCode({ status: "READY" }), 0);
  assert.equal(doctorExitCode({ status: "BLOCKED" }), 1);
});
