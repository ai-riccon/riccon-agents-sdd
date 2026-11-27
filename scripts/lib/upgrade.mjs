import fs from "node:fs";
import path from "node:path";
import {
  copyFile,
  ensureDir,
  exists,
  timestampForFile,
} from "./util.mjs";
import { buildManifest, planUpgrade, writeManifest } from "./manifest.mjs";
import { installedExtensions, runSpecify } from "./speckit.mjs";
import { getSpeckitVersion, loadCompat } from "./compat.mjs";
import { TEAM_VERSION } from "./version.mjs";

function backupFile(projectRoot, backupDir, relative) {
  const src = path.join(projectRoot, relative);
  if (!exists(src)) return;
  const dest = path.join(backupDir, relative);
  ensureDir(path.dirname(dest));
  copyFile(src, dest);
}

export async function upgradeProject(projectRoot, teamRoot, {
  dryRun = true,
  write = false,
  force = false,
  specKit = false,
} = {}) {
  const plan = planUpgrade(teamRoot, projectRoot);
  const summary = {
    ok: true,
    dryRun: !write,
    plan: {
      add: plan.add.map((x) => x.path),
      update: plan.update.map((x) => x.path),
      remove: plan.remove,
      locallyModified: plan.locallyModified.map((x) => x.path),
      same: plan.same.length,
    },
    applied: { add: [], update: [], skipped: [], removed: [] },
    specKit: [],
  };

  if (!write) return summary;

  const backupDir = path.join(projectRoot, ".sdd", "backup", `upgrade-${timestampForFile()}`);
  ensureDir(backupDir);
  for (const entry of [...plan.update, ...plan.locallyModified]) {
    backupFile(projectRoot, backupDir, entry.path);
  }
  for (const rel of plan.remove) backupFile(projectRoot, backupDir, rel);

  for (const entry of plan.add) {
    copyFile(path.join(teamRoot, entry.source), path.join(projectRoot, entry.path));
    summary.applied.add.push(entry.path);
  }
  for (const entry of plan.update) {
    copyFile(path.join(teamRoot, entry.source), path.join(projectRoot, entry.path));
    summary.applied.update.push(entry.path);
  }
  for (const entry of plan.locallyModified) {
    if (force) {
      copyFile(path.join(teamRoot, entry.source), path.join(projectRoot, entry.path));
      summary.applied.update.push(entry.path);
    } else {
      summary.applied.skipped.push(entry.path);
    }
  }
  for (const rel of plan.remove) {
    if (force) {
      fs.rmSync(path.join(projectRoot, rel), { force: true });
      summary.applied.removed.push(rel);
    } else {
      summary.applied.skipped.push(rel);
    }
  }

  const version = await getSpeckitVersion(projectRoot);
  const compat = loadCompat(teamRoot);
  const manifest = buildManifest(teamRoot, projectRoot, {
    team_version: TEAM_VERSION,
    speckit_version: version.version,
    compat_range: compat?.range ?? null,
  });
  writeManifest(projectRoot, manifest);
  summary.manifestFiles = manifest.files.length;
  summary.backupDir = backupDir;

  if (specKit) {
    const integration = runSpecify(["integration", "upgrade", "opencode"], projectRoot);
    summary.specKit.push({ command: "specify integration upgrade opencode", ...integration });
    for (const ext of installedExtensions(projectRoot)) {
      const result = runSpecify(["extension", "update", ext], projectRoot);
      summary.specKit.push({ command: `specify extension update ${ext}`, ...result });
    }
  }

  return summary;
}
