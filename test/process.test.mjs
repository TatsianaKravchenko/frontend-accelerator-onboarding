import assert from "node:assert/strict";
import test from "node:test";
import { defaultProcessRunner } from "../toolchain/lib/process.mjs";

test(
  "Windows process runner launches npm command shims through ComSpec on Node 24",
  { skip: process.platform !== "win32" },
  async () => {
    const result = await defaultProcessRunner("npm.cmd", ["--version"]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
  },
);
