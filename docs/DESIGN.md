# 设计

## 1. 目标

Riccon SDD 把 spec-kit 的规格驱动流程，放进一个受监督的 OpenCode 多 agent 团队：

- 用户只跟 `sdd/lead` 对话；
- lead 决定执行哪些 spec-kit 命令；
- 子代理分工，但不直接问用户；
- 每道门有可检查的产物和用户批准；
- 每个任务有 commit、证据、独立评审；
- 会话中断后，从 `.sdd/` + handoff 恢复；
- 团队能在真实项目中复盘、升级，并跟住 spec-kit 版本。

## 2. 非目标

- 不做第二个 riccon 内核：不做证据哈希、strict gate、release/sandbox、T1–T4 全套治理。
- 不 fork spec-kit：运行时读取项目内已安装的 `.opencode/commands/speckit.*.md`。
- 不做 brownfield：v0.1.0 只支持 greenfield；`sdd adopt` 留给 v2。
- 不做全自动自改：团队改进提案必须人工批准。
- 不做生产发布自动化：ops 是可选轨道，生产发布需要用户明确批准。

## 3. 团队形状

| 角色 | 核心职责 | 主要产物 |
|---|---|---|
| `sdd/lead` | 用户入口、spec-kit 执行、调度、门禁、决策、handoff | spec/plan/tasks、state、decisions、handoffs |
| `sdd/product` | 发现、MVP、故事、AC、UX、预验收 | `.sdd/analysis/product/**`、产品建议 |
| `sdd/architect` | 选型、架构、数据、契约、ADR、plan 评审 | `.sdd/analysis/architecture/**`、ADR 建议 |
| `sdd/builder` | 单任务实现、测试、迁移、取证 | 源码、测试、`.sdd/evidence/**` |
| `sdd/verifier` | 独立验证、反假绿、analyze/converge/final | `.sdd/reviews/**`、验证证据 |
| `sdd/ops` | CI/CD、容器、部署、可观测性、回滚 | CI、容器、runbook |

只有 lead 能 spawn 和 `question`；子代理的 `subagent`/`question` 权限是 deny。

## 4. 决策权

- 用户：产品范围、UX 方向、预算、风险例外、生产发布、花钱、破坏性操作。
- 团队：常规技术选型、库、重构、测试策略、文档。
- lead 不能自批门禁；用户批准记录在 `.sdd/decisions/DEC-*.md`。
- 高风险/不可逆/生产决策永远不能沉默通过。

## 5. 主流程

```text
init
  → kickoff 门（constitution + 合同 + MVP 一页纸）
  → specify + clarify
  → spec 门
  → plan + research/data-model/contracts/quickstart
  → plan 门
  → checklist + tasks + analyze
  → tasks 门
  → 逐任务 builder → evidence → verifier
  → converge → final review
  → final 门（用户验收）
  → done
```

v1 串行：一次一个 builder、一个任务。

## 6. 状态与证据

- `.sdd/` 是执行状态的唯一事实源；聊天历史不是记忆。
- `state.json` 存 phase、gate、feature、approvals、next。
- `tasks/*.json` 存 owner、status、write_scope、acceptance、verify、evidence、review。
- `evidence/` 由 `sdd evidence run` 生成：命令、cwd、exit code、时间、commit、日志路径。
- `reviews/` 由 verifier 写：task/analyze/converge/final。
- `handoffs/` 存摘要、下一步、不变量、风险、first read。

## 7. 门禁

| 门 | 关键检查 |
|---|---|
| kickoff | constitution 非模板；合同含栈/命令/DoD；brief 完整并 approved；用户决策 |
| spec | spec 结构；无待澄清；requirements checklist 全过；用户决策 |
| plan | plan/research/quickstart；Constitution Check；用户决策 |
| tasks | tasks 同步；每任务 scope/acceptance/verify；analyze pass；用户决策 |
| final | 全任务 done；证据 exit 0；高风险 review；converge clean；final review；用户验收 |

门禁失败不降低标准；回到具体任务修复。

## 8. 升级与兼容

- 团队文件通过 `.sdd/manifest.json` + `sdd upgrade` 升级；保留项目状态和本地修改。
- spec-kit 兼容范围 `>=1.4.5 <2.0`；`sdd doctor` / `sdd compat check` 检查命令/模板/脚本/扩展。
- spec-kit 2.0 必须升级团队。
- 团队改进通过 `/sdd-improve` 提案，人工批准后合入源仓库。

## 9. 风险与限制

- 本地 manifest/hash 不能证明“谁批准/谁评审”。
- 证据是审计线索，不是 runtime attestation。
- scope 检查只做路径归属，不证明 authorship。
- Agent 是概率系统；门禁降低风险，不消除错误。
- 真实项目使用时要关注：门禁失败率、返工率、任务周期、scope 越界、证据质量。
