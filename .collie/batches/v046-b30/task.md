---
schema_version: 1
run_id: r-20261121120444
batch_id: v046-b30
base_sha: c2e4ba56c70386d9656b10b95a38208f255f71db
created_at: 2026-11-21T12:04:44.821Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b30：小修：rule9_same_head 只看这一次的 head_sha；api_error 续跑总带 waited_secs

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.21 的「v046-b30」一段与 14.35「查出来的两处」。`src/run.ts` 队列里 `rule9_same_head` 的判断：现在是「本批次历史上有某个 `head_sha` 被规则 9 降级过两次」，改成只看这一次——
   这一次运行的 `ci.resolved` 的 `head_sha`，等于本批次此前别的运行里被规则 9 降级那一次的 `head_sha`，才上报；`escalated` 的 `head_sha` 写这一次的。
   **一个批次在第一次队列里两次被规则 9 降级、`head_sha` 都是 A，以 `rule9_same_head` 停下。把 backlog 里它的状态格改回 pending 并提交，再跑一次队列：worker 这一次有新的代码提交（`head_sha` 是 B），CI 仍失败、被规则 9 降级 → 照常自动重跑，不上报；**
   **重跑时 worker 没有新提交、仍被规则 9 降级 → 以 `rule9_same_head` 停下，`escalated` 的 `head_sha` 是 B**
2. `src/run.ts`：`api_error` 的自动续跑，`batch.retried` 总带 `waited_secs`（`api_retry_wait_secs = 0` 时是 0）；别的中断原因仍不带这个字段。
   **沙箱配置里 `api_retry_wait_secs = 0`，worker 第 1 次以 `api_error` 结束：`batch.retried` 带 `waited_secs: 0`，然后照常重跑一次**
3. 测试。`test/rule9-same-head.test.ts` 加一条 `second queue with a new head_sha is retried, then escalates on its own repeat`（条目 1 的情形）；
   `test/api-error-retry.test.ts` 加一条 `api_error with api_retry_wait_secs = 0 still records waited_secs: 0`（条目 2 的情形）。
   R1 查过：`test/rule9-same-head.test.ts` 现有 3 条都在同一次队列里，结果不变；`test/api-error-retry.test.ts` 的 `idling first → retry does NOT wait, retryDelay never called` 断言 `idling` 的续跑不带 `waited_secs`，仍然成立。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时两个文件的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts test/api-error-retry.test.ts` | exit 0 |
| 两条新用例在 | `grep -qF "second queue with a new head_sha is retried, then escalates on its own repeat" test/rule9-same-head.test.ts && grep -qF "api_error with api_retry_wait_secs = 0 still records waited_secs: 0" test/api-error-retry.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/` 下 `src/run.ts` 以外的文件；改动任何一条仲裁规则的判定、`fix_max` 的计数、`rule9_twice` 的判断、收尾（`batchCleanup`）
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；测试里真的等待；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b30/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b30` 为提交信息单独提交并推送该文件。
