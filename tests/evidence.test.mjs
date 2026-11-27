import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeProject, initGit, commitAll, writeTasks } from "./helpers.mjs";
import { listTasks, loadTask, syncTasks, updateTask } from "../scripts/lib/task.mjs";
import { runEvidence, listEvidence, loadEvidence, validateEvidence } from "../scripts/lib/evidence.mjs";
import { runProcessArgv, writeJson, writeText } from "../scripts/lib/util.mjs";

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

test("validateEvidence 绑定 commit/task/dirty/日志路径", async () => {
  const root = makeProject("evidence-binding");
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
  const commit = commitAll(root, "feat: 增加 a");
  updateTask(root, task.id, { status: "review", add_evidence: ["EV-0001"], end_commit: commit });
  // 先写一个占位日志，再生成正式证据（runEvidence 会创建 EV-0002）
  const ev = await runEvidence(root, {
    taskId: task.id,
    agent: "sdd/builder",
    command: "git rev-parse HEAD",
    gate: "final",
  });
  const current = loadTask(root, task.id);
  assert.equal(validateEvidence(root, ev, { task: current }).ok, true);
  assert.equal(validateEvidence(root, { ...ev, commit: null }, { task: current }).ok, false);
  assert.equal(validateEvidence(root, { ...ev, commit: "0".repeat(40) }, { task: current }).ok, false);
  assert.equal(validateEvidence(root, { ...ev, dirty: true }, { task: current }).ok, false);
  assert.equal(validateEvidence(root, { ...ev, task: "TASK-0002" }, { task: current }).ok, false);
  assert.equal(validateEvidence(root, { ...ev, log_path: "../../evil.log" }, { task: current }).ok, false);
});

test("done 拒绝未绑定/低质量证据", async () => {
  const root = makeProject("evidence-done");
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
  const head = commitAll(root, "test: 任务开始");
  updateTask(root, task.id, { end_commit: head });
  const fake = {
    schema_version: 1,
    id: "EV-0001",
    task: task.id,
    agent: "sdd/builder",
    command: "git rev-parse HEAD",
    cwd: root,
    exit_code: 0,
    started_at: "2026-01-01T00:00:00+08:00",
    finished_at: "2026-01-01T00:00:01+08:00",
    duration_ms: 1,
    commit: null,
    dirty: true,
    log_path: `.sdd/evidence/${task.id}/EV-0001.log`,
    log_bytes: 1,
    truncated: false,
    manual: false,
    created_at: "2026-01-01T00:00:01+08:00",
  };
  writeText(path.join(root, fake.log_path), "x\n");
  writeJson(path.join(root, ".sdd", "evidence", task.id, "EV-0001.json"), fake);
  updateTask(root, task.id, { status: "review", add_evidence: ["EV-0001"], end_commit: head });
  assert.throws(
    () => updateTask(root, task.id, { status: "done" }),
    /没有通过校验的证据/,
  );
});

test("patch.evidence 会持久化", async () => {
  const root = makeProject("evidence-persist");
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
  const commit = commitAll(root, "test: 任务");
  const ev = await runEvidence(root, { taskId: task.id, agent: "sdd/builder", command: "git rev-parse HEAD" });
  const updated = updateTask(root, task.id, {
    status: "review",
    evidence: [ev.id],
    end_commit: commit,
  });
  assert.deepEqual(updated.evidence, [ev.id]);
});

test("runProcessArgv 保留参数空格并支持超时杀进程树", async () => {
  const spaced = await runProcessArgv(process.execPath, ["-e", "console.log('a b')"]);
  assert.equal(spaced.exitCode, 0);
  assert.match(spaced.stdout, /a b/);

  const timed = await runProcessArgv(process.execPath, ["-e", "setTimeout(()=>{}, 10000)"], { timeoutMs: 300 });
  assert.equal(timed.timedOut, true);
});
