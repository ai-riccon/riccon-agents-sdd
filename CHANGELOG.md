# Changelog

## 0.1.0 — 2026-11-27

首个可运行版本。

### 新增

- 6 个 agent：`sdd/lead`、`product`、`architect`、`builder`、`verifier`、`ops`。
- 7 个命令：`/sdd-start`、`/sdd-status`、`/sdd-resume`、`/sdd-review`、`/sdd-decision`、`/sdd-improve`、`/sdd-upgrade`。
- 4 个 skill：`sdd-core`、`sdd-speckit`、`sdd-verify`、`sdd-upgrade`。
- 项目级安装：`sdd init` 安装 agents/commands/skills/runtime，初始化 spec-kit、git、assess/bug 扩展，合并 `default_agent`。
- `.sdd/` 交付账本：project/state/config/brief/manifest、tasks、decisions、evidence、reviews、handoffs、retro、metrics。
- 四道门 + 最终验收：kickoff、spec、plan、tasks、final。
- CLI：init、doctor、status、upgrade、state validate、task new/sync/list/show/update/scope、evidence run/list、gate check、review new/list/show、decision new/answer/list/show、handoff new/list、retro new、metrics、compat check、version。
- 团队升级：manifest/hash、dry-run、备份、本地修改冲突处理、spec-kit 侧升级开关。
- spec-kit 兼容：`>=1.4.5 <2.0`，检查必需命令/模板/脚本/扩展。
- 测试：22 个 `node:test`，覆盖 toy E2E、任务生命周期、证据、scope、升级、兼容、权限同步、schema、review findings；`npm test` / `npm run check` / `npm run smoke`。
- 文档：设计、工作流、状态、权限、模型、升级、兼容、评测。

### 已知限制

- 只支持 greenfield；`sdd adopt` 留给 v2。
- v1 串行实现，不支持并行 builder。
- 证据不做日志哈希；reviewer/session 仍是自报。
- 运行时依赖 `yaml`；其它校验为手写。
