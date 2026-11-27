import test from "node:test";
import assert from "node:assert/strict";
import { makeProject } from "./helpers.mjs";
import { checkGate, runGate } from "../scripts/lib/gate.mjs";
import { setPhase, loadState } from "../scripts/lib/state.mjs";

test("乱序门禁被拒绝：init 阶段不能直接 final", () => {
  const root = makeProject("gate-order");
  const result = checkGate(root, "final");
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("前序门禁")));
});

test("未知门禁被拒绝", () => {
  const root = makeProject("gate-unknown");
  assert.throws(() => checkGate(root, "bogus"), /未知门禁/);
});

test("旧门重跑不把 phase 回退", () => {
  const root = makeProject("gate-phase");
  setPhase(root, "implement");
  // 用一个必然失败的门禁检查，确认 phase 不变
  const result = runGate(root, "kickoff");
  assert.equal(result.ok, false);
  assert.equal(loadState(root).phase, "implement");
});
