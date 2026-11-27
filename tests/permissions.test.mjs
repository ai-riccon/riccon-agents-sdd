import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./helpers.mjs";
import { checkAgentSync, agentPath } from "../scripts/lib/agents.mjs";
import { parseFrontMatter } from "../scripts/lib/util.mjs";

test("源仓库 agent 权限/模型同步", () => {
  const result = checkAgentSync(repoRoot, repoRoot);
  assert.equal(result.ok, true, result.problems.join("; "));
});

test("lead 可 spawn sdd/*，子代理禁止 question/subagent", () => {
  const lead = parseFrontMatter(fs.readFileSync(agentPath(repoRoot, "lead"), "utf8")).data;
  const builder = parseFrontMatter(fs.readFileSync(agentPath(repoRoot, "builder"), "utf8")).data;
  const has = (perms, action, resource, effect) => (perms ?? []).some(
    (p) => p.action === action && p.resource === resource && p.effect === effect,
  );
  assert.equal(has(lead.permissions, "subagent", "sdd/*", "allow"), true);
  assert.equal(has(lead.permissions, "question", "*", "allow"), true);
  assert.equal(has(builder.permissions, "subagent", "*", "deny"), true);
  assert.equal(has(builder.permissions, "question", "*", "deny"), true);
});

test("reviews 只允许 verifier 写", () => {
  const roles = ["builder", "product", "architect", "ops"];
  for (const role of roles) {
    const data = parseFrontMatter(fs.readFileSync(agentPath(repoRoot, role), "utf8")).data;
    const denied = (data.permissions ?? []).some(
      (p) => p.action === "edit" && p.resource === ".sdd/reviews/**" && p.effect === "deny",
    );
    assert.equal(denied, true, `${role} 应 deny .sdd/reviews/**`);
  }
  const verifier = parseFrontMatter(fs.readFileSync(agentPath(repoRoot, "verifier"), "utf8")).data;
  const verifierDeny = (verifier.permissions ?? []).some(
    (p) => p.action === "edit" && p.resource === ".sdd/reviews/**" && p.effect === "deny",
  );
  assert.equal(verifierDeny, false);
});

test("子代理写操作 shell 需要确认，verifier 的 review new 放行", () => {
  const builder = parseFrontMatter(fs.readFileSync(agentPath(repoRoot, "builder"), "utf8")).data;
  const verifier = parseFrontMatter(fs.readFileSync(agentPath(repoRoot, "verifier"), "utf8")).data;
  const hasRule = (perms, action, resource, effect) => (perms ?? []).some(
    (p) => p.action === action && p.resource === resource && p.effect === effect,
  );
  for (const resource of ["*task*new*", "*task*update*", "*task*sync*", "*gate*check*", "*retro*new*"]) {
    assert.equal(hasRule(builder.permissions, "shell", resource, "ask"), true, resource);
  }
  assert.equal(hasRule(verifier.permissions, "shell", "*review*new*", "allow"), true);
});

test("evidence 文件禁止直接 edit，必须走 evidence run", () => {
  for (const role of ["lead", "product", "architect", "builder", "verifier", "ops"]) {
    const data = parseFrontMatter(fs.readFileSync(agentPath(repoRoot, role), "utf8")).data;
    const denied = (data.permissions ?? []).some(
      (p) => p.action === "edit" && p.resource === ".sdd/evidence/**" && p.effect === "deny",
    );
    assert.equal(denied, true, `${role} 应 deny .sdd/evidence/**`);
  }
});

test("agent 漂移会被 checkAgentSync 发现", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-perm-"));
  fs.cpSync(path.join(repoRoot, ".opencode"), path.join(temp, ".opencode"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "templates"), path.join(temp, "templates"), { recursive: true });
  assert.equal(checkAgentSync(temp, temp).ok, true);
  const file = agentPath(temp, "lead");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/steps: 440/, "steps: 1"), "utf8");
  const result = checkAgentSync(temp, temp);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("steps")));
});
