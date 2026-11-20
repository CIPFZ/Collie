---
schema_version: 1
run_id: r-20261120061618
batch_id: v046-b21
base_sha: 274c579d4ded64966c1e88951acbbfa37b819dd1
created_at: 2026-11-20T06:24:34.848Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b21：没有测试 agent 的运行，why 与 report 的 JSON 里不出现测试 agent 的键（第一个带情形的批次）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.18 的「第一个带情形的批次」一段与 14.31 里「判 PASS 之后才查出来的三处」的第 1 条。`src/view.ts`：一次运行（或一个批次）的 journal 里没有 `tester.finished` 事件时，
   `projectWhy` 的 attempt 对象不带 `tester` 键、它的 `cost` 不带 `tester` 键，`projectReport` 的行不带 `testerCost` 键（类型上改成可选；不要输出值为 `null` 或 `undefined` 的占位）。
   有 `tester.finished` 时这三处与现在相同。`formatWhy`、`formatReport` 的文字输出一个字节都不变。
2. 现有用例里断言这三处是 `null` 的两条，改成断言键不存在。这是点名允许的改写，在「偏离或疑问」里列出原断言与现断言：
   `test/why.test.ts` 的 `no tester events: output identical to run without tester (tester field null)`（`a.tester` 与 `a.cost.tester` 两行；用例名里的 `tester field null` 相应改掉）；
   `test/report.test.ts` 的 `no tester events: output byte-identical (no tester column)`（`row.testerCost` 一行）。
   R1 查过：全部测试里断言这三个键为 `null` 的只有这三行；没有用例对 `cost` 或整行做整体的 `toEqual`。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 一次运行的 journal 里没有任何 `tester.` 开头的事件：`projectWhy` 得到的那个 attempt 对象没有 `tester` 这个键，它的 `cost` 对象也没有 `tester` 这个键；整个结果 `JSON.stringify` 之后不出现 `"tester":`
- S2 [新] 一个队列里每个批次的 journal 都没有任何 `tester.` 开头的事件：`projectReport` 得到的每一行 `batchRows` 都没有 `testerCost` 这个键；整个结果 `JSON.stringify` 之后不出现 `"testerCost":`
- K1 [保持] 一次运行的 journal 里有一条 `tester.finished`（`num_turns` 21、`cost_usd` 0.29、`duration_ms` 123000）：那个 attempt 的 `tester` 是 `turns` 21、`costUsd` 0.29、`durationMs` 123000、`invocations` 1，`cost.tester` 是 0.29；`formatWhy` 的文字里有以 `tester:` 开头的一行
- K2 [保持] 队列里一个批次的 journal 有一条 `tester.finished`（`cost_usd` 0.29）：`projectReport` 那一行的 `testerCost` 是 0.29；`formatReport` 的文字里有「tester 花费」这一列
- K3 [保持] 没有任何 `tester.` 开头事件的运行与队列：`formatWhy` 的文字里没有以 `tester:` 开头的行，`formatReport` 的文字里没有「tester 花费」

## 本批次接口

- `src/view.ts` 已有的导出，签名都不变：`loadRuns(root)`、`projectWhy(runDataList, batchId, filterAttempt?)`、`formatWhy(proj)`、`projectReport(allRunData, queueEvents, queueRunId)`、`formatReport(proj, whyTexts, showQueueText, queueRemainingText)`
- 类型 `RunData` 在 `src/view.ts`，`Event` 在 `src/schema/index.ts`；journal 是 `.collie/runs/<run_id>/events.ndjson`，一行一个事件

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b21` | exit 0 |

`test/acceptance/v046-b21/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/view.ts` 之外的 `src/` 文件；改变 `formatWhy`、`formatReport` 的文字输出；改变有测试 agent 时的 JSON
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b21/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b21` 为提交信息单独提交并推送该文件。
