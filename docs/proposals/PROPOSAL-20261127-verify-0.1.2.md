# PROPOSAL-20261127 — 0.1.2 修复验证评审

- **日期**：2026-11-27
- **类型**：对提交 `a65002d`（"处理 0.1.1 验证评审残留，发布 0.1.2"）的验证评审，供维护 agent 处理低危残留
- **前序**：`PROPOSAL-20261127-full-review.md`（原始评审）→ `PROPOSAL-20261127-verify-0.1.1.md`（0.1.1 验证，提出 R1–R6）
- **方法**：R1 亲自实跑复现两条 spawn 路径 + 代理核实 R2–R6 与死代码删除回归 + 逐行复核；未修改任何源文件
- **基线**：`npm test` 63/63、`npm run check`（0.1.2）、`npm run smoke` 全绿
- **严重度**：P0=门禁绕过/数据丢失/安全；P1=功能错误/证据保真；P2=健壮性/合规缺口；P3=小问题

> 路径相对仓库根，行号基于 HEAD `a65002d`。

---

## 总体结论

**0.1.2 真实关闭了 R1–R6，且未回归 0.1.1 的任何 P0 修复。** R1（Windows 引号保真）经亲自实跑确认两条路径均安全；R2/R3/R5/R6 逐行核实到位、死代码删除无残留调用、门禁/任务/配置改动无回归；63 个测试包含全部 P0 回归仍通过。

**未发现活跃门禁绕过或安全漏洞。** 残留均为低危测试广度/命名问题（P2/P3），不阻塞发布。0.1.2 可接受用于受监督 greenfield。

---

## 已确认修复

| 项 | 验证证据 | 判定 |
|---|---|---|
| R1 Windows 引号/注入 | `util.mjs:267-284` resolveWindowsProgram（where.exe 解析 .exe 直 spawn）；`:286-321` PowerShell `& $program @argv` splatting；`:258-265` formatArgv 日志保真；亲自复现见下 | ✅ |
| R2 版本校验守卫 | `check.mjs:44-50` 校 README「当前版本：`x.y.z`」+ CHANGELOG 首个 `## x.y.z`；`tests/version.test.mjs:10-19` 断言一致；四处均 0.1.2 | ✅ |
| R3 权限覆盖 | `permissions.yml:64-66` base edit deny `.sdd/evidence/**`；subagents ask 补 task*new(:191)/task*sync(:197)/retro*new(:215)；frontmatter 同步；取证走 shell 不受 edit deny 影响（toy/cli 测试过） | ✅ 无回归 |
| R4 测试广度 | 新增 handoff/metrics/config/status/speckit/init-backup/version 测试，断言真实行为/失败路径；总 63 | ⚠️ 部分（见 N1） |
| R5 schema/代码漂移 | `schemas/review.schema.json:7-18` non-analyze→commit minLength 1 + evidence minItems 1；`evidence.mjs:96-97` 无 HEAD 拒绝；`docs/STATE.md:134-135` 注明 final 绑 HEAD | ✅ |
| R6 帮助/死代码/弱断言 | `cli.mjs:133` usage 补 --dry-run/--yes；readEvidenceLog/passingEvidence/taskStats/gateCommand 全仓无残留调用；`evidence.test:222-224` 超时加耗时断言 | ✅ 无回归 |

### R1 专项复现（亲自实跑，Windows）

| 用例 | 路径 | 结果 |
|---|---|---|
| `node -e "console.log('a b')"` | node→node.exe 直 spawn | exit 0，输出 `a b`（空格保真） |
| `node -e … 'x" & echo INJECTED & "'` | 同上 | exit 0，输出 `ok`，**无 INJECTED 执行** |
| `node -e … "%SDD_R1%"` | 同上 | 输出 `%SDD_R1%` 字面（不展开） |
| 合成 .cmd 转发 node + 元字符参数 | PowerShell splatting | 输出单一合法 JSON 数组，元字符作为**数据**传递，无独立 echo 执行 |
| `npm --version` | npm→npm.cmd→PowerShell | exit 0，`11.20.0` |

结论：cmd.exe 注入与 %VAR% 展开已消除；.exe 直 spawn 与 PowerShell splatting 均保真。

---

## 残留问题（均低危，建议下版顺手处理）

### N1（P2）R4 测试广度未完全闭合

- **doctor 模块仍零覆盖**：tests/ 无 doctor 引用；init/security 测试直调 initProject，不经 CLI doctor 路径。
- `tests/prompts.test.mjs:11-30` 仍是纯字符串存在断言，未验行为。
- **报告准确性**：0.1.2 处理结果把 "final-scope" 列为新增测试，但 `tests/final-gate.test.mjs` 在 0.1.1（5013c3a）已存在、本轮未改（`git diff` 为空）——属冒领，final-scope 覆盖实为 0.1.1 成果。

**建议**：补 doctor CLI 路径测试；prompts 测试升级为行为断言；后续处理结果如实区分新增/既有测试。

### N2（P3）R1 测试未覆盖 PowerShell 包装路径

- `tests/evidence.test.mjs:203-225` 只用 `node`/`process.execPath`（.exe 直 spawn），未测 .cmd/.bat 的 PowerShell splatting 分支。
- .cmd/.bat 目标在 cmd 层仍有引号解析（Windows 固有；注入已被 splatting 阻止，仅引号可能被剥离）。

**建议**：增一个 .cmd 目标测试断言元字符不执行、%VAR% 字面；文档注明 .cmd 引号局限。

### N3（P3）测试断言强度小疵

- `tests/version.test.mjs` 复制 check.mjs 正则而非用篡改夹具测 check 的失败分支。
- `tests/schema.test.mjs` 仅正例，未对 review schema 新约束（non-analyze commit/evidence 必填）跑 Ajv 负例。
- `tests/config.test.mjs:32` 名为解析错误实为非映射守卫，命名略不符。

### N4（P3）权限通配过匹配

- `permissions.yml` `*task*new*` 可能误匹配含 task…new 的取证命令，仅多一次 ask，方向安全。可收紧通配。

---

## 遗留待办（已声明，非缺陷）

- **设计取舍**：shell `*` allow 旁路 / CLI 无角色身份校验，`docs/PERMISSIONS.md` 明示权限非安全边界，与 README“诚实限制”一致。单一写者在 CLI 层靠约定+ask，非强制隔离。
- **维护 agent 自列待办**：`nextId` 并发锁、时区配置读取（nowIso 仍硬编码 +08:00）、部分 P3 重复逻辑。这些不影响正确性，属硬化项。

---

## 验收建议

0.1.2 可接受发布。三轮评审（原始 → 0.1.1 → 0.1.2）后，**原始 6 条 P0 + 9 条 P1 与验证残留 R1–R6 均已实质关闭，无活跃绕过**。剩余 N1–N4 为低危测试广度/命名问题，建议合并到一个后续硬化提交，优先级 N1（doctor 覆盖）> N2（.cmd 测试）> N3/N4。

## 风险与回滚

- 本轮无高风险改动；R1 spawn 路径已经双路径实跑验证。
- 各项独立提交便于回滚；版本变动同步 TEAM_VERSION/package.json/README/CHANGELOG（check.mjs 现已强制）。

---

## 处理结果（0.1.3，2026-11-27）

### 确认

N1–N4 均确认存在；N1 的报告归属问题属实：`final-gate.test.mjs` 是 0.1.1 既有测试，0.1.2 处理结果误列为“新增”，已更正。

### 修复

| 项 | 修复 |
|---|---|
| N1 | 新增 `tests/doctor.test.mjs`（完整项目通过 / 缺命令失败）；prompts 测试补 task-packet 实际路径、constitution/contracts/data-model/handoffs 断言；更正 final-scope 归属 |
| N2 | 新增 Windows `.cmd` 目标测试：元字符作为数据传递、`%VAR%` 不展开、单行 JSON 输出；文档注明 `.cmd` 引号可能被 cmd 剥离 |
| N3 | `checkVersions` 独立为 `scripts/lib/version-check.mjs`，新增篡改夹具负例；review/evidence schema 增加 Ajv 负例；config 测试改名 |
| N4 | permissions shell ask 通配收紧为 `*task new*`、`*task update*`、`*task sync*`、`*review new*`、`*gate check*`、`*decision new*`、`*decision answer*`、`*handoff new*`、`*retro new*` |

### 回归

- `npm test`：69/69 通过。
- `npm run check`：通过（0.1.3）。
- `npm run smoke`：通过。
- Windows `.cmd` 目标：`x" & echo INJECTED & "` 作为数据传递，无独立 `echo INJECTED`；`%SDD_R1%` 字面。
- doctor 完整项目通过；删除 `speckit.plan.md` 后 doctor 失败。
- 版本篡改夹具：package/README/CHANGELOG 任一不一致均被 `checkVersions` 报错。

### 剩余

- shell 旁路/CLI 身份校验仍是已声明设计取舍。
- `nextId` 并发锁、时区配置读取、部分 P3 重复逻辑仍待办。