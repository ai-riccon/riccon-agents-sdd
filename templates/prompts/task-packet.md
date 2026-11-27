# Builder 任务包 — {{TASK_ID}}

## 任务

- 标题：{{TITLE}}
- spec-kit ID：{{SPECKIT_ID}}
- feature：{{FEATURE}}
- phase：{{PHASE}}
- story：{{STORY}}
- 风险：{{RISK}}
- owner：{{OWNER}}

## 写入范围（只能改这些）

{{WRITE_SCOPE}}

## 验收标准

{{ACCEPTANCE}}

## 验证命令

{{VERIFY}}

## 必读

- `specs/{{FEATURE}}/spec.md`
- `specs/{{FEATURE}}/plan.md`
- `specs/{{FEATURE}}/tasks.md` 中本任务段落
- `AGENTS.md` 项目合同
- `.sdd/state.json`（只读）

## 交付

1. 只改 `write_scope` 内文件；不碰 `.sdd/state.json`、`.sdd/tasks/**`、`.sdd/decisions/**`、`AGENTS.md`、`.opencode/**`。
2. 用中文 commit，只提交本任务范围内的文件。
3. 提交后运行验证命令，并用 `sdd evidence run` 记录证据。
4. 返回 receipt：任务、结果、改动文件、验证命令、证据 ID、遗留问题、下一步。
5. 不要自己标 done；lead 会在 verifier 通过后关闭。
