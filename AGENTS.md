# Riccon SDD — 维护者指南

本文件是**团队仓库自身**的维护约束，不是目标项目的合同。目标项目的合同在它自己的 `AGENTS.md`。

## 内容索引

| 路径 | 内容 |
|---|---|
| `.opencode/agents/sdd/` | 6 个 agent 定义（frontmatter + 中文提示词） |
| `.opencode/commands/` | `/sdd-*` 命令 |
| `.opencode/skills/` | 4 个共享 skill |
| `scripts/sdd.mjs` | CLI 入口 |
| `scripts/lib/` | CLI、init、doctor、upgrade、state、task、evidence、gate、decision、handoff、retro、metrics、compat、speckit、manifest |
| `templates/agents/permissions.yml` | 权限单一事实源 |
| `templates/agents/models.yml` | 模型/steps 单一事实源 |
| `templates/project/AGENTS.md` | 目标项目合同模板 |
| `templates/state/` | 状态/决策/评审/handoff/retro/brief 模板 |
| `templates/prompts/task-packet.md` | lead 派发 builder 的任务包 |
| `schemas/` | JSON Schema 契约（文档用途；CLI 使用手写校验） |
| `compat/speckit-1.x.json` | spec-kit 兼容清单 |
| `docs/` | 设计、流程、状态、权限、模型、升级、兼容、评测 |
| `tests/` | `node:test` 测试 |

## 命令

```bash
npm test              # node --test tests/*.test.mjs
npm run check         # 源仓库一致性检查（文件、版本、agent 同步）
npm run smoke         # dry-run init
npm run sync:agents   # 把 permissions/models 同步进 agent frontmatter
```

## 硬规则

1. **团队定义保持技术栈无关。** 不要在 agent/skill/command 里写死 React、Spring、Postgres 等具体选型；技术栈属于目标项目合同。
2. **权限和模型只改 YAML。** 改 `templates/agents/permissions.yml` 或 `models.yml`，然后 `npm run sync:agents`；不要手改 6 份 agent 的 permissions/steps/model。
3. **agent 文件保持中文。** 标识符、API 字段、命令、日志键英文。
4. **状态契约优先。** 改 `.sdd/` 字段时，同时更新 `schemas/`、`docs/STATE.md`、相关 CLI 和测试。
5. **证据不可伪造。** 不要加“手工证据可当 done”的捷径；不要放宽 gate 来让测试通过。
6. **单一写者。** lead 写 state/tasks/decisions/handoffs；builder 写代码+evidence；verifier 写 reviews。
7. **不存密钥。** agent、模板、测试、文档、示例都不得包含真实密钥或生产凭据。
8. **版本单一事实源。** `scripts/lib/version.mjs` 的 `TEAM_VERSION` 是版本源；同步 `package.json`、`README.md`、`CHANGELOG.md`。
9. **测试先行或同步。** 改 CLI/gate/task/evidence/upgrade 必须带测试；`npm test` 和 `npm run check` 必须全绿。
10. **升级必须可回滚。** 改 manifest/升级逻辑时保留 dry-run、备份和本地修改冲突处理。

## 修改 agent

1. 改 `.opencode/agents/sdd/<role>.md` 的正文。
2. 如果改权限/模型，改 `templates/agents/*.yml`，运行 `npm run sync:agents`。
3. 运行 `npm run check`；`doctor` 会检查同步。
4. 如果角色边界变化，同步更新 `docs/DESIGN.md`、`docs/PERMISSIONS.md`、`README.md` 和 `sdd-core` skill。

## 修改 CLI

1. 在 `scripts/lib/` 加/改模块；保持函数可测试。
2. 在 `scripts/lib/cli.mjs` 接入命令和中文帮助。
3. 在 `tests/` 加测试；至少覆盖成功路径、失败路径和状态变化。
4. 更新 `README.md` 命令表、`docs/STATE.md`。

## 修改 spec-kit 兼容

1. 在 `compat/speckit-1.x.json` 更新 `range`、`tested_versions`、必需命令/模板/脚本/扩展。
2. 用真实 `specify init` 项目验证 `sdd doctor` / `sdd compat check`。
3. 更新 `docs/COMPATIBILITY.md` 和 `CHANGELOG.md`。
4. 2.0 需要新 compat 文件（如 `speckit-2.x.json`）和团队大版本。

## 发布

1. 更新 `TEAM_VERSION`、`package.json`、`CHANGELOG.md`。
2. `npm test`、`npm run check`、`npm run smoke` 全绿。
3. 打 annotated tag `vX.Y.Z`。
4. 在真实目标项目跑一次 `sdd init` → 四道门 toy 流程 → `sdd upgrade --dry-run`。

## 目标项目里的团队文件

- 目标项目的 `.opencode/agents/sdd/**`、`.opencode/skills/sdd-*/**`、`.opencode/sdd/**` 是团队管理文件；不要在目标项目里直接改。
- 需要团队级改动，走 `/sdd-improve` 提案，回到本仓库修改并发版。
- 目标项目的 `.sdd/state.json`、`tasks/`、`decisions/`、`evidence/`、`reviews/`、`handoffs/`、`retro/` 是项目状态，不做团队升级覆盖。
