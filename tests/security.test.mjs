import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeProject, repoRoot } from "./helpers.mjs";
import { initProject, mergeOpencode } from "../scripts/lib/init.mjs";
import { verifyManifest, planUpgrade } from "../scripts/lib/manifest.mjs";
import { upgradeProject } from "../scripts/lib/upgrade.mjs";
import { loadTask, newTask, updateTask } from "../scripts/lib/task.mjs";
import { loadDecision } from "../scripts/lib/decision.mjs";
import { loadReview, writeReview } from "../scripts/lib/review.mjs";
import { validateCommitish, writeJson, writeText, hashText } from "../scripts/lib/util.mjs";

test("路径穿越 ID 被拒绝", () => {
  const root = makeProject("security-id");
  assert.throws(() => loadTask(root, "../../evil"), /任务 ID 非法/);
  assert.throws(() => updateTask(root, "../../evil", {}), /任务 ID 非法/);
  assert.throws(() => loadDecision(root, "../../evil"), /决策 ID 非法/);
  assert.throws(() => loadReview(root, "../../evil"), /评审 ID 非法/);
  assert.throws(
    () => writeReview(root, { kind: "task", task: "../../evil", verdict: "pass" }),
    /任务 ID 非法/,
  );
});

test("git commit 选项注入被拒绝", () => {
  assert.equal(validateCommitish(repoRoot, "--output=evil"), null);
  assert.equal(validateCommitish(repoRoot, "-p"), null);
  assert.ok(validateCommitish(repoRoot, "HEAD"));
  const root = makeProject("security-commit");
  const task = updateTask(root, newTask(root, { title: "t" }).id, {});
  assert.throws(
    () => updateTask(root, task.id, { baseline_commit: "--output=evil" }),
    /不是合法 commit/,
  );
  assert.throws(
    () => updateTask(root, task.id, { end_commit: "--output=evil" }),
    /不是合法 commit/,
  );
});

test("manifest 越界路径被拒绝", async () => {
  const root = makeProject("security-manifest");
  const manifest = {
    schema_version: 1,
    team_version: "0.1.0",
    installed_at: "2026-01-01T00:00:00+08:00",
    files: [{ path: "../evil", sha256: hashText("x"), managed: true }],
  };
  writeJson(path.join(root, ".sdd", "manifest.json"), manifest);
  const verify = verifyManifest(root);
  assert.ok(verify.errors.some((e) => e.includes("非管理路径")));
  const plan = planUpgrade(repoRoot, root);
  assert.ok(plan.errors.some((e) => e.includes("非管理路径")));
  const result = await upgradeProject(root, repoRoot, { write: true, force: true });
  assert.equal(result.ok, false);
});

test("重复 init 默认被拒绝", async () => {
  const root = makeProject("security-reinit");
  await assert.rejects(
    () => initProject(root, repoRoot, { dryRun: false }),
    /项目已初始化/,
  );
});

test("非法 opencode.json 不被静默覆盖", () => {
  const root = makeProject("security-opencode");
  const file = path.join(root, "opencode.json");
  writeText(file, "{ not json");
  assert.throws(() => mergeOpencode(root), /不是合法 JSON/);
  assert.equal(fs.readFileSync(file, "utf8"), "{ not json");
});
