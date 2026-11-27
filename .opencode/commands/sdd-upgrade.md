---
description: 检查团队与 spec-kit 版本兼容性，dry-run 升级；只有用户批准后才写。
agent: sdd/lead
---

# /sdd-upgrade

1. 运行 `SDD doctor`、`SDD compat check`。
2. 运行 `SDD upgrade --dry-run`（目标项目用 `--project <目录>`；在源仓库运行）。
3. 向用户报告：
   - 团队版本 vs 项目安装版本
   - spec-kit 版本 vs 兼容范围
   - 将要新增/更新/删除的文件
   - 本地修改冲突
   - 是否需要同时升级 spec-kit 集成/扩展
4. 只有用户明确同意后才运行 `SDD upgrade --write`；有本地修改冲突时先解释，再决定 `--force` 还是手工合并。
5. 需要升级 spec-kit 侧时，单独征得同意后运行 `SDD upgrade --write --spec-kit`，并说明它会执行 `specify integration upgrade opencode` / `specify extension update`。
6. 升级后运行 `SDD doctor` 和 `npm test`（如果项目有测试），报告结果。
7. 不要在未备份/未 dry-run 的情况下直接写。
