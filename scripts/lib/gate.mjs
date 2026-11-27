import path from "node:path";
import { exists, readText } from "./util.mjs";
import { GATES, loadState, setGate, setPhase, sddPath } from "./state.mjs";
import { latestGateDecision, openBlockingDecisions } from "./decision.mjs";
import { latestReview, reviewPasses } from "./review.mjs";
import { listEvidence, validateEvidence } from "./evidence.mjs";
import { listTasks, parseTasksMarkdown, resolveFeatureDir, updateTask } from "./task.mjs";

function result(name, ok, message = "") {
  return { name, status: ok ? "pass" : "fail", message: ok ? "" : message };
}

function warn(name, message) {
  return { name, status: "warn", message };
}

function readIfExists(p) {
  return exists(p) ? readText(p, "") : null;
}

function hasApproval(projectRoot, gate) {
  return Boolean(latestGateDecision(projectRoot, gate));
}

function checkNoBlockingDecisions(projectRoot) {
  const blocking = openBlockingDecisions(projectRoot);
  return result(
    "无阻塞决策",
    blocking.length === 0,
    blocking.length ? `仍开放：${blocking.map((d) => d.id).join(", ")}` : "",
  );
}

function checkKickoff(projectRoot) {
  const checks = [];
  checks.push(checkNoBlockingDecisions(projectRoot));
  const constitution = readIfExists(path.join(projectRoot, ".specify", "memory", "constitution.md"));
  const constitutionFilled = Boolean(
    constitution &&
    !/\[[A-Z][A-Z0-9_]*\]/.test(constitution) &&
    !/TODO|待补充/.test(constitution),
  );
  checks.push(result("constitution 已填写", constitutionFilled, constitutionFilled ? "" : "仍是模板或含占位符"));
  const agents = readIfExists(path.join(projectRoot, "AGENTS.md"));
  const contract = Boolean(
    agents &&
    agents.includes("sdd:contract:start") &&
    agents.includes("sdd:contract:end") &&
    /技术栈|tech stack/i.test(agents) &&
    /命令|commands/i.test(agents) &&
    /Definition of Done|DoD|完成定义/i.test(agents) &&
    !/待填写/.test(agents),
  );
  checks.push(result("项目合同完整", contract, contract ? "" : "AGENTS.md 缺少合同块、技术栈/命令/DoD，或仍有“待填写”"));
  const brief = readIfExists(sddPath(projectRoot, "brief.md"));
  const briefSections = Boolean(
    brief &&
    /##\s*用户与问题/.test(brief) &&
    /##\s*MVC/.test(brief) &&
    /##\s*非目标/.test(brief) &&
    /##\s*成功指标/.test(brief) &&
    /##\s*约束与风险/.test(brief),
  );
  const briefApproved = Boolean(brief && /状态[：:]\s*approved/i.test(brief));
  const briefFilled = Boolean(
    brief &&
    !/待填写/.test(brief) &&
    !/目标用户[：:]\s*$/m.test(brief) &&
    !/核心问题[：:]\s*$/m.test(brief),
  );
  checks.push(result("MVP 一页纸完整", briefSections, briefSections ? "" : "缺少必要章节"));
  checks.push(result("MVP 一页纸已填写", briefFilled, briefFilled ? "" : "目标用户/核心问题等仍是占位"));
  checks.push(result("MVP 一页纸已批准", briefApproved, briefApproved ? "" : "状态仍不是 approved"));
  checks.push(result("用户已批准 kickoff", hasApproval(projectRoot, "kickoff"), hasApproval(projectRoot, "kickoff") ? "" : "缺少 kickoff 的 approve 决策"));
  return checks;
}

function checkSpec(projectRoot) {
  const checks = [];
  const featureDir = resolveFeatureDir(projectRoot);
  checks.push(result("找到 feature 目录", Boolean(featureDir), featureDir ?? "缺少 specs/NNN-*/spec.md"));
  if (!featureDir) return checks;
  const spec = readIfExists(path.join(featureDir, "spec.md"));
  checks.push(result("spec.md 存在", Boolean(spec), spec ? "" : "缺少 spec.md"));
  if (spec) {
    checks.push(result("spec 无待澄清标记", !/\[NEEDS CLARIFICATION\]/i.test(spec), "仍有 [NEEDS CLARIFICATION]"));
    const headings = ["## User Scenarios", "## Success Criteria", "### Functional Requirements"];
    const missing = headings.filter((h) => !spec.includes(h));
    checks.push(result("spec 结构完整", missing.length === 0, missing.length ? `缺少：${missing.join(", ")}` : ""));
  }
  const checklist = readIfExists(path.join(featureDir, "checklists", "requirements.md"));
  if (!checklist) {
    checks.push(result("requirements checklist", false, "缺少 checklists/requirements.md"));
  } else {
    const unchecked = (checklist.match(/^- \[ \]/gm) ?? []).length;
    checks.push(result("requirements checklist 全过", unchecked === 0, unchecked ? `${unchecked} 项未勾选` : ""));
  }
  checks.push(result("用户已批准 spec", hasApproval(projectRoot, "spec"), hasApproval(projectRoot, "spec") ? "" : "缺少 spec 的 approve 决策"));
  checks.push(checkNoBlockingDecisions(projectRoot));
  return checks;
}

function checkPlan(projectRoot) {
  const checks = [];
  const featureDir = resolveFeatureDir(projectRoot);
  checks.push(result("找到 feature 目录", Boolean(featureDir), featureDir ?? "缺少 feature 目录"));
  if (!featureDir) return checks;
  const required = ["plan.md", "research.md", "quickstart.md"];
  const missing = required.filter((name) => !exists(path.join(featureDir, name)));
  checks.push(result("plan 核心产物存在", missing.length === 0, missing.length ? `缺少：${missing.join(", ")}` : ""));
  const plan = readIfExists(path.join(featureDir, "plan.md")) ?? "";
  checks.push(result("plan 含 Constitution Check", /Constitution Check/i.test(plan), /Constitution Check/i.test(plan) ? "" : "plan.md 缺少 Constitution Check"));
  if (exists(path.join(featureDir, "data-model.md"))) {
    checks.push(result("data-model.md", true));
  } else {
    checks.push(warn("data-model.md", "未生成；若涉及数据实体，请补充"));
  }
  if (exists(path.join(featureDir, "contracts"))) {
    checks.push(result("contracts/", true));
  } else {
    checks.push(warn("contracts/", "未生成；若涉及接口/事件，请补充"));
  }
  checks.push(result("用户已批准 plan", hasApproval(projectRoot, "plan"), hasApproval(projectRoot, "plan") ? "" : "缺少 plan 的 approve 决策"));
  checks.push(checkNoBlockingDecisions(projectRoot));
  return checks;
}

function checkTasks(projectRoot) {
  const checks = [];
  const featureDir = resolveFeatureDir(projectRoot);
  checks.push(result("找到 feature 目录", Boolean(featureDir), featureDir ?? "缺少 feature 目录"));
  if (!featureDir) return checks;
  const tasksMd = readIfExists(path.join(featureDir, "tasks.md"));
  checks.push(result("tasks.md 存在", Boolean(tasksMd), tasksMd ? "" : "缺少 tasks.md"));
  const parsed = tasksMd ? parseTasksMarkdown(tasksMd) : [];
  checks.push(result("tasks.md 含任务", parsed.length > 0, `识别到 ${parsed.length} 个任务`));
  const tasks = listTasks(projectRoot);
  const bySpeckit = new Map(tasks.filter((t) => t.speckit_id).map((t) => [t.speckit_id, t]));
  const missing = [];
  const incomplete = [];
  for (const item of parsed) {
    const task = bySpeckit.get(item.speckit_id);
    if (!task) {
      missing.push(item.speckit_id);
      continue;
    }
    if (!task.write_scope?.length || !task.acceptance?.length || !task.verify?.length) {
      incomplete.push(task.id);
    }
  }
  checks.push(result("任务已同步到 .sdd", missing.length === 0, missing.length ? `缺少：${missing.join(", ")}` : ""));
  checks.push(result("任务具备 scope/acceptance/verify", incomplete.length === 0, incomplete.length ? `待补充：${incomplete.join(", ")}` : ""));
  const analyze = latestReview(projectRoot, { kind: "analyze" });
  checks.push(result("analyze 已通过", Boolean(analyze && reviewPasses(analyze)), analyze ? `verdict=${analyze.verdict}` : "缺少 analyze 评审"));
  checks.push(result("用户已批准 tasks", hasApproval(projectRoot, "tasks"), hasApproval(projectRoot, "tasks") ? "" : "缺少 tasks 的 approve 决策"));
  checks.push(checkNoBlockingDecisions(projectRoot));
  return checks;
}

function checkFinal(projectRoot) {
  const checks = [];
  const tasks = listTasks(projectRoot);
  checks.push(result("存在任务", tasks.length > 0, `共 ${tasks.length} 个任务`));
  const notDone = tasks.filter((t) => t.status !== "done");
  checks.push(result("所有任务 done", notDone.length === 0, notDone.length ? `未完成：${notDone.map((t) => `${t.id}(${t.status})`).join(", ")}` : ""));
  const evidenceErrors = [];
  for (const task of tasks.filter((t) => t.status === "done")) {
    const evidence = listEvidence(projectRoot, task.id);
    if (!evidence.length) {
      evidenceErrors.push(`${task.id} 无证据`);
      continue;
    }
    const passing = evidence.filter((ev) => validateEvidence(projectRoot, ev).ok);
    if (!passing.length) evidenceErrors.push(`${task.id} 无 exit 0 且日志存在的证据`);
    if (task.risk === "high" && !reviewPasses(latestReview(projectRoot, { kind: "task", task: task.id }))) {
      evidenceErrors.push(`${task.id} 是高风险任务，缺少独立 task review`);
    }
  }
  checks.push(result("任务证据/评审完整", evidenceErrors.length === 0, evidenceErrors.join("; ")));
  const converge = latestReview(projectRoot, { kind: "converge" });
  checks.push(result("converge 已 clean", Boolean(converge && reviewPasses(converge)), converge ? `verdict=${converge.verdict}` : "缺少 converge 评审"));
  const finalReview = latestReview(projectRoot, { kind: "final" });
  checks.push(result("final review 已通过", Boolean(finalReview && reviewPasses(finalReview)), finalReview ? `verdict=${finalReview.verdict}` : "缺少 final 评审"));
  checks.push(result("用户已做最终验收", hasApproval(projectRoot, "final"), hasApproval(projectRoot, "final") ? "" : "缺少 final 的 approve 决策"));
  checks.push(checkNoBlockingDecisions(projectRoot));
  return checks;
}

export function checkGate(projectRoot, gate) {
  if (!GATES.includes(gate)) throw new Error(`未知门禁：${gate}；可用：${GATES.join(", ")}`);
  const state = loadState(projectRoot);
  if (!state) throw new Error("缺少 .sdd/state.json；先运行 sdd init");
  let checks;
  if (gate === "kickoff") checks = checkKickoff(projectRoot);
  else if (gate === "spec") checks = checkSpec(projectRoot);
  else if (gate === "plan") checks = checkPlan(projectRoot);
  else if (gate === "tasks") checks = checkTasks(projectRoot);
  else checks = checkFinal(projectRoot);
  const errors = checks.filter((c) => c.status === "fail").map((c) => `${c.name}: ${c.message || "失败"}`);
  const warnings = checks.filter((c) => c.status === "warn").map((c) => `${c.name}: ${c.message}`);
  return { ok: errors.length === 0, gate, checks, errors, warnings };
}

const NEXT_PHASE = {
  kickoff: "specify",
  spec: "plan",
  plan: "tasks",
  tasks: "implement",
  final: "done",
};

export function runGate(projectRoot, gate) {
  const result = checkGate(projectRoot, gate);
  setGate(projectRoot, gate, result.ok ? "pass" : "fail", result.ok ? "" : result.errors.join("; "));
  if (result.ok) {
    if (gate === "tasks") {
      for (const task of listTasks(projectRoot)) {
        if (task.status === "planned") updateTask(projectRoot, task.id, { status: "ready" });
      }
    }
    setPhase(projectRoot, NEXT_PHASE[gate]);
  }
  return result;
}

export function gateCommand(projectRoot, gate) {
  const result = runGate(projectRoot, gate);
  return result;
}
