# 快速开始

## 1. 安装团队源仓库

```bash
cd D:/Development/riccon-agents-sdd
npm install
npm test
```

可选：把 `sdd` 放到 PATH：

```bash
npm link
sdd version
```

不 link 也可以，用 `node scripts/sdd.mjs`。

## 2. 初始化目标项目

```bash
node scripts/sdd.mjs init D:/Projects/my-app
```

或者进入空项目目录：

```bash
node D:/Development/riccon-agents-sdd/scripts/sdd.mjs init .
```

安装器会初始化 git、spec-kit（opencode 集成）、git/assess/bug 扩展，安装团队 agents/commands/skills/runtime，写 `AGENTS.md`、`.sdd/`、`opencode.json` 的 `default_agent: "sdd/lead"`，然后跑 `doctor`。

## 3. 打开项目

用 OpenCode 打开目标项目。默认 agent 是 `sdd/lead`；你不需要手动选其他 agent。

第一句话可以是：

```text
我想做一个 <一句话产品想法>。先帮我判断范围，必要时用 grilling 追问我。
```

lead 会：

1. 读 `.sdd/state.json`、`AGENTS.md`、最近 handoff；
2. 跑 `sdd status` / `sdd doctor`；
3. 进入 kickoff：问目标用户、问题、MVC、non-goals、成功指标、技术约束；
4. 起草 `.sdd/brief.md`、`AGENTS.md` 合同、constitution；
5. 创建 `DEC-*`（gate=kickoff）让你批准。

## 4. 四道门

你会在四个时点被要求批准：

1. **kickoff**：范围/技术栈/DoD。
2. **spec**：用户故事与验收标准。
3. **plan**：架构、数据模型、契约。
4. **tasks**：任务、scope、执行顺序。

最终还有一个 **final** 验收。每次批准都会写到 `.sdd/decisions/`；lead 不会自批。

## 5. 实现阶段

- lead 一次派一个任务给 `sdd/builder`。
- builder 只改 `write_scope`，提交后跑 `sdd evidence run`。
- lead 检查 scope，按风险派 `sdd/verifier`。
- 高风险任务和每个用户故事/里程碑必须独立评审。
- 任务 done 后，lead 更新 `.sdd/tasks` 和 `tasks.md`。

你可以随时问：

```text
现在到哪了？下一步是什么？
```

或使用 `/sdd-status`。

## 6. 中断与恢复

会话中断后，新会话直接说：

```text
继续
```

或 `/sdd-resume`。lead 会读 `.sdd/` + 最近 handoff，不依赖旧聊天。

## 7. 验收后

- 新功能：开新 spec；旧 spec 保留。
- 真实缺陷：使用 `bug` 扩展的 assess → fix → test。
- 复盘：`/sdd-improve`，把团队级问题写成提案。

## 8. 升级

在团队源仓库：

```bash
node scripts/sdd.mjs upgrade --project D:/Projects/my-app --dry-run
node scripts/sdd.mjs upgrade --project D:/Projects/my-app --write
```

需要 spec-kit 侧升级时，先征得你同意，再加 `--spec-kit`。

## 9. 常见问题

**`sdd doctor` 说 spec-kit 不兼容**

- 确认 `specify version --json` 在 `>=1.4.5 <2.0`。
- 2.0 需要升级团队。
- 缺命令/模板/脚本时，运行 `specify integration upgrade opencode` 或重装扩展。

**默认 agent 不是 `sdd/lead`**

- 检查 `opencode.json` 的 `default_agent`。
- 初始化时用了 `--no-default-agent` 的话，手动加：
  ```json
  { "default_agent": "sdd/lead" }
  ```

**`sdd upgrade` 被拒绝**

- 目标项目里的 runtime 不允许自己升级；用团队源仓库的 CLI + `--project`。

**任务无法进入 in_progress**

- 检查 `write_scope`、`owner`、`baseline_commit`；仓库至少要有一次 commit。

**证据被拒绝**

- 先提交源码；`.sdd/` 自身变化不算 dirty。
- 不要用 `--allow-dirty` 掩盖未提交代码。
