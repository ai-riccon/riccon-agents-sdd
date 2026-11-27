# 状态与门禁

## 1. `.sdd/` 布局

```text
.sdd/
├─ project.json
├─ state.json
├─ config.yml
├─ brief.md
├─ manifest.json
├─ tasks/TASK-0001.json
├─ decisions/DEC-0001.md
├─ evidence/TASK-0001/EV-0001.json + EV-0001.log
├─ reviews/REV-*.md、ANALYZE-*.md、CONVERGE-*.md、FINAL-*.md
├─ handoffs/HANDOFF-0001.md
├─ retro/RETRO-0001.md
├─ metrics/events.jsonl
├─ analysis/             product/architect 的分析笔记
└─ backup/               升级/配置备份（gitignored）
```

## 2. project.json

| 字段 | 含义 |
|---|---|
| `schema_version` | 固定 `1` |
| `project_id` | UUID |
| `name` | 项目名 |
| `created_at` | 创建时间（+08:00） |
| `team_version` | 安装时的团队版本 |
| `speckit_version` | 安装时的 spec-kit 版本 |
| `team_source` | 团队源仓库路径（用于 `/sdd-improve` 写提案） |
| `track` | v1 固定 `greenfield` |
| `timezone` | 默认 `Asia/Shanghai` |
| `integration` | 固定 `opencode` |

## 3. state.json

| 字段 | 含义 |
|---|---|
| `phase` | `init → kickoff → specify → plan → tasks → implement → done`，可 `blocked`；`verify`/`accept` 是保留阶段，v1 门禁不自动进入 |
| `gate` | `{name, status, checked_at, message}` |
| `current_feature` | 当前 feature 目录名 |
| `current_story` | 当前用户故事 |
| `active_task` | 当前活动任务 |
| `approvals` | 每道门的 `{status, decision_id, at}` |
| `next` | 下一步可执行动作 |
| `health` | `ok` / `blocked` / `risk` |
| `created_at` / `updated_at` | 时间 |

门禁状态：`pending`、`pass`、`fail`。批准状态：`pending`、`approved`、`rejected`。

## 4. config.yml

```yaml
language: zh-CN
timezone: Asia/Shanghai
models: { default: inherit, lead: inherit, ... }
coverage: { line: 80, branch: 70 }
evidence: { hash: false, max_log_bytes: 2097152 }
handoff: { context_tokens: 120000, steps: 300, tool_calls: 60 }
parallel: { enabled: false, max_builders: 2 }
git: { auto_commit: false, branch_prefix: "feature/" }
speckit: { compat_range: ">=1.4.5 <2.0" }
```

## 5. task

```json
{
  "id": "TASK-0001",
  "speckit_id": "T001",
  "feature": "001-mvp",
  "title": "...",
  "phase": "Phase 1: Setup",
  "story": "US1",
  "parallel": false,
  "risk": "low|medium|high",
  "owner": "sdd/builder",
  "status": "planned|ready|in_progress|review|done|blocked",
  "write_scope": ["src/..."],
  "acceptance": ["..."],
  "verify": ["npm test -- ..."],
  "depends_on": ["TASK-0002"],
  "baseline_commit": "...",
  "end_commit": "...",
  "evidence": ["EV-0001"],
  "review": "REV-TASK-0001-001",
  "speckit_done": false
}
```

生命周期：

```text
planned → ready → in_progress → review → done
   ↑         ↑          ↑           │
   └─────────┴──────────┴───────────┘  (blocked/rework)
```

规则：

- `in_progress` 前必须有 owner、write_scope、baseline_commit。
- `review` 前必须有至少一条证据；记录 end_commit。
- `done` 前必须有证据；高风险任务还必须有独立 review。
- `tasks.md` 的 `[X]` 只是 spec-kit 勾选，不是完成证明。

## 6. evidence

```json
{
  "id": "EV-0001",
  "task": "TASK-0001",
  "agent": "sdd/builder",
  "command": "npm test",
  "cwd": "D:/project",
  "exit_code": 0,
  "started_at": "...",
  "finished_at": "...",
  "duration_ms": 1234,
  "commit": "abc123",
  "dirty": false,
  "gate": null,
  "log_path": ".sdd/evidence/TASK-0001/EV-0001.log",
  "log_bytes": 123,
  "truncated": false,
  "manual": false
}
```

- 只由 `sdd evidence run` 生成；手工证据不能用于 done/final。
- 先提交再取证；`.sdd/` 自身变化不算 dirty，源码未提交才算。
- done/final 要求 `commit` 非空、`dirty=false`、`evidence.task` 匹配、日志位于 `.sdd/evidence/<task>/` 且非空。
- done 证据要求 `commit === task.end_commit`；`gate=final` 证据要求 `commit === 当前 HEAD`。
- `--gate final` 允许对 `done` 任务取最终证据，绑定到最后一个任务。
- 日志上限默认 2 MB，超出截断并标记。
- v1 不做日志哈希；需要时可在 config 打开 `evidence.hash`（未来）。

## 7. review

路径：`.sdd/reviews/<ID>.md`，YAML front matter：

```yaml
id: REV-TASK-0001-001
kind: task|analyze|converge|final|milestone
task: TASK-0001
verdict: pass|fail|clean|converged
independent: true
reviewed_commit: abc123
reviewed_evidence: [EV-0001]
findings: []
```

- `kind=task`：任务评审；高风险任务 done 前必须有 pass；`reviewed_commit` 必须等于任务 end_commit，`reviewed_evidence` 非空。
- `kind=analyze`：tasks 门前必须 pass，且无 CRITICAL/HIGH；analyze 不要求 commit/evidence。
- `kind=converge`：final 前必须 clean/converged；要求 `reviewed_commit` 和 `reviewed_evidence`。
- `kind=final`：final 门前必须 pass；`reviewed_commit` 必须等于当前 HEAD。
- P0/P1 必须 fixed/closed；P2/P3 必须 fixed/closed，或 accepted 且有 owner/due/accepted_reason。
- severity 只接受 P0–P3（含 p0/critical 等归一化别名）；未知 severity 视为不通过。
- 可用 `sdd review new --kind ... --task ... --verdict ...` 创建骨架，再补 findings/正文。

## 8. decision

```yaml
id: DEC-0001
status: open|answered|blocked
owner: user|team
blocking: true
gate: kickoff|spec|plan|tasks|final
question: ...
options: [...]
recommendation: ...
default: ...
deadline: ...
answer: ...
answer_kind: answer|approve|reject|accept|conditional
```

- 门禁批准 = 该门禁**最新一条已回答决策**的 `answer_kind: approve|accept`；后续 reject 会撤销先前 approve。
- 已回答决策默认不能重答；需要显式 `--reopen`。
- lead 不能自批；`sdd decision answer` 的 shell 权限是 ask。

## 9. handoff

front matter：`id`、`session`、`summary`、`next`、`invariants`、`risks`、`first_read`、`phase`、`gate`、`gate_status`。

写 handoff 前：

- 没有 `in_progress` / `review` 任务；
- 没有 open blocking 决策；
- 当前 gate 不是 fail；
- `next` 非空且不是占位词；
- `first_read` 路径存在。

## 10. 门禁检查

`sdd gate check --gate <name>` 会写 `state.gate`，通过时推进 phase：

| 门 | 通过后 phase |
|---|---|
| kickoff | specify |
| spec | plan |
| plan | tasks |
| tasks | implement（并把 planned 任务置 ready） |
| final | done |

失败时 gate=fail，phase 不变；修复后重跑。

## 11. 写权限

| 路径 | 写者 |
|---|---|
| `.sdd/state.json` | lead |
| `.sdd/tasks/**` | lead |
| `.sdd/decisions/**` | lead |
| `.sdd/handoffs/**` | lead |
| `.sdd/evidence/**` | builder / verifier |
| `.sdd/reviews/**` | verifier |
| `.sdd/brief.md` | lead |
| `.sdd/config.yml` | 用户/lead（慎改） |
| `.sdd/retro/**` | lead |
| `.sdd/metrics/**` | CLI |

## 12. 校验

`sdd state validate` 检查：

- 必需文件存在；
- project/state schema 版本；
- phase/gate 合法；
- 任务 ID/状态/引用证据/评审存在；
- 决策/评审有 id；
- 非独立评审产生 warning。
