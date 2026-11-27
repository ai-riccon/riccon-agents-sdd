import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  commandPath, installedExtensions, listInstalledCommands, readInitOptions,
  relativeCommand, scriptVariant,
} from "../scripts/lib/speckit.mjs";
import { ensureDir, writeJson, writeText } from "../scripts/lib/util.mjs";

test("speckit 辅助函数读取项目布局", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-speckit-"));
  ensureDir(path.join(root, ".specify", "extensions", "git"));
  ensureDir(path.join(root, ".specify", "extensions", "assess"));
  ensureDir(path.join(root, ".opencode", "commands"));
  writeText(path.join(root, ".opencode", "commands", "speckit.specify.md"), "# specify\n");
  writeText(path.join(root, ".opencode", "commands", "speckit.plan.md"), "# plan\n");
  writeJson(path.join(root, ".specify", "init-options.json"), { integration: "opencode", script: "ps" });

  assert.equal(scriptVariant(), process.platform === "win32" ? "ps" : "sh");
  assert.deepEqual(installedExtensions(root).sort(), ["assess", "git"]);
  assert.deepEqual(listInstalledCommands(root), ["speckit.plan", "speckit.specify"]);
  assert.equal(relativeCommand(root, "speckit.plan"), ".opencode/commands/speckit.plan.md");
  assert.equal(commandPath(root, "speckit.plan"), path.join(root, ".opencode", "commands", "speckit.plan.md"));
  assert.equal(readInitOptions(root).integration, "opencode");
});
