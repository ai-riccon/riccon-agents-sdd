import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEAM_VERSION } from "../scripts/lib/version.mjs";
import { checkVersions } from "../scripts/lib/version-check.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("版本单一事实源：package/README/CHANGELOG 与 version.mjs 一致", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(pkg.version, TEAM_VERSION);

  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  assert.equal(readme.match(/当前版本：`([0-9]+\.[0-9]+\.[0-9]+)`/)?.[1], TEAM_VERSION);

  const changelog = fs.readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
  assert.equal(changelog.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/m)?.[1], TEAM_VERSION);
});

test("checkVersions 能发现篡改的版本", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-version-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "0.0.1" }), "utf8");
  fs.writeFileSync(path.join(dir, "README.md"), "当前版本：`0.0.1`\n", "utf8");
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), "## 0.0.1\n", "utf8");
  const errors = checkVersions(dir, "0.1.2");
  assert.equal(errors.length, 3);

  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "0.1.2" }), "utf8");
  fs.writeFileSync(path.join(dir, "README.md"), "当前版本：`0.1.2`\n", "utf8");
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), "## 0.1.2\n", "utf8");
  assert.deepEqual(checkVersions(dir, "0.1.2"), []);
});
