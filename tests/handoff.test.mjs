import test from "node:test";
import assert from "node:assert/strict";
import { makeProject, initGit, commitAll } from "./helpers.mjs";
import { newHandoff, latestHandoff } from "../scripts/lib/handoff.mjs";
import { newTask, updateTask } from "../scripts/lib/task.mjs";

test("handoff 在安全边界创建并拒绝活动任务", () => {
  const root = makeProject("handoff");
  initGit(root);
  commitAll(root, "test: 初始");
  const handoff = newHandoff(root, {
    summary: "完成 kickoff",
    next: "进入 specify",
    first_read: [".sdd/state.json"],
  });
  assert.equal(handoff.id, "HANDOFF-0001");
  assert.equal(latestHandoff(root).id, "HANDOFF-0001");

  const task = newTask(root, {
    title: "活动任务",
    owner: "sdd/builder",
    write_scope: ["src/"],
    acceptance: ["可运行"],
    verify: ["git rev-parse HEAD"],
  });
  updateTask(root, task.id, { status: "ready" });
  updateTask(root, task.id, { status: "in_progress" });
  assert.throws(
    () => newHandoff(root, { summary: "x", next: "继续", first_read: [".sdd/state.json"] }),
    /活动任务/,
  );
});

test("handoff 拒绝空 next", () => {
  const root = makeProject("handoff-next");
  initGit(root);
  commitAll(root, "test: 初始");
  assert.throws(() => newHandoff(root, { summary: "x", next: "" }), /next/);
});
