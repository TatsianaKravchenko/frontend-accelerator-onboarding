import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setupToolchain } from "../toolchain/lib/setup.mjs";

const execFile = promisify(execFileCallback);
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function createTarget(t) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator setup target "));
  const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator setup cache "));
  const browserInstallRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator browser source "));
  t.after(() => rm(targetRoot, { force: true, recursive: true }));
  t.after(() => rm(cacheRoot, { force: true, recursive: true }));
  t.after(() => rm(browserInstallRoot, { force: true, recursive: true }));
  await execFile("git", ["init", "--quiet"], { cwd: targetRoot, windowsHide: true });
  await mkdir(path.join(targetRoot, "toolchain"), { recursive: true });
  await copyFile(path.join(sourceRoot, "toolchain", "manifest.json"), path.join(targetRoot, "toolchain", "manifest.json"));
  await writeFile(
    path.join(targetRoot, "package.json"),
    `${JSON.stringify({ private: true, scripts: { lint: "eslint ." } }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(targetRoot, "package-lock.json"), '{"lockfileVersion":3}\n', "utf8");
  return { browserInstallRoot, cacheRoot, targetRoot };
}

function fakeBrowserPath(browserInstallRoot) {
  if (process.platform === "win32") return path.join(browserInstallRoot, "chrome-123", "chrome-win64", "chrome.exe");
  if (process.platform === "darwin") {
    return path.join(
      browserInstallRoot,
      "chrome-123",
      "chrome-mac",
      "Google Chrome for Testing.app",
      "Contents",
      "MacOS",
      "Google Chrome for Testing",
    );
  }
  return path.join(browserInstallRoot, "chrome-123", "chrome-linux64", "chrome");
}

function createFakeRunner(options = {}) {
  const calls = [];
  const runner = async (command, args, processOptions) => {
    calls.push({ command, args, cwd: processOptions.cwd, env: processOptions.env });
    if (/npm(?:\.cmd)?$/i.test(command)) {
      const packageJson = JSON.parse(await readFile(path.join(processOptions.cwd, "package.json"), "utf8"));
      const [packageName, version] = Object.entries(packageJson.dependencies)[0];
      if (options.failPackage === packageName) return { code: 1, signal: null, stdout: "", stderr: "offline" };
      const manifest = JSON.parse(await readFile(path.join(sourceRoot, "toolchain", "manifest.json"), "utf8"));
      const definition = Object.values(manifest.capabilities).find((item) => item.package === packageName);
      const packageDirectory = path.join(processOptions.cwd, "node_modules", ...packageName.split("/"));
      const binDirectory = path.join(processOptions.cwd, "node_modules", ".bin");
      await mkdir(packageDirectory, { recursive: true });
      await mkdir(binDirectory, { recursive: true });
      await writeFile(
        path.join(packageDirectory, "package.json"),
        `${JSON.stringify({ name: packageName, version, bin: { [definition.binary]: "cli.js" } })}\n`,
        "utf8",
      );
      await writeFile(path.join(packageDirectory, "cli.js"), "// fake executable\n", "utf8");
      const executable = path.join(binDirectory, process.platform === "win32" ? `${definition.binary}.cmd` : definition.binary);
      await writeFile(executable, "fake executable\n", "utf8");
      await writeFile(
        path.join(processOptions.cwd, "package-lock.json"),
        `${JSON.stringify({ lockfileVersion: 3, packages: { "": {}, [`node_modules/${packageName}`]: { version, integrity: definition.integrity } } }, null, 2)}\n`,
        "utf8",
      );
      return { code: 0, signal: null, stdout: "", stderr: "" };
    }
    assert.equal(command, process.execPath);
    if (args.at(-1) === "install") {
      const browser = fakeBrowserPath(options.browserInstallRoot);
      await mkdir(path.dirname(browser), { recursive: true });
      await writeFile(browser, "fake chrome\n", "utf8");
    }
    return { code: 0, signal: null, stdout: "agent-browser 0.32.3", stderr: "" };
  };
  return { calls, runner };
}

test("setup provisions exact capabilities outside the application and is idempotent", async (t) => {
  const { browserInstallRoot, cacheRoot, targetRoot } = await createTarget(t);
  const beforePackage = await readFile(path.join(targetRoot, "package.json"), "utf8");
  const beforeLock = await readFile(path.join(targetRoot, "package-lock.json"), "utf8");
  const fake = createFakeRunner({ browserInstallRoot });

  const first = await setupToolchain({
    targetRoot,
    cacheRoot,
    browserInstallRoot,
    nodeVersion: "24.0.0",
    runner: fake.runner,
    confirm: async () => true,
  });

  assert.equal(first.status, "ready");
  assert.deepEqual(first.outcomes.map((item) => item.status), ["installed", "installed"]);
  assert.equal(await readFile(path.join(targetRoot, "package.json"), "utf8"), beforePackage);
  assert.equal(await readFile(path.join(targetRoot, "package-lock.json"), "utf8"), beforeLock);
  const browserReceiptPath = path.join(first.cachePaths.capabilitiesRoot, "browser", "accelerator-receipt.json");
  const browserReceipt = JSON.parse(await readFile(browserReceiptPath, "utf8"));
  assert.match(browserReceipt.binaryPath, /^node_modules\//);
  assert.match(browserReceipt.browserExecutablePath, /^browser-artifacts\//);
  assert.equal(
    await readFile(path.join(first.cachePaths.capabilitiesRoot, "browser", ...browserReceipt.browserExecutablePath.split("/")), "utf8"),
    "fake chrome\n",
  );
  await assert.rejects(readFile(fakeBrowserPath(browserInstallRoot)), /ENOENT/);

  const second = await setupToolchain({
    targetRoot,
    cacheRoot,
    browserInstallRoot,
    nodeVersion: "24.0.0",
    runner: async () => {
      throw new Error("idempotent setup must not spawn a process");
    },
    confirm: async () => true,
  });
  assert.equal(second.status, "ready");
  assert.deepEqual(second.outcomes.map((item) => item.status), ["reused", "reused"]);
});

test("recommended setup failure preserves required browser readiness", async (t) => {
  const { browserInstallRoot, cacheRoot, targetRoot } = await createTarget(t);
  const fake = createFakeRunner({ browserInstallRoot, failPackage: "ctx7" });
  const result = await setupToolchain({
    targetRoot,
    cacheRoot,
    browserInstallRoot,
    nodeVersion: "24.0.0",
    runner: fake.runner,
    confirm: async () => true,
  });
  assert.equal(result.status, "degraded");
  assert.deepEqual(result.outcomes.map((item) => [item.capability, item.status]), [
    ["browser", "installed"],
    ["docs", "failed"],
  ]);
  const browserReceipt = path.join(result.cachePaths.capabilitiesRoot, "browser", "accelerator-receipt.json");
  assert.equal(JSON.parse(await readFile(browserReceipt, "utf8")).capability, "browser");
});

test("required setup failure blocks and leaves no promoted browser directory", async (t) => {
  const { browserInstallRoot, cacheRoot, targetRoot } = await createTarget(t);
  const fake = createFakeRunner({ browserInstallRoot, failPackage: "agent-browser" });
  const result = await setupToolchain({
    targetRoot,
    cacheRoot,
    browserInstallRoot,
    nodeVersion: "24.0.0",
    runner: fake.runner,
    confirm: async () => true,
  });
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.outcomes.map((item) => [item.capability, item.status]), [["browser", "failed"]]);
  await assert.rejects(readFile(path.join(result.cachePaths.capabilitiesRoot, "browser", "accelerator-receipt.json")), /ENOENT/);
});

test("setup rejects a Runtime Toolchain Cache inside the target repository", async (t) => {
  const { browserInstallRoot, targetRoot } = await createTarget(t);
  await assert.rejects(
    setupToolchain({
      targetRoot,
      cacheRoot: path.join(targetRoot, ".runtime-cache"),
      browserInstallRoot,
      nodeVersion: "24.0.0",
      runner: async () => {
        throw new Error("invalid cache placement must fail before spawning");
      },
      confirm: async () => true,
    }),
    /must be outside the target repository/,
  );
});
