#!/usr/bin/env node
// Convert one redacted T3 Tots event per JSON line into an OpenBot action.
// This process is deliberately transport-free: OpenBot owns prompts, cards,
// routines and credentials; this adapter only translates event shapes.

const readline = require("readline");

function requestOf(event) {
  return event.request || event.approval || event.question || event;
}

function adapt(event) {
  if (!event || typeof event !== "object") throw new Error("event must be an object");
  const name = String(event.event || event.kind || "");
  const request = requestOf(event);
  const base = {
    source: "t3-tots",
    event: name,
    eventId: event.eventId || null,
    machine: event.machine || null,
    threadId: event.threadId || request.threadId || null,
    title: event.title || request.title || null,
  };

  if (/request\.opened|request-opened/.test(name)) {
    const approval = request.kind === "approval" || request.requestKind === "approval" || !!request.reason;
    return {
      ...base,
      action: approval ? "approval" : "question",
      requestId: request.requestId || request.id || null,
      prompt: request.prompt || request.text || event.text || "",
      reason: approval ? (request.reason || event.reason || null) : null,
      options: Array.isArray(request.options) ? request.options : [],
    };
  }

  if (/request\.resolved|request-resolved/.test(name)) {
    return {
      ...base,
      action: "request-resolved",
      requestId: request.requestId || request.id || null,
      answer: request.answer || event.answer || null,
    };
  }

  if (/thread\.(finished|failed|cancelled)|thread-(finished|failed|cancelled|failed-batch|missed-summary)/.test(name)) {
    return {
      ...base,
      action: "status",
      status: event.status || name.split(/[.-]/).at(-1),
      text: event.text || null,
      error: event.error || null,
      lastReply: event.lastReply || null,
      usageLimit: event.usageLimit === true,
      resumeAt: event.resumeAt || null,
      count: event.count || null,
    };
  }

  if (name === "test") return { ...base, action: "test" };
  return { ...base, action: "unknown", text: event.text || null };
}

function main(input = process.stdin, output = process.stdout) {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    try { output.write(JSON.stringify(adapt(JSON.parse(line))) + "\n"); }
    catch (err) { output.write(JSON.stringify({ source: "t3-tots", action: "error", error: err.message }) + "\n"); }
  });
}

if (require.main === module) main();
module.exports = { adapt };
