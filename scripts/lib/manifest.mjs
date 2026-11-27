import fs from "node:fs";
import path from "node:path";
import {
  copyFile,
  exists,
  hashFile,
  listFilesRecursive,
  readJson,
  relativePosix,
  toPosix,
  writeJson,
} from "./util.mjs";

const COPY_RULES = [
  { from: ".opencode/agents/sdd", to: ".opencode/agents/sdd", kind: "dir" },
  { from: ".opencode/commands", to: ".opencode/commands", kind: "dir", match: /^sdd-.*\.md$/ },
  { from: ".opencode/skills", to: ".opencode/skills", kind: "dir", match: /^sdd-/, nested: true },
  { from: "scripts", to: ".opencode/sdd/scripts", kind: "dir" },
  { from: "schemas", to: ".opencode/sdd/schemas", kind: "dir" },
  { from: "templates", to: ".opencode/sdd/templates", kind: "dir" },
  { from: "compat", to: ".opencode/sdd/compat", kind: "dir" },
  { from: "package.json", to: ".opencode/sdd/package.json", kind: "file" },
  { from: "node_modules/yaml", to: ".opencode/sdd/node_modules/yaml", kind: "dir" },
];

function skillDirs(teamRoot) {
  const root = path.join(teamRoot, ".opencode", "skills");
  if (!exists(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("sdd-"))
    .map((e) => path.join(root, e.name))
    .filter((dir) => exists(path.join(dir, "SKILL.md")));
}

export function collectManagedEntries(teamRoot) {
  const entries = [];
  for (const rule of COPY_RULES) {
    const src = path.join(teamRoot, rule.from);
    const destRoot = path.join(rule.to);
    if (!exists(src)) continue;
    if (rule.kind === "file") {
      entries.push({ source: toPosix(rule.from), target: toPosix(rule.to) });
      continue;
    }
    if (rule.from === ".opencode/skills") {
      for (const dir of skillDirs(teamRoot)) {
        for (const file of listFilesRecursive(dir)) {
          const rel = relativePosix(teamRoot, file);
          const target = toPosix(path.join(destRoot, path.basename(dir), path.relative(dir, file)));
          entries.push({ source: rel, target });
        }
      }
      continue;
    }
    for (const file of listFilesRecursive(src)) {
      const rel = relativePosix(teamRoot, file);
      if (rule.match) {
        const base = path.basename(file);
        if (rule.nested) {
          const parent = path.basename(path.dirname(file));
          if (!rule.match.test(parent)) continue;
        } else if (!rule.match.test(base)) {
          continue;
        }
      }
      const sub = path.relative(src, file);
      entries.push({ source: rel, target: toPosix(path.join(destRoot, sub)) });
    }
  }
  return entries;
}

export function installTeamFiles(teamRoot, projectRoot) {
  const entries = collectManagedEntries(teamRoot);
  for (const entry of entries) {
    const src = path.join(teamRoot, entry.source);
    const dest = path.join(projectRoot, entry.target);
    copyFile(src, dest);
  }
  return entries;
}

export function buildManifest(teamRoot, projectRoot, extra = {}) {
  const entries = collectManagedEntries(teamRoot);
  return {
    schema_version: 1,
    team_version: extra.team_version ?? "0.1.0",
    installed_at: extra.installed_at ?? new Date().toISOString(),
    speckit_version: extra.speckit_version ?? null,
    compat_range: extra.compat_range ?? null,
    files: entries.map((entry) => ({
      path: entry.target,
      // 记录“安装基线”的源文件 hash，而不是目标当前 hash；
      // 这样本地修改在后续升级/doctor 中仍能被识别。
      sha256: hashFile(path.join(teamRoot, entry.source)),
      managed: true,
    })),
  };
}

export function manifestPath(projectRoot) {
  return path.join(projectRoot, ".sdd", "manifest.json");
}

export function readManifest(projectRoot) {
  return readJson(manifestPath(projectRoot), null);
}

export function writeManifest(projectRoot, manifest) {
  writeJson(manifestPath(projectRoot), manifest);
}

export function verifyManifest(projectRoot) {
  const manifest = readManifest(projectRoot);
  if (!manifest) {
    return { ok: false, missing: [], modified: [], extra: [], errors: ["缺少 .sdd/manifest.json"] };
  }
  const missing = [];
  const modified = [];
  const errors = [];
  for (const file of manifest.files ?? []) {
    const full = path.join(projectRoot, file.path);
    if (!exists(full)) {
      missing.push(file.path);
      continue;
    }
    if (hashFile(full) !== file.sha256) modified.push(file.path);
  }
  return { ok: missing.length === 0 && errors.length === 0, missing, modified, extra: [], errors, manifest };
}

export function planUpgrade(teamRoot, projectRoot) {
  const manifest = readManifest(projectRoot);
  const managed = new Map((manifest?.files ?? []).map((f) => [f.path, f]));
  const entries = collectManagedEntries(teamRoot);
  const plan = { add: [], update: [], same: [], locallyModified: [], remove: [], errors: [] };
  const nextTargets = new Set();
  for (const entry of entries) {
    nextTargets.add(entry.target);
    const src = path.join(teamRoot, entry.source);
    const dest = path.join(projectRoot, entry.target);
    const sourceHash = hashFile(src);
    if (!exists(dest)) {
      plan.add.push({ path: entry.target, source: entry.source, sha256: sourceHash });
      continue;
    }
    const destHash = hashFile(dest);
    const recorded = managed.get(entry.target);
    if (destHash === sourceHash) {
      plan.same.push(entry.target);
      continue;
    }
    if (recorded && recorded.sha256 !== destHash) {
      plan.locallyModified.push({
        path: entry.target,
        source: entry.source,
        source_sha256: sourceHash,
        current_sha256: destHash,
        recorded_sha256: recorded.sha256,
      });
    } else {
      plan.update.push({ path: entry.target, source: entry.source, sha256: sourceHash });
    }
  }
  for (const file of manifest?.files ?? []) {
    if (!nextTargets.has(file.path)) plan.remove.push(file.path);
  }
  return plan;
}
