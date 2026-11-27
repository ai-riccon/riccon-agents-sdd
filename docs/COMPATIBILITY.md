# spec-kit 兼容

## 1. 兼容范围

`compat/speckit-1.x.json`：

```json
{
  "range": ">=1.4.5 <2.0",
  "tested_versions": ["1.4.5"],
  "required_commands": [...],
  "required_templates": [...],
  "required_scripts": [...],
  "required_extensions": ["git", "assess", "bug"]
}
```

- 1.4.5 是当前测试版本。
- 1.x 其他版本在范围内可以跑，但 doctor 会提示“未列入已测试版本”。
- 2.0 必须升级团队；不保证向后兼容。

## 2. 依赖的 spec-kit 面

### 命令

九个核心命令：

```text
speckit.constitution
speckit.specify
speckit.clarify
speckit.plan
speckit.checklist
speckit.tasks
speckit.analyze
speckit.implement
speckit.converge
```

扩展命令：`speckit.git.*`、`speckit.assess.*`、`speckit.bug.*`。

### 模板

```text
spec-template.md
plan-template.md
tasks-template.md
checklist-template.md
constitution-template.md
```

### 脚本

```text
common
create-new-feature
setup-plan
setup-tasks
check-prerequisites
resolve-template
```

Windows 用 `.specify/scripts/powershell/*.ps1`，macOS/Linux 用 `bash/*.sh`，也可用 `python/*.py`。

### 扩展

- `git`：`before_specify` 建分支；auto-commit 关闭。
- `assess`：可选产品发现。
- `bug`：MVP 后真实缺陷。

## 3. 运行时检查

`sdd doctor` / `sdd compat check`：

1. `specify version --json` → CLI 版本。
2. `.specify/init-options.json` → integration 必须是 opencode，读取 script 变体。
3. 必需命令文件存在于 `.opencode/commands/`。
4. 必需模板存在于 `.specify/templates/`。
5. 必需脚本存在于 `.specify/scripts/<variant>/`。
6. 必需扩展存在于 `.specify/extensions/`。

失败时给出明确修复指令；不会静默降级。

## 4. 关键事实

- 当前 feature 由 `.specify/feature.json` 跟踪，不是 git 分支。
- `/speckit.implement` 默认单 agent 顺序写任务；Riccon SDD 不端到端执行，lead 按任务派 builder。
- `converge` 只追加 tasks.md 的 Convergence 段，不改代码。
- `analyze` 只读，不写文件。
- `checklist` 是 reviewer-owned；`[x]` 表示需求质量检查通过，不是实现完成。
- `implement` 会检查 checklists；未勾选会停下来问。
- opencode 集成默认支持事件插件；`sdd init` 用 `--integration-options "--events false"` 关闭。

## 5. 升级 spec-kit

```bash
specify self upgrade                  # CLI 本体
specify integration upgrade opencode  # 项目命令/模板
specify extension update <id>         # 扩展
```

团队侧：

```bash
node scripts/sdd.mjs upgrade --project <dir> --write --spec-kit
```

顺序建议：

1. 先 dry-run，记录当前版本。
2. 升级 spec-kit CLI。
3. 升级项目集成/扩展。
4. 跑 `sdd doctor`、项目测试、toy 流程。
5. 如果 2.0，先升级团队 compat。

## 6. 更新兼容清单

1. 用真实 `specify init` 项目验证新版本。
2. 更新 `compat/speckit-1.x.json` 的 `range`、`tested_versions`、必需项。
3. 更新 `docs/COMPATIBILITY.md`。
4. 跑 `npm test` / `npm run check`。
5. 发团队小版本。
