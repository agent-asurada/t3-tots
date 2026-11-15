const test = require("node:test");
const assert = require("node:assert/strict");
const { adapt, adaptRoute } = require("../skills/t3-openbot/openbot-adapter");

test("question requests become OpenBot questions", () => {
  const out = adapt({ event: "request.opened", eventId: "e1", threadId: "t1", request: { id: "r1", prompt: "Pick one", options: ["A", "B"] } });
  assert.deepEqual(out, { source: "t3-tots", event: "request.opened", eventId: "e1", machine: null, threadId: "t1", title: null, action: "question", requestId: "r1", prompt: "Pick one", reason: null, options: ["A", "B"] });
});

test("approval requests preserve the reason", () => {
  const out = adapt({ event: "request.opened", request: { requestId: "r2", requestKind: "approval", prompt: "Run it", reason: "Safety check" } });
  assert.equal(out.action, "approval"); assert.equal(out.reason, "Safety check"); assert.equal(out.requestId, "r2");
});

test("thread endings become status actions", () => {
  const out = adapt({ event: "thread.failed", threadId: "t3", error: "boom", usageLimit: true });
  assert.equal(out.action, "status"); assert.equal(out.status, "failed"); assert.equal(out.error, "boom"); assert.equal(out.usageLimit, true);
});

test("unknown events remain visible without forwarding arbitrary fields", () => {
  const out = adapt({ event: "other", text: "data", secret: "drop" });
  assert.deepEqual(out, { source: "t3-tots", event: "other", eventId: null, machine: null, threadId: null, title: null, action: "unknown", text: "data" });
  assert.equal("secret" in out, false);
});

test("MCP routes become allowlisted t3ctl argv", () => {
  assert.deepEqual(adaptRoute("t3_thread_send", { thread: "t1", prompt: "Continue" }), {
    source: "t3-tots", action: "local-command", route: "t3_thread_send",
    argv: ["node", "t3ctl", "send", "--thread", "t1", "--prompt", "Continue"],
  });
  assert.equal(adaptRoute("t3_thread_update", { thread: "t1", action: "rename", title: "New" }).argv.at(-1), "New");
});

test("unsupported or incomplete MCP routes do not produce commands", () => {
  assert.equal(adaptRoute("t3_unknown", {}).action, "unsupported-route");
  assert.equal(adaptRoute("t3_thread_send", { thread: "t1" }).action, "invalid-route");
  assert.equal(adaptRoute("t3_thread_update", { thread: "t1", action: "delete" }).action, "invalid-route");
});
