import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanBrowserArgs,
  executeBrowserAdapter,
  keyboardDaemonCommand,
  temporalFillScript,
} from "../toolchain/lib/browser-adapter.mjs";

function outputBuffer() {
  let value = "";
  return {
    stream: { write(chunk) { value += chunk; } },
    value: () => value,
  };
}

test("browser adapter recognizes commands around global flags", () => {
  assert.deepEqual(
    cleanBrowserArgs(["--session", "regression", "--json", "fill", "#date", "2026-08-15"]),
    ["fill", "#date", "2026-08-15"],
  );
});

test("temporal input fill uses the native value setter and input/change events", async () => {
  const calls = [];
  const stdout = outputBuffer();
  const result = await executeBrowserAdapter({
    targetRoot: "C:/repo",
    args: ["--session", "regression", "fill", "#date", "2026-08-15"],
    stdout: stdout.stream,
    execute: async () => assert.fail("temporal input must not fall back to agent-browser fill"),
    sendDaemon: async (call) => {
      calls.push(call);
      return { success: true, data: { result: true }, error: null };
    },
  });

  assert.equal(result.code, 0);
  assert.equal(stdout.value(), "✓ Done\n");
  assert.equal(calls[0].session, "regression");
  assert.equal(calls[0].command.action, "evaluate");
  assert.match(calls[0].command.script, /Input\.prototype, "value"/);
  assert.match(calls[0].command.script, /dispatchEvent\(new Event\("input"/);
  assert.match(calls[0].command.script, /dispatchEvent\(new Event\("change"/);
  assert.match(calls[0].command.script, /2026-08-15/);
});

test("non-temporal fill retains the pinned agent-browser behavior", async () => {
  const calls = [];
  const expected = { code: 7, signal: null, stdout: "", stderr: "fallback" };
  const result = await executeBrowserAdapter({
    targetRoot: "C:/repo",
    args: ["--session", "regression", "fill", "#name", "Ada"],
    stdout: outputBuffer().stream,
    sendDaemon: async () => ({ success: true, data: { result: false }, error: null }),
    execute: async (call) => {
      calls.push(call);
      return expected;
    },
  });

  assert.equal(result, expected);
  assert.deepEqual(calls[0], {
    targetRoot: "C:/repo",
    name: "browser",
    args: ["--session", "regression", "fill", "#name", "Ada"],
    stdio: "inherit",
  });
});

test("Enter and Space keydown/keyup commands carry Chrome activation fields", () => {
  assert.deepEqual(
    { ...keyboardDaemonCommand("keydown", "Enter"), id: "stable" },
    { id: "stable", action: "input_keyboard", type: "keyDown", key: "Enter", code: "Enter", text: "\r" },
  );
  assert.deepEqual(
    { ...keyboardDaemonCommand("keyup", "Enter"), id: "stable" },
    { id: "stable", action: "input_keyboard", type: "keyUp", key: "Enter", code: "Enter" },
  );
  assert.deepEqual(
    { ...keyboardDaemonCommand("keydown", "Space"), id: "stable" },
    { id: "stable", action: "input_keyboard", type: "keyDown", key: " ", code: "Space", text: " " },
  );
  assert.deepEqual(
    { ...keyboardDaemonCommand("keyup", "Space"), id: "stable" },
    { id: "stable", action: "input_keyboard", type: "keyUp", key: " ", code: "Space" },
  );
});

test("keyboard regression path sends the corrected daemon command", async () => {
  const calls = [];
  const stdout = outputBuffer();
  const result = await executeBrowserAdapter({
    targetRoot: "C:/repo",
    args: ["--session", "regression", "keydown", "Space"],
    stdout: stdout.stream,
    execute: async () => assert.fail("corrected keyboard events must bypass the incomplete CLI command"),
    sendDaemon: async (call) => {
      calls.push(call);
      return { success: true, data: {}, error: null };
    },
  });

  assert.equal(result.code, 0);
  assert.equal(stdout.value(), "✓ Done\n");
  assert.equal(calls[0].command.action, "input_keyboard");
  assert.deepEqual(
    { ...calls[0].command, id: "stable" },
    { id: "stable", action: "input_keyboard", type: "keyDown", key: " ", code: "Space", text: " " },
  );
});

test("temporal fill script safely quotes selectors and values", () => {
  const script = temporalFillScript("input[data-name='a\\b']", "12:34\"x");
  assert.match(script, /document\.querySelector\("input\[data-name='a\\\\b'\]"\)/);
  assert.match(script, /setter\.call\(element, "12:34\\"x"\)/);
});
