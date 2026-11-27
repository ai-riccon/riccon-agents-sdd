# Changelog

## 0.1.2 — 2026-11-27

0.1.1 验证评审的残留硬化。

### 修复

- **R1**：Windows 非 `.exe` 命令改走 PowerShell argv 包装，不再经 `cmd.exe` 拼字符串；空格/引号参数保真，`cmd` 元字符不注入，`%VAR%` 不展开；证据日志用 `formatArgv` 记录。
- **R2**：`scripts/check.mjs` 增校 README/CHANGELOG 版本；新增版本一致性测试。
- **R3**：subagents shell ask 补 `task new`/`task sync`/`retro new`；`.sdd/evidence/**` 对所有角色 edit deny，证据只能由 `sdd evidence run` 生成。
- **R4**：测试增至 63 个，补 handoff、metrics、config、status、speckit、init backup、final scope、版本一致性。
- **R5**：review schema 对非 analyze 强制 `reviewed_commit` 非空/`reviewed_evidence` 非空；`runEvidence` 无 HEAD 直接拒绝；docs/STATE 注明 final 证据绑定当前 HEAD。
- **R6**：usage 补 `--dry-run`/`--yes`；删除死代码 `readEvidenceLog`/`passingEvidence`/`taskStats`/`gateCommand`；超时测试增加耗时断言。

### 测试

- 63 个 `node:test`。

## 0.1.1 — 2026-11-27

安全与门禁加固，修复 0.1.0 全量评审的 P0/P1。

### 修复

- 证据绑定 commit/task/日志目录；dirty、commit 不匹配、日志越界不能 done/final。
- review severity 白名单；缺 commit/evidence 的 final/converge 不通过；findings 结构化。
- 批准语义改为“最新已回答决策”，reject 撤销 approve；已回答决策不能静默重答。
- builder/product/architect/ops 禁止写 `.sdd/reviews/**`；子代理写操作 shell ask。
- ID 白名单、git commit 校验、manifest 路径限定；重复 init 默认拒绝，`--force` 先备份。
- 升级备份包含旧 manifest；manifest 缺失默认拒绝写入。
- `--write` 需要 `--yes`；布尔旗标显式解析；evidence argv 保留引号；超时杀进程树。
- 门禁顺序校验，phase 只前进；final 纳入 scope 检查；风险降级保留 max_risk。
- metrics 补 gate/task 事件；init 写 `.gitattributes`；CI 加 smoke。

### 测试

- 51 个 `node:test`，覆盖 toy E2E、证据绑定、scope、升级/回滚、权限、schema、review findings、路径穿越、批准撤销、门禁顺序、final scope、超时。

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
- 文档：设计、工作流、状态、权限、模型、升级、兼容、评测。
- 测试：22 个 `node:test`，覆盖 toy E2E、任务生命周期、证据、scope、升级、兼容、权限同步、schema、review findings。

### 已知限制

- 只支持 greenfield；`sdd adopt` 留给 v2。
- v1 串行实现，不支持并行 builder。
- 证据不做日志哈希；reviewer/session 仍是自报。
- 运行时依赖 `yaml`；其它校验为手写。
