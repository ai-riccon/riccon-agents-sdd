import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export const TZ = "Asia/Shanghai";

export function nowIso() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  return `${parts.replace(" ", "T")}+08:00`;
}

export function timestampForFile() {
  return nowIso().replace(/[:+]/g, "").replace("T", "-");
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function exists(p) {
  return fs.existsSync(p);
}

export function readText(p, fallback = undefined) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export function writeText(p, text) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, text, "utf8");
}

export function readJson(p, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export function writeJson(p, value) {
  writeText(p, `${JSON.stringify(value, null, 2)}\n`);
}

export function readYaml(p, fallback = undefined) {
  try {
    return parseYaml(fs.readFileSync(p, "utf8")) ?? fallback;
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export function writeYaml(p, value) {
  writeText(p, stringifyYaml(value, { lineWidth: 0 }));
}

export function parseFrontMatter(text) {
  const normalized = String(text).replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, body: normalized };
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { data: {}, body: normalized };
  const yamlText = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n/, "");
  let data = {};
  try {
    data = parseYaml(yamlText) ?? {};
  } catch {
    data = {};
  }
  return { data, body };
}

export function stringifyFrontMatter(data, body) {
  const yamlText = stringifyYaml(data, { lineWidth: 0 }).trimEnd();
  return `---\n${yamlText}\n---\n\n${String(body).replace(/^\n+/, "")}`;
}

export function hashFile(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

export function hashText(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

export function listFilesRecursive(root, { ignore = [] } = {}) {
  const out = [];
  if (!exists(root)) return out;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = toPosix(path.relative(root, full));
      if (ignore.some((pattern) => rel === pattern || rel.startsWith(`${pattern}/`))) continue;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out.sort();
}

export function copyDir(src, dest, { ignore = [] } = {}) {
  if (!exists(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    const rel = toPosix(path.relative(src, from));
    if (ignore.some((pattern) => rel === pattern || rel.startsWith(`${pattern}/`))) continue;
    if (entry.isDirectory()) copyDir(from, to, { ignore });
    else if (entry.isFile()) {
      ensureDir(path.dirname(to));
      fs.copyFileSync(from, to);
    }
  }
}

export function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

export function toPosix(p) {
  return String(p).replace(/\\/g, "/");
}

export function relativePosix(from, to) {
  return toPosix(path.relative(from, to));
}

export function globToRegExp(glob) {
  let pattern = toPosix(glob).trim();
  if (pattern.endsWith("/")) pattern += "**";
  let out = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else if ("\\^$+.()|{}[]".includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  out += "$";
  return new RegExp(out);
}

export function matchesScope(file, scopes) {
  const target = toPosix(file).replace(/^\.\//, "");
  for (const raw of scopes ?? []) {
    const scope = toPosix(raw).replace(/^\.\//, "").replace(/\/$/, "");
    if (!scope) continue;
    if (target === scope) return true;
    if (target.startsWith(`${scope}/`)) return true;
    if (globToRegExp(scope).test(target)) return true;
  }
  return false;
}

export function runProcess(command, { cwd = process.cwd(), timeoutMs = 0, maxBytes = 2 * 1024 * 1024 } = {}) {
  return new Promise((resolve) => {
    const startedAt = nowIso();
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let truncated = false;
    let child;
    try {
      child = spawn(command, { cwd, shell: true, windowsHide: true, env: process.env });
    } catch (err) {
      resolve({
        exitCode: 1,
        signal: null,
        stdout,
        stderr: String(err),
        durationMs: Date.now() - start,
        startedAt,
        finishedAt: nowIso(),
        bytes,
        truncated,
      });
      return;
    }
    const append = (chunk, target) => {
      const text = chunk.toString("utf8");
      bytes += Buffer.byteLength(text);
      if (bytes > maxBytes) {
        truncated = true;
        return;
      }
      if (target === "out") stdout += text;
      else stderr += text;
    };
    child.stdout?.on("data", (chunk) => append(chunk, "out"));
    child.stderr?.on("data", (chunk) => append(chunk, "err"));
    let timer;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
      }, timeoutMs);
    }
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: code ?? (signal ? 1 : 0),
        signal: signal ?? null,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        startedAt,
        finishedAt: nowIso(),
        bytes,
        truncated,
      });
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: 1,
        signal: null,
        stdout,
        stderr: `${stderr}${String(err)}`,
        durationMs: Date.now() - start,
        startedAt,
        finishedAt: nowIso(),
        bytes,
        truncated,
      });
    });
  });
}

export function git(args, cwd = process.cwd()) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    code: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

export function gitHead(cwd = process.cwd()) {
  const r = git(["rev-parse", "HEAD"], cwd);
  return r.code === 0 ? r.stdout : null;
}

export function gitIsClean(cwd = process.cwd()) {
  const r = git(["status", "--porcelain"], cwd);
  if (r.code !== 0) return false;
  // .sdd/ 是团队账本（证据/指标/状态）；它变化不代表源码未提交。
  const lines = r.stdout.split(/\r?\n/).filter(Boolean).filter((line) => {
    let file = line.slice(2).trim().replace(/^"|"$/g, "");
    if (file.includes(" -> ")) file = file.split(" -> ").pop().trim();
    return !file.startsWith(".sdd/");
  });
  return lines.length === 0;
}

export function gitDiffNames(base, head, cwd = process.cwd()) {
  const r = git(["diff", "--name-only", `${base}..${head}`], cwd);
  if (r.code !== 0) return [];
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(toPosix);
}

export function readIds(dir, prefix) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .map((name) => name.match(new RegExp(`^${prefix}-(\\d+)\\.`))?.[1])
    .filter(Boolean)
    .map((n) => Number(n))
    .sort((a, b) => a - b);
}

export function nextId(dir, prefix, pad = 4) {
  const ids = readIds(dir, prefix);
  const next = ids.length ? ids[ids.length - 1] + 1 : 1;
  return `${prefix}-${String(next).padStart(pad, "0")}`;
}

export function uniqueId(prefix, pad = 4) {
  return `${prefix}-${String(Date.now()).slice(-pad)}`;
}

export function relativeFirstRead(projectRoot, relPaths) {
  return relPaths.map((p) => toPosix(p));
}

export function truncate(text, max = 2000) {
  const s = String(text ?? "");
  return s.length <= max ? s : `${s.slice(0, max)}\n...[truncated]`;
}

export function printTable(rows, headers) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)));
  const line = (cells) => cells.map((c, i) => String(c ?? "").padEnd(widths[i])).join("  ");
  const out = [line(headers), widths.map((w) => "-".repeat(w)).join("  ")];
  for (const row of rows) out.push(line(row));
  return out.join("\n");
}
