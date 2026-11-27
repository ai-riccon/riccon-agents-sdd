import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { makeProject } from "./helpers.mjs";
import {
  initProjectState, loadState, setPhase, setGate, setApproval, validateState,
} from "../scripts/lib/state.mjs";
import { writeJson } from "../scripts/lib/util.mjs";

test("初始化状态并允许阶段/门禁迁移", () => {
  const root = makeProject("state");
  const project = initProjectState(root, { name: "state-test" });
  assert.equal(project.name, "state-test");
  assert.equal(loadState(root).phase, "init");
  setPhase(root, "kickoff");
  setGate(root, "kickoff", "pass");
  setApproval(root, "kickoff", { status: "approved", decision_id: "DEC-0001" });
  const state = loadState(root);
  assert.equal(state.phase, "kickoff");
  assert.equal(state.gate.status, "pass");
  assert.equal(state.approvals.kickoff.status, "approved");
});

test("validateState 发现缺少 manifest", () => {
  const root = makeProject("state-invalid");
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("manifest.json")));
  writeJson(path.join(root, ".sdd", "manifest.json"), { schema_version: 1, team_version: "0.1.0", installed_at: "x", files: [] });
  const ok = validateState(root);
  assert.equal(ok.ok, true, ok.errors.join("; "));
});
