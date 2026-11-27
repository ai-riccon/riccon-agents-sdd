# PROPOSAL-20261127 — Riccon SDD 源仓库全量评审

- **日期**：2026-11-27
- **类型**：源仓库全量评审（非单项目 retro），供维护 agent 处理
- **评审范围**：全部 ~7500 行——`scripts/` 24 个脚本、6 agent + 4 skill + 7 命令、9 schema + 状态/门禁模块、`templates/`、`tests/`、升级/兼容/CI
- **方法**：4 路并行通读 + 门禁绕过在临时沙箱实测复现 + 关键 P0 逐行人工复核；未修改任何源文件
- **基线**：`npm test` 22 过、`npm run check` 全绿、密钥扫描干净、工作树干净
- **严重度定义**：P0=门禁可绕过/数据丢失/安全漏洞；P1=功能错误/关键校验缺口；P2=健壮性/文档漂移；P3=风格/死代码

> 所有路径相对仓库根 `D:\Development\riccon-agents-sdd`，行号基于当前 `main`（HEAD `3ec3d2f`）。

---

## 摘要（TL;DR）

设计理念与提示词层成熟：角色边界清晰、YAML 权限同步可靠、中文报错与退出码统一、toy E2E 是亮点。

**核心风险：主张“证据先于声明”在 CLI 层实质失守。** 证据、评审、批准、单一写者四条防线均有可实测的绕过路径；“22 全绿”覆盖广度不足以支撑硬规则 5/9/10。问题集中在**信任边界**：用户/agent 输入直达路径与 git 参数，done/final 依赖的校验器本身偏弱。

**建议修复顺序**：
1. 堵门禁绕过（P0-1/2/3）——强化 `validateEvidence`/`reviewPasses`/批准语义，done 复用它们
2. 补输入校验（P0-5）——id 白名单、git `--` 分隔、manifest 路径限定
3. 守权限与 init（P0-4/6）——reviews deny、shell ask 匹配 node 调用、重复 init 强制走 upgrade
4. 补门禁失败路径与升级回滚测试（硬规则 9/10）
5. 再处理 P1 旗标/引号/超时/提示词契约，P2 文档漂移与 metrics

---

## 影响范围

| 层 | 涉及文件 |
|---|---|
| CLI 校验 | `scripts/lib/evidence.mjs`、`task.mjs`、`review.mjs`、`decision.mjs`、`gate.mjs`、`state.mjs` |
| CLI 安全 | `scripts/lib/util.mjs`、`cli.mjs`、`manifest.mjs`、`upgrade.mjs`、`init.mjs` |
| 权限 | `templates/agents/permissions.yml`（改后须 `npm run sync:agents`） |
| 提示词 | `.opencode/agents/sdd/lead.md`、`verifier.md`、`ops.md`；`.opencode/commands/sdd-upgrade.md`；`.opencode/skills/sdd-verify/SKILL.md`；`templates/prompts/task-packet.md` |
| 契约/文档 | `schemas/*.json`、`docs/STATE.md`、`docs/UPGRADE.md`、`docs/EVALS.md` |
| 指标/CI | `scripts/lib/metrics.mjs`、`.github/workflows/ci.yml`、`scripts/check.mjs`、`scripts/smoke.mjs` |
| 测试 | `tests/`（gate 失败路径、upgrade force/remove/回滚、各绕过回归） |

---

## P0 发现（6 项，均实测或逐行复核）

### P0-1 证据不绑定 commit，done 不验证据质量 → 假绿过 final

**位置**
- `scripts/lib/evidence.mjs:146-158`（`validateEvidence`）
- `scripts/lib/task.mjs:207-216`（done 守卫）
- `schemas/evidence.schema.json:19`（允许 `commit: null`）

**问题**
- `validateEvidence` 只查：非 manual、`exit_code===0`、日志文件存在、**若** `evidence.commit` 非空则查仓库有 HEAD。它**从不**比对 `evidence.commit == task.end_commit`（或 HEAD 实际值）、忽略 dirty 标志、不校 `ev.task` 匹配、不验日志内容真实性。
- `task.mjs:212-216` 标 done 只查证据**条数**（`task.evidence?.length || incomingEvidence.length`）和高风险 review **字符串存在**（`patch.review ?? task.review`），**不调** `validateEvidence`/`reviewPasses`。
- 附带 bug：`task.mjs:207` 的 `incomingEvidence` 含 `patch.evidence`，可满足 :213 的 done 检查，但 :225-227 只持久化 `patch.add_evidence`——`patch.evidence` 不落盘，done 后证据消失。

**复现（沙箱已实测）**：手写一条 `exit_code:0 / commit:null / dirty:true` 的证据 JSON + 一个假 review ID，`task update --status done` 通过，高风险任务过 final。

**建议改动**
- `validateEvidence` 强制：`evidence.commit` 必填且等于 `task.end_commit`；dirty 证据拒绝（除非显式 `--allow-dirty` 且仍不得用于 done/final）；`ev.task` 必须匹配；日志路径必须落在 `.sdd/evidence/<task>/` 内且非空。
- `task.mjs` done 守卫改为：对每条绑定证据调 `validateEvidence`，至少一条 ok；高风险任务调 `reviewPasses(latestReview(...))` 而非查字符串。
- 统一 `patch.evidence` 与 `patch.add_evidence` 语义（要么都落盘，要么废弃 `patch.evidence`）。
- 同步收紧 `schemas/evidence.schema.json`（commit 必填）与 `docs/STATE.md`、`docs/EVALS.md:48` 的反假绿声明。

**验证方式**：新增测试——exit≠0 证据、commit:null、commit≠end_commit、dirty:true、task 不匹配、日志缺失/越界，各自不得 done/过 final；`patch.evidence` 落盘一致性。

---

### P0-2 评审 severity 改标签即绕过 + 默认 pass

**位置**
- `scripts/lib/review.mjs:94-101`（`findingsBySeverity`）
- `scripts/lib/review.mjs:104-118`（`reviewPasses`）
- `scripts/lib/review.mjs:72-73`（默认值）
- `scripts/lib/cli.mjs:373-374`（CLI 默认）

**问题**
- `findingsBySeverity` 只初始化 P0–P3 桶；未知/小写 severity（`critical`/`p0`/`HIGH`）落入 `if (!out[severity]) out[severity]=[]` 新建的**不受检桶**；缺 severity 默认 P3 且可 accepted。`reviewPasses` 只检 P0–P3 桶 → open 严重发现仍返回 true。
- `verdict` 默认 `pass`、`independent` 默认 `true`（CLI 仅字符串 `"false"` 才置 false）；`reviewPasses` 不校 `reviewed_commit`/`reviewed_evidence` 绑定 → 空 final 评审即过终门。
- `verdict` 枚举不校验；CLI `review new` 无 `--findings` 参数，P0/P1 拦截全靠手写 YAML frontmatter。

**复现（沙箱已实测）**：把 open critical finding 的 severity 改成 `critical`（非 `P0`），`reviewPasses` 返回 true。

**建议改动**
- severity 白名单校验（`P0|P1|P2|P3`），非法值拒绝或归一化后按最高档处理；缺 severity 不得默认 P3。
- `reviewPasses` 增加：`reviewed_commit` 必填且与任务 end_commit 一致；final/converge 评审要求 `reviewed_evidence` 非空。
- verdict/independent 枚举与布尔校验；CLI 补 `--findings`（JSON）入口。
- 同步 `schemas/review.schema.json` 与 `docs/STATE.md:156`（P0/P1 文档说“必须 fixed”，代码也允许 closed——统一口径）。

**验证方式**：未知/小写 severity、缺 severity、open P0/P1、verdict 非法、reviewed_commit 缺失/不匹配，各自 `reviewPasses=false`。

---

### P0-3 用户批准可伪造/不撤销

**位置**
- `scripts/lib/decision.mjs:89-112`（`answerDecision`）
- `scripts/lib/decision.mjs:114-123`（`latestGateDecision`）
- `scripts/lib/gate.mjs:21-23`（`hasApproval`）
- `templates/agents/permissions.yml:150`（shell ask 规则）

**问题**
- `latestGateDecision(approvedOnly=true)` 取最后一条 approve/accept，**后续 reject 不撤销先前批准**（approve DEC-0001 → reject DEC-0002，仍返回 DEC-0001）。
- `hasApproval` 绕开 `state.approvals`（只写不读）直读决策。
- `answerDecision` 无 open 守卫，可重答已回答决策；先写文件后 `setApproval`，非法 gate 抛错留半写态；`newDecision` 的 gate 不校验。
- shell ask 规则 `*sdd decision answer*` 不匹配规范调用 `node …/sdd.mjs decision answer`（见 `sdd-verify/SKILL.md:35`），批准永不弹窗。

**复现（沙箱已实测）**：先 approve 再 reject 同一门，`hasApproval` 仍 true。

**建议改动**
- 批准语义改为“该门**最新已回答**决策的 answer_kind”，reject 覆盖先前 approve；或显式维护 `state.approvals` 并让 gate 读它。
- `answerDecision` 加 open 守卫（已回答拒绝重答，或显式 `--reopen`）；先校验 gate 合法性再写文件。
- `newDecision` 校验 gate ∈ GATES。
- permissions.yml shell ask 规则改为匹配 `*sdd.mjs*decision*answer*` 与 `*sdd*decision*answer*`，覆盖 node 调用。

**验证方式**：approve→reject 后 `hasApproval=false`；重答被拒；非法 gate 不留半写态；ask 规则匹配 node 调用形式。

---

### P0-4 单一写者权限缺口 + shell 旁路

**位置**
- `templates/agents/permissions.yml:5-67`（base：read/edit/shell `*` allow）
- `templates/agents/permissions.yml:222-243`（builder deny 清单）
- `templates/agents/permissions.yml:188-220,245-283`（product/architect/verifier/ops）
- `docs/STATE.md:214`（称 reviews 仅 verifier 写）

**问题**
- builder（及 product/architect/ops）的 edit deny 清单**漏 `.sdd/reviews/**`** → 可直接伪造 pass 评审。
- base 给所有角色 shell `*` allow + edit `*` allow；CLI 不校验调用者身份 → builder 可直跑 `task update --status done`、`review new --verdict pass`、`gate check` 绕过全部 edit deny。
- shell ask 只拦 `decision answer`/`upgrade --write`，未拦 task/review/gate 写操作。

**复现**：builder 权限下 `node .opencode/sdd/scripts/sdd.mjs review new --task TASK-0001 --verdict pass` 成功（无 reviews deny + shell allow）。

**建议改动**
- 给 builder/product/architect/ops 补 `edit .sdd/reviews/** deny`（verifier 保留写权）。
- shell ask 增补 `*sdd.mjs*task*update*`、`*sdd.mjs*review*new*`、`*sdd.mjs*gate*` 等写操作（至少子代理角色）。
- 评估 CLI 层角色校验（如 `--agent` 与权限表联动）的可行性；若仍靠约定，须在 README“诚实限制”与 docs/PERMISSIONS.md 明确说明 shell 旁路风险。
- **改 YAML 后运行 `npm run sync:agents`，不要手改 6 份 agent frontmatter**（硬规则 2）。

**验证方式**：`tests/permissions.test.mjs` 增断言——builder/product/architect/ops 对 reviews 为 deny；ask 规则覆盖 node 调用；`npm run check` 同步检查通过。

---

### P0-5 路径穿越 + git 选项注入 + manifest 路径未校验

**位置**
- `scripts/lib/cli.mjs:366-378`（review new）、`:389-391`（review show）、`:416-419`（decision answer）
- `scripts/lib/review.mjs:19-21,50`（`reviewPath`/prefix 拼 `opts.task`）
- `scripts/lib/decision.mjs:106`、`scripts/lib/task.mjs:24`（id 拼路径）
- `scripts/lib/util.mjs:261-272`（`git()` 无 `--` 分隔）、`:291-295`（`gitDiffNames`）
- `scripts/lib/manifest.mjs:122,166` + `scripts/lib/upgrade.mjs:68-74`（manifest 路径直用于 rm/copy）

**问题**
- `--task`/id 未校验直拼路径：`review new --task "../../evil"` → `path.join` 归一化后在项目外写任意 .md（且不要求 task 存在）；`decision answer` 覆盖任意已存在 .md；`task show`/`review show` 读任意 .json/.md。
- `gitDiffNames` 把 baseline/end 拼成 `${base}..${head}` 单参数，`git()` 无 `--` 分隔；`task update --baseline-commit "--output=/path"` → git 选项注入可写任意文件。
- manifest 内路径未校验，被篡改后 `upgrade --force` 可删除/备份复制任意路径。

**复现**：`review new --task "../../pwn"` 在仓库外生成文件；`--baseline-commit "--output=…"` 触发 git 写文件（结构已复核，`git()` 确无 `--`）。

**建议改动**
- 所有 id 入口白名单正则（如 `^(TASK-\d+|EV-\d+|DEC-\d+|REV-[A-Z0-9-]+|FINAL-\d+|CONVERGE-\d+|ANALYZE-\d+)$`），拒绝含 `/`、`\`、`..` 的输入。
- `gitDiffNames` 校验 base/head 为合法 commit-ish（`git rev-parse --verify`），并在 diff 参数前加 `--`；或改用 `git diff --name-only base head --`。
- manifest 路径限定在管理目录集合内（`.opencode/agents/sdd/`、`.opencode/commands/`、`.opencode/skills/sdd-*/`、`.opencode/sdd/`），越界拒绝。

**验证方式**：穿越 id、含 `..`/绝对路径的 task/id、`--output=` 型 baseline、manifest 越界路径，各自被拒且不产生项目外写入。

---

### P0-6 重复 init 无条件覆盖团队文件 + opencode.json 覆盖，无备份

**位置**
- `scripts/lib/init.mjs:126-129`（仅警告）→ `scripts/lib/manifest.mjs:73-81`（`installTeamFiles` 无条件 copy）
- `scripts/lib/init.mjs:32-40`（opencode.json 不可解析当新文件）

**问题**
- 检测到 `.sdd/state.json` 已存在仅追加警告，随后无条件覆盖全部团队管理文件，无 hash 比对、无备份、无 force 门槛 → 本地修改永久丢失。提交 `c702aae` 只加提示语未加守卫。违反硬规则 10，且与 upgrade 精心保护本地修改的设计矛盾。
- 不可解析的 opencode.json（如带注释 JSONC）被 `readJson` 返回 null 视为新文件，无备份覆盖，丢用户配置。

**建议改动**
- 重复 init（state.json 存在）默认**拒绝并提示改用 `sdd upgrade`**；确需重装走显式 `--force` 且先备份团队文件到 `.sdd/backup/`。
- opencode.json 解析失败时拒绝覆盖并报错（或备份原文件后再合并），不得静默当新文件。

**验证方式**：已初始化项目再 init 被拒（或备份后覆盖）；非法 JSONC opencode.json 不被静默覆盖；新增 init 真实路径测试（见测试缺口）。

---

## P1 发现（9 项）

### P1-1 门禁无顺序约束，final 不检前序门
- `scripts/lib/gate.mjs:160-188`（checkFinal）、`:190-203`（checkGate）、`:213-225`（runGate）
- checkFinal 校验任务/证据/converge/final/批准等**产物**，但不校验 kickoff/spec/plan/tasks 是否曾通过；runGate 无阶段顺序约束，init 阶段可直跑 final（产物伪造后即过，沙箱实测）；重跑旧门 `setPhase(NEXT_PHASE[gate])` 把 phase 回退（implement→specify）。
- **改**：runGate 校验前序门已 pass（读 state.gate 历史或 approvals）；phase 只前进不回退。**验**：乱序门禁被拒、phase 不回退。

### P1-2 risk 随时可改，high→low 跳过评审
- `scripts/lib/task.mjs:218-224`：risk 在可 patch 键列表，任意改。high→low 后 done 不再要求评审（沙箱实测）。
- **改**：risk 降级需显式决策/批准，或 done 时按历史最高 risk 校验。**验**：high→low 后仍要求评审。

### P1-3 final 不查 scope 越界 + git diff 失败假通过
- `scripts/lib/gate.mjs:160-188` 不调 `taskScopeViolations`（仅手动命令用）；`scripts/lib/util.mjs:293` git diff 失败返回 `[]` → 非法 baseline 使 scope“0 文件通过”；`scripts/lib/cli.mjs:314` 无法检查时 exit 0。
- **改**：final 门纳入 scope 检查；gitDiffNames 失败应报错而非返回空；scope 无法检查时门禁 fail。**验**：越界任务过不了 final；非法 baseline 报错。

### P1-4 升级回滚闭环断裂 + manifest 缺失静默覆盖
- `scripts/lib/upgrade.mjs:45-50`：备份含 update/locallyModified/remove，但**不含旧 manifest.json** → 手工回滚文件后与新 manifest hash 不符，被误判本地修改。
- `scripts/lib/manifest.mjs:148-162`：manifest 丢失/损坏时差异文件全归 update 直接覆盖，“本地修改默认跳过”静默失效，仅剩备份兜底。
- **改**：备份包含旧 manifest；manifest 缺失/损坏时拒绝写入并提示重建（或全量备份后 force）。**验**：回滚后 doctor 不误判；manifest 缺失时 upgrade 拒绝。

### P1-5 CLI 旗标解析错误 + 无确认
- `scripts/lib/cli.mjs:56-82`（parseArgv）、`:207-215`（upgrade）：`--write false` 解析为字符串 "false" 后被当真；`options.force !== false` 恒真；`--parallel=false` 仍置 true；upgrade 忽略 `--dry-run`（`docs/UPGRADE.md:7` 仍宣传）；`--write/--force` 无 CLI 级确认（`0f6d7f4` 只收紧 OpenCode glob，终端直跑无效）。
- **改**：布尔旗标显式解析 true/false；upgrade 支持 `--dry-run`；`--write`/`--force` 终端交互确认或 `--yes` 显式跳过。**验**：`--write false` 不写入；dry-run 不写；force 需确认。

### P1-6 证据命令引号丢失
- `scripts/lib/cli.mjs:333`：`commandArgs.join(" ")` 丢 shell 引号，含空格参数被拆散执行。
- **改**：保留 argv 数组直接 spawn（不经 shell join），或正确 quoting。**验**：含空格/引号参数原样执行。

### P1-7 超时不杀进程树
- `scripts/lib/util.mjs:224-228`：超时只 `child.kill()` 杀 shell，Windows 孙进程持管道致 close 永不触发、超时失效。
- **改**：Windows 用 `taskkill /pid <pid> /T /F`，POSIX 用进程组 kill。**验**：含子进程的命令超时被终止。

### P1-8 提示词—CLI 契约脱节
- `.opencode/agents/sdd/lead.md:275`（及 :269）：final 要求跑全量测试并取证，但 `evidence.mjs:75` 只接受 in_progress/review 任务，final 时全 done → 取证必被拒，无说明绑定哪个任务/如何重开。
- `.opencode/agents/sdd/verifier.md:239`、`.opencode/skills/sdd-verify/SKILL.md:63`：只要求正文写 findings，门禁读 frontmatter 结构化 findings（severity/status/owner/due）→ 只写正文即假绿。
- `.opencode/commands/sdd-upgrade.md:20`：指示 runtime 跑 `upgrade --write`，但已安装 runtime 拒绝 upgrade（`cli.mjs:208`），与自身第 2 步矛盾。
- **改**：lead 明确 final 证据绑定策略（如绑最后一个任务或专用 milestone 任务）；verifier/sdd-verify 明确要求 frontmatter findings 结构并给示例；sdd-upgrade 改用 team_source CLI。**验**：按提示词执行可在 final 取证、评审 findings 被门禁识别。

### P1-9 ops 孤儿 + 安装后路径回退缺失
- `lead.md` 与 7 命令从不派发 ops；`ops.md` 无 receipt/证据协议、与 builder write_scope 划界缺失。
- `lead.md:260` 引用 `templates/prompts/task-packet.md`，安装后实际在 `.opencode/sdd/templates/…`（`manifest.mjs:20`），无类似 CLI 的双路径回退说明。
- **改**：lead 增 ops 派发轨道与证据协议；task-packet 引用改安装后路径或加回退。**验**：ops 可被派发并取证；目标项目内路径可解析。

---

## P2 发现（健壮性 / 文档漂移）

- **metrics 死数据**：`scripts/lib/metrics.mjs:52-54` gate_failures/dispatches/reworks/avg_cycle 恒 0，全仓仅发 `evidence_run`，retro 指标无来源。→ 在 gate/task/decision 关键路径发射事件。
- **时区硬编码**：`scripts/lib/util.mjs:7-21` nowIso 固定 +08:00，`config.timezone` 从不读取。→ 读 config 或统一 UTC。
- **状态校验漂移**：`scripts/lib/state.mjs:257` validateState 只查 project 版本非 state（`docs/STATE.md:226` 称两者）；`gate.mjs:205-211` NEXT_PHASE 无 verify/accept，`docs/STATE.md:42` 生命周期含之但 CLI 不可达。→ 对齐文档与实现。
- **YAML 解析失败静默**：`scripts/lib/agents.mjs:32` 解析失败返回 {} 后写回，摧毁原 frontmatter。→ 失败即抛错。
- **证据 TOCTOU + 并发覆盖**：`scripts/lib/evidence.mjs:80-92` dirty 检查与执行间竞态；证据 id 执行后计算，并发取证互相覆盖；`--cwd` 可指项目外（`cli.mjs:334`）而检查仍对项目根。
- **compat 范围静默放行**：`scripts/lib/compat.mjs:24-43` 未知 token（`*`/`1.x`/笔误）放行，`~1.2.3` 当精确匹配。→ 未知 token 报错。
- **manifest nested 漏匹配**：`scripts/lib/manifest.mjs:59-61` 只看直接父目录名，`sdd-*/子目录/` 文件漏安装漏登记（当前 skill 全平铺，潜伏）。
- **CRLF 误判本地修改**：字节级 hash + 目标项目不写 `.gitattributes`，Windows autocrlf 检出转 CRLF → 误判。→ hash 前归一化换行或目标写 .gitattributes。
- **CI/发布**：`.github/workflows/ci.yml:22-24` 矩阵 win+ubuntu×Node22/26 良好，但 smoke 未进 CI；`package-lock.json` resolved 全指 npmmirror，境外 CI 可用性风险；`cli.mjs:228` `--spec-kit` 子命令失败进程仍 exit 0。
- **提示词缺口**：`lead.md:219,231` 依赖外部 grilling skill 无回退；`lead.md:245`/`sdd-speckit:33` checklist 交 verifier 但其职责未提；`task-packet.md` 缺返工 findings 槽、必读漏 constitution/contracts/data-model、禁写清单漏 handoffs/.specify；converge 新任务 sync 后仍 planned（`gate.mjs:217` 只在 tasks 门升 ready），lead 未说明手动升 ready；`lead.md:335` blocked 无解锁流程；`README.md:43`“builder 只把任务推进到 review”与单一写者（lead 执行状态变更）措辞矛盾。

## P3 发现（风格 / 死代码）

- 死代码：util 的 `uniqueId/printTable/truncate/hashText/relativeFirstRead`、`gateCommand`、`taskStats`、`passingEvidence`、`readEvidenceLog`、`handoff.latestHandoff`、speckit 5 导出、`readExtensions`；cli 导入 `loadState/listRetros` 未用；`check.mjs:9` warnings 永空。
- 重复逻辑：`loadTasks/listTasks`、`latestHandoff`×2、`allEvidence/listEvidence`、状态计数×3；`evidence.mjs:82`/`doctor.mjs:18` 动态导入应静态。
- ID 字符串排序超 999/9999 失序（`review.mjs:91`/`decision.mjs:117` localeCompare）；`util.mjs:306` nextId 无锁并发覆盖；`upgrade.mjs:45` 备份目录秒级时间戳同秒覆盖。
- 事实更正：运行时依赖 `yaml`（`package.json:22`，并非零依赖）；`sdd retro list` 报“未知命令”；`templates/state/task.json:14,20` 示例 `src/example.ts`/`npm test` 偏具体栈，建议中性占位。

---

## 硬规则合规

| # | 规则 | 结论 |
|---|---|---|
| 1 | 技术栈无关 | ✅ 通过 |
| 2 | 权限/模型只改 YAML | ✅ frontmatter 与 YAML 一致 |
| 3 | agent 中文 | ✅ 通过 |
| 4 | 状态契约优先 | ⚠️ schemas/文档/CLI 多处漂移（P2） |
| 5 | 证据不可伪造 | ❌ 实质失守（P0-1/2/3） |
| 6 | 单一写者 | ❌ 权限缺口 + shell 旁路（P0-4） |
| 7 | 不存密钥 | ✅ 扫描干净 |
| 8 | 版本单一事实源 | ⚠️ 当前三处均 0.1.0 一致，但 `check.mjs:41-42` 只校 package.json，README/CHANGELOG 未校 |
| 9 | 测试先行/同步 | ⚠️ 多模块零覆盖、gate 仅 happy path（见下） |
| 10 | 升级可回滚 | ❌ 重复 init 无备份、manifest 缺失静默覆盖（P0-6/P1-4） |

## 测试覆盖缺口

- **零覆盖模块**：doctor、status、handoff（唯一未做 schema 校验的产物）、metrics、config、speckit、compat check、version/help/未知命令。
- **init**：仅 dry-run；git init / specify init / opencode.json 合并 / AGENTS.md 追加零自动化。
- **upgrade**：缺 force 覆盖、remove、dry-run 汇总、备份内容、`--spec-kit`、CLI 层。
- **gate**：仅 toy 通过路径；缺批准/缺证据/open findings/未知门/乱序等失败路径全缺。
- **task**：done 无证据、高风险无评审、review 无证据、in_progress 无 owner、risk 降级等守卫未测。
- **evidence**：错误状态、缺参、超时、截断、allow-dirty 未测。
- **decision**：非法 kind、reject→approval、latest-wins、重答未测；retro 仅 schema 形状。
- **CLI 层**：仅 task/evidence/review/gate；task show/sync、review show 未测。
- **关键**：现有 22 测试未覆盖任何上述绕过。

---

## 验证方式（整体验收）

维护 agent 完成修复后须满足：
1. `npm test`、`npm run check`、`npm run smoke` 全绿，且**新增**覆盖每条 P0/P1 的回归测试（先写失败测试再修，硬规则 9）。
2. 沙箱复现脚本对每条 P0 绕过返回“被拒绝”（证据绑定/severity 白名单/批准撤销/权限 deny/路径校验/init 守卫）。
3. `schemas/`、`docs/STATE.md`、相关 CLI 与测试同步更新（硬规则 4）。
4. 权限改动经 `npm run sync:agents`，`doctor` 同步检查通过（硬规则 2）。
5. 在真实目标项目跑 `sdd init` → 四道门 toy 流程 → `sdd upgrade --dry-run` → 重复 init 被拒 → 升级回滚无误判。

## 风险与回滚

- 强化校验可能让既有 toy/测试夹具失败——属预期，应更新夹具而非放宽门禁（硬规则 5：不得为过测试放宽 gate）。
- 权限收紧（reviews deny / shell ask）可能阻断既有合法流程——需在 lead/verifier 提示词同步说明合法路径。
- 每项修复独立提交，便于回滚；升级逻辑改动保留 dry-run/备份/本地修改冲突处理（硬规则 10）。
- 版本若变动，同步 `TEAM_VERSION`/`package.json`/`README.md`/`CHANGELOG.md`（硬规则 8）。

## 维护约束提醒（处理本提案时须遵守）

- 团队定义技术栈无关；权限/模型只改 YAML 后 sync；agent 正文中文。
- 状态契约改动同步 schemas + docs/STATE.md + CLI + 测试。
- 不加“手工证据可当 done”捷径，不放宽 gate 过测试。
- 单一写者：lead 写 state/tasks/decisions/handoffs；builder 写代码+evidence；verifier 写 reviews。
- 不存密钥；升级必须可回滚。

---

## 处理结果（0.1.1，2026-11-27）

### 确认

P0-1 至 P0-6、P1-1 至 P1-9 均已在代码/沙箱中复核存在；其中路径穿越、批准撤销、severity 绕过、重复 init、manifest 越界、乱序门禁、final scope、升级备份等已补回归测试。

### 主要修复

| 项 | 修复 |
|---|---|
| P0-1 | `validateEvidence` 绑定 task/commit/dirty/日志目录；`updateTask done` 复用校验；`patch.evidence` 落盘 |
| P0-2 | severity 白名单/归一化；review 需 commit/evidence；final 绑定 HEAD；CLI `--findings` |
| P0-3 | 最新已回答决策语义；reject 撤销 approve；已回答不可静默重答；gate 校验 |
| P0-4 | reviews deny 补全；子代理 shell 写操作 ask；verifier 保留 review new；文档说明 shell 旁路 |
| P0-5 | ID 白名单；commit 校验；git diff `--`；manifest 管理路径限定 |
| P0-6 | 重复 init 默认拒绝；`--force` 先备份；非法 opencode.json 拒绝覆盖 |
| P1-1 | 门禁顺序校验；phase 只前进 |
| P1-2 | `max_risk` 保留历史最高风险 |
| P1-3 | final 纳入 scope；git diff 失败/scope 无法检查即失败 |
| P1-4 | 备份旧 manifest；manifest 缺失默认拒绝写入 |
| P1-5 | 布尔旗标解析；`--dry-run`；`--write` 需 `--yes` |
| P1-6 | evidence 使用 argv 直接执行，保留引号 |
| P1-7 | 超时杀进程树（Windows taskkill / POSIX 进程组） |
| P1-8 | lead final 证据绑定策略；verifier 结构化 findings；upgrade 用 team_source + --yes |
| P1-9 | lead 增 ops 轨道；ops receipt/证据；task-packet 路径回退 |
| P2 | metrics 事件、state.schema_version、YAML 解析失败抛错、.gitattributes、CI smoke、spec-kit 失败退出码、converge 任务 ready、blocked 解锁、README 措辞 |

### 回归

- `npm test`：51/51 通过。
- `npm run check`：通过（0.1.1）。
- `npm run smoke`：通过。
- 真实 `sdd init` + `sdd doctor`：通过。
- 重复 init：默认拒绝；`--force` 备份 296 个文件后重装。
- `sdd upgrade --write` 无 `--yes`：拒绝；`--dry-run` 不写；`--write --yes` 成功备份。
- OpenCode：`sdd/lead` 在升级后的目标项目读取状态并报告。
