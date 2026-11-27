import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { makeProject, repoRoot } from "./helpers.mjs";
import { doctor } from "../scripts/lib/doctor.mjs";
import { ensureDir, writeJson, writeText } from "../scripts/lib/util.mjs";
import { scriptVariant } from "../scripts/lib/speckit.mjs";
import { TEAM_VERSION } from "../scripts/lib/version.mjs";

function hasSpecify() {
  return spawnSync("specify", ["version", "--json"], { encoding: "utf8" }).status === 0;
}

function prepareDoctorProject(root) {
  const variant = scriptVariant();
  const scriptDir = variant === "ps" ? "powershell" : "bash";
  const ext = variant === "ps" ? ".ps1" : ".sh";
  const commands = [
    "constitution", "specify", "clarify", "plan", "checklist", "tasks", "analyze", "implement", "converge",
  ];
  for (const command of commands) {
    writeText(path.join(root, ".opencode", "commands", `speckit.${command}.md`), "# command\n");
  }
  for (const template of ["spec-template.md", "plan-template.md", "tasks-template.md", "checklist-template.md", "constitution-template.md"]) {
    writeText(path.join(root, ".specify", "templates", template), "# template\n");
  }
  for (const script of ["common", "create-new-feature", "setup-plan", "setup-tasks", "check-prerequisites", "resolve-template"]) {
    writeText(path.join(root, ".specify", "scripts", scriptDir, `${script}${ext}`), "# script\n");
  }
  for (const extName of ["git", "assess", "bug"]) {
    ensureDir(path.join(root, ".specify", "extensions", extName));
  }
  writeJson(path.join(root, ".specify", "init-options.json"), { integration: "opencode", script: variant });
  writeText(path.join(root, "AGENTS.md"), "<!-- sdd:contract:start -->\n技术栈：Node\n命令：node\nDefinition of Done: 测试\n<!-- sdd:contract:end -->\n");
  writeJson(path.join(root, "opencode.json"), { default_agent: "sdd/lead" });
  writeJson(path.join(root, ".sdd", "manifest.json"), {
    schema_version: 1,
    team_version: TEAM_VERSION,
    installed_at: "2026-01-01T00:00:00+08:00",
    files: [],
  });
}

test("doctor CLI 路径在完整项目上通过", { skip: !hasSpecify() }, async () => {
  const root = makeProject("doctor");
  prepareDoctorProject(root);
  const result = await doctor(root, repoRoot, repoRoot);
  assert.equal(result.ok, true, result.checks.filter((c) => c.status === "fail").map((c) => c.message).join("; "));
});

test("doctor 发现缺失命令文件", { skip: !hasSpecify() }, async () => {
  const root = makeProject("doctor-fail");
  prepareDoctorProject(root);
  fs.rmSync(path.join(root, ".opencode", "commands", "speckit.plan.md"));
  const result = await doctor(root, repoRoot, repoRoot);
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((c) => c.status === "fail" && c.message.includes("speckit.plan")));
});
