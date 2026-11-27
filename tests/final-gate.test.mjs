import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  makeProject, initGit, commitAll, approve, writeConvergeReview, writeFinalReview,
} from "./helpers.mjs";
import { newTask, updateTask, listTasks } from "../scripts/lib/task.mjs";
import { runEvidence } from "../scripts/lib/evidence.mjs";
import { writeReview } from "../scripts/lib/review.mjs";
import { checkGate } from "../scripts/lib/gate.mjs";

test("final 门拒绝 write_scope 越界", async () => {
  const root = makeProject("final-scope");
  initGit(root);
  const base = commitAll(root, "test: base");
  const task = newTask(root, {
    title: "scope-test",
    risk: "low",
    write_scope: ["src/"],
    acceptance: ["可运行"],
    verify: ["git rev-parse HEAD"],
    owner: "sdd/builder",
  });
  updateTask(root, task.id, { status: "ready" });
  updateTask(root, task.id, { status: "in_progress", baseline_commit: base });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "a.txt"), "a\n", "utf8");
  commitAll(root, "feat: in scope");
  fs.writeFileSync(path.join(root, "other.txt"), "out of scope\n", "utf8");
  const end = commitAll(root, "test: out of scope");
  updateTask(root, task.id, { end_commit: end });
  const ev = await runEvidence(root, { taskId: task.id, agent: "sdd/builder", command: "git rev-parse HEAD" });
  updateTask(root, task.id, { status: "review", add_evidence: [ev.id], end_commit: end });
  const review = writeReview(root, {
    kind: "task",
    task: task.id,
    verdict: "pass",
    reviewed_commit: end,
    reviewed_evidence: [ev.id],
    body: "# Review\n\n通过。\n",
  });
  updateTask(root, task.id, { status: "done", review: review.id });

  for (const gate of ["kickoff", "spec", "plan", "tasks"]) approve(root, gate);
  writeConvergeReview(root, { reviewed_commit: end, reviewed_evidence: [ev.id] });
  writeFinalReview(root, { reviewed_commit: end, reviewed_evidence: [ev.id] });
  approve(root, "final");

  const result = checkGate(root, "final");
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("越出 write_scope")), result.errors.join("; "));
  assert.equal(listTasks(root)[0].status, "done");
});
