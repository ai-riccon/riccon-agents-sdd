import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureDir, writeText, writeJson, readJson } from "../scripts/lib/util.mjs";
import { buildManifest, installTeamFiles, writeManifest, planUpgrade, readManifest, verifyManifest } from "../scripts/lib/manifest.mjs";

function makeSource() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-src-"));
  writeText(path.join(root, ".opencode", "agents", "sdd", "lead.md"), "# Lead v1\n");
  writeText(path.join(root, ".opencode", "commands", "sdd-start.md"), "# Start v1\n");
  writeText(path.join(root, ".opencode", "skills", "sdd-core", "SKILL.md"), "# Core v1\n");
  writeText(path.join(root, "scripts", "lib", "x.mjs"), "export const x = 1;\n");
  writeText(path.join(root, "schemas", "state.schema.json"), "{}\n");
  writeText(path.join(root, "templates", "agents", "permissions.yml"), "base: []\n");
  writeText(path.join(root, "templates", "agents", "models.yml"), "default: inherit\n");
  writeText(path.join(root, "compat", "speckit-1.x.json"), "{}\n");
  writeText(path.join(root, "package.json"), "{\"version\":\"0.1.0\"}\n");
  return root;
}

function makeTarget() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-target-"));
  ensureDir(path.join(root, ".sdd"));
  return root;
}

test("manifest 安装后可验证，升级可识别本地修改", () => {
  const src = makeSource();
  const target = makeTarget();
  installTeamFiles(src, target);
  const manifest = buildManifest(src, target, { team_version: "0.1.0" });
  writeManifest(target, manifest);
  assert.ok(readManifest(target));
  assert.equal(manifest.files.length > 0, true);

  writeText(path.join(target, ".opencode", "agents", "sdd", "lead.md"), "# Lead local\n");
  const plan = planUpgrade(src, target);
  assert.ok(plan.locallyModified.some((x) => x.path === ".opencode/agents/sdd/lead.md"));
});

test("升级写入会备份并更新未修改文件", async () => {
  const src = makeSource();
  const target = makeTarget();
  installTeamFiles(src, target);
  writeManifest(target, buildManifest(src, target, { team_version: "0.1.0" }));
  writeText(path.join(target, ".opencode", "agents", "sdd", "lead.md"), "# Lead local\n");
  writeText(path.join(src, "scripts", "lib", "x.mjs"), "export const x = 2;\n");
  const { upgradeProject } = await import("../scripts/lib/upgrade.mjs");
  const result = await upgradeProject(target, src, { write: true, force: false });
  assert.ok(result.backupDir);
  const updated = fs.readFileSync(path.join(target, ".opencode", "sdd", "scripts", "lib", "x.mjs"), "utf8");
  assert.match(updated, /x = 2/);
  const verify = verifyManifest(target);
  assert.ok(verify.modified.includes(".opencode/agents/sdd/lead.md"));
  assert.ok(fs.existsSync(path.join(result.backupDir, ".sdd", "manifest.json")));
});

test("升级 --force 覆盖本地修改并移除旧文件", async () => {
  const src = makeSource();
  const target = makeTarget();
  installTeamFiles(src, target);
  writeManifest(target, buildManifest(src, target, { team_version: "0.1.0" }));
  writeText(path.join(target, ".opencode", "agents", "sdd", "lead.md"), "# Lead local\n");
  fs.rmSync(path.join(src, "scripts", "lib", "x.mjs"));
  const { upgradeProject } = await import("../scripts/lib/upgrade.mjs");
  const result = await upgradeProject(target, src, { write: true, force: true });
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(path.join(target, ".opencode", "agents", "sdd", "lead.md"), "utf8"), "# Lead v1\n");
  assert.equal(fs.existsSync(path.join(target, ".opencode", "sdd", "scripts", "lib", "x.mjs")), false);
  assert.ok(result.applied.removed.includes(".opencode/sdd/scripts/lib/x.mjs"));
});

test("manifest 缺失时拒绝写入，--force 才允许", async () => {
  const src = makeSource();
  const target = makeTarget();
  installTeamFiles(src, target);
  const { upgradeProject } = await import("../scripts/lib/upgrade.mjs");
  const refused = await upgradeProject(target, src, { write: true, force: false });
  assert.equal(refused.ok, false);
  assert.ok(refused.errors.some((e) => e.includes("manifest")));
  const forced = await upgradeProject(target, src, { write: true, force: true });
  assert.equal(forced.ok, true);
  assert.ok(forced.backupDir);
  assert.ok(readManifest(target));
});
