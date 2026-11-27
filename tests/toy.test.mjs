import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  makeProject, initGit, commitAll, runCli, approve, writeKickoff, writeSpec,
  writePlan, writeTasks, writeAnalyzeReview, writeConvergeReview,
  writeFinalReview, readState,
} from "./helpers.mjs";
import { updateTask, syncTasks, listTasks } from "../scripts/lib/task.mjs";
import { runEvidence } from "../scripts/lib/evidence.mjs";
import { writeReview } from "../scripts/lib/review.mjs";

test("toy MVP 走完四道门 + 最终验收", async () => {
  const root = makeProject("toy-e2e");
  initGit(root);
  writeKickoff(root);
  commitAll(root, "test: kickoff 材料");

  approve(root, "kickoff");
  runCli(root, ["gate", "check", "--gate", "kickoff"]);
  assert.equal(readState(root).phase, "specify");

  writeSpec(root);
  commitAll(root, "test: spec 材料");
  approve(root, "spec");
  runCli(root, ["gate", "check", "--gate", "spec"]);
  assert.equal(readState(root).phase, "plan");

  writePlan(root);
  commitAll(root, "test: plan 材料");
  approve(root, "plan");
  runCli(root, ["gate", "check", "--gate", "plan"]);
  assert.equal(readState(root).phase, "tasks");

  writeTasks(root);
  const sync = syncTasks(root);
  assert.equal(sync.total, 2);
  for (const task of listTasks(root)) {
    updateTask(root, task.id, {
      owner: "sdd/builder",
      risk: "low",
      write_scope: ["src/"],
      acceptance: ["命令 exit 0"],
      verify: ["git rev-parse HEAD"],
    });
  }
  writeAnalyzeReview(root);
  commitAll(root, "test: tasks 材料");
  approve(root, "tasks");
  runCli(root, ["gate", "check", "--gate", "tasks"]);
  assert.equal(readState(root).phase, "implement");

  const task = listTasks(root)[0];
  updateTask(root, task.id, { status: "in_progress", owner: "sdd/builder" });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "hello.txt"), "hello\n", "utf8");
  const commit = commitAll(root, "feat: 增加 hello 文件");

  const evidence = await runEvidence(root, {
    taskId: task.id,
    agent: "sdd/builder",
    command: "git rev-parse HEAD",
  });
  assert.equal(evidence.exit_code, 0);

  updateTask(root, task.id, {
    status: "review",
    add_evidence: [evidence.id],
    end_commit: commit,
  });
  writeReview(root, {
    kind: "task",
    task: task.id,
    verdict: "pass",
    reviewed_commit: commit,
    reviewed_evidence: [evidence.id],
    body: "# Task Review\n\n通过。\n",
  });
  updateTask(root, task.id, { status: "done", review: `REV-${task.id}-001` });

  // 第二个任务直接关闭，保持 final 门可通过
  const second = listTasks(root).find((t) => t.id !== task.id);
  if (second) {
    updateTask(root, second.id, { status: "ready" });
    updateTask(root, second.id, { status: "in_progress", owner: "sdd/builder" });
    const ev2 = await runEvidence(root, { taskId: second.id, agent: "sdd/builder", command: "git rev-parse HEAD" });
    updateTask(root, second.id, { status: "review", add_evidence: [ev2.id] });
    writeReview(root, {
      kind: "task",
      task: second.id,
      verdict: "pass",
      reviewed_evidence: [ev2.id],
      body: "# Task Review\n\n通过。\n",
    });
    updateTask(root, second.id, { status: "done", review: `REV-${second.id}-001` });
  }

  const finalCommit = commitAll(root, "test: final 材料");
  const allEvidence = listTasks(root).flatMap((t) => t.evidence ?? []);
  writeConvergeReview(root, { reviewed_commit: finalCommit, reviewed_evidence: allEvidence });
  writeFinalReview(root, { reviewed_commit: finalCommit, reviewed_evidence: allEvidence });
  approve(root, "final");
  runCli(root, ["gate", "check", "--gate", "final"]);
  const state = readState(root);
  assert.equal(state.phase, "done");
  assert.equal(state.gate.status, "pass");
});
