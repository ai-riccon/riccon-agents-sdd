# 权限

## 1. 模型

权限定义在 `templates/agents/permissions.yml`，由 `scripts/sync-agents.mjs` 写入各 agent frontmatter 的 `permissions` 数组。`sdd doctor` 检查漂移。

规则字段：

```yaml
- action: read|edit|shell|external_directory|skill|webfetch|websearch|subagent|question
  resource: "*" | "路径/glob"
  effect: allow|ask|deny
```

OpenCode 以**最后匹配**为准；所以顺序是：

```text
base → subagents（非 lead）→ 角色特定
```

## 2. 共享基线

- 读/写/执行：默认 allow，项目内自由工作。
- 敏感读取 ask：`.env`、`.env.*`、`**/.env*`、`**/*.pem`、`**/*.key`、`**/id_rsa*`、`**/id_ed25519*`。
- 敏感编辑 ask：`AGENTS.md`、`.opencode/**`、`.git/**`、`.env*`、`*.pem`、`*.key`。
- 外部目录 ask。
- skill/webfetch/websearch allow。
- 破坏性 shell ask：`rm`、`rmdir`、`git reset --hard`、`git clean`、`git push/rebase/filter`、`git restore`、`git checkout --`、`git branch -D`、`git tag -d`、`docker prune/rm/push`、`kubectl delete`、`helm uninstall`、`terraform destroy/apply`、`npm publish`、`npm install -g`、`chmod -R`、`chown -R`、`dd`、`mkfs`、`shutdown/reboot`、`sudo`。
- `sdd decision answer`、`sdd upgrade --write` ask，确保用户看到。

## 3. 角色差异

| 角色 | 额外规则 |
|---|---|
| `lead` | `subagent *` deny → `subagent sdd/*` allow；`question *` allow |
| 所有子代理 | `subagent *` deny；`question *` deny |
| `product` | 禁止编辑 `.sdd/state.json`、`tasks/**`、`decisions/**`、`.sdd/reviews/**`、`handoffs/**`、`AGENTS.md`、`.opencode/**` |
| `architect` | 同上 |
| `builder` | 同上；另禁 `.sdd/handoffs/**`、`.specify/**` |
| `verifier` | 禁止 state/tasks/decisions/handoffs/AGENTS.md/.opencode/.specify；保留 `.sdd/reviews/**` 写权；`git commit*` ask |
| `ops` | 禁止编辑 state/tasks/decisions/reviews/handoffs/AGENTS.md/.opencode；不写功能代码 |

子代理的 shell 写操作额外 ask：`*task*new*`、`*task*update*`、`*task*sync*`、`*review*new*`、`*gate*check*`、`*decision*new*`、`*decision*answer*`、`*handoff*new*`、`*retro*new*`。verifier 的 `review new` 单独 allow（这是它的职责）。

`.sdd/evidence/**` 对所有角色 edit deny：证据只能由 `sdd evidence run` 生成，不能手改。

静态权限只表达“不能写团队状态/配置”；**任务级 `write_scope` 是提示词 + lead diff 检查**，不是静态权限能完全表达的。

## 4. 边界

- 只有 lead 能 spawn、能问用户。
- 子代理的问题回流给 lead，不允许直接打断用户。
- builder 不能标 done；verifier 不能修源码；product/architect 不能写 spec/plan/tasks。
- 生产发布、花钱、破坏性操作必须用户明确批准。
- 权限模式不是安全边界；真正隔离需要沙箱/一次性运行时。
- CLI 不校验调用者身份。子代理仍可通过 shell 执行任意 `node` 命令绕过 edit deny；ask 规则是误操作防线，不是恶意隔离。生产环境请用沙箱/受限 runner。

## 5. 秘密

- 不要把密钥写进仓库、状态、日志、任务卡、证据、提示词、handoff。
- 证据日志会提交到仓库；运行前确认输出不含密钥。
- `.env` 读取/编辑是 ask；不要让 builder 把 `.env` 内容贴进 receipt。

## 6. 修改权限

1. 改 `templates/agents/permissions.yml`。
2. `npm run sync:agents`。
3. `npm run check`。
4. 在 `docs/PERMISSIONS.md` 更新矩阵。
5. 在真实项目跑 `sdd doctor` 和一次 toy 流程。

不要手改 6 份 agent 的 `permissions`；doctor 会报漂移。
