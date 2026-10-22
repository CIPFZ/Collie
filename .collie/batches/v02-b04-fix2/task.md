---
schema_version: 1
run_id: r-20261022-082259
batch_id: v02-b04-fix2
base_sha: 5f843b800a3e28490a01c3360d23eb396a4b4aa5
created_at: 2026-10-22T08:22:59.816Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b04-fix2：CI 证据与结构回归

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `ci.token_file`（3.1）：`ConfigSchema` 的 `[ci]` 加可选 `token_file`（字符串，`~` 展开为 home）；
   `evidence.ts` 构造 `ciQuery` 时读取文件内容（trim）作为 `token`，文件不存在等同未配置；
   runner 拉起子进程时从 env 删除 `GITHUB_TOKEN` 与 `GH_TOKEN`（fake 与 claude 两个 runner 都要，claude 走 SDK 的 `env` 选项）；
   `.gitignore` 与 `src/cli.ts` 的 `GITIGNORE_ENTRIES` 加 `.collie/github-token`。
   测试：config 解析 `token_file`、`~` 展开；evidence 从临时文件读到 token 并传给注入的 fetch（断言 `Authorization` 头）；
   runner 测试断言传给 `query()` 的 `options.env` 不含这两个键
2. 限流不等待（3.1）：无 token 且首次轮询即 `rate_limited` 时立即返回 unknown、记 `ci.wait_timeout`
   （`waited_secs: 0`、`last_state: rate_limited`），不再等 `ci_wait_secs`；有 token 时行为不变。注入 fetch 替身覆盖两种情况，
   无 token 那条用例的测试名须含 `unauthenticated` 与 `rate limit` 与 `immediately` 三个词
3. 结构回归（3.2）：新建 `test/invariants.test.ts`，把已通过批次的 grep 类结构检查改写为测试，至少包括：
   `.collie/heartbeat.json` 被 gitignore（b02）；`test/scenario-g.test.ts` 与 `test/ladder.test.ts` 无 `setInterval` / `setTimeout(`（b04-tests）；
   `src/runner/claude.ts` 无 `softStopRequested`、无拆出调用的 `interrupt`（b03、b04-fix）；`src/` 除 `src/runner/` 外无 `@anthropic-ai`（b02）；
   `src/ladder.ts` 有 `fingerprint?:`（b04-fix）。
   同时把场景 G 假指纹的 `setTimeout(0)` 去掉：改为同步返回或 `await Promise.resolve()`，检查频率由注入的 `livenessSetTimer` 控制，
   让 b04-tests 那条不变量对 main 重新成立

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 不变量文件存在且含 5 类检查 | `test "$(grep -cE "^\s*it\(" test/invariants.test.ts)" -ge 6` | exit 0 |
| 场景 G 无真实定时器（恢复 b04-tests） | `! grep -qE "setInterval\|setTimeout\(" test/scenario-g.test.ts` | exit 0 |
| token_file 进 schema 与 evidence | `grep -qE "token_file" src/schema/index.ts && grep -qE "token_file" src/evidence.ts` | exit 0 |
| 子进程 env 去密钥有测试 | `grep -qE "GITHUB_TOKEN" test/runner-claude.test.ts && grep -qE "GH_TOKEN" src/runner/claude.ts` | exit 0 |
| token 文件被忽略 | `grep -qE "github-token" .gitignore && grep -qE "github-token" src/cli.ts` | exit 0 |
| 限流不等待有测试 | `grep -qE "unauthenticated.*rate.?limit.*(no wait\|without waiting\|immediately)" test/ci.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（`.gitignore` 不在清单内，本批次允许改）
- 把任何 token 值写进代码、测试或 fixture；测试里用 `fake-token` 字样
- 为了让测试过而删除或跳过任何测试

## 汇报要求

完成后写 `.collie/batches/v02-b04-fix2/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b04-fix2` 为提交信息单独提交并推送该文件。
