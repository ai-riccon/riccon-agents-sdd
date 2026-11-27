import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeProject, initGit, commitAll, writeTasks } from "./helpers.mjs";
import { listTasks, syncTasks, updateTask } from "../scripts/lib/task.mjs";
import { runEvidence, listEvidence, validateEvidence } from "../scripts/lib/evidence.mjs";

test("evidence run 记录命令、exit code 和日志", async () => {
  const root = makeProject("evidence");
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
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "a.txt"), "a\n", "utf8");
  commitAll(root, "feat: 增加 a");
  const ev = await runEvidence(root, { taskId: task.id, agent: "sdd/builder", command: "git rev-parse HEAD" });
  assert.equal(ev.exit_code, 0);
  assert.ok(fs.existsSync(path.join(root, ev.log_path)));
  const items = listEvidence(root, task.id);
  assert.equal(items.length, 1);
  assert.equal(validateEvidence(root, ev).ok, true);
});

test("工作树脏时拒绝取证", async () => {
  const root = makeProject("evidence-dirty");
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
  fs.writeFileSync(path.join(root, "dirty.txt"), "x\n", "utf8");
  await assert.rejects(
    () => runEvidence(root, { taskId: task.id, agent: "sdd/builder", command: "git rev-parse HEAD" }),
    /工作树不干净/,
  );
});

test("非零 exit code 也被记录", async () => {
  const root = makeProject("evidence-fail");
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
  const ev = await runEvidence(root, {
    taskId: task.id,
    agent: "sdd/builder",
    command: "node -e \"process.exit(3)\"",
  });
  assert.equal(ev.exit_code, 3);
  assert.equal(validateEvidence(root, ev).ok, false);
});
