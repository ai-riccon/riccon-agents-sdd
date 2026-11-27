# 升级

## 1. 两个升级面

| 面 | 命令 | 说明 |
|---|---|---|
| 团队文件 | `sdd upgrade --project <dir> --dry-run/--write --yes` | 在团队源仓库运行 |
| spec-kit 项目文件 | `specify integration upgrade opencode`、`specify extension update <id>` | 由 `--spec-kit` 触发，需用户同意 |
| spec-kit CLI 本体 | `specify self upgrade` | 用户决定，团队不自动执行 |

不要混在一起：`sdd upgrade` 只改团队管理的文件；`--spec-kit` 才执行 spec-kit 侧升级。

## 2. Manifest

`.sdd/manifest.json`：

```json
{
  "schema_version": 1,
  "team_version": "0.1.3",
  "installed_at": "...",
  "speckit_version": "1.4.5",
  "compat_range": ">=1.4.5 <2.0",
  "files": [{ "path": ".opencode/agents/sdd/lead.md", "sha256": "...", "managed": true }]
}
```

管理范围：

- `.opencode/agents/sdd/**`
- `.opencode/commands/sdd-*.md`
- `.opencode/skills/sdd-*/**`
- `.opencode/sdd/**`（runtime、templates、schemas、compat）
- `node_modules/yaml`（vendored）

不管理：

- `.sdd/state.json`、`config.yml`、`brief.md`
- `.sdd/tasks/**`、`decisions/**`、`evidence/**`、`reviews/**`、`handoffs/**`、`retro/**`
- `AGENTS.md` 项目合同正文（只管理 `sdd:team` 块）
- `opencode.json`（只合并 `default_agent`）
- `specs/**`（spec-kit 产物永不覆盖）

## 3. 升级流程

```bash
# 在团队源仓库
node scripts/sdd.mjs upgrade --project /path/to/project --dry-run
```

看四类结果：

- `+` 新增
- `~` 更新（目标文件未被本地修改）
- `-` 删除（源仓库已移除）
- `!` 本地修改（目标 hash 与 manifest 记录不一致，默认跳过）

确认后：

```bash
node scripts/sdd.mjs upgrade --project /path/to/project --write --yes
```

- 自动备份到 `.sdd/backup/upgrade-<时间>/`，包含旧 `.sdd/manifest.json`。
- 本地修改默认跳过；确认覆盖才 `--force`。
- 如果 manifest 缺失或损坏，默认拒绝写入；`--force` 会全量备份后重装。
- 升级后重建 manifest。
- 运行 `sdd doctor` 和项目测试。

需要 spec-kit 侧升级：

```bash
node scripts/sdd.mjs upgrade --project /path/to/project --write --yes --spec-kit
```

会执行 `specify integration upgrade opencode` 和已安装扩展的 `specify extension update`。先 dry-run，再征得用户同意。

## 4. 冲突处理

- 优先手工合并，不要直接 `--force`。
- 如果本地修改是有意的项目定制，考虑把它变成团队提案（`/sdd-improve`），而不是长期漂移。
- 如果升级后 doctor 失败，从 `.sdd/backup/upgrade-<时间>/` 恢复，再排查。

## 5. 回滚

备份目录保留原始文件结构；手工复制回去即可。没有自动 `rollback` 命令（v1）。

## 6. 团队自我改进

- 每个里程碑/项目写 `.sdd/retro/RETRO-*.md`。
- `/sdd-improve` 读取 metrics、retro、reviews、decisions，向源仓库 `docs/proposals/` 写提案。
- 提案包含：问题与证据、影响范围、建议改动、验证方式、风险与回滚。
- 人工审阅后合入源仓库；不自动修改已安装团队文件。

## 7. 版本

- `scripts/lib/version.mjs` 的 `TEAM_VERSION` 是源。
- 同步 `package.json`、`README.md`、`CHANGELOG.md`。
- 发版打 annotated tag `vX.Y.Z`。
- 升级目标项目时，manifest 记录新团队版本。
