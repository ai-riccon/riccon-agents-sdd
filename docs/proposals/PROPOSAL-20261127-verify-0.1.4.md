# PROPOSAL-20261127 — 0.1.4 修复验证评审

- **日期**：2026-11-27
- **类型**：对提交 `f7ae3c8`（"修复权限模板编码并补充 cmd 文档，发布 0.1.4"）的验证评审
- **前序**：full-review → verify-0.1.1（R1–R6）→ verify-0.1.2（N1–N4）→ verify-0.1.3（M1–M2）
- **方法**：字节级核实编码修复 + 逐行复核 check.mjs 编码守卫 + 文档落点 grep；本轮改动小且聚焦，全部亲自核实；未修改任何源文件
- **基线**：`npm test` 70/70、`npm run check`（0.1.4）、`npm run smoke` 全绿
- **严重度**：P0=门禁绕过/数据丢失/安全；P1=功能错误/证据保真；P2=健壮性/合规缺口；P3=小问题

> 路径相对仓库根，行号基于 HEAD `f7ae3c8`。

---

## 总体结论

**0.1.4 完整闭合 M1（编码）与 M2（.cmd 文档），无新问题、无功能回归。** 编码守卫真实有效，硬规则 11 落地。70 个测试含全部 P0 回归仍通过。

**五轮评审至此，原始 6 P0 + 9 P1、R1–R6、N1–N4、M1–M2 全部实质关闭，无活跃门禁绕过、无已知未决缺陷。** 剩余仅已声明设计取舍与维护 agent 自列待办。0.1.4 可接受发布。

---

## 已确认修复（亲自核实）

| 项 | 验证证据 | 判定 |
|---|---|---|
| M1 头部编码 | `templates/agents/permissions.yml` 首字节 `23 20`（"# "，**无 BOM**），干净 3 行中文注释恢复（"权限单一事实源。"等） | ✅ |
| M1 编码守卫 | `scripts/check.mjs:45-67` checkEncoding：扫 .opencode/templates/docs/README/CHANGELOG，拒 UTF-8 BOM（:56-58）、拒替换字符 \uFFFD（:59-61）、权限头 startsWith 专项（:63-66）；`:69` 接入 | ✅ |
| M1 测试 | `tests/encoding.test.mjs:10-25` 真断言全队文本文件无 BOM/无替换字符 + 权限头正则匹配 | ✅ |
| M1 根因规则 | `AGENTS.md` 硬规则 11：禁 PowerShell Set-Content/Out-File 写 UTF-8（5.1 写 BOM/按 ANSI 读致 mojibake），用 write 工具/Node fs，check 拒 BOM/替换字符 | ✅ |
| M2 .cmd 文档 | `README.md:242`、`docs/STATE.md:138`、`docs/COMPATIBILITY.md:65` 均注明 .cmd/.bat 经 PowerShell splatting、元字符不执行、%VAR% 不展开、cmd 层可能剥离引号、优先 .exe；CHANGELOG 声明与事实一致 | ✅ |

### 编码守卫有效性说明

0.1.3 的 mojibake（“鏉冮檺…”）是**合法 CJK 字符**而非 \uFFFD 替换字符，单靠 \uFFFD 检查无法捕获；守卫靠**权限头 startsWith 专项检查**（check.mjs:64）捕获该回归，辅以 BOM 检查。对此类回归有效。

---

## 可选观察（非缺陷，不阻塞）

- **守卫扫描范围**：checkEncoding 覆盖 .opencode/templates/docs/README/CHANGELOG，未含 `scripts/`、`tests/`、`schemas/`。这些以 ASCII 代码为主，中文多为报错串；如要全面防 mojibake 可扩范围。当前覆盖团队定义文件（中文密集区）合理。
- **无 BOM 的 mojibake 检测**：除 permissions.yml 有头专项外，其他文件若被 GBK 误读成合法 CJK（无 BOM、无 \uFFFD），守卫不会发现。属理论局限，实际回归类（BOM/权限头）已覆盖。

## 遗留待办（已声明，非缺陷）

- **设计取舍**：shell `*` allow 旁路 / CLI 无角色身份校验，`docs/PERMISSIONS.md` 明示权限非安全边界。
- **维护 agent 自列**：`nextId` 并发锁、时区配置读取（nowIso 仍硬编码 +08:00）、部分 P3 重复逻辑。

---

## 验收建议

0.1.4 可接受发布，本轮无需再开修复项。五轮评审闭环：

| 轮次 | 提出 | 状态 |
|---|---|---|
| full-review | P0×6 / P1×9 / P2 / P3 | P0/P1 于 0.1.1 关闭 |
| verify-0.1.1 | R1–R6 | 0.1.2 关闭 |
| verify-0.1.2 | N1–N4 | 0.1.3 关闭 |
| verify-0.1.3 | M1–M2 | 0.1.4 关闭 |

除已声明设计取舍与自列待办外，无已知未决缺陷。后续若处理自列待办（nextId 锁/时区/重复逻辑），按硬规则 9 带测试、硬规则 11 注意编码即可。

## 风险与回滚

- 本轮仅改注释/文档/新增守卫与测试，零功能风险。
- 版本变动同步 TEAM_VERSION/package.json/README/CHANGELOG（check.mjs 已强制，含编码守卫）。