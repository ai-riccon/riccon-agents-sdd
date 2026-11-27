import fs from "node:fs";
import path from "node:path";
import {
  ensureDir,
  exists,
  gitHead,
  gitIsClean,
  nextId,
  nowIso,
  readJson,
  readText,
  runProcess,
  writeJson,
  writeText,
} from "./util.mjs";
import { SCHEMA_VERSION } from "./version.mjs";
import { sddPath } from "./state.mjs";
import { loadTask } from "./task.mjs";
import { appendEvent } from "./metrics.mjs";
import { loadConfig } from "./config.mjs";

export function evidenceDir(projectRoot, taskId) {
  return sddPath(projectRoot, "evidence", taskId);
}

export function evidencePath(projectRoot, taskId, evidenceId) {
  return path.join(evidenceDir(projectRoot, taskId), `${evidenceId}.json`);
}

export function logPath(projectRoot, taskId, evidenceId) {
  return path.join(evidenceDir(projectRoot, taskId), `${evidenceId}.log`);
}

export function nextEvidenceId(projectRoot, taskId) {
  return nextId(evidenceDir(projectRoot, taskId), "EV");
}

export function listEvidence(projectRoot, taskId = null) {
  const root = sddPath(projectRoot, "evidence");
  if (!exists(root)) return [];
  const taskDirs = taskId
    ? [path.join(root, taskId)]
    : fs.readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^TASK-\d+$/.test(e.name))
        .map((e) => path.join(root, e.name));
  const out = [];
  for (const dir of taskDirs) {
    if (!exists(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/^EV-\d+\.json$/.test(name)) continue;
      out.push(readJson(path.join(dir, name), null));
    }
  }
  return out.filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
}

export function loadEvidence(projectRoot, taskId, evidenceId) {
  return readJson(evidencePath(projectRoot, taskId, evidenceId), null);
}

export async function runEvidence(projectRoot, {
  taskId,
  agent,
  command,
  cwd = projectRoot,
  gate = null,
  allowDirty = false,
  timeoutMs = 0,
} = {}) {
  if (!taskId) throw new Error("缺少 --task");
  if (!agent) throw new Error("缺少 --agent");
  if (!command) throw new Error("缺少要执行的命令（放在 -- 之后）");
  const task = loadTask(projectRoot, taskId);
  if (!task) throw new Error(`找不到任务：${taskId}`);
  if (!["in_progress", "review"].includes(task.status)) {
    throw new Error(`任务 ${taskId} 当前是 ${task.status}；只有 in_progress/review 可以取证`);
  }
  const config = loadConfig(projectRoot);
  const commit = gitHead(projectRoot);
  const dirty = !gitIsClean(projectRoot);
  if (!allowDirty && dirty) {
    const { git: gitCmd } = await import("./util.mjs");
    const status = gitCmd(["status", "--porcelain"], projectRoot);
    throw new Error(`工作树不干净；先提交（或在明确接受风险时使用 --allow-dirty）。\n${status.stdout}`);
  }
  const result = await runProcess(command, {
    cwd,
    timeoutMs,
    maxBytes: config.evidence.max_log_bytes ?? 2097152,
  });
  ensureDir(evidenceDir(projectRoot, taskId));
  const evidenceId = nextEvidenceId(projectRoot, taskId);
  const relativeLog = path.relative(projectRoot, logPath(projectRoot, taskId, evidenceId));
  const logText = [
    `# task: ${taskId}`,
    `# agent: ${agent}`,
    `# command: ${command}`,
    `# cwd: ${cwd}`,
    `# exit_code: ${result.exitCode}`,
    `# started_at: ${result.startedAt}`,
    `# finished_at: ${result.finishedAt}`,
    `# duration_ms: ${result.durationMs}`,
    `# commit: ${commit ?? "-"}`,
    `# dirty: ${dirty}`,
    `# truncated: ${result.truncated}`,
    "",
    "## STDOUT",
    result.stdout,
    "",
    "## STDERR",
    result.stderr,
    "",
  ].join("\n");
  writeText(logPath(projectRoot, taskId, evidenceId), logText);
  const evidence = {
    schema_version: SCHEMA_VERSION,
    id: evidenceId,
    task: taskId,
    agent,
    command,
    cwd,
    exit_code: result.exitCode,
    signal: result.signal,
    started_at: result.startedAt,
    finished_at: result.finishedAt,
    duration_ms: result.durationMs,
    commit,
    dirty,
    gate,
    log_path: relativeLog.replace(/\\/g, "/"),
    log_bytes: Buffer.byteLength(logText),
    truncated: result.truncated,
    manual: false,
    created_at: nowIso(),
  };
  writeJson(evidencePath(projectRoot, taskId, evidenceId), evidence);
  appendEvent(projectRoot, "evidence_run", {
    task: taskId,
    evidence: evidenceId,
    exit_code: result.exitCode,
    duration_ms: result.durationMs,
  });
  return evidence;
}

export function validateEvidence(projectRoot, evidence) {
  const errors = [];
  if (!evidence) return { ok: false, errors: ["证据不存在"] };
  if (evidence.manual) errors.push("manual 证据不能用于 done/final");
  if (evidence.exit_code !== 0) errors.push(`exit code 是 ${evidence.exit_code}`);
  const log = path.join(projectRoot, evidence.log_path ?? "");
  if (!evidence.log_path || !exists(log)) errors.push("证据日志缺失");
  if (evidence.commit) {
    const head = gitHead(projectRoot);
    if (!head) errors.push("当前仓库没有 HEAD");
  }
  return { ok: errors.length === 0, errors };
}

export function passingEvidence(projectRoot, taskId = null) {
  return listEvidence(projectRoot, taskId).filter((ev) => ev.exit_code === 0 && !ev.manual);
}

export function readEvidenceLog(projectRoot, evidence) {
  return readText(path.join(projectRoot, evidence.log_path ?? ""), "");
}
