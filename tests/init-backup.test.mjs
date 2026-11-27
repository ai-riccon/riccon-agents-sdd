import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backupTeamFiles } from "../scripts/lib/init.mjs";
import { ensureDir, writeText } from "../scripts/lib/util.mjs";

test("init --force 备份团队文件", () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-backup-src-"));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-backup-target-"));
  writeText(path.join(src, ".opencode", "agents", "sdd", "lead.md"), "# Lead v1\n");
  writeText(path.join(target, ".opencode", "agents", "sdd", "lead.md"), "# Lead local\n");
  const backup = path.join(target, ".sdd", "backup", "reinit-test");
  ensureDir(backup);
  const count = backupTeamFiles(src, target, backup);
  assert.ok(count >= 1);
  assert.equal(
    fs.readFileSync(path.join(backup, ".opencode", "agents", "sdd", "lead.md"), "utf8"),
    "# Lead local\n",
  );
});
