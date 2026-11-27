import test from "node:test";
import assert from "node:assert/strict";
import { makeProject } from "./helpers.mjs";
import { newTask } from "../scripts/lib/task.mjs";
import { newDecision } from "../scripts/lib/decision.mjs";
import { statusSummary } from "../scripts/lib/state.mjs";

test("statusSummary 统计任务与开放决策", () => {
  const root = makeProject("status");
  newTask(root, { title: "a" });
  newTask(root, { title: "b" });
  newDecision(root, { gate: "spec", question: "?" });
  const summary = statusSummary(root);
  assert.equal(summary.project.name, "status");
  assert.equal(summary.tasks.total, 2);
  assert.equal(summary.tasks.counts.planned, 2);
  assert.equal(summary.decisions.open.length, 1);
  assert.equal(summary.state.phase, "init");
});
