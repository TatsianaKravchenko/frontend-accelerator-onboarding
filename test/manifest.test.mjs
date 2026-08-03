import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  isSupportedNodeVersion,
  loadManifest,
  manifestHash,
  validateManifest,
} from "../toolchain/lib/manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Runtime Toolchain Manifest pins the required and recommended capabilities", async () => {
  const loaded = await loadManifest(root);
  assert.equal(loaded.manifest.node, ">=24");
  assert.deepEqual(loaded.manifest.capabilities.browser, {
    required: true,
    package: "agent-browser",
    version: "0.32.3",
    integrity: "sha512-jwmqex/vEFNWx7X/W3JnZSWm5C+46SFKWDXYD7timGPCcvqHZtdVIBnKGUz7iCJYflQg4DrtxWUWzuin9+zoyA==",
    binary: "agent-browser",
    setup: ["install"],
  });
  assert.equal(loaded.manifest.capabilities.docs.required, false);
  assert.equal(loaded.manifest.capabilities.docs.package, "ctx7");
  assert.equal(loaded.manifest.capabilities.docs.version, "0.5.5");
});

test("manifest hashing is deterministic and key-order independent", async () => {
  const value = JSON.parse(await readFile(path.join(root, "toolchain", "manifest.json"), "utf8"));
  const reordered = {
    capabilities: value.capabilities,
    node: value.node,
    toolchainVersion: value.toolchainVersion,
    schemaVersion: value.schemaVersion,
  };
  assert.equal(manifestHash(validateManifest(value)), manifestHash(validateManifest(reordered)));
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("manifest validation rejects unknown fields and unpinned versions", () => {
  const valid = {
    schemaVersion: 1,
    toolchainVersion: 1,
    node: ">=24",
    capabilities: {
      browser: {
        required: true,
        package: "agent-browser",
        version: "0.32.3",
        integrity: "sha512-jwmqex/vEFNWx7X/W3JnZSWm5C+46SFKWDXYD7timGPCcvqHZtdVIBnKGUz7iCJYflQg4DrtxWUWzuin9+zoyA==",
        binary: "agent-browser",
      },
      docs: {
        required: false,
        package: "ctx7",
        version: "0.5.5",
        integrity: "sha512-yA42zBalneR2kXGAqzJWh23kpwLbdDeScy4dKXOOXUckDJlybk4+sn9uFOCYvGEiczMsmClOsqOwI6+BHCpk+w==",
        binary: "ctx7",
      },
    },
  };
  assert.throws(() => validateManifest({ ...valid, surprise: true }), /unknown field surprise/);
  assert.throws(
    () => validateManifest({ ...valid, capabilities: { ...valid.capabilities, browser: { ...valid.capabilities.browser, version: "latest" } } }),
    /exact semantic version/,
  );
  assert.throws(
    () => validateManifest({ ...valid, capabilities: { ...valid.capabilities, docs: { ...valid.capabilities.docs, integrity: "sha512-YWJjZA==" } } }),
    /sha512 integrity/,
  );
  assert.throws(
    () => validateManifest({ ...valid, capabilities: { ...valid.capabilities, docs: { ...valid.capabilities.docs, binary: "ctx 7" } } }),
    /bare executable name/,
  );
});

test("manifest loading rejects duplicate capability names before JSON normalization", async () => {
  const raw = `{
    "schemaVersion": 1,
    "toolchainVersion": 1,
    "node": ">=24",
    "capabilities": {
      "browser": {},
      "browser": {},
      "docs": {}
    }
  }`;
  await assert.rejects(
    loadManifest(root, { readFile: async () => raw }),
    /Duplicate Runtime Toolchain Manifest field: capabilities\.browser/,
  );
});

test("Node.js support begins at major version 24", () => {
  assert.equal(isSupportedNodeVersion("23.9.0"), false);
  assert.equal(isSupportedNodeVersion("24.0.0"), true);
  assert.equal(isSupportedNodeVersion("26.1.0"), true);
});
