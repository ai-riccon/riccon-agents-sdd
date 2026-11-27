import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./helpers.mjs";
import { initProject } from "../scripts/lib/init.mjs";

test("init dry-run 列出安装步骤", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-init-"));
  const result = await initProject(temp, repoRoot, { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.ok(result.actions.some((a) => a.includes("specify init")));
  assert.ok(result.actions.some((a) => a.includes("git init")));
  assert.ok(result.actions.some((a) => a.includes("团队")));
});
