# 模型与 steps

## 1. 单一事实源

`templates/agents/models.yml`：

```yaml
default: inherit
roles:
  lead: inherit
  product: inherit
  architect: inherit
  builder: inherit
  verifier: inherit
  ops: inherit
steps:
  lead: 440
  product: 240
  architect: 400
  builder: 600
  verifier: 400
  ops: 300
```

`scripts/sync-agents.mjs` 把 `model` 和 `steps` 写进 agent frontmatter：

- `inherit` → 删除 `model` 字段，使用当前会话模型。
- 具体值 → 写 `model: provider/model#variant`。
- `steps` 始终写入。

## 2. 默认策略

- 全部继承当前会话模型；换模型不需要改 agent 文件。
- steps 按角色给上限：builder 最多（600），product/ops 较少。
- 项目级 `config.yml` 的 `models` 只用于文档/未来覆盖；当前实际值来自 `models.yml` 同步结果。

## 3. 覆盖

在团队源仓库改 `templates/agents/models.yml`：

```yaml
roles:
  lead: opencode-go/deepseek-v4.1-flash#max
  builder: opencode-go/deepseek-v4.1-flash
```

然后：

```bash
npm run sync:agents
npm run check
```

再发版/升级目标项目。

不要在 agent 正文里写模型名；不要在 6 份 agent 里各写一套。

## 4. 成本

- 记录在 `.sdd/metrics/events.jsonl` 和 `sdd metrics`：任务周期、返工、派发、门禁失败。
- token 使用取决于 OpenCode 会话是否暴露；v1 不强制采集。
- 建议：lead/verifier 用较强模型，builder 可以用较快/便宜模型；但先用 inherit 跑通，再按真实成本调整。

## 5. steps 与上下文

- steps 是上限，不是目标；接近上限时应 handoff。
- 上下文检查点：120K input tokens / 300 of 440 steps / 60 tool calls / 一次自动压缩。
- Architect/Verifier 接近预算时，优先在任务边界拆新 subagent，不要在 review 中途切。
