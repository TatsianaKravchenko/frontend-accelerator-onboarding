import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  loadRegistration,
  mergeRegistrationDocument,
  registrationDigest,
} from "../lib/hook-merge.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFile = promisify(execFileCallback);
const EVENTS = ["SessionStart", "PreToolUse", "PostToolUse", "Stop"];

function runPowerShell(command, options) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(options.input);
  });
}

function legacyCodexWindowsCommand(event, registrationId) {
  return `powershell.exe -NoProfile -Command "$r=(git rev-parse --show-toplevel).Trim(); & node (Join-Path $r 'toolchain/hooks/runtime-hook.mjs') codex ${event} --registration ${registrationId}"`;
}

function prependPath(environment, directory) {
  const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === "path") ?? "Path";
  return {
    ...environment,
    [pathKey]: `${directory}${path.delimiter}${environment[pathKey] ?? ""}`,
  };
}

async function createWindowsHookProject(t) {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "frontend accelerator hook project "));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));
  await execFile("git", ["init", "--quiet"], { cwd: projectRoot, windowsHide: true });
  await cp(path.join(root, "toolchain"), path.join(projectRoot, "toolchain"), { recursive: true });
  const cwd = path.join(projectRoot, "nested", "directory");
  await mkdir(cwd, { recursive: true });
  return { cwd, projectRoot };
}

test("hook registration merge preserves unrelated settings and is idempotent", async () => {
  const registration = await loadRegistration(root, "claude");
  const current = { permissions: { allow: ["Read"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "user" }] }] } };
  const first = mergeRegistrationDocument(current, registration);
  assert.equal(first.changed, true);
  assert.deepEqual(first.document.permissions, current.permissions);
  assert.equal(first.document.hooks.Stop.length, 2);
  assert.deepEqual(first.semanticDiff.addedEvents, ["SessionStart", "PreToolUse", "PostToolUse", "Stop"]);
  assert.deepEqual(first.semanticDiff.updatedEvents, []);

  const second = mergeRegistrationDocument(first.document, registration);
  assert.equal(second.changed, false);
  assert.deepEqual(second.semanticDiff.addedEvents, []);
  assert.deepEqual(second.semanticDiff.updatedEvents, []);
  assert.deepEqual(second.document, first.document);
  assert.match(registrationDigest(registration), /^[a-f0-9]{64}$/);
});

test("known broken Codex Windows launchers are upgraded without replacing unrelated settings", async () => {
  const registration = await loadRegistration(root, "codex");
  const installed = mergeRegistrationDocument({}, registration).document;
  for (const event of EVENTS) {
    installed.hooks[event][0].hooks[0].commandWindows = legacyCodexWindowsCommand(
      event,
      registration.registrationId,
    );
  }
  installed.description = "user-owned";

  const merged = mergeRegistrationDocument(installed, registration);

  assert.equal(merged.changed, true);
  assert.deepEqual(merged.semanticDiff.addedEvents, []);
  assert.deepEqual(merged.semanticDiff.updatedEvents, EVENTS);
  assert.equal(merged.document.description, "user-owned");
  for (const event of EVENTS) {
    assert.deepEqual(merged.document.hooks[event][0], registration.hooks[event][0]);
  }
});

test("known registration identifier with changed semantics is a conflict", async () => {
  const registration = await loadRegistration(root, "codex");
  const installed = mergeRegistrationDocument({}, registration).document;
  installed.hooks.Stop[0].hooks[0].timeout = 1;
  assert.throws(
    () => mergeRegistrationDocument(installed, registration),
    /accelerator registration has conflicting semantics/,
  );
});

test("Codex registration contains a single-layer Windows launcher and Git-root POSIX launcher", async () => {
  const registration = await loadRegistration(root, "codex");
  for (const groups of Object.values(registration.hooks)) {
    const handler = groups[0].hooks[0];
    assert.match(handler.command, /git rev-parse --show-toplevel/);
    assert.doesNotMatch(handler.commandWindows, /powershell\.exe\s+-NoProfile\s+-Command/);
    assert.match(handler.commandWindows, /git rev-parse --show-toplevel/);
    assert.match(handler.commandWindows, /Get-Command node/);
    assert.match(handler.commandWindows, /exit \$code/);
  }
});

test(
  "Codex Windows launcher resolves the Git root from a nested directory whose path contains spaces",
  { skip: process.platform !== "win32" },
  async (t) => {
    const registration = await loadRegistration(root, "codex");
    const command = registration.hooks.SessionStart[0].hooks[0].commandWindows;
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "frontend-accelerator-hook-"));
    t.after(() => rm(cacheRoot, { recursive: true, force: true }));
    const { cwd } = await createWindowsHookProject(t);

    const result = await runPowerShell(command, {
      cwd,
      env: { ...process.env, FRONTEND_ACCELERATOR_CACHE_DIR: cacheRoot },
      input: JSON.stringify({
        hook_event_name: "SessionStart",
        session_id: "windows-launcher-кириллица",
        cwd,
      }),
    });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.ok((await readdir(cacheRoot, { recursive: true })).length > 0);
  },
);

test(
  "Codex Windows launcher preserves a native exit code and stderr",
  { skip: process.platform !== "win32" },
  async (t) => {
    const registration = await loadRegistration(root, "codex");
    const command = registration.hooks.SessionStart[0].hooks[0].commandWindows;
    const { cwd, projectRoot } = await createWindowsHookProject(t);
    const shimDirectory = path.join(projectRoot, "node shim");
    await mkdir(shimDirectory, { recursive: true });
    await writeFile(
      path.join(shimDirectory, "node.cmd"),
      "@echo off\r\necho hook-blocked 1>&2\r\nexit /b 2\r\n",
      "utf8",
    );

    const result = await runPowerShell(command, {
      cwd,
      env: prependPath(process.env, shimDirectory),
      input: JSON.stringify({
        hook_event_name: "SessionStart",
        session_id: "windows-launcher-exit-code",
        cwd,
      }),
    });

    assert.equal(result.code, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /hook-blocked/);
  },
);
