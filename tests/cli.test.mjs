import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeProject, initGit, commitAll, runCli } from "./helpers.mjs";
import { listTasks } from "../scripts/lib/task.mjs";

test("CLI task new/list/update 可用", () => {
  const root = makeProject("cli-task");
  initGit(root);
  commitAll(root, "test: 初始");
  runCli(root, ["task", "new", "--title", "示例任务", "--scope", "src/", "--acceptance", "可运行", "--verify", "git rev-parse HEAD", "--owner", "sdd/builder"]);
  const tasks = listTasks(root);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "示例任务");
  const id = tasks[0].id;
  runCli(root, ["task", "update", id, "--status", "ready"]);
  runCli(root, ["task", "update", id, "--status", "in_progress"]);
  assert.equal(listTasks(root)[0].status, "in_progress");
  const out = runCli(root, ["task", "list"]);
  assert.match(out.stdout, new RegExp(id));
});

test("CLI 布尔旗标与 --yes 守卫", () => {
  const root = makeProject("cli-flags");
  initGit(root);
  commitAll(root, "test: 初始");
  runCli(root, ["task", "new", "--title", "t", "--scope", "src/", "--acceptance", "a", "--verify", "git rev-parse HEAD"]);
  const id = listTasks(root)[0].id;
  runCli(root, ["task", "update", id, "--parallel", "false"]);
  assert.equal(listTasks(root)[0].parallel, false);
  const noYes = runCli(root, ["upgrade", "--write"], { allowFail: true });
  assert.equal(noYes.code, 1);
  assert.match(noYes.stderr, /--yes/);
  const stateBefore = fs.readFileSync(path.join(root, ".sdd", "state.json"), "utf8");
  runCli(root, ["upgrade", "--write", "false"], { allowFail: true });
  assert.equal(fs.readFileSync(path.join(root, ".sdd", "state.json"), "utf8"), stateBefore);
});

test("CLI 拒绝路径穿越与非法 findings", () => {
  const root = makeProject("cli-security");
  const traversal = runCli(root, ["task", "show", "../../evil"], { allowFail: true });
  assert.equal(traversal.code, 1);
  const badFindings = runCli(root, ["review", "new", "--kind", "task", "--task", "TASK-0001", "--findings", "not-json"], { allowFail: true });
  assert.equal(badFindings.code, 1);
  assert.match(badFindings.stderr, /findings/);
});

test("CLI evidence run 支持 -- 后的命令", () => {
  const root = makeProject("cli-evidence");
  initGit(root);
  commitAll(root, "test: 初始");
  runCli(root, ["task", "new", "--title", "取证", "--scope", "src/", "--acceptance", "可运行", "--verify", "git rev-parse HEAD", "--owner", "sdd/builder"]);
  const id = listTasks(root)[0].id;
  runCli(root, ["task", "update", id, "--status", "ready"]);
  runCli(root, ["task", "update", id, "--status", "in_progress"]);
  const out = runCli(root, ["evidence", "run", "--task", id, "--agent", "sdd/builder", "--", "git", "rev-parse", "HEAD"]);
  assert.match(out.stdout, /EV-0001/);
  const ev = path.join(root, ".sdd", "evidence", id, "EV-0001.json");
  assert.ok(fs.existsSync(ev));
  const review = runCli(root, ["review", "new", "--kind", "task", "--task", id, "--verdict", "pass", "--reviewed-commit", "HEAD", "--reviewed-evidence", "EV-0001"]);
  assert.match(review.stdout, /REV-TASK-0001-001/);
  assert.ok(fs.existsSync(path.join(root, ".sdd", "reviews", "REV-TASK-0001-001.md")));
  const list = runCli(root, ["review", "list"]);
  assert.match(list.stdout, /REV-TASK-0001-001/);
  runCli(root, ["task", "update", id, "--status", "review", "--add-evidence", "EV-0001", "--end-commit", "HEAD"]);
  assert.ok(listTasks(root)[0].end_commit);
});
