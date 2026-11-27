import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { initProjectState } from "../scripts/lib/state.mjs";
import { newDecision, answerDecision } from "../scripts/lib/decision.mjs";
import { writeReview } from "../scripts/lib/review.mjs";
import { writeText, writeJson, ensureDir } from "../scripts/lib/util.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function makeProject(name = "toy") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sdd-${name}-`));
  initProjectState(root, { name });
  return root;
}

export function git(root, args, { allowFail = false } = {}) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (!allowFail && result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return { code: result.status, stdout: (result.stdout ?? "").trim(), stderr: (result.stderr ?? "").trim() };
}

export function initGit(root) {
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "sdd@example.test"]);
  git(root, ["config", "user.name", "SDD Test"]);
}

export function commitAll(root, message = "test: 初始提交") {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]).stdout;
}

export function runCli(root, args, { allowFail = false } = {}) {
  const split = args.indexOf("--");
  const full = split >= 0
    ? [...args.slice(0, split), "--project", root, ...args.slice(split)]
    : [...args, "--project", root];
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "sdd.mjs"), ...full], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  if (!allowFail && result.status !== 0) {
    throw new Error(`sdd ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return { code: result.status, stdout: (result.stdout ?? "").trim(), stderr: (result.stderr ?? "").trim() };
}

export function approve(root, gate, answer = "approve") {
  const decision = newDecision(root, {
    gate,
    question: `${gate} 是否批准？`,
    options: ["approve", "reject"],
    recommendation: "approve",
    blocking: true,
  });
  answerDecision(root, decision.id, { answer, kind: answer, owner: "user" });
  return decision.id;
}

export function writeKickoff(root) {
  ensureDir(path.join(root, ".specify", "memory"));
  writeText(path.join(root, ".specify", "memory", "constitution.md"), `# Toy Constitution\n\n## Core Principles\n\n- 可验证优先。\n- 不泄露密钥。\n- 小步提交。\n`);
  writeText(path.join(root, "AGENTS.md"), `# Toy\n\n<!-- sdd:contract:start -->\n## 项目合同\n\n- 技术栈：Node.js\n- 构建命令：node --version\n- 测试命令：node --version\n- Definition of Done：测试通过、证据记录。\n<!-- sdd:contract:end -->\n`);
  writeText(path.join(root, ".sdd", "brief.md"), `# Toy — MVP 一页纸\n\n## 用户与问题\n\n- 目标用户：测试用户\n- 核心问题：验证流程\n\n## MVC（最小可用能力）\n\n- 打印 hello\n\n## 非目标（non-goals）\n\n- 不做 UI\n\n## 成功指标\n\n- 命令 exit 0\n\n## 约束与风险\n\n- 无\n\n## 批准\n\n- 状态：approved\n`);
}

export function writeSpec(root) {
  const feature = path.join(root, "specs", "001-mvp");
  ensureDir(path.join(feature, "checklists"));
  writeJson(path.join(root, ".specify", "feature.json"), { feature_directory: "specs/001-mvp" });
  writeText(path.join(feature, "spec.md"), `# Toy Spec\n\n## User Scenarios & Testing\n\n### User Story 1\n\nAs a tester, I want hello, so that I can verify.\n\n## Requirements\n\n### Functional Requirements\n\n- **FR-001**: The command prints hello.\n\n## Success Criteria\n\n- **SC-001**: Command exits 0.\n`);
  writeText(path.join(feature, "checklists", "requirements.md"), `# Requirements Checklist\n\n- [x] 需求可测试\n- [x] 范围明确\n`);
}

export function writePlan(root) {
  const feature = path.join(root, "specs", "001-mvp");
  writeText(path.join(feature, "plan.md"), `# Plan\n\n## Constitution Check\n\nPASS\n\n## Technical Context\n\nNode.js.\n`);
  writeText(path.join(feature, "research.md"), `# Research\n\nUse Node.js.\n`);
  writeText(path.join(feature, "quickstart.md"), `# Quickstart\n\nRun node --version.\n`);
}

export function writeTasks(root) {
  const feature = path.join(root, "specs", "001-mvp");
  writeText(path.join(feature, "tasks.md"), `# Tasks\n\n## Phase 1: Setup\n\n- [ ] T001 Create hello file\n\n## Phase 2: User Story 1\n\n- [ ] T002 Verify hello\n`);
}

export function writeAnalyzeReview(root) {
  return writeReview(root, {
    kind: "analyze",
    gate: "tasks",
    verdict: "pass",
    independent: true,
    body: "# Analyze\n\n无 CRITICAL/HIGH。\n",
  });
}

export function writeConvergeReview(root) {
  return writeReview(root, {
    kind: "converge",
    verdict: "clean",
    independent: true,
    body: "# Converge\n\nConverged.\n",
  });
}

export function writeFinalReview(root) {
  return writeReview(root, {
    kind: "final",
    verdict: "pass",
    independent: true,
    body: "# Final\n\nPass.\n",
  });
}

export function readState(root) {
  return JSON.parse(fs.readFileSync(path.join(root, ".sdd", "state.json"), "utf8"));
}
