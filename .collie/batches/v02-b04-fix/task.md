---
schema_version: 1
run_id: r-20261022-025901
batch_id: v02-b04-fix
base_sha: 08729f3fb5135f5ab4dfd212fb30cd1bb72d8f5d
created_at: 2026-10-22T02:59:01.679Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b04-fix：指纹注入、限流不等待、worker_pid

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `LivenessMonitor` 的产出指纹函数可注入（11.5）：`LivenessConfig.fingerprint?: () => Promise<string>`，
   默认实现才调 git。`test/scenario-g.test.ts` 注入同步返回的假指纹，fake worker 发事件、推进假时钟、
   改变假指纹三者全部由测试代码顺序控制，不依赖任何真实子进程或事件循环时序。
   `test/ladder.test.ts` 同样处理
2. `ci.ts` 实现 SPEC 3.1 的「限流不等待」：环境无 `GITHUB_TOKEN` 且首次轮询即 `rate_limited` 时，
   立即返回 unknown、记 `ci.wait_timeout`（`waited_secs: 0`、`last_state: rate_limited`），不再等 `ci_wait_secs`。
   有 token 时行为不变。测试用注入的 fetch 替身覆盖两种情况
3. `ClaudeRunner` 提供 `worker_pid`（11.2）：通过 SDK 的 `spawnClaudeCodeProcess` 钩子用 `node:child_process.spawn`
   自行拉起并记下 `pid`，`RunHandle.pid` 返回它；`kill` 级对该 pid 发 `SIGKILL`。
   `test/runner-claude.test.ts` 断言注入 `query()` 收到的选项含该钩子，且钩子返回对象的 `pid` 流到 `RunHandle`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 连跑 5 次 | `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts \|\| exit 1; done` | exit 0 |
| 指纹已注入 | `grep -qE "fingerprint" test/scenario-g.test.ts && grep -qE "fingerprint\?:" src/ladder.ts` | exit 0 |
| 限流不等待有测试 | `grep -qE "rate_limited" test/ci.test.ts && grep -qE "waited_secs: 0\|waitedMs: 0" test/ci.test.ts` | exit 0 |
| pid 经钩子流到 RunHandle | `grep -qE "spawnClaudeCodeProcess" src/runner/claude.ts && grep -qE "spawnClaudeCodeProcess" test/runner-claude.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|spawnClaudeCodeProcess" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 条目 3 不得改变 soft / hard 的现有实现（`interrupt()` / abort）

## 汇报要求

完成后写 `.collie/batches/v02-b04-fix/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b04-fix` 为提交信息单独提交并推送该文件。
