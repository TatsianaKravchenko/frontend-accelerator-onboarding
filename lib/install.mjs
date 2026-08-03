import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  inspectRegistrationFile,
  loadRegistration,
  serializeRegistrationDocument,
} from "./hook-merge.mjs";
import { assertGitRoot } from "../toolchain/lib/repository.mjs";

export const PAYLOAD_DIRECTORIES = [".claude", ".agents", "rulesets", "toolchain"];
export const INSTALLATION_RECEIPT = ".frontend-accelerator/installation.json";

// Payload files changed by the Windows hook repair after commit 7b1b11b.
// Exact digests let pre-receipt installations opt into one narrow, known migration.
const LEGACY_PAYLOAD_HASHES = {
  "toolchain/lib/registrations.mjs": [
    "sha256:e5338df214ecf9f3fdb30cd9c14fcfadc343c2846f9af4b5a257c4b9d0113649",
  ],
  "toolchain/registrations/codex-hooks.json": [
    "sha256:2bf9b07fea58174142755d2f45e9643a989928418a7799e234d3353c4de31bef",
  ],
};

export class InstallConflictError extends Error {
  constructor(conflicts) {
    super(`Installation stopped: ${conflicts.length} target file conflict${conflicts.length === 1 ? "" : "s"}.`);
    this.name = "InstallConflictError";
    this.conflicts = conflicts;
  }
}

export class UpdateConflictError extends Error {
  constructor(conflicts) {
    super(`Update stopped: ${conflicts.length} target file conflict${conflicts.length === 1 ? "" : "s"}.`);
    this.name = "UpdateConflictError";
    this.conflicts = conflicts;
  }
}

function contentDigest(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function isPayloadRelativePath(file) {
  return (
    typeof file === "string" &&
    file.length > 0 &&
    !file.includes("\\") &&
    path.posix.normalize(file) === file &&
    PAYLOAD_DIRECTORIES.some((directory) => file.startsWith(`${directory}/`))
  );
}

function validateInstallationReceipt(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1) {
    throw new Error("unsupported installation receipt schema");
  }
  if (value.payloadFiles === null || typeof value.payloadFiles !== "object" || Array.isArray(value.payloadFiles)) {
    throw new Error("installation receipt payloadFiles must be an object");
  }
  for (const [file, digest] of Object.entries(value.payloadFiles)) {
    if (!isPayloadRelativePath(file) || typeof digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
      throw new Error(`invalid installation receipt entry: ${file}`);
    }
  }
  return value;
}

async function pathExists(file) {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function inspectFile(file) {
  try {
    return { status: "present", digest: contentDigest(await readFile(file)) };
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing" };
    if (error.code === "EISDIR" || error.code === "EACCES") return { status: "invalid" };
    throw error;
  }
}

async function loadInstallationReceipt(targetRoot) {
  const target = path.join(targetRoot, ...INSTALLATION_RECEIPT.split("/"));
  let raw;
  try {
    raw = await readFile(target, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing", target };
    return { status: "invalid", reason: error.message, target };
  }
  try {
    return { status: "valid", target, value: validateInstallationReceipt(JSON.parse(raw)) };
  } catch (error) {
    return { status: "invalid", reason: error.message, target };
  }
}

async function payloadHashes(sourceRoot, files) {
  const entries = await Promise.all(
    files.map(async (file) => [file, contentDigest(await readFile(path.join(sourceRoot, file)))]),
  );
  return Object.fromEntries(entries);
}

function equalPayloadHashes(left, right) {
  const leftFiles = Object.keys(left);
  const rightFiles = Object.keys(right);
  return (
    leftFiles.length === rightFiles.length &&
    leftFiles.every((file) => left[file] === right[file])
  );
}

async function writeInstallationReceipt(targetRoot, hashes) {
  const target = path.join(targetRoot, ...INSTALLATION_RECEIPT.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `${JSON.stringify({ schemaVersion: 1, payloadFiles: hashes }, null, 2)}\n`,
    "utf8",
  );
  return target;
}

async function walkFiles(directory, baseDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath, baseDirectory)));
      continue;
    }
    if (!entry.isFile()) throw new Error(`Unsupported payload entry: ${fullPath}`);
    files.push(path.relative(baseDirectory, fullPath).split(path.sep).join("/"));
  }
  return files.sort();
}

export async function listPayloadFiles(sourceRoot) {
  const files = [];
  for (const directory of PAYLOAD_DIRECTORIES) {
    const sourceDirectory = path.join(sourceRoot, directory);
    if (!(await pathExists(sourceDirectory))) throw new Error(`Missing payload directory: ${sourceDirectory}`);
    files.push(...(await walkFiles(sourceDirectory, sourceRoot)));
  }
  return files.sort();
}

export async function assertTargetIsGitRoot(targetRoot) {
  try {
    await assertGitRoot(targetRoot);
  } catch (error) {
    if (/inside a Git repository/.test(error.message)) {
      throw new Error(`Target must be a Git root: ${targetRoot}`, { cause: error });
    }
    throw error;
  }
}

export async function buildInstallPlan({ sourceRoot, targetRoot }) {
  const resolvedSource = path.resolve(sourceRoot);
  const resolvedTarget = path.resolve(targetRoot);
  await assertTargetIsGitRoot(resolvedTarget);
  const files = await listPayloadFiles(resolvedSource);
  const sourceHashes = await payloadHashes(resolvedSource, files);
  const conflicts = [];

  for (const file of files) {
    if (await pathExists(path.join(resolvedTarget, file))) conflicts.push(file);
  }
  if (await pathExists(path.join(resolvedTarget, ...INSTALLATION_RECEIPT.split("/")))) {
    conflicts.push(INSTALLATION_RECEIPT);
  }
  const registrations = [];
  for (const runtime of ["claude", "codex"]) {
    const registration = await loadRegistration(resolvedSource, runtime);
    try {
      registrations.push({
        registration,
        ...(await inspectRegistrationFile(resolvedTarget, registration)),
      });
    } catch (error) {
      conflicts.push(registration.target);
    }
  }

  return {
    conflicts: [...new Set(conflicts)].sort(),
    files,
    operations: [
      ...files.map((file) => ({ operation: "copy", targetRelative: file })),
      ...registrations.map(({ operation, registration, semanticDiff, targetRelative }) => ({
        operation,
        targetRelative,
        registrationId: registration.registrationId,
        hookEvents: Object.keys(registration.hooks),
        semanticDiff,
      })),
      { operation: "write", targetRelative: INSTALLATION_RECEIPT },
    ],
    registrations,
    sourceRoot: resolvedSource,
    sourceHashes,
    targetRoot: resolvedTarget,
  };
}

export async function installPayload({ sourceRoot, targetRoot, confirm }) {
  const plan = await buildInstallPlan({ sourceRoot, targetRoot });
  if (plan.conflicts.length > 0) throw new InstallConflictError(plan.conflicts);
  if (!(await confirm(plan))) return { ...plan, copied: [], status: "declined" };

  const copied = [];
  for (const file of plan.files) {
    const source = path.join(plan.sourceRoot, file);
    const target = path.join(plan.targetRoot, file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
    copied.push(file);
  }

  const configured = [];
  for (const item of plan.registrations) {
    if (!item.changed) continue;
    await mkdir(path.dirname(item.target), { recursive: true });
    await writeFile(item.target, serializeRegistrationDocument(item.document), "utf8");
    configured.push(item.targetRelative);
  }

  const receipt = await writeInstallationReceipt(plan.targetRoot, plan.sourceHashes);

  return { ...plan, configured, copied, receipt, status: "installed" };
}

export async function buildUpdatePlan({
  sourceRoot,
  targetRoot,
  legacyPayloadHashes = LEGACY_PAYLOAD_HASHES,
}) {
  const resolvedSource = path.resolve(sourceRoot);
  const resolvedTarget = path.resolve(targetRoot);
  await assertTargetIsGitRoot(resolvedTarget);
  const files = await listPayloadFiles(resolvedSource);
  const sourceHashes = await payloadHashes(resolvedSource, files);
  const receipt = await loadInstallationReceipt(resolvedTarget);
  const conflicts = [];
  const payloadActions = [];
  let existingPayloadFiles = 0;

  if (receipt.status === "invalid") conflicts.push(INSTALLATION_RECEIPT);

  for (const file of files) {
    const target = path.join(resolvedTarget, file);
    const state = await inspectFile(target);
    if (state.status === "missing") {
      payloadActions.push({ action: "copy", file });
      continue;
    }
    existingPayloadFiles += 1;
    if (state.status === "invalid") {
      conflicts.push(file);
      continue;
    }
    if (state.digest === sourceHashes[file]) {
      payloadActions.push({ action: "unchanged", file });
      continue;
    }
    const receiptOwnsFile =
      receipt.status === "valid" && receipt.value.payloadFiles[file] === state.digest;
    const legacyOwnsFile = legacyPayloadHashes[file]?.includes(state.digest) === true;
    if (receiptOwnsFile || legacyOwnsFile) {
      payloadActions.push({ action: "update", file });
      continue;
    }
    conflicts.push(file);
  }

  if (receipt.status === "valid") {
    for (const [file, installedDigest] of Object.entries(receipt.value.payloadFiles)) {
      if (Object.hasOwn(sourceHashes, file)) continue;
      const state = await inspectFile(path.join(resolvedTarget, file));
      if (state.status === "missing") continue;
      if (state.status !== "present" || state.digest !== installedDigest) {
        conflicts.push(file);
        continue;
      }
      payloadActions.push({ action: "remove", file });
    }
  }

  if (receipt.status === "missing" && existingPayloadFiles === 0) {
    throw new Error("No existing Frontend Accelerator installation was found. Run install first.");
  }

  const registrations = [];
  for (const runtime of ["claude", "codex"]) {
    const registration = await loadRegistration(resolvedSource, runtime);
    try {
      registrations.push({
        registration,
        ...(await inspectRegistrationFile(resolvedTarget, registration)),
      });
    } catch (error) {
      conflicts.push(registration.target);
    }
  }

  const receiptNeedsWrite =
    receipt.status === "missing" ||
    (receipt.status === "valid" && !equalPayloadHashes(receipt.value.payloadFiles, sourceHashes));
  const changedPayloadActions = payloadActions.filter((item) => item.action !== "unchanged");
  const changedRegistrations = registrations.filter((item) => item.changed);
  const operations = [
    ...changedPayloadActions.map(({ action, file }) => ({ operation: action, targetRelative: file })),
    ...changedRegistrations.map(({ operation, registration, semanticDiff, targetRelative }) => ({
      operation,
      targetRelative,
      registrationId: registration.registrationId,
      hookEvents: Object.keys(registration.hooks),
      semanticDiff,
    })),
    ...(receiptNeedsWrite ? [{ operation: "write", targetRelative: INSTALLATION_RECEIPT }] : []),
  ];

  return {
    changed: operations.length > 0,
    conflicts: [...new Set(conflicts)].sort(),
    files,
    operations,
    payloadActions,
    receipt,
    receiptNeedsWrite,
    registrations,
    sourceHashes,
    sourceRoot: resolvedSource,
    targetRoot: resolvedTarget,
  };
}

export async function updatePayload({
  sourceRoot,
  targetRoot,
  confirm,
  legacyPayloadHashes,
}) {
  const plan = await buildUpdatePlan({ sourceRoot, targetRoot, legacyPayloadHashes });
  if (plan.conflicts.length > 0) throw new UpdateConflictError(plan.conflicts);
  if (!plan.changed) {
    return { ...plan, configured: [], copied: [], removed: [], status: "unchanged", updated: [] };
  }
  if (!(await confirm(plan))) {
    return { ...plan, configured: [], copied: [], removed: [], status: "declined", updated: [] };
  }

  const copied = [];
  const updated = [];
  const removed = [];
  for (const item of plan.payloadActions) {
    const target = path.join(plan.targetRoot, item.file);
    if (item.action === "remove") {
      await rm(target, { force: true });
      removed.push(item.file);
      continue;
    }
    if (item.action !== "copy" && item.action !== "update") continue;
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(plan.sourceRoot, item.file), target);
    (item.action === "copy" ? copied : updated).push(item.file);
  }

  const configured = [];
  for (const item of plan.registrations) {
    if (!item.changed) continue;
    await mkdir(path.dirname(item.target), { recursive: true });
    await writeFile(item.target, serializeRegistrationDocument(item.document), "utf8");
    configured.push(item.targetRelative);
  }

  if (plan.receiptNeedsWrite) await writeInstallationReceipt(plan.targetRoot, plan.sourceHashes);

  return { ...plan, configured, copied, removed, status: "updated", updated };
}
