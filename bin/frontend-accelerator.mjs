#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  InstallConflictError,
  UpdateConflictError,
  installPayload,
  updatePayload,
} from "../lib/install.mjs";
import { doctorExitCode, formatDoctorReport, runDoctor } from "../toolchain/lib/doctor.mjs";
import { assertSupportedNodeVersion } from "../toolchain/lib/manifest.mjs";
import { setupToolchain } from "../toolchain/lib/setup.mjs";

const usage = `Frontend Accelerator Toolset

Usage:
  frontend-accelerator install [--yes]
  frontend-accelerator update [--yes]
  frontend-accelerator setup [--yes]
  frontend-accelerator doctor [--json]

install  Preview and write the project payload plus recognized Claude/Codex hook registrations.
update   Safely update an existing accelerator payload and its recognized hook registrations.
setup    Preview and provision pinned runtime tools into the user-local accelerator cache.
doctor   Read project/cache readiness without installing, repairing, trusting, or rewriting state.
`;

function parseCommand(argv) {
  const [command, ...flags] = argv;
  if (command === undefined || command === "--help" || command === "-h") return { command: "help" };
  const allowed = command === "doctor" ? new Set(["--json"]) : new Set(["--yes"]);
  if (!new Set(["install", "update", "setup", "doctor"]).has(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  for (const flag of flags) {
    if (!allowed.has(flag)) throw new Error(`Unsupported option for ${command}: ${flag}`);
  }
  if (new Set(flags).size !== flags.length) throw new Error(`Duplicate option for ${command}`);
  return { command, yes: flags.includes("--yes"), json: flags.includes("--json") };
}

async function ask(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive confirmation requires a terminal. Re-run with --yes after reviewing the preview.");
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`${question} [y/N] `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

function previewInstall(plan) {
  console.log(`Target: ${plan.targetRoot}`);
  for (const item of plan.operations) {
    const hookDetails = item.hookEvents ? ` [${item.hookEvents.join(", ")}]` : "";
    console.log(`${item.operation.toUpperCase().padEnd(9)} ${item.targetRelative}${hookDetails}`);
  }
}

function previewSetup(plan) {
  console.log(`Target: ${plan.targetRoot}`);
  console.log(`Cache: ${plan.cachePaths.cacheRoot}`);
  for (const capability of plan.capabilities) {
    console.log(
      `${capability.action.toUpperCase().padEnd(9)} ${capability.name} (${capability.package}@${capability.version}) -> ${capability.destination}`,
    );
  }
}

async function main() {
  const parsed = parseCommand(process.argv.slice(2));
  if (parsed.command === "help") {
    console.log(usage);
    return;
  }
  const targetRoot = process.cwd();

  if (parsed.command === "install") {
    assertSupportedNodeVersion();
    const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const result = await installPayload({
      sourceRoot,
      targetRoot,
      confirm: async (plan) => {
        previewInstall(plan);
        return parsed.yes || ask("Apply this project installation plan?");
      },
    });
    if (result.status === "declined") {
      console.log("Installation cancelled. No files were written.");
      return;
    }
    console.log(`Installed ${result.copied.length} payload files and configured ${result.configured.length} hook files.`);
    return;
  }

  if (parsed.command === "update") {
    assertSupportedNodeVersion();
    const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const result = await updatePayload({
      sourceRoot,
      targetRoot,
      confirm: async (plan) => {
        previewInstall(plan);
        return parsed.yes || ask("Apply this project update plan?");
      },
    });
    if (result.status === "declined") {
      console.log("Update cancelled. No files were written.");
      return;
    }
    if (result.status === "unchanged") {
      console.log("Frontend Accelerator is already up to date.");
      return;
    }
    console.log(
      `Updated ${result.updated.length} payload files, copied ${result.copied.length}, removed ${result.removed.length}, and configured ${result.configured.length} hook files.`,
    );
    if (result.configured.includes(".codex/hooks.json")) {
      console.log("Codex hook commands changed. Review and trust them again through /hooks.");
    }
    return;
  }

  if (parsed.command === "setup") {
    assertSupportedNodeVersion();
    const result = await setupToolchain({
      targetRoot,
      confirm: async (plan) => {
        previewSetup(plan);
        return parsed.yes || ask("Download and provision this Runtime Toolchain plan?");
      },
    });
    if (result.status === "declined") console.log("Runtime setup cancelled. No tools were provisioned.");
    else {
      for (const outcome of result.outcomes) {
        const detail = outcome.error ? ` — ${outcome.error}` : "";
        console.log(`${outcome.status.toUpperCase().padEnd(9)} ${outcome.capability}${detail}`);
      }
      console.log(`Runtime setup: ${result.status.toUpperCase()}`);
    }
    if (result.status === "blocked") process.exitCode = 1;
    return;
  }

  const report = await runDoctor({ targetRoot });
  console.log(parsed.json ? JSON.stringify(report, null, 2) : formatDoctorReport(report));
  process.exitCode = doctorExitCode(report);
}

main().catch((error) => {
  if (error instanceof InstallConflictError || error instanceof UpdateConflictError) {
    console.error(error.message);
    for (const file of error.conflicts) console.error(`  ${file}`);
    console.error("No files were written. Resolve the reported conflicts and retry.");
  } else {
    console.error(error.message);
    if (/Unknown command|Unsupported option|Duplicate option/.test(error.message)) console.error(usage);
  }
  process.exitCode = 1;
});
