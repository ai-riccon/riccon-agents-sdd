import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listFilesRecursive, readText } from "../scripts/lib/util.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("团队文本文件无 BOM/替换字符，permissions 头部中文完整", () => {
  const files = [
    ...listFilesRecursive(path.join(repoRoot, ".opencode")),
    ...listFilesRecursive(path.join(repoRoot, "templates")),
    ...listFilesRecursive(path.join(repoRoot, "docs")),
    path.join(repoRoot, "README.md"),
    path.join(repoRoot, "CHANGELOG.md"),
  ];
  for (const file of files) {
    const buffer = fs.readFileSync(file);
    assert.notDeepEqual([buffer[0], buffer[1], buffer[2]], [0xef, 0xbb, 0xbf], `${file} 带 BOM`);
    assert.equal(buffer.toString("utf8").includes("\uFFFD"), false, `${file} 含替换字符`);
  }
  const permissions = readText(path.join(repoRoot, "templates", "agents", "permissions.yml"));
  assert.match(permissions, /^# Riccon SDD 权限单一事实源。/);
});
