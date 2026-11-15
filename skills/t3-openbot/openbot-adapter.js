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

function adaptRoute(route, payload = {}) {
  const r = String(route || "");
  const arg = (name) => payload[name] == null ? null : String(payload[name]);
  const command = ["node", "t3ctl"];
  if (r === "t3_project_list") command.push("projects");
  else if (r === "t3_thread_list") {
    command.push("threads");
    if (arg("project")) command.push("--project", arg("project"));
    if (arg("limit")) command.push("--limit", arg("limit"));
  } else if (r === "t3_thread_read") {
    if (!arg("thread")) return { source: "t3-tots", action: "invalid-route", route: r, error: "thread is required" };
    command.push("read", "--thread", arg("thread"));
    if (arg("last")) command.push("--last", arg("last"));
  } else if (r === "t3_pending_request") {
    if (!arg("thread")) return { source: "t3-tots", action: "invalid-route", route: r, error: "thread is required" };
    command.push("pending", "--thread", arg("thread"), "--json");
  } else if (r === "t3_thread_launch") {
    if (!arg("project") || !arg("prompt")) return { source: "t3-tots", action: "invalid-route", route: r, error: "project and prompt are required" };
    command.push("new", "--project", arg("project"), "--prompt", arg("prompt"));
    if (arg("title")) command.push("--title", arg("title"));
  } else if (r === "t3_thread_send") {
    if (!arg("thread") || !arg("prompt")) return { source: "t3-tots", action: "invalid-route", route: r, error: "thread and prompt are required" };
    command.push("send", "--thread", arg("thread"), "--prompt", arg("prompt"));
  } else if (r === "t3_thread_update") {
    const action = arg("action");
    if (!arg("thread") || !["archive", "unarchive", "settle", "unsettle", "rename"].includes(action))
      return { source: "t3-tots", action: "invalid-route", route: r, error: "thread and a supported action are required" };
    command.push(action, "--thread", arg("thread"));
    if (action === "rename") {
      if (!arg("title")) return { source: "t3-tots", action: "invalid-route", route: r, error: "title is required for rename" };
      command.push("--title", arg("title"));
    }
  } else return { source: "t3-tots", action: "unsupported-route", route: r };
  return { source: "t3-tots", action: "local-command", route: r, argv: command };
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
module.exports = { adapt, adaptRoute };
