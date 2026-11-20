---
schema_version: 1
run_id: r-20261120041144
batch_id: v046-b19
base_sha: 228d28f0629b588828712701291d6cabd0ec6899
created_at: 2026-11-20T04:11:45.449Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b19：接线收尾三：why 与 report 显示测试 agent 的花费

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.16 的「v046-b19」一段的第一条（第二条已由 R1 做完，见 16.17）。`src/view.ts`：`why <run_id>` 与 `report`（队列汇报）读本批次 journal 里的 `tester.started` / `tester.finished`，
   把测试 agent 的轮数、花费、用时显示出来，和 worker、reviewer 并列；一次运行里测试 agent 拉起多次时合计；没有 `tester.*` 事件的运行，不显示这一栏（输出和现在逐字节相同）。
   **一个有 `tester.finished`（带 `num_turns`、`cost_usd`、`duration_ms`）的运行：`why` 的输出里有测试 agent 的轮数与花费，`report` 那一行的合计花费把它算进去；一个没有 `tester.*` 的运行：`why` 与 `report` 的输出和现在逐字节相同**
2. `test/why.test.ts`、`test/report.test.ts`：条目 1 加粗的两种情形各加用例（有测试 agent；拉起两次时合计；无测试 agent 逐字不变）。
   R1 查过：这两个文件现有的用例里没有一条用到 `tester.*` 事件，所以「无测试 agent 逐字不变」成立时现有断言都不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| why 与 report 的测试通过 | `npm test -- test/why.test.ts test/report.test.ts` | exit 0 |
| 视图读了测试 agent 的事件，两份测试都覆盖到 | `grep -qF "tester.finished" src/view.ts && grep -qF "tester.finished" test/why.test.ts && grep -qF "tester.finished" test/report.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-*.md`、`.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/runner/`；改任何判定
- 改变没有测试 agent 的运行的 `why` / `report` 输出哪怕一个字节
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b19/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b19` 为提交信息单独提交并推送该文件。
