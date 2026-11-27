import fs from "node:fs";
import path from "node:path";
import {
  ensureDir,
  exists,
  nextId,
  nowIso,
  parseFrontMatter,
  readText,
  stringifyFrontMatter,
  writeText,
} from "./util.mjs";
import { sddPath } from "./state.mjs";

export function reviewDir(projectRoot) {
  return sddPath(projectRoot, "reviews");
}

export function reviewPath(projectRoot, id) {
  return path.join(reviewDir(projectRoot), `${id}.md`);
}

export function listReviews(projectRoot, { kind = null } = {}) {
  const dir = reviewDir(projectRoot);
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const text = readText(path.join(dir, name), "");
      const { data, body } = parseFrontMatter(text);
      return { ...data, body, file: name };
    })
    .filter((r) => !kind || r.kind === kind);
}

export function loadReview(projectRoot, id) {
  const p = reviewPath(projectRoot, id);
  if (!exists(p)) return null;
  const { data, body } = parseFrontMatter(readText(p, ""));
  return { ...data, body, file: path.basename(p) };
}

export function writeReview(projectRoot, opts = {}) {
  ensureDir(reviewDir(projectRoot));
  const kind = opts.kind ?? (opts.task ? "task" : "milestone");
  const prefix = opts.id
    ? opts.id
    : kind === "task"
      ? `REV-${opts.task}-001`
      : kind === "analyze"
        ? "ANALYZE-001"
        : kind === "converge"
          ? "CONVERGE-001"
          : kind === "final"
            ? "FINAL-001"
            : "REV-MILESTONE-001";
  let id = prefix;
  if (!opts.id) {
    const base = prefix.replace(/-\d+$/, "");
    id = nextId(reviewDir(projectRoot), base, 3);
  }
  const data = {
    schema_version: 1,
    id,
    kind,
    task: opts.task ?? null,
    gate: opts.gate ?? null,
    feature: opts.feature ?? null,
    reviewer: opts.reviewer ?? "sdd/verifier",
    session: opts.session ?? null,
    verdict: opts.verdict ?? "pass",
    independent: opts.independent ?? true,
    reviewed_commit: opts.reviewed_commit ?? null,
    reviewed_evidence: opts.reviewed_evidence ?? [],
    findings: opts.findings ?? [],
    created_at: nowIso(),
  };
  const body = opts.body ?? `# ${id}\n\n## 结论\n\n${data.verdict}\n\n## 检查项\n\n- [ ] 待补充\n`;
  writeText(reviewPath(projectRoot, id), stringifyFrontMatter(data, body));
  return { ...data, body };
}

export function latestReview(projectRoot, { kind = null, gate = null, task = null } = {}) {
  const reviews = listReviews(projectRoot, { kind }).filter((r) => {
    if (gate && r.gate !== gate) return false;
    if (task && r.task !== task) return false;
    return true;
  });
  if (!reviews.length) return null;
  return reviews.sort((a, b) => String(a.id).localeCompare(String(b.id)))[reviews.length - 1];
}

export function findingsBySeverity(review) {
  const out = { P0: [], P1: [], P2: [], P3: [] };
  for (const finding of review?.findings ?? []) {
    const severity = finding.severity ?? "P3";
    if (!out[severity]) out[severity] = [];
    out[severity].push(finding);
  }
  return out;
}

export function reviewPasses(review) {
  if (!review) return false;
  if (!["pass", "converged", "clean"].includes(review.verdict)) return false;
  if (review.independent === false) return false;
  const findings = findingsBySeverity(review);
  return [...findings.P0, ...findings.P1].every((f) => f.status === "fixed" || f.status === "closed");
}
