const test = require("node:test");
const assert = require("node:assert/strict");
const { adapt } = require("../skills/t3-openbot/openbot-adapter");

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
