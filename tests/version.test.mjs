import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEAM_VERSION } from "../scripts/lib/version.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("版本单一事实源：package/README/CHANGELOG 与 version.mjs 一致", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(pkg.version, TEAM_VERSION);

  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  assert.equal(readme.match(/当前版本：`([0-9]+\.[0-9]+\.[0-9]+)`/)?.[1], TEAM_VERSION);

  const changelog = fs.readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
  assert.equal(changelog.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/m)?.[1], TEAM_VERSION);
});
