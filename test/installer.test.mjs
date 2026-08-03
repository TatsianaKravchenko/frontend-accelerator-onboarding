import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  InstallConflictError,
  INSTALLATION_RECEIPT,
  PAYLOAD_DIRECTORIES,
  UpdateConflictError,
  buildInstallPlan,
  buildUpdatePlan,
  installPayload,
  listPayloadFiles,
  updatePayload,
} from "../lib/install.mjs";

const execFile = promisify(execFileCallback);
const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const HOOK_CONFIGS = [".claude/settings.json", ".codex/hooks.json"];
const INSTALL_OUTPUTS = [...HOOK_CONFIGS, INSTALLATION_RECEIPT];
const EVENTS = ["SessionStart", "PreToolUse", "PostToolUse", "Stop"];

async function createTemporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "frontend accelerator install "));
  t.after(() => rm(directory, { force: true, recursive: true }));
  return directory;
}

async function createGitRoot(t) {
  const directory = await createTemporaryDirectory(t);
  await execFile("git", ["init", "--quiet"], { cwd: directory, windowsHide: true });
  return directory;
}

async function createSourceCopy(t) {
  const directory = await createTemporaryDirectory(t);
  for (const payloadDirectory of PAYLOAD_DIRECTORIES) {
    await cp(path.join(sourceRoot, payloadDirectory), path.join(directory, payloadDirectory), {
      recursive: true,
    });
  }
  return directory;
}

function digest(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function legacyCodexWindowsCommand(event, registrationId) {
  return `powershell.exe -NoProfile -Command "$r=(git rev-parse --show-toplevel).Trim(); & node (Join-Path $r 'toolchain/hooks/runtime-hook.mjs') codex ${event} --registration ${registrationId}"`;
}

async function writeLegacyCodexHooks(targetRoot) {
  const hooksFile = path.join(targetRoot, ".codex", "hooks.json");
  const hooks = JSON.parse(await readFile(hooksFile, "utf8"));
  const registrationId = "frontend-accelerator.changed-file-lint-gate.v1";
  for (const event of EVENTS) {
    hooks.hooks[event][0].hooks[0].commandWindows = legacyCodexWindowsCommand(
      event,
      registrationId,
    );
  }
  await writeFile(hooksFile, `${JSON.stringify(hooks, null, 2)}\n`, "utf8");
}

async function write(targetRoot, relativePath, content = "user-owned\n") {
  const target = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function walkFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(fullPath, baseDirectory)));
    if (entry.isFile()) files.push(path.relative(baseDirectory, fullPath).split(path.sep).join("/"));
  }
  return files.sort();
}

test("package exposes the workflow payload, Runtime Toolchain, and CLI", async () => {
  const packageJson = JSON.parse(await readFile(path.join(sourceRoot, "package.json"), "utf8"));
  assert.deepEqual(packageJson.files, [
    ".claude",
    ".agents",
    "rulesets",
    "toolchain",
    "bin",
    "lib",
    "README.md",
  ]);
});

test("payload contains files only under the four install directories", async () => {
  const files = await listPayloadFiles(sourceRoot);
  assert.ok(files.length > 0);
  assert.ok(
    files.every((file) => PAYLOAD_DIRECTORIES.some((directory) => file.startsWith(`${directory}/`))),
  );
});

test("installs the exact payload into an empty Git root whose path contains spaces", async (t) => {
  const targetRoot = await createGitRoot(t);
  const expected = await listPayloadFiles(sourceRoot);

  const result = await installPayload({ sourceRoot, targetRoot, confirm: async () => true });

  assert.equal(result.status, "installed");
  assert.deepEqual(result.copied, expected);
  assert.deepEqual(result.configured, HOOK_CONFIGS);
  assert.deepEqual(await walkFiles(targetRoot), [...expected, ...INSTALL_OUTPUTS].sort());
  const receipt = JSON.parse(
    await readFile(path.join(targetRoot, ...INSTALLATION_RECEIPT.split("/")), "utf8"),
  );
  assert.equal(receipt.schemaVersion, 1);
  assert.deepEqual(Object.keys(receipt.payloadFiles), expected);
  for (const config of HOOK_CONFIGS) {
    const document = JSON.parse(await readFile(path.join(targetRoot, config), "utf8"));
    assert.deepEqual(Object.keys(document.hooks).sort(), ["PostToolUse", "PreToolUse", "SessionStart", "Stop"]);
  }
});

test("install plan previews every hook event and its semantic additions", async (t) => {
  const targetRoot = await createGitRoot(t);
  const plan = await buildInstallPlan({ sourceRoot, targetRoot });
  const hookOperations = plan.operations.filter((operation) => operation.hookEvents);
  assert.equal(hookOperations.length, 2);
  for (const operation of hookOperations) {
    assert.deepEqual(operation.hookEvents, ["SessionStart", "PreToolUse", "PostToolUse", "Stop"]);
    assert.deepEqual(operation.semanticDiff.addedEvents, operation.hookEvents);
  }
});

test("rejects a directory that is not a Git root before confirmation", async (t) => {
  const targetRoot = await createTemporaryDirectory(t);
  let confirmationRequested = false;

  await assert.rejects(
    installPayload({
      sourceRoot,
      targetRoot,
      confirm: async () => {
        confirmationRequested = true;
        return true;
      },
    }),
    /Target must be a Git root/,
  );
  assert.equal(confirmationRequested, false);
  assert.deepEqual(await walkFiles(targetRoot), []);
});

test("rejects execution from a Git subdirectory", async (t) => {
  const targetRoot = await createGitRoot(t);
  const subdirectory = path.join(targetRoot, "apps", "web");
  await mkdir(subdirectory, { recursive: true });

  await assert.rejects(
    installPayload({ sourceRoot, targetRoot: subdirectory, confirm: async () => true }),
    /Run the command from the Git root itself/,
  );
  assert.deepEqual(await walkFiles(targetRoot), []);
});

test("reports one collision and performs zero writes", async (t) => {
  const targetRoot = await createGitRoot(t);
  const conflict = ".claude/commands/coder.md";
  await write(targetRoot, conflict);
  const before = await walkFiles(targetRoot);

  await assert.rejects(
    installPayload({ sourceRoot, targetRoot, confirm: async () => true }),
    (error) => {
      assert.ok(error instanceof InstallConflictError);
      assert.deepEqual(error.conflicts, [conflict]);
      return true;
    },
  );
  assert.deepEqual(await walkFiles(targetRoot), before);
});

test("reports every collision before performing any write", async (t) => {
  const targetRoot = await createGitRoot(t);
  const conflicts = [".claude/commands/coder.md", "rulesets/project/README.md"];
  for (const conflict of conflicts) await write(targetRoot, conflict);
  const before = await walkFiles(targetRoot);

  await assert.rejects(
    installPayload({ sourceRoot, targetRoot, confirm: async () => true }),
    (error) => {
      assert.ok(error instanceof InstallConflictError);
      assert.deepEqual(error.conflicts, conflicts);
      return true;
    },
  );
  assert.deepEqual(await walkFiles(targetRoot), before);
});

test("allows unrelated existing files and leaves them unchanged", async (t) => {
  const targetRoot = await createGitRoot(t);
  const userFile = ".claude/user-owned.md";
  await write(targetRoot, userFile);

  await installPayload({ sourceRoot, targetRoot, confirm: async () => true });

  assert.equal(await readFile(path.join(targetRoot, userFile), "utf8"), "user-owned\n");
  assert.deepEqual(
    await walkFiles(targetRoot),
    [...(await listPayloadFiles(sourceRoot)), ...INSTALL_OUTPUTS, userFile].sort(),
  );
});

test("update uses the installation receipt to replace owned payload and becomes idempotent", async (t) => {
  const targetRoot = await createGitRoot(t);
  await installPayload({ sourceRoot, targetRoot, confirm: async () => true });
  const nextSourceRoot = await createSourceCopy(t);
  const changedFile = "rulesets/project/README.md";
  await write(nextSourceRoot, changedFile, "# Updated project rules\n");

  const plan = await buildUpdatePlan({ sourceRoot: nextSourceRoot, targetRoot });
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(
    plan.operations.filter((item) => item.operation === "update").map((item) => item.targetRelative),
    [changedFile],
  );

  const result = await updatePayload({
    sourceRoot: nextSourceRoot,
    targetRoot,
    confirm: async () => true,
  });
  assert.equal(result.status, "updated");
  assert.deepEqual(result.updated, [changedFile]);
  assert.equal(await readFile(path.join(targetRoot, changedFile), "utf8"), "# Updated project rules\n");

  let confirmationRequested = false;
  const second = await updatePayload({
    sourceRoot: nextSourceRoot,
    targetRoot,
    confirm: async () => {
      confirmationRequested = true;
      return true;
    },
  });
  assert.equal(second.status, "unchanged");
  assert.equal(confirmationRequested, false);
});

test("update removes an obsolete file only when its receipt digest still matches", async (t) => {
  const targetRoot = await createGitRoot(t);
  await installPayload({ sourceRoot, targetRoot, confirm: async () => true });
  const nextSourceRoot = await createSourceCopy(t);
  const removedFile = "rulesets/project/README.md";
  await rm(path.join(nextSourceRoot, removedFile));

  const result = await updatePayload({
    sourceRoot: nextSourceRoot,
    targetRoot,
    confirm: async () => true,
  });

  assert.deepEqual(result.removed, [removedFile]);
  await assert.rejects(readFile(path.join(targetRoot, removedFile), "utf8"), { code: "ENOENT" });
});

test("CLI exposes the update command", async () => {
  const { stdout, stderr } = await execFile(
    process.execPath,
    [path.join(sourceRoot, "bin", "frontend-accelerator.mjs"), "--help"],
    { encoding: "utf8", windowsHide: true },
  );

  assert.equal(stderr, "");
  assert.match(stdout, /frontend-accelerator update \[--yes\]/);
  assert.match(stdout, /Safely update an existing accelerator payload/);
});

test("update bootstraps a legacy installation and migrates its Codex hooks", async (t) => {
  const targetRoot = await createGitRoot(t);
  await installPayload({ sourceRoot, targetRoot, confirm: async () => true });
  await rm(path.join(targetRoot, ...INSTALLATION_RECEIPT.split("/")), { force: true });
  await writeLegacyCodexHooks(targetRoot);

  const legacyFiles = {
    "toolchain/lib/registrations.mjs": "legacy registrations\n",
    "toolchain/registrations/codex-hooks.json": "legacy codex registration\n",
  };
  const legacyPayloadHashes = {};
  for (const [file, content] of Object.entries(legacyFiles)) {
    await write(targetRoot, file, content);
    legacyPayloadHashes[file] = [digest(content)];
  }

  const result = await updatePayload({
    sourceRoot,
    targetRoot,
    legacyPayloadHashes,
    confirm: async () => true,
  });

  assert.equal(result.status, "updated");
  assert.deepEqual(result.updated.sort(), Object.keys(legacyFiles).sort());
  assert.deepEqual(result.configured, [".codex/hooks.json"]);
  assert.equal(
    (await readFile(path.join(targetRoot, ".codex", "hooks.json"), "utf8")).includes(
      "powershell.exe -NoProfile -Command",
    ),
    false,
  );
  assert.equal(
    await readFile(path.join(targetRoot, "toolchain/lib/registrations.mjs"), "utf8"),
    await readFile(path.join(sourceRoot, "toolchain/lib/registrations.mjs"), "utf8"),
  );
  assert.equal(
    await readFile(path.join(targetRoot, "toolchain/registrations/codex-hooks.json"), "utf8"),
    await readFile(path.join(sourceRoot, "toolchain/registrations/codex-hooks.json"), "utf8"),
  );
  const receipt = JSON.parse(
    await readFile(path.join(targetRoot, ...INSTALLATION_RECEIPT.split("/")), "utf8"),
  );
  assert.equal(receipt.schemaVersion, 1);
});

test("update rejects modified accelerator-owned files before confirmation and writes nothing", async (t) => {
  const targetRoot = await createGitRoot(t);
  await installPayload({ sourceRoot, targetRoot, confirm: async () => true });
  const changedFile = "rulesets/project/README.md";
  await write(targetRoot, changedFile, "user customization\n");
  const before = await readFile(path.join(targetRoot, changedFile), "utf8");
  let confirmationRequested = false;

  await assert.rejects(
    updatePayload({
      sourceRoot,
      targetRoot,
      confirm: async () => {
        confirmationRequested = true;
        return true;
      },
    }),
    (error) => {
      assert.ok(error instanceof UpdateConflictError);
      assert.deepEqual(error.conflicts, [changedFile]);
      return true;
    },
  );

  assert.equal(confirmationRequested, false);
  assert.equal(await readFile(path.join(targetRoot, changedFile), "utf8"), before);
});

test("update rejects a repository without an existing accelerator installation", async (t) => {
  const targetRoot = await createGitRoot(t);
  await assert.rejects(
    updatePayload({ sourceRoot, targetRoot, confirm: async () => true }),
    /No existing Frontend Accelerator installation was found/,
  );
});

test("merges recognized hooks while preserving unrelated runtime configuration", async (t) => {
  const targetRoot = await createGitRoot(t);
  await write(
    targetRoot,
    ".claude/settings.json",
    `${JSON.stringify({ permissions: { allow: ["Read"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "user-hook" }] }] } }, null, 2)}\n`,
  );
  await write(
    targetRoot,
    ".codex/hooks.json",
    `${JSON.stringify({ description: "user-owned", hooks: {} }, null, 2)}\n`,
  );

  const result = await installPayload({ sourceRoot, targetRoot, confirm: async () => true });

  assert.equal(result.status, "installed");
  const claude = JSON.parse(await readFile(path.join(targetRoot, ".claude/settings.json"), "utf8"));
  const codex = JSON.parse(await readFile(path.join(targetRoot, ".codex/hooks.json"), "utf8"));
  assert.deepEqual(claude.permissions, { allow: ["Read"] });
  assert.equal(claude.hooks.Stop[0].hooks[0].command, "user-hook");
  assert.equal(claude.hooks.Stop.length, 2);
  assert.equal(codex.description, "user-owned");
  assert.equal(codex.hooks.Stop.length, 1);
});

test("malformed recognized hook configuration causes zero writes", async (t) => {
  const targetRoot = await createGitRoot(t);
  await write(targetRoot, ".claude/settings.json", "{ invalid json\n");
  await write(targetRoot, "existing.txt");
  const before = await walkFiles(targetRoot);

  await assert.rejects(
    installPayload({ sourceRoot, targetRoot, confirm: async () => true }),
    (error) => {
      assert.ok(error instanceof InstallConflictError);
      assert.deepEqual(error.conflicts, [".claude/settings.json"]);
      return true;
    },
  );
  assert.deepEqual(await walkFiles(targetRoot), before);
  assert.equal(await readFile(path.join(targetRoot, ".claude/settings.json"), "utf8"), "{ invalid json\n");
});

test("declined confirmation performs zero writes", async (t) => {
  const targetRoot = await createGitRoot(t);
  await write(targetRoot, "existing.txt");
  const before = await walkFiles(targetRoot);

  const result = await installPayload({ sourceRoot, targetRoot, confirm: async () => false });

  assert.equal(result.status, "declined");
  assert.deepEqual(result.copied, []);
  assert.deepEqual(await walkFiles(targetRoot), before);
});
