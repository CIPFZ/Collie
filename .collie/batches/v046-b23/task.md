---
schema_version: 1
run_id: r-20261120072700
batch_id: v046-b23
base_sha: a9631d7f1582c104075481f46d4bc702bbc437b4
created_at: 2026-11-20T07:27:00.885Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b23：模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.18 的「模型接口出错的会话算可续跑的中断」一段（中断后自动重跑见 13.14）。`src/runner/claude.ts` 与 `src/runner/index.ts`：读结果消息里的 `terminal_reason`；`RunResult.stopReason` 的取值加 `api_error`，
   先后是 `stopped` > `turns_exhausted` > `api_error` > `error`。
   **结果消息是 `subtype: success`、`is_error: true`、`terminal_reason: api_error`：返回值的 `exitCode` 非零、`stopReason` 是 `api_error`；同样的消息、会话是被中止的：`stopped`；出错而没有 `terminal_reason` 的消息：仍是 `error`**
2. `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`：`[limits]` 加可选的 `api_retry_wait_secs`（非负整数，缺省 300，写法照 `tester_max`；模板写 `api_retry_wait_secs = 300` 带一行注释）。本仓库的 `.collie/collie.toml` 不许动。
   队列里 `api_error` 与 `idling`、`stalled`、`wallclock` 一样算中断，共用每个批次每次队列一次的自动续跑；只有 `api_error` 在续跑之前先等 `api_retry_wait_secs`，`batch.retried` 多带 `waited_secs`。
   等待经可注入的函数做：`QueueContext` 加可选的 `retryDelay(ms)`（缺省真实等待），`src/cli.ts` 只做转发。v046-b22 的收尾仍在所有自动重跑的判断之后。
   **队列里 worker 第 1 次以 `api_error` 结束、没有 report：注入的等待函数收到 300000，然后自动重跑一次，`batch.retried` 是 `cause: interrupted`、`stop_reason: api_error`、`waited_secs: 300`；重跑 PASS：队列继续，退出码 0**
   **重跑又以 `api_error` 结束：不再重跑，队列以 `blocked` 结束，退出码 20；第 1 次是 `idling` 的重跑不等，等待函数没有被调用**
3. 测试。`test/runner-claude.test.ts` 新加一组 `describe('runner: api_error stop reason', …)`（条目 1 的三种情形）；新文件 `test/api-error-retry.test.ts`，一组 `describe('queue: api_error counts as a resumable interruption', …)`（条目 2 的情形；假 worker 的返回值直接给 `stopReason: 'api_error'`）。
   允许改写的旧用例只有：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `api_retry_wait_secs: 300`）与内联配置 `VALID_TOML`（跟着模板加一行）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这一项）。在「偏离或疑问」里列出。
   R1 查过：`test/runner-claude.test.ts` 现有 6 处断言 `stopReason` 是 `error` 的用例，夹具都不带 `terminal_reason`，不受影响；`test/scenario-n.test.ts` 的 `worker crash → no interrupt retry` 里 worker 是抛错，结束原因是 `error`，仍然不重跑；
   全部测试里现在没有一处用到 `terminal_reason` 或 `api_error`。测试要注入等待函数而 `test/support/sandbox.ts` 传不过去时，可以给它加转发，在「偏离或疑问」里写明。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `api_error`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器、队列、配置的测试通过 | `npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "runner: api_error stop reason" test/runner-claude.test.ts && grep -qF "queue: api_error counts as a resumable interruption" test/api-error-retry.test.ts` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^api_retry_wait_secs = 300" templates/collie.toml && ! grep -qF "api_retry_wait_secs" .collie/collie.toml` | exit 0 |
| 运行器与队列都认得 api_error（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/runner/claude.ts \| grep -qF "api_error" && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "api_error"` | exit 0 |
| 不变量同步 | `grep -qF "api_error" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/ladder.ts`、`src/view.ts`；改动任何一条规则的判定、`fix_max` 的计数
- 让一个批次在一次队列里被自动续跑超过一次；让测试 agent 或 reviewer 的会话也走这条续跑；在测试里真的等待
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b23/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b23` 为提交信息单独提交并推送该文件。
