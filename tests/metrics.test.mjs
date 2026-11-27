import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeProject, initGit, commitAll } from "./helpers.mjs";
import { newTask, updateTask } from "../scripts/lib/task.mjs";
import { runEvidence } from "../scripts/lib/evidence.mjs";
import { writeReview } from "../scripts/lib/review.mjs";
import { runGate } from "../scripts/lib/gate.mjs";
import { computeMetrics, readEvents } from "../scripts/lib/metrics.mjs";

test("metrics 记录任务/门禁事件和完成数", async () => {
  const root = makeProject("metrics");
  initGit(root);
  commitAll(root, "test: 初始");
  const task = newTask(root, {
    title: "指标任务",
    risk: "low",
    write_scope: ["src/"],
    acceptance: ["可运行"],
    verify: ["git rev-parse HEAD"],
    owner: "sdd/builder",
  });
  updateTask(root, task.id, { status: "ready" });
  updateTask(root, task.id, { status: "in_progress" });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "a.txt"), "a\n", "utf8");
  const commit = commitAll(root, "feat: 指标任务");
  const ev = await runEvidence(root, { taskId: task.id, agent: "sdd/builder", command: "git rev-parse HEAD" });
  updateTask(root, task.id, { status: "review", add_evidence: [ev.id], end_commit: commit });
  const review = writeReview(root, {
    kind: "task",
    task: task.id,
    verdict: "pass",
    reviewed_commit: commit,
    reviewed_evidence: [ev.id],
    body: "# Review\n\n通过。\n",
  });
  updateTask(root, task.id, { status: "done", review: review.id });

  runGate(root, "kickoff");
  const metrics = computeMetrics(root);
  assert.equal(metrics.tasks_total, 1);
  assert.equal(metrics.tasks_done, 1);
  assert.ok(metrics.evidence_total >= 1);
  assert.ok(metrics.dispatches >= 1);
  assert.ok(metrics.gate_failures >= 1);
  assert.ok(readEvents(root).some((event) => event.type === "task_done"));
});
