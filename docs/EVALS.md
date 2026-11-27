# 评测

## 1. v0.1.0 验收

| # | 验收项 | 方式 |
|---|---|---|
| 1 | 源仓库检查通过 | `npm run check` |
| 2 | 单元/集成测试通过 | `npm test`（19 个测试） |
| 3 | dry-run init 通过 | `npm run smoke` |
| 4 | 真实项目安装 | `sdd init <temp>` + `sdd doctor` |
| 5 | spec-kit 1.4.5 集成 | `specify version --json`、命令/模板/脚本检查 |
| 6 | 四道门 + 最终验收 | `tests/toy.test.mjs` |
| 7 | 升级不覆盖状态 | `sdd upgrade --dry-run/--write` + 对比 `.sdd/state.json` |
| 8 | 默认 agent 正确 | 目标项目 `opencode.json` 的 `default_agent: sdd/lead` |

## 2. 证据等级

| 等级 | 含义 | 示例 |
|---|---|---|
| L1 | 静态/单元 | 函数、schema、状态迁移、gate 逻辑 |
| L2 | 集成 | 真实 `specify init`、命令/模板存在、doctor |
| L3 | 真实项目 | 一个 greenfield MVP 走完四道门 |
| L4 | 复现/回归 | 新会话从 handoff 恢复并继续 |

v0.1.0 达到 L1 + L2 + toy L3；真实项目 L3/L4 需要在使用中积累。

## 3. 真实项目指标

从 `.sdd/metrics/events.jsonl` 和状态计算：

- 门禁失败次数/门禁通过次数。
- 任务返工率（review → in_progress）。
- scope 越界次数。
- 证据失败率（exit != 0）。
- 任务平均周期。
- handoff 恢复后是否需要人工纠偏。
- token 成本（如可采集）。

这些指标不追求“越低越好”；重点是从失败模式改进团队提示词、门禁和 CLI。

## 4. 反假绿

评测时必须检查：

- gate 通过是否真的检查了证据，而不是只看计划。
- `tasks.md` 勾选是否被误当完成。
- verifier 是否用了新上下文、是否独立复跑。
- 证据是否来自当前 commit、日志是否存在。
- scope 检查是否只看 union，忽略实际 diff。
- 升级是否覆盖了 `.sdd/state.json`、`config.yml`、spec 产物。

## 5. 什么会证伪团队

- 干净项目 `sdd init` 失败，或 doctor 通过但缺少命令/模板。
- 没有证据/评审仍能过 final gate。
- verifier 可以修改源码或任务状态。
- 升级覆盖本地状态或 spec 产物。
- handoff 恢复后必须重读旧聊天。
- spec-kit 升级后团队静默改变行为，而 doctor 不报。

## 6. 运行

```bash
npm test
npm run check
npm run smoke
```

真实安装测试（需要 spec-kit/OpenCode）：

```bash
node scripts/sdd.mjs init C:\Users\you\AppData\Local\Temp\sdd-eval
cd C:\Users\you\AppData\Local\Temp\sdd-eval
node .opencode/sdd/scripts/sdd.mjs doctor
```

然后用 OpenCode 打开项目，跟 `sdd/lead` 走一个最小 greenfield 项目。
