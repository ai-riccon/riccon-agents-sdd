# PROPOSAL-20261127 — 0.1.1 修复验证评审

- **日期**：2026-11-27
- **类型**：对提交 `5013c3a`（"修复全量评审 P0/P1，发布 0.1.1"）的验证评审，供维护 agent 处理残留项
- **前序**：`PROPOSAL-20261127-full-review.md`（原始全量评审，P0×6 / P1×9 / P2 / P3）
- **方法**：逐行复核门禁核心修复 + 2 路并行核实安全/权限/init 与 P1/P2/合规 + 残留问题沙箱实测；未修改任何源文件
- **基线**：`npm test` 51/51、`npm run check`（0.1.1）、`npm run smoke` 全绿
- **严重度**：P0=门禁绕过/数据丢失/安全；P1=功能错误/证据保真；P2=健壮性/合规缺口；P3=小问题

> 路径相对仓库根，行号基于 HEAD `5013c3a`。

---

## 总体结论

**0.1.1 真实堵住了原始评审的全部 6 条 P0 与 9 条 P1 核心绕过，非纸面修复。** 证据绑定、severity 白名单、批准撤销、done 复用校验、max_risk 棘轮、门禁顺序、final scope/HEAD 绑定、ID 白名单、git 注入防护、manifest 路径限定、重复 init 守卫均经逐行复核确认；新增回归测试断言真实失败路径（throws / ok:false / 文件未变），非平凡通过。**未发现活跃的门禁绕过。**

残留项属硬化性质（Windows 引号保真、版本校验守卫、测试广度），建议作为 0.1.2 跟进，不阻塞 0.1.1 用于受监督 greenfield。

---

## 已确认修复（逐行复核）

| 原发现 | 验证证据 | 判定 |
|---|---|---|
| P0-1 证据不绑定/done 不验质量 | `evidence.mjs:172-214` validateEvidence 强制 task 匹配/commit==end_commit（final 比 HEAD）/dirty 拒绝/日志目录+非空；`task.mjs:209-212,251-264` done 复用 validateEvidence+reviewPasses；`task.mjs:278-280` patch.evidence 落盘 | ✅ |
| P0-2 severity 绕过/默认 pass | `review.mjs:21-28` normalizeSeverity 白名单；`:141-149` INVALID 桶；`:151-175` reviewPasses 拒 INVALID、非 analyze 强制 reviewed_commit+证据绑定+commit==end_commit；`:85` verdict 默认改 fail；`:61-73` validateFindings | ✅ |
| P0-3 批准不撤销/可重答 | `decision.mjs:135-146` 最新已回答决策为准；`:148-151` gateApproved；`gate.mjs:27-29` hasApproval 改用 gateApproved；`decision.mjs:114-116` open 守卫+--reopen；`:46-50,113` assertGate | ✅ |
| P0-4 reviews deny/shell 旁路 | `permissions.yml:217,240,263` reviews deny 补全；verifier 无 deny；`:303-305` review-new allow 在 subagents ask 之后（最后匹配正确）；ask 双侧通配匹配 node 调用；frontmatter 同步 | ✅（旁路已文档化，见下） |
| P0-5 路径穿越/git 注入/manifest 越界 | `util.mjs:146-179` ID 白名单拒 `/ \ ..`；`:210-214` commit 拒 `-` 开头+rev-parse；`gitDiffNames` SHA+`--`；`manifest.mjs:74-87` 管理前缀限定；各入口全覆盖 | ✅ |
| P0-6 重复 init/opencode.json 覆盖 | `init.mjs:127-130` 默认拒绝；`:131-136` --force 先备份；`:34-47` 非法 JSON 拒覆盖、合法先备份 | ✅ |
| P1-1 门禁乱序/phase 回退 | `gate.mjs:209-216` checkOrder 前序门 gateApproved；`:228` 非 kickoff 强制；`:251-254` phase 只前进 | ✅ |
| P1-2 risk 降级跳评审 | `task.mjs:275-277` max_risk 只升不降；`:258-264` 按 max_risk 校验 | ✅ |
| P1-3 final 不查 scope/diff 假通过 | `gate.mjs:186-188` final 纳入 scope；`task.mjs:302-309` gitDiffNames try/catch→checked:false | ✅ |
| P1-4 升级回滚 | `upgrade.mjs:55-61` 备份含旧 manifest；`:47-50` manifest 缺失拒绝、--force 放行 | ✅ |
| P1-5 旗标解析/确认 | `cli.mjs:90-92` toBool；`:214` dry-run 不写；`:215-217` --write 需 --yes；`:240` --spec-kit 失败 exit 1 | ✅ |
| P1-6 引号丢失 | `util.mjs` runProcessArgv 直接 spawn argv（POSIX/Windows .exe） | ⚠️ 部分（见 R1） |
| P1-7 超时杀进程树 | `util.mjs:264-275` killTree：Windows taskkill /T /F、POSIX detached+kill(-pid) | ✅ |
| P1-8/9 提示词契约 | lead final `--gate final` 绑最后 done 任务（与 evidence.mjs:89-91,187-199 兼容）；verifier 结构化 findings；sdd-upgrade team_source+--yes；ops 轨道+receipt；task-packet 双路径 | ✅ |
| P2 多数 | metrics 三事件有发射方（gate.mjs:255-257、task.mjs:284-292）；state schema_version；agents.mjs YAML 失败抛错；init 写 .gitattributes；CI 加 smoke；converge ready；blocked 解锁 | ✅ |
| 硬规则 4 契约同步 | evidence.schema commit 必填；review.schema severity 枚举+绑定；task.schema max_risk；STATE.md 同步 | ✅ |

---

## 残留问题（建议 0.1.2 处理）

### R1（P1）Windows 非 .exe 命令引号失真 + cmd 元字符注入

**位置**：`scripts/lib/util.mjs:314-320`（cmd.exe 分支）、`:260-261`（quoteWinArg）

**问题**：win32 下程序名非 `.exe`（node/npm/git 等最常见取证命令）时，把 `[program,...args]` 经 quoteWinArg 拼成命令行交 `cmd.exe /d /s /c`。quoteWinArg 的 `\"` 经 Node spawn 二次转义后被 cmd 误读：
- 参数失真：`runProcessArgv('node',['-e',脚本,'a b'])` 实测输出为空；
- 元字符注入：含 `"` 参数实测可执行 `echo INJECTED`；`%VAR%` 仍被展开；
- 证据保真受损：日志记录 `argv.join(" ")` 与实际执行不符，违背“证据先于声明”。

现有测试只用 `process.execPath`（.exe 路径）故漏检。仓库在 Windows 开发，此路径影响主流取证命令。

**建议改动**：优先把程序解析为 .exe 全路径直接 spawn（避开 cmd）；必须经 cmd 时用 `windowsVerbatimArguments` + 正确 cmd 转义，或禁用 `%` 展开。日志记录与实际执行保持一致。

**验证方式**：新增 Windows 非 .exe 测试——`node -e` 含空格/引号参数原样执行、cmd 元字符不被注入、`%VAR%` 不展开、日志命令与执行一致。

### R2（P2，硬规则 8）版本同步校验不完整

**位置**：`scripts/check.mjs:41-42`

**问题**：只校 `package.json == TEAM_VERSION`，README.md/CHANGELOG.md 版本同步未纳入校验。当前四处均 0.1.1 一致，但守卫缺失，未来易漂移。

**建议改动**：check.mjs 增校 README.md 与 CHANGELOG.md 顶部版本等于 TEAM_VERSION。

**验证方式**：故意改 README 版本制造不一致，check 失败。

### R3（P2）权限 ask 覆盖与 evidence deny 缺口

**位置**：`templates/agents/permissions.yml:187-204`（subagents ask）、各角色 edit deny

**问题**：
- subagents shell ask 覆盖 task*update/review*new/gate*check/decision*new/answer/handoff*new，但**漏 task*new、task*sync、retro*new**——子代理可无确认创建/同步任务、写 retro。
- `.sdd/evidence/**` 对各角色均无 edit deny，verifier 等可直接改证据文件（base edit `*` allow）。

属已声明的 shell/edit 旁路局限内（见下），但覆盖不一致。

**建议改动**：ask 补 task*new/task*sync/retro*new；评估给非 builder 角色补 `.sdd/evidence/**` edit deny。改 YAML 后 `npm run sync:agents`。

**验证方式**：permissions.test 增断言。

### R4（P2，硬规则 9）测试广度仍不足

**问题**：
- 零覆盖模块：doctor、status、handoff、metrics、config、speckit（compat 仅测纯函数）。
- `tests/prompts.test.mjs` 仅字符串存在断言，未验行为。
- `tests/gate.test.mjs:19-26` 用必失败门测 phase 不回退，未测“通过旧门时 next>current 才前进”的正路径。
- done 任务 `--gate final` 取证无 E2E（evidence.test.mjs:106 用 review 态）。
- init `--force` 备份路径、upgrade 回滚后 hash 一致、converge/blocked 行为均无测试。

**建议改动**：补上述模块与场景测试；prompts 测试升级为行为断言。

### R5（P3）schema/代码小漂移

- `schemas/review.schema.json` reviewed_commit 仍容 null（代码更严，强制非空）。
- 无 HEAD 仓库 runEvidence 可写 commit:null 违反 evidence schema（commit 必填）——实际不可达（in_progress 需 baseline_commit 来自 gitHead），建议 runEvidence 显式拒绝无 HEAD。
- `docs/STATE.md:134` “commit===end_commit” 对 final 证据不精确（实为当前 HEAD），建议注明 final 例外。

### R6（P3）帮助/死代码/弱断言

- `scripts/lib/cli.mjs:133` usage() 缺 `--yes`/`--dry-run` 说明。
- `scripts/lib/evidence.mjs:220` readEvidenceLog 不校 log_path，但系死代码无调用方（建议删除）。
- 超时测试仅断言 timedOut 标志；`util.mjs:361` 3s 兜底在 kill 失败时同样置位，断言偏弱。

---

## 误报澄清

- **verifier `*review*new*` ask/allow“冲突”非 bug**：`permissions.yml:303-305` 的 allow 位于 subagents ask（:190-192）之后，按“最后匹配为准”正确放行 verifier 创建评审；builder 无此 allow 故仍 ask。顺序正确，无需改动。

## 已声明的设计局限（非回归）

- shell `*` allow 下 `node -e`、引号拆分仍可绕过 edit deny；`docs/PERMISSIONS.md:54` 明示权限非安全边界，与 README“诚实限制”一致。单一写者在 CLI 层仍靠约定+ask，非强制隔离。这是已接受的设计取舍，不计为缺陷。

---

## 验收建议

0.1.1 可接受用于受监督 greenfield/toy 流程。0.1.2 建议优先级：
1. R1 Windows 引号保真（P1，影响主流取证命令与证据可信度）
2. R2 版本校验守卫 + R4 测试广度（硬规则 8/9）
3. R3 权限覆盖一致性、R5/R6 小漂移

每项修复带回归测试；权限改动经 sync；不为过测试放宽门禁。

## 风险与回滚

- R1 改动 spawn 路径可能影响既有取证行为——需补 Windows/POSIX 双平台测试后再合入。
- 各项独立提交便于回滚；版本变动同步 TEAM_VERSION/package.json/README/CHANGELOG。

---

## 处理结果（0.1.2，2026-11-27）

### 确认

R1 已实测复现：Windows 下 `runProcessArgv('node', ['-e', ...])` 参数被 `cmd.exe` 拆坏，含 `& echo INJECTED &` 的参数确实执行了注入命令，`%VAR%` 行为不稳定。R2-R6 均已逐项复核存在。

### 修复

| 项 | 修复 |
|---|---|
| R1 | Windows 非 `.exe` 命令改用 PowerShell argv 包装（临时 JSON + run.ps1），`& program @argv` 保真；`.exe` 仍直接 spawn；证据日志用 `formatArgv` |
| R2 | `check.mjs` 校 README/CHANGELOG 版本；新增 `tests/version.test.mjs` |
| R3 | subagents ask 补 `task new/sync/retro new`；`.sdd/evidence/**` 全角色 edit deny |
| R4 | 新增 handoff/metrics/config/status/speckit/init-backup/version/doctor 测试；final-scope 为 0.1.1 既有测试，本轮继续通过；总数 63 |
| R5 | review schema 非 analyze 强制 commit 非空/evidence 非空；`runEvidence` 无 HEAD 拒绝；STATE 注明 final 证据绑定 HEAD |
| R6 | usage 补 `--dry-run`/`--yes`；删除 `readEvidenceLog`/`passingEvidence`/`taskStats`/`gateCommand`；超时测试加耗时断言 |

### 回归

- `npm test`：63/63 通过。
- `npm run check`：通过（0.1.2）。
- `npm run smoke`：通过。
- R1 专项：非 `.exe` 的 `node -e` 空格/引号参数、cmd 元字符、`%VAR%` 字面量均按预期；无 `INJECTED`。
- 真实 `sdd init` + `sdd doctor`、重复 init 拒绝/`--force` 备份、`upgrade --write` 无 `--yes` 拒绝/`--dry-run` 不写/`--write --yes` 备份，均通过。

### 剩余

- 已声明的 shell 旁路/CLI 身份校验仍属设计取舍，未改。
- `nextId` 并发锁、时区配置读取、部分 P3 重复逻辑仍在待办。