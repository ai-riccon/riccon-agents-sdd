import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeProject, initGit, commitAll, writeTasks } from "./helpers.mjs";
import {
  listTasks, syncTasks, updateTask, taskScopeViolations,
} from "../scripts/lib/task.mjs";
import { runEvidence } from "../scripts/lib/evidence.mjs";
import { writeReview } from "../scripts/lib/review.mjs";

test("任务同步与生命周期", () => {
  const root = makeProject("task");
  initGit(root);
  writeTasks(root);
  commitAll(root, "test: 初始");
  const sync = syncTasks(root);
  assert.equal(sync.total, 2);
  const tasks = listTasks(root);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].speckit_id, "T001");

  updateTask(root, tasks[0].id, {
    write_scope: ["src/"],
    acceptance: ["可运行"],
    verify: ["git rev-parse HEAD"],
    owner: "sdd/builder",
  });
  updateTask(root, tasks[0].id, { status: "ready" });
  const started = updateTask(root, tasks[0].id, { status: "in_progress" });
  assert.equal(started.status, "in_progress");
  assert.ok(started.baseline_commit);
});

test("非法状态跳转被拒绝", () => {
  const root = makeProject("task-invalid");
  initGit(root);
  writeTasks(root);
  commitAll(root, "test: 初始");
  syncTasks(root);
  const task = listTasks(root)[0];
  assert.throws(() => updateTask(root, task.id, { status: "done" }), /不能从 planned/);
});

test("高风险任务降级后仍要求独立评审", async () => {
  const root = makeProject("task-risk");
  initGit(root);
  writeTasks(root);
  commitAll(root, "test: 初始");
  syncTasks(root);
  const task = listTasks(root)[0];
  updateTask(root, task.id, {
    risk: "high",
    write_scope: ["src/"],
    acceptance: ["可运行"],
    verify: ["git rev-parse HEAD"],
    owner: "sdd/builder",
  });
  updateTask(root, task.id, { status: "ready" });
  updateTask(root, task.id, { status: "in_progress" });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "a.txt"), "a\n", "utf8");
  const commit = commitAll(root, "feat: 高风险任务");
  const ev = await runEvidence(root, { taskId: task.id, agent: "sdd/builder", command: "git rev-parse HEAD" });
  updateTask(root, task.id, { status: "review", add_evidence: [ev.id], end_commit: commit });
  updateTask(root, task.id, { risk: "low" });
  assert.throws(() => updateTask(root, task.id, { status: "done" }), /高风险任务/);
  const review = writeReview(root, {
    kind: "task",
    task: task.id,
    verdict: "pass",
    reviewed_commit: commit,
    reviewed_evidence: [ev.id],
    body: "# Review\n\n通过。\n",
  });
  const done = updateTask(root, task.id, { status: "done", review: review.id });
  assert.equal(done.status, "done");
  assert.equal(done.max_risk, "high");
});

test("scope 无法检查时返回 checked=false", () => {
  const root = makeProject("task-scope-invalid");
  initGit(root);
  writeTasks(root);
  commitAll(root, "test: 初始");
  syncTasks(root);
  const task = listTasks(root)[0];
  const result = taskScopeViolations(root, task.id, { base: "--output=evil", head: "HEAD" });
  assert.equal(result.checked, false);
  assert.match(result.reason, /非法 commit/);
});

test("scope 越界可被发现", async () => {
  const root = makeProject("task-scope");
  initGit(root);
  writeTasks(root);
  commitAll(root, "test: 初始");
  syncTasks(root);
  const task = listTasks(root)[0];
  updateTask(root, task.id, {
    write_scope: ["src/"],
    acceptance: ["可运行"],
    verify: ["git rev-parse HEAD"],
    owner: "sdd/builder",
  });
  updateTask(root, task.id, { status: "ready" });
  updateTask(root, task.id, { status: "in_progress" });
  fs.mkdirSync(path.join(root, "other"), { recursive: true });
  fs.writeFileSync(path.join(root, "other", "out.txt"), "x\n", "utf8");
  commitAll(root, "test: 越界文件");
  const evidence = await runEvidence(root, {
    taskId: task.id,
    agent: "sdd/builder",
    command: "git rev-parse HEAD",
  });
  updateTask(root, task.id, { status: "review", add_evidence: [evidence.id], end_commit: "HEAD" });
  const scope = taskScopeViolations(root, task.id);
  assert.equal(scope.checked, true);
  assert.ok(scope.violations.includes("other/out.txt"));
});
