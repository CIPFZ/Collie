---
schema_version: 1
run_id: r-20261022-102856
batch_id: v02-b04-fix3
base_sha: b6a141a301e8348064ca648b2440778bc48c2f41
created_at: 2026-10-22T10:28:56.451Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b04-fix3：worker_pid、包装层 interrupt、原子心跳

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `ClaudeRunner` 提供 `worker_pid`（11.2）：通过 SDK 的 `spawnClaudeCodeProcess` 钩子用 `node:child_process.spawn`
   自行拉起并记下 `pid`，`RunHandle.pid` 返回它；`kill` 级对该 pid 发 `SIGKILL`。
   `test/runner-claude.test.ts` 断言注入 `query()` 收到的选项含该钩子，且钩子返回对象的 `pid` 流到 `RunHandle`。
   fix2 的 env 去密钥在这条路径上同样生效（spawn 时的 env 也要删）
2. `claude.ts` 惰性包装层的 `interrupt()`：SDK 对象已就绪但没有 `interrupt` 时必须抛错，不得静默返回；
   SDK 尚未就绪时的调用仍可忽略但要记一条 stderr 日志。`test/runner-claude.test.ts` 加「就绪但无 interrupt → 抛错」用例
3. `heartbeat.ts` 三处 `writeFileSync` 改为写临时文件再 `renameSync`（原子）；
   `test/heartbeat.test.ts` 加「文件为空 / 半截 JSON」两个用例，断言按 SPEC 11.3 处理且不抛出。
   顺带：`evidence.ts` 的 `token_file` 相对路径改为相对仓库根（SPEC 3.1），加一条测试。
   以上三条的结构检查同步加进 `test/invariants.test.ts`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 心跳原子写 | `grep -qE "renameSync" src/heartbeat.ts && ! grep -qE "writeFileSync\(path," src/heartbeat.ts` | exit 0 |
| 包装层 interrupt 缺失抛错有测试 | `grep -ciE "no interrupt\|without interrupt\|missing interrupt" test/runner-claude.test.ts \| grep -qvE "^0$"` | exit 0 |
| pid 经钩子流到 RunHandle | `grep -qE "spawnClaudeCodeProcess" src/runner/claude.ts && grep -qE "spawnClaudeCodeProcess" test/runner-claude.test.ts` | exit 0 |
| 不变量已扩充 | `grep -qE "renameSync\|spawnClaudeCodeProcess" test/invariants.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|spawnClaudeCodeProcess" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 条目 1 不得改变 soft / hard 的现有实现（`interrupt()` / abort）

## 汇报要求

完成后写 `.collie/batches/v02-b04-fix3/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b04-fix3` 为提交信息单独提交并推送该文件。
