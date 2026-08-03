import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  isPathInside,
  isResolvedPathInside,
  resolveActivationProofPath,
  resolveCachePaths,
  resolveCacheRoot,
  resolveCapabilityPaths,
  resolveSessionStatePath,
} from "../toolchain/lib/cache.mjs";

test("cache roots follow platform conventions and explicit override wins", () => {
  assert.equal(
    resolveCacheRoot({ platform: "win32", env: { LOCALAPPDATA: "C:\\Local" }, homedir: "C:\\Users\\demo" }),
    path.join("C:\\Local", "frontend-accelerator"),
  );
  assert.equal(
    resolveCacheRoot({ platform: "darwin", env: {}, homedir: "/Users/demo" }),
    path.join("/Users/demo", "Library", "Caches", "frontend-accelerator"),
  );
  assert.equal(
    resolveCacheRoot({ platform: "linux", env: { XDG_CACHE_HOME: "/cache" }, homedir: "/home/demo" }),
    path.join("/cache", "frontend-accelerator"),
  );
  assert.equal(
    resolveCacheRoot({ platform: "linux", env: { FRONTEND_ACCELERATOR_CACHE_DIR: "/custom/cache" }, homedir: "/home/demo" }),
    path.resolve("/custom/cache"),
  );
});

test("cache entries isolate manifest, platform, architecture, capability, and session", () => {
  const paths = resolveCachePaths({ cacheRoot: path.resolve("cache"), manifestHash: "abc", platform: "win32", arch: "x64" });
  assert.match(paths.entryRoot, /abc[\\/]win32-x64$/);
  const capability = resolveCapabilityPaths(paths, { name: "browser", package: "agent-browser", binary: "agent-browser" }, { platform: "win32" });
  assert.match(capability.executable, /node_modules[\\/]\.bin[\\/]agent-browser\.cmd$/);
  assert.match(capability.browserArtifactsRoot, /capabilities[\\/]browser[\\/]browser-artifacts$/);
  assert.notEqual(
    resolveActivationProofPath(paths, path.resolve("repo-a"), "codex"),
    resolveActivationProofPath(paths, path.resolve("repo-b"), "codex"),
  );
  assert.notEqual(
    resolveSessionStatePath(paths, path.resolve("repo-a"), "codex", "one"),
    resolveSessionStatePath(paths, path.resolve("repo-a"), "codex", "two"),
  );
});

test("resolved containment treats a filesystem alias and its canonical path as one location", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "accelerator path identity "));
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const physicalRoot = path.join(temporaryRoot, "physical");
  const aliasRoot = path.join(temporaryRoot, "alias");
  const repositoryThroughAlias = path.join(aliasRoot, "repository");
  await mkdir(path.join(physicalRoot, "repository"), { recursive: true });
  await symlink(physicalRoot, aliasRoot, process.platform === "win32" ? "junction" : "dir");

  const canonicalRepository = await realpath(repositoryThroughAlias);
  const missingCacheThroughAlias = path.join(repositoryThroughAlias, ".runtime-cache");
  assert.equal(isPathInside(canonicalRepository, missingCacheThroughAlias), false);
  assert.equal(await isResolvedPathInside(canonicalRepository, missingCacheThroughAlias), true);
  assert.equal(
    await isResolvedPathInside(canonicalRepository, path.join(temporaryRoot, "external-cache")),
    false,
  );
});
