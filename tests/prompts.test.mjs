import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./helpers.mjs";

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("lead 提示词包含 final 证据、ops、blocked 解锁与 task-packet 路径", () => {
  const lead = read(".opencode/agents/sdd/lead.md");
  assert.match(lead, /final 证据绑定/);
  assert.match(lead, /Ops 轨道/);
  assert.match(lead, /blocked 解锁/);
  assert.match(lead, /\.opencode\/sdd\/templates\/prompts\/task-packet\.md/);
});

test("verifier 提示词要求结构化 findings", () => {
  const verifier = read(".opencode/agents/sdd/verifier.md");
  assert.match(verifier, /--findings/);
  assert.match(verifier, /frontmatter/);
  assert.match(verifier, /severity/);
});

test("upgrade 命令要求 team_source 与 --yes", () => {
  const command = read(".opencode/commands/sdd-upgrade.md");
  assert.match(command, /team_source/);
  assert.match(command, /--yes/);
});
