import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { makeProject } from "./helpers.mjs";
import { initProjectState, loadProject, loadState, loadDecisions, loadReviews } from "../scripts/lib/state.mjs";
import { newTask, listTasks } from "../scripts/lib/task.mjs";
import { newDecision } from "../scripts/lib/decision.mjs";
import { writeReview } from "../scripts/lib/review.mjs";
import { newRetro } from "../scripts/lib/retro.mjs";
import { parseFrontMatter, readText } from "../scripts/lib/util.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ajv = new Ajv({ allErrors: true, strict: false });

function schema(name) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas", `${name}.schema.json`), "utf8"));
}

function check(name, data) {
  const validate = ajv.compile(schema(name));
  if (!validate(data)) {
    assert.fail(`${name} schema 不通过：${JSON.stringify(validate.errors)}`);
  }
}

test("生成的 project/state/task/decision/review/retro/manifest/evidence 符合 schema", () => {
  const root = makeProject("schema");
  initProjectState(root, { name: "schema-test" });
  check("project", loadProject(root));
  check("state", loadState(root));

  const task = newTask(root, {
    title: "示例",
    owner: "sdd/builder",
    write_scope: ["src/"],
    acceptance: ["可运行"],
    verify: ["git rev-parse HEAD"],
  });
  check("task", listTasks(root)[0]);

  newDecision(root, { gate: "spec", question: "是否批准？", options: ["approve", "reject"] });
  check("decision", loadDecisions(root)[0]);

  writeReview(root, { kind: "task", task: task.id, verdict: "pass", reviewed_evidence: ["EV-0001"] });
  check("review", loadReviews(root)[0]);

  newRetro(root, { period: "milestone" });
  const retro = parseFrontMatter(readText(path.join(root, ".sdd", "retro", "RETRO-0001.md"))).data;
  check("retro", retro);

  check("manifest", {
    schema_version: 1,
    team_version: "0.1.0",
    installed_at: "2026-11-27T12:00:00+08:00",
    speckit_version: "1.4.5",
    compat_range: ">=1.4.5 <2.0",
    files: [{ path: ".opencode/agents/sdd/lead.md", sha256: "a".repeat(64), managed: true }],
  });

  check("evidence", {
    schema_version: 1,
    id: "EV-0001",
    task: "TASK-0001",
    agent: "sdd/builder",
    command: "git rev-parse HEAD",
    cwd: "D:/project",
    exit_code: 0,
    signal: null,
    started_at: "2026-11-27T12:00:00+08:00",
    finished_at: "2026-11-27T12:00:01+08:00",
    duration_ms: 1000,
    commit: "abc123",
    dirty: false,
    gate: null,
    log_path: ".sdd/evidence/TASK-0001/EV-0001.log",
    log_bytes: 10,
    truncated: false,
    manual: false,
    created_at: "2026-11-27T12:00:01+08:00",
  });
});
