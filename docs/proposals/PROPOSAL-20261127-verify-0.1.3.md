# PROPOSAL-20261127 — 0.1.3 修复验证评审

- **日期**：2026-11-27
- **类型**：对提交 `fc5c5a3`（"处理 0.1.2 终审 N1-N4，发布 0.1.3"）的验证评审，供维护 agent 处理一处新回归与半步残留
- **前序**：full-review → verify-0.1.1（R1–R6）→ verify-0.1.2（N1–N4）
- **方法**：N4 权限亲自逐行复核 + 代理核实 N1/N2/N3 测试质量与回归 + 编码损坏字节级确认；未修改任何源文件
- **基线**：`npm test` 69/69、`npm run check`（0.1.3）、`npm run smoke` 全绿
- **严重度**：P0=门禁绕过/数据丢失/安全；P1=功能错误/证据保真；P2=健壮性/合规缺口；P3=小问题

> 路径相对仓库根，行号基于 HEAD `fc5c5a3`。

---

## 总体结论

**0.1.3 实质闭合 N1/N3/N4，N2 测试到位但文档注明差半步；无功能回归。** 69 个测试含全部 P0 回归仍通过；6 份 agent 改动均为权限 frontmatter 同步产物，角色边界无变化。

**新发现一处低危回归**：`permissions.yml` 头部注释编码损坏（0.1.3 引入）。不影响 YAML 解析与门禁，但违反中文可读约定，应修复。

0.1.3 可接受。原始 P0/P1 与 R1–R6 经四轮评审均已实质关闭，无活跃绕过；剩余为编码修复与文档落点两项小务。

---

## 处理结果（0.1.4，2026-11-27）

### 确认

- **M1 字节级确认**：`templates/agents/permissions.yml` 头部为 UTF-8 BOM（`EF BB BF`）+ mojibake，3 行中文注释被合并为一行；YAML 规则本身未受影响。
- **M2 确认**：0.1.3 CHANGELOG 声称“文档注明 .cmd 引号局限”，但 README/STATE/COMPAT/EVALS 均无落点。

### 修复

- M1：重写 permissions.yml 头部 3 行中文注释，去除 BOM；`scripts/check.mjs` 增加 BOM/替换字符/权限头检查；新增 `tests/encoding.test.mjs`；AGENTS.md 增加“不要用 PowerShell Set-Content 写 UTF-8”规则。
- M2：在 README、docs/STATE.md、docs/COMPATIBILITY.md 落点说明 `.cmd`/`.bat` 的 PowerShell splatting 与 cmd 引号局限；CHANGELOG 声明与事实一致。
- 目标项目 `D:\Development\riccon-hub` 已 `sdd upgrade --write --yes` 到 0.1.4，安装的 permissions 模板已恢复无 BOM 中文头。

### 回归

- `npm test`：70/70 通过。
- `npm run check`：通过（0.1.4），编码守卫覆盖 BOM/替换字符/权限头。
- `sdd doctor`（riccon-hub）：通过。
- 安装后的 `.opencode/sdd/templates/agents/permissions.yml`：无 BOM，首行 `# Riccon SDD 权限单一事实源。`。

---

## 已确认修复

| 项 | 验证证据 | 判定 |
|---|---|---|
| N1 测试广度 | `tests/doctor.test.mjs:46-60` 直调 `doctor()`（与 CLI `cli.mjs:197` 同实现），完整项目 ok:true、删 speckit.plan.md ok:false 且消息含 "speckit.plan"；`tests/prompts.test.mjs:16-22` 升级为 task-packet 真实存在 + constitution/contracts/data-model/handoffs/.specify 内容断言；final-scope 归属已更正（verify-0.1.1.md:150、CHANGELOG） | ✅（小局限见下） |
| N2 .cmd 测试 | `tests/evidence.test.mjs:188-201` 真 .cmd 目标（forward.cmd→node）经 `util.mjs:270` wrapper→PowerShell splatting；断言单行 JSON、元字符作为数据、%SDD_R1% 字面；非 win32 合理 skip | ⚠️ 测试到位，文档缺位（见 M2） |
| N3 断言强度 | `scripts/lib/version-check.mjs:4-34` 独立校 package/README/CHANGELOG，`check.mjs:42` 接入；`tests/version.test.mjs:23-35` 篡改夹具（0.0.1 vs 0.1.2）断言 3 条错误、修正后 []；`tests/schema.test.mjs:99-144` Ajv 负例（review 非 analyze commit:null/evidence:[]→false、analyze 豁免→true；evidence commit:null/""→false）；config 改名名副其实 | ✅ |
| N4 权限通配收紧 | `permissions.yml:188-213` ask 改空格分隔 `*task new*`/`*task update*`/`*task sync*`/`*review new*`/`*gate check*`/`*decision new*`/`*decision answer*`/`*handoff new*`/`*retro new*`，仍匹配 node 调用、不再过匹配；verifier `*review new*` allow（:312-314）仍在 subagents ask 之后最后匹配生效；frontmatter 同步一致 | ✅ 亲自复核 |

---

## 残留问题

### M1（P3，新回归）permissions.yml 头部编码损坏

**位置**：`templates/agents/permissions.yml:1`

**问题**（字节级确认）：0.1.2 头部为干净 3 行中文注释；0.1.3 变为 **UTF-8 BOM（`ef bb bf`）+ mojibake**（“权限单一事实源”→“鏉冮檺鍗曚竴浜嬪疄婧愩€?”，UTF-8 被按 GBK 误读再编码），3 行并成 1 行、空行丢失。全仓唯一乱码文件。YAML 规则本体为 ASCII，解析/check/test 不受影响，但违反中文可读约定（AGENTS.md 硬规则 3 精神）。

**根因提示**：疑似 N4 编辑或同步工具以错误编码（GBK/BOM）写回 permissions.yml。建议排查写入路径编码，避免下次同步再损坏。

**建议改动**：恢复无 BOM 的 UTF-8 三行注释：
```
# Riccon SDD 权限单一事实源。
# 由 scripts/sync-agents.mjs 写入各 agent frontmatter；doctor 检查漂移。
# 规则顺序：base → subagents → 角色特定；OpenCode 以最后匹配为准。
```

**验证方式**：`head -c 3` 无 BOM；头部中文可读；`npm run check`/`sync:agents` 后不再复现损坏。

### M2（P3，N2 文档半步）.cmd 局限未落用户文档

**问题**：0.1.3 CHANGELOG 声称“文档注明 .cmd 引号可能被 cmd 剥离”，但 `docs/EVALS.md`/`README.md`/`docs/STATE.md`/`docs/COMPATIBILITY.md` 均无该注明（grep 为空）；仅评审提案自身提及。声明与落点不符。

**建议改动**：在 `docs/EVALS.md`（证据保真节）或 README“诚实限制”补一句：Windows .cmd/.bat 目标经 PowerShell 传递，引号可能被 cmd 剥离，元字符不会执行；.exe 目标完全保真。

---

## 可选改进（非阻塞，N1 小局限）

- doctor 测试直调 `doctor()`，未经 `runCli` 子进程；失败路径仅覆盖缺命令。可补 CLI 层与更多失败项。
- prompts 测试仍是关键词断言，未验必读清单完整性、无安装后路径解析测试。可升级为行为断言。

## 遗留待办（已声明，非缺陷）

- shell `*` allow 旁路 / CLI 无角色身份校验：`docs/PERMISSIONS.md` 明示权限非安全边界，设计取舍。
- 维护 agent 自列：`nextId` 并发锁、时区配置读取（nowIso 仍硬编码 +08:00）、部分 P3 重复逻辑。

---

## 验收建议

0.1.3 可接受发布。四轮评审后**原始 6 P0 + 9 P1、R1–R6、N1–N4 均实质关闭，无活跃门禁绕过**。建议一个收尾小提交处理 M1（编码修复，优先）+ M2（文档落点），并排查编码根因。此后除已声明设计取舍与自列待办外，无已知未决缺陷。

## 风险与回滚

- M1 仅改注释，零功能风险；M2 仅增文档。
- 版本变动同步 TEAM_VERSION/package.json/README/CHANGELOG（check.mjs 已强制）。