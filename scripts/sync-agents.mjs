#!/usr/bin/env node

import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function parseScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseAgent(raw, file = "agent.md") {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (pair) frontmatter[pair[1]] = parseScalar(pair[2]);
  }

  for (const field of ["name", "description", "invokes"]) {
    if (!frontmatter[field]) throw new Error(`${file}: frontmatter missing ${field}`);
  }

  if (frontmatter.name !== frontmatter.invokes) {
    throw new Error(`${file}: agent name and invoked skill must match`);
  }

  return { body: match[2].trim(), file, frontmatter };
}

function inferredReadOnly(tools = "") {
  const values = tools.split(",").map((value) => value.trim());
  return !values.some(
    (value) =>
      value === "Write" ||
      value === "Edit" ||
      value.startsWith("Write(") ||
      value.startsWith("Edit(") ||
      (value.startsWith("Bash") && !/^Bash\(git (diff|log)/.test(value)),
  );
}

function tomlMultiline(value) {
  return `"""\n${value.replaceAll('"""', '\\"\\"\\"')}\n"""`;
}

function emitAgent({ body, frontmatter }) {
  const readOnly = frontmatter["read-only"]
    ? frontmatter["read-only"] === "true"
    : inferredReadOnly(frontmatter.tools);
  const lines = [
    `[agents.${frontmatter.name}]`,
    `description = ${JSON.stringify(frontmatter.description)}`,
    `read_only = ${readOnly}`,
  ];
  if (frontmatter.tools) lines.push(`# canonical tools scope: ${frontmatter.tools}`);
  lines.push(`instructions = ${tomlMultiline(body)}`);
  return lines.join("\n");
}

export async function generateAgentToml(rootDir) {
  const sourceDir = path.join(rootDir, ".claude", "agents");
  const entries = (await readdir(sourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length === 0) throw new Error(`${sourceDir}: no canonical agents found`);

  const agents = [];
  for (const entry of entries) {
    const file = path.join(sourceDir, entry.name);
    agents.push(parseAgent(await readFile(file, "utf8"), entry.name));
  }

  const header = [
    "# GENERATED from .claude/agents - do not edit by hand.",
    "# Maintainers regenerate with: npm run sync:agents",
    "# Downstream users copy this committed file and configure Codex manually.",
    "# Include these definitions in the user-global Codex config and enable multi-agent support.",
    "",
  ].join("\n");
  return `${header}${agents.map(emitAgent).join("\n\n")}\n`;
}

async function listFiles(directory, base = directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath, base)));
    if (entry.isFile()) files.push(path.relative(base, fullPath).split(path.sep).join("/"));
  }
  return files.sort();
}

export async function collectMirrorDifferences(rootDir) {
  const canonicalSkills = path.join(rootDir, ".claude", "skills");
  const mirroredSkills = path.join(rootDir, ".agents", "skills");
  const [sourceFiles, targetFiles] = await Promise.all([
    listFiles(canonicalSkills),
    listFiles(mirroredSkills),
  ]);
  const sourceSet = new Set(sourceFiles);
  const targetSet = new Set(targetFiles);
  const differences = [];

  for (const file of sourceFiles) {
    if (!targetSet.has(file)) {
      differences.push(`missing mirror skill file: ${file}`);
      continue;
    }
    const [source, target] = await Promise.all([
      readFile(path.join(canonicalSkills, file)),
      readFile(path.join(mirroredSkills, file)),
    ]);
    if (!source.equals(target)) differences.push(`stale mirror skill file: ${file}`);
  }

  for (const file of targetFiles) {
    if (!sourceSet.has(file)) differences.push(`extra mirror skill file: ${file}`);
  }

  const expectedToml = await generateAgentToml(rootDir);
  let currentToml = "";
  try {
    currentToml = await readFile(path.join(rootDir, ".agents", "codex-agents.toml"), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (currentToml !== expectedToml) differences.push("stale Codex agent TOML");

  return differences;
}

export async function syncAgents(rootDir, { check = false } = {}) {
  if (check) {
    const differences = await collectMirrorDifferences(rootDir);
    if (differences.length > 0) {
      const error = new Error(`Codex mirror is stale:\n- ${differences.join("\n- ")}`);
      error.differences = differences;
      throw error;
    }
    return;
  }

  const canonicalSkills = path.join(rootDir, ".claude", "skills");
  const agentsRoot = path.join(rootDir, ".agents");
  const mirroredSkills = path.join(agentsRoot, "skills");
  await rm(mirroredSkills, { force: true, recursive: true });
  await mkdir(agentsRoot, { recursive: true });
  await cp(canonicalSkills, mirroredSkills, { recursive: true });
  await writeFile(path.join(agentsRoot, "codex-agents.toml"), await generateAgentToml(rootDir), "utf8");
}

async function main() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const check = process.argv.includes("--check");
  await syncAgents(rootDir, { check });
  console.log(check ? "Codex mirrors are up to date." : "Generated .agents/ skills and agent TOML.");
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
