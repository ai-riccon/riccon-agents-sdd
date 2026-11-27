# 工作流

## 1. 启动

1. 在源仓库运行 `sdd init <目标项目>`。
2. 打开目标项目；默认 agent 是 `sdd/lead`。
3. 用户说“我想做……”。
4. lead 读 `.sdd/state.json`、handoff、`AGENTS.md`，运行 `sdd status` / `sdd doctor`，报告下一步。

如果 `.sdd/` 不存在，lead 不做初始化，提示用户运行 `sdd init`。

## 2. Kickoff

目标：在写 spec 前确定用户、问题、MVP、non-goals、指标、技术约束。

1. lead 用自然语言了解想法；含糊时加载 `grilling` skill 分轮提问。
2. 想法模糊/高风险时，可选使用 `assess` 扩展（intake → research → define → shape → decide）。
3. `sdd/product` 起草 MVP 一页纸；`sdd/architect` 给技术栈/约束/风险建议。
4. lead 写 `.sdd/brief.md`，填 `AGENTS.md` 合同块（技术栈、构建/测试命令、DoD、风险等级）。
5. lead 按 `speckit.constitution` 生成 `.specify/memory/constitution.md`。
6. 创建 `DEC-*`（gate=kickoff），向用户提交 kickoff 包。
7. 用户批准 → `sdd decision answer ... --kind approve` → `sdd gate check --gate kickoff`。

## 3. Specify + Clarify

1. lead 读 `.opencode/commands/speckit.specify.md`，按步骤执行；输入是已批准的 brief。
2. 需要澄清时读 `speckit.clarify.md`，最多 5 问；用 `question` 工具。
3. 检查 `specs/NNN-*/spec.md` 结构、无 `[NEEDS CLARIFICATION]`、requirements checklist。
4. 创建 `DEC-*`（gate=spec），提交 spec 包；用户批准 → gate check。

产物：

```text
specs/NNN-<name>/
├─ spec.md
└─ checklists/requirements.md
```

## 4. Plan

1. `sdd/architect` 给技术选型、架构、数据模型、契约、ADR、安全基线、plan 批评。
2. lead 读 `speckit.plan.md` 并执行。
3. `sdd/product` 检查 UX/文案/AC 可测试性。
4. 检查 Constitution Check；未解释违反回到用户决策。
5. 创建 `DEC-*`（gate=plan），提交 plan 包；用户批准 → gate check。

产物：

```text
specs/NNN-<name>/
├─ plan.md
├─ research.md
├─ data-model.md
├─ contracts/
└─ quickstart.md
```

## 5. Tasks

1. verifier 按风险创建 `checklists/<domain>.md`（安全、UX、性能、数据）。
2. lead 执行 `speckit.tasks` 生成 `tasks.md`。
3. `sdd task sync` 把任务同步为 `.sdd/tasks/*.json`。
4. lead 为每个任务补齐 `write_scope`、`acceptance`、`verify`、`risk`、`depends_on`。
5. verifier 执行 `speckit.analyze`，写 `ANALYZE-*.md`；CRITICAL/HIGH 必须修复。
6. 创建 `DEC-*`（gate=tasks），提交 tasks 包；用户批准 → gate check。

任务包格式见 `templates/prompts/task-packet.md`。

## 6. Implement

v1 串行：

```text
lead: task update in_progress
  → 生成任务包
  → spawn sdd/builder
  → builder 实现 / 提交 / evidence
  → lead 核对 receipt + scope
  → task update review
  → 按风险 spawn verifier
  → verifier 写 review
  → lead task update done
```

规则：

- builder 只改 `write_scope`；不碰 state/tasks/decisions/AGENTS.md/.opencode。
- builder 提交后用 `sdd evidence run` 记录证据；工作树脏会拒绝。
- lead 用 `sdd task scope` 检查越界。
- 高风险任务/用户故事/里程碑必须独立 verifier。
- verifier 用 `sdd review new` 创建评审骨架，补 findings/正文，返回 review ID。
- 失败重派最多 2 次，仍失败向用户升级。

## 7. Converge + Final

1. 每个用户故事/里程碑跑全量测试 + `speckit.converge` 分析。
2. lead 执行 converge；有缺口则追加任务并 `sdd task sync`。
3. 所有任务 done；verifier 写 `CONVERGE-*.md`（clean）和 `FINAL-*.md`（pass）。
4. product 做预验收。
5. 创建 `DEC-*`（gate=final），提交最终包；用户接受 → gate check。
6. 写 handoff，phase=done。

## 8. Bug（post-MVP）

MVP 验收后的真实缺陷使用 `bug` 扩展：

```text
/speckit.bug.assess → /speckit.bug.fix → /speckit.bug.test
```

构建期缺陷不生成 bug 工件；回到 tasks/rework/converge。

## 9. Handoff

在以下时点写：

- 每道门通过后；
- 每个用户故事/里程碑；
- 上下文接近 120K input / 300 of 440 steps / 60 tool calls / 一次自动压缩；
- 长时间暂停前。

handoff 前：没有 in_progress/review 任务、没有阻塞决策、gate 不是 fail、`next` 非空、`first_read` 存在。

## 10. spec-kit 命令适配

| 命令 | 谁执行 | 适配 |
|---|---|---|
| constitution | lead | kickoff 原则 |
| specify | lead | brief 输入；中文内容、英文标题 |
| clarify | lead | 最多 5 问 |
| plan | lead + architect | architect 提供研究/ADR |
| checklist | verifier 创建、lead 执行 | verifier 拥有勾选 |
| tasks | lead | 随后 task sync |
| analyze | verifier | 只读，写 review |
| implement | **不端到端** | lead 只用预检/任务语义，逐任务派 builder |
| converge | lead 执行、verifier 审计 | 只追加任务 |
| bug.* | lead/verifier | 仅 post-MVP |
