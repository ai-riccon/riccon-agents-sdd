import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkAgentSync } from "./lib/agents.mjs";
import { TEAM_VERSION } from "./lib/version.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(repoRoot, rel))) errors.push(`缺少 ${rel}`);
}

for (const role of ["lead", "product", "architect", "builder", "verifier", "ops"]) {
  mustExist(`.opencode/agents/sdd/${role}.md`);
}
for (const command of ["start", "status", "resume", "review", "decision", "improve", "upgrade"]) {
  mustExist(`.opencode/commands/sdd-${command}.md`);
}
for (const skill of ["sdd-core", "sdd-speckit", "sdd-verify", "sdd-upgrade"]) {
  mustExist(`.opencode/skills/${skill}/SKILL.md`);
}
for (const file of [
  "templates/agents/permissions.yml",
  "templates/agents/models.yml",
  "templates/project/AGENTS.md",
  "templates/prompts/task-packet.md",
  "compat/speckit-1.x.json",
  "schemas/state.schema.json",
  "schemas/task.schema.json",
  "schemas/evidence.schema.json",
  "schemas/review.schema.json",
  "schemas/decision.schema.json",
  "schemas/handoff.schema.json",
  "schemas/manifest.schema.json",
]) {
  mustExist(file);
}

const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
if (pkg.version !== TEAM_VERSION) errors.push(`package.json ${pkg.version} != version.mjs ${TEAM_VERSION}`);

const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const readmeVersion = readme.match(/当前版本：`([0-9]+\.[0-9]+\.[0-9]+)`/)?.[1];
if (readmeVersion !== TEAM_VERSION) errors.push(`README.md ${readmeVersion ?? "未找到版本"} != version.mjs ${TEAM_VERSION}`);

const changelog = fs.readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
const changelogVersion = changelog.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/m)?.[1];
if (changelogVersion !== TEAM_VERSION) errors.push(`CHANGELOG.md ${changelogVersion ?? "未找到版本"} != version.mjs ${TEAM_VERSION}`);

const sync = checkAgentSync(repoRoot, repoRoot);
if (!sync.ok) errors.push(...sync.problems);

const compat = JSON.parse(fs.readFileSync(path.join(repoRoot, "compat", "speckit-1.x.json"), "utf8"));
if (!compat.range) errors.push("compat/speckit-1.x.json 缺少 range");

if (errors.length) {
  console.log("✗ check 失败");
  for (const e of errors) console.log(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✓ Riccon SDD ${TEAM_VERSION} 源仓库检查通过`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
