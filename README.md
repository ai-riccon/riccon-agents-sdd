# Riccon SDD

**spec-kit 驱动的 OpenCode 智能体团队，把 0→1 软件项目从想法交付到可验证 MVP。**

你只跟 `sdd/lead` 对话。lead 决定执行哪些 spec-kit 命令、调度 `product` / `architect` / `builder` / `verifier` / `ops`，维护 `.sdd/` 交付账本，并在四道门停下来找你确认。

当前版本：`0.1.1`。这是一个**受监督的交付团队**，不是全自动软件公司；生产发布、花钱、破坏性操作仍需你明确批准。

---

## 它解决什么

单个 coding agent 常见的问题是“说完成了，但证明不了”：

- spec/plan/tasks 互相矛盾，没人做交叉检查；
- builder 自己写、自己验收；
- `tasks.md` 勾了 `[X]`，但没有测试、没有证据；
- 会话中断后，下一个 agent 只能靠聊天历史猜；
- 团队提示词越用越散，没人把真实项目的摩擦回流。

Riccon SDD 把这些变成可检查的文件和状态：

```text
kickoff → specify → plan → tasks → 逐任务实现 → 独立验证 → converge → 最终验收
```

---

## 五个角色（+ 可选 ops）

| 角色 | 负责 | 不写 |
|---|---|---|
| `sdd/lead` | 用户唯一入口；执行 spec-kit 命令、调度、门禁、决策、handoff | 生产源码、测试、迁移 |
| `sdd/product` | 发现、MVP 一页纸、用户故事、验收标准、UX、预验收 | 源码、state/tasks/decisions |
| `sdd/architect` | 技术选型、架构、数据模型、契约、ADR、plan 评审 | 功能代码、state/tasks/decisions |
| `sdd/builder` | 单任务 `write_scope` 内的源码、测试、迁移、取证 | state/tasks/decisions、AGENTS.md、.opencode |
| `sdd/verifier` | 独立验证、反假绿、analyze/converge/final 评审 | 源码、state/tasks/decisions |
| `sdd/ops` | 可选：CI/CD、容器、部署、可观测性、回滚、runbook | 功能代码、state/tasks/decisions |

关键边界：

- 只有 lead 能 spawn 子代理、能直接问用户；其他 agent 的 `subagent` 和 `question` 权限是 deny。
- builder 完成实现并请求 review；任务状态由 lead 更新，builder 不能自己标 `done`。
- verifier 用新上下文；不复用上一个任务的 verifier 会话。
- 高风险任务（认证、权限、支付、PII、迁移、并发、安全边界、外部集成、数据删除）必须有独立评审。
- 任何人不能自我验收；lead 不能既实现又批准。

---

## 四道门 + 最终验收

| 门 | 必需产物 | 通过条件 | 批准 |
|---|---|---|---|
| **kickoff** | constitution、`AGENTS.md` 合同、`.sdd/brief.md` | constitution 非模板；合同含技术栈/命令/DoD；brief 含用户/问题/MVC/non-goals/指标/约束 | 用户 |
| **spec** | `spec.md`、requirements checklist | 无 `[NEEDS CLARIFICATION]`；checklist 全过；US/AC/FR/SC 完整 | 用户 |
| **plan** | `plan.md`、`research.md`、`data-model.md`、`contracts/`、`quickstart.md` | Constitution Check 存在；技术上下文/契约完整 | 用户 |
| **tasks** | `tasks.md`、`.sdd/tasks/*.json`、analyze 报告 | 每任务有 scope/acceptance/verify；analyze 无 CRITICAL/HIGH | 用户 |
| **final** | 全任务 done、证据、评审、converge clean、全量测试 | 所有检查通过；用户 accepted | 用户 |

任务生命周期：

```text
planned → ready → in_progress → review → done      (+ blocked)
```

- lead 是 `state.json`、`tasks/*.json`、`tasks.md` 勾选、decisions、handoffs 的唯一写者。
- builder 只提交本任务范围，提交后跑 `sdd evidence run`，把证据绑定到该 commit。
- lead 用 `sdd task scope` 检查是否越界。
- 低风险任务由 lead 审 diff + 证据后关闭；高风险任务和每个用户故事/里程碑必须独立 verifier。

---

## 快速开始

要求：**Node.js ≥ 22**（开发环境使用 26）、**git**、**spec-kit CLI 1.4.x**、**OpenCode**。

```bash
git clone <this-repo> riccon-agents-sdd
cd riccon-agents-sdd
npm install
npm test
```

在源仓库初始化一个新项目：

```bash
node scripts/sdd.mjs init /path/to/my-project
```

或者在项目目录里：

```bash
node D:/Development/riccon-agents-sdd/scripts/sdd.mjs init .
```

安装器会：

1. `git init`（若尚无仓库）；
2. 在目标项目运行 `specify init --here --integration opencode --script ps|sh --non-interactive`；
3. 安装 `git`、`assess`、`bug` 扩展，关闭 git auto-commit 和事件插件；
4. 安装 `.opencode/agents/sdd/`、`.opencode/commands/sdd-*.md`、`.opencode/skills/sdd-*/`、`.opencode/sdd/` runtime；
5. 合并 `opencode.json`，写入 `default_agent: "sdd/lead"`（可用 `--no-default-agent` 关闭）；
6. 写入 `AGENTS.md` 合同块、`.sdd/` 骨架和 `.sdd/manifest.json`；
7. 运行 `sdd doctor`。

打开项目后，默认 agent 就是 `sdd/lead`；直接说“我想做……”即可。

---

## 命令

OpenCode 命令：

```text
/sdd-start       开始或继续
/sdd-status      一屏状态
/sdd-resume      从 handoff 恢复
/sdd-review      生成评审包并推动门禁
/sdd-decision    处理开放决策
/sdd-improve     复盘并向团队仓库提交改进提案
/sdd-upgrade     检查/升级团队与 spec-kit 集成
```

CLI：

```bash
sdd init [dir] [--dry-run] [--no-git] [--no-default-agent]
sdd doctor [--json]
sdd status [--json]
sdd upgrade [--write --yes] [--dry-run] [--force] [--spec-kit] [--project dir]
sdd state validate
sdd task new|sync|list|show|update|scope
sdd evidence run --task TASK-0001 --agent sdd/builder -- <command>
sdd evidence list --task TASK-0001
sdd gate check --gate kickoff|spec|plan|tasks|final
sdd review new|list|show
sdd decision new|answer|list|show
sdd handoff new|list
sdd retro new
sdd metrics
sdd compat check
sdd version
```

项目内 runtime 路径是 `.opencode/sdd/scripts/sdd.mjs`；在源仓库用 `node scripts/sdd.mjs`。

---

## `.sdd/` 状态

```text
.sdd/
├─ project.json          项目元数据、团队/spec-kit 版本
├─ state.json            phase、gate、feature、approvals、next
├─ config.yml            语言、模型、覆盖率、证据、handoff、并行、git
├─ brief.md              MVP 一页纸
├─ manifest.json         团队文件版本与 hash
├─ tasks/TASK-0001.json  owner、status、write_scope、acceptance、verify、evidence、review
├─ decisions/DEC-0001.md 问题、选项、推荐、默认、截止、答案
├─ evidence/TASK-0001/EV-0001.json + .log
├─ reviews/REV-*.md      task/analyze/converge/final 评审
├─ handoffs/HANDOFF-*.md 摘要、下一步、不变量、风险、first read
├─ retro/RETRO-*.md      复盘与改进提案
├─ metrics/events.jsonl  本地指标事件
└─ backup/               升级/配置备份（gitignored）
```

- 机器状态用 JSON；决策、评审、handoff、retro 用 Markdown + YAML front matter。
- 证据 = 命令、cwd、exit code、开始/结束、commit、日志路径、agent、task；v1 不做日志哈希。
- `.sdd/` 是执行状态的唯一事实源；聊天历史不是记忆。
- 不要存密钥；证据日志会提交到仓库，注意敏感输出。

---

## 仓库结构

```text
.opencode/agents/sdd/     lead、product、architect、builder、verifier、ops
.opencode/commands/       /sdd-* 命令
.opencode/skills/         sdd-core、sdd-speckit、sdd-verify、sdd-upgrade
scripts/                  CLI、init、doctor、upgrade、state、task、evidence、gate…
templates/                权限/模型单一事实源、项目合同、状态模板、任务包
schemas/                  project/state/task/evidence/decision/review/handoff/retro/manifest
compat/                   spec-kit 兼容清单
docs/                     设计、流程、状态、权限、模型、升级、兼容、评测
tests/                    node:test：toy E2E、任务、证据、升级、兼容
```

---

## 升级与兼容

**团队升级**（在源仓库运行）：

```bash
node scripts/sdd.mjs upgrade --project /path/to/project --dry-run
node scripts/sdd.mjs upgrade --project /path/to/project --write --yes
```

- 基于 `.sdd/manifest.json` 的文件 hash。
- 只改团队管理的文件；保留 `.sdd/` 状态、`config.yml`、`brief.md`、spec 产物和项目合同。
- 本地修改默认跳过；确认覆盖才 `--force`。
- 升级前自动备份到 `.sdd/backup/upgrade-<时间>/`。

**spec-kit 升级**：

- 团队兼容 `>=1.4.5 <2.0`；2.0 必须升级团队。
- `sdd doctor` / `sdd compat check` 检查必需命令、模板、脚本和扩展。
- `sdd upgrade --write --yes --spec-kit` 才会执行 `specify integration upgrade opencode` / `specify extension update`，且需要用户明确同意。

**团队自我改进**：

- 每个里程碑/项目写 `.sdd/retro/`；
- `/sdd-improve` 读取证据、评审、门禁失败和指标，向团队源仓库 `docs/proposals/` 写提案；
- 人工审阅后合入；不自动修改已安装团队文件。

---

## 设计原则

- **规格先于代码**：不跳过 spec/plan/tasks；不在 tasks 门之前写生产代码。
- **证据先于声明**：没有 exit 0、可复现的证据，不算完成。
- **独立验证**：builder 不自证；高风险任务必须有新上下文的 verifier。
- **单一写者**：lead 写状态和任务；builder 写代码和证据；verifier 写评审。
- **小步交付**：一个任务一个可独立验收的结果；一个文件一个 writer。
- **人类保留关键决策**：产品范围、UX、预算、风险例外、生产发布由用户决定。
- **技术栈无关**：团队定义不绑定框架、数据库或目录结构；技术栈写在项目合同。
- **可恢复**：`.sdd/` + handoff 足以让新会话继续，不依赖旧聊天。
- **可升级**：manifest + dry-run + 兼容清单，升级不静默破坏。

---

## 诚实限制

- 这是受监督团队，不是生产就绪平台。
- 本地 manifest/hash 不能密码学证明“谁批准/谁评审”；reviewer/session 仍是自报。
- 证据 JSON/日志能发现不一致，但不能证明命令真的执行过。
- scope 检查只做路径归属，不能证明 authorship；合并前仍需看实际 diff。
- 生产发布、真实 PII、生产密钥必须单独评审与批准。
- Agent 是概率系统；门禁和证据降低风险，但不能消除错误。
- 权限模式不是安全边界：子代理仍可能通过 shell 执行任意 `node` 命令；CLI 不校验调用者身份。`reviews/state` 的 edit deny 和 shell ask 是误操作防线，不是恶意隔离；真实隔离需要沙箱/一次性运行时。

---

## 文档

- [快速开始](docs/QUICKSTART.md)
- [设计](docs/DESIGN.md)
- [工作流](docs/WORKFLOW.md)
- [状态与门禁](docs/STATE.md)
- [权限](docs/PERMISSIONS.md)
- [模型](docs/MODELS.md)
- [升级](docs/UPGRADE.md)
- [兼容](docs/COMPATIBILITY.md)
- [评测](docs/EVALS.md)

## 许可

Apache-2.0。见 `LICENSE` 和 `NOTICE`。
