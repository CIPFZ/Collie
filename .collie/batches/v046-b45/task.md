---
schema_version: 1
run_id: r-20261124132831
batch_id: v046-b45
base_sha: 3e683aba91dccfe6f5ea70d542c0eecf4267deee
created_at: 2026-11-24T13:34:53.769Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b45：why 认得被跳过的 reviewer；重跑任务书的「声称不符」不再渲染成空（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.30 的第二段。`src/view.ts`：一次运行的 journal 里有 `reviewer.skipped` 时，attempt 带 `reviewerSkipped`，`formatWhy` 的 reviewer 一行是 `reviewer: skipped (rule <N>)`；`verdict.downgraded` 事件带 `assumed: true` 时，`downgraded` 带 `assumed`，那一行写成 `verdict.downgraded: PASS (assumed) → <结论>, rule <N>: …`。
   没有这两样的运行，`why`、`report` 的文字与 JSON 一个字节都不变（键不出现，不要输出值为 `null` 或 `false` 的占位）。
2. `src/run.ts` 从上一次运行的 journal 重建「声称不符」的地方：`claimed`、`actual` 不是字符串时用 `JSON.stringify` 渲染成紧凑的 JSON；是字符串时与现在相同。
   R1 查过：`test/why.test.ts`、`test/report.test.ts` 里的运行都没有 `reviewer.skipped`；`test/scenario-a.test.ts`、`test/scenario-d.test.ts` 断言的是 `show` 的输出，不经过 `why`。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 沙箱的全局验收命令里多一条 `sh fail.sh`（以 1 退出），假 worker 如实提交并推送，单批次跑一次（reviewer 被跳过）：对这个批次 `formatWhy(projectWhy(loadRuns(root), 批次号))` 的文字里有一行恰好是 `reviewer: skipped (rule 8)`，没有恰好是 `reviewer: —` 的行
- S2 [新] S1 那一次运行：`formatWhy` 的文字里以 `verdict.downgraded:` 开头的那一行含 `PASS (assumed) → FIX`
- S3 [新] 沙箱默认配置；假 worker 提交的测试里 44 条通过、3 条失败，却声称 47 条通过、0 条失败（搭法照 `test/scenario-b.test.ts`）；单批次跑一次，退出码 10；再跑一次，第 2 次的假 worker 把它拿到的 `task.md` 读出来：`task.md` 里有 `{"passed":47,"failed":0}`，也有 `"failed":3`
- K1 [保持] 沙箱默认配置，假 worker 如实，假 reviewer 判 PASS，单批次跑一次：`formatWhy` 的文字里有以 `reviewer: PASS` 开头的行，没有 `skipped`，没有 `(assumed)`；`JSON.stringify(projectWhy(…))` 里不出现 `reviewerSkipped`，也不出现 `assumed`
- K2 [保持] `renderFixSection` 拿到的 `claimMismatches` 是一项 `field` 为 `head_sha`、`claimed` 为 `abc1234`、`actual` 为 `unresolvable`（都是字符串）：返回的文字里有一行恰好是 ``- head_sha：claimed `abc1234`，actual `unresolvable` ``
- K3 [保持] S3 的第一次运行：退出码 10；journal 里 `claim.mismatch` 事件的 `rule` 是 6、`field` 是 `tests`

## 本批次接口

- `src/view.ts` 已有的导出，签名不变：`loadRuns(root)`、`projectWhy(runDataList, batchId, filterAttempt?)`、`formatWhy(proj)`；`src/run.ts` 已有的导出 `renderFixSection(info: FixInfo)` 与类型 `FixInfo`
- 沙箱与场景用 `test/support/sandbox.ts` 导出的 `Sandbox`、`workerScene`、`fooledReviewerScene`、`honestClaims`、`BATCH`；往全局验收命令里加一条、第 2 次运行里读 `task.md` 的假 worker，都照 `test/acceptance/v046-b35/new.test.ts`
- 本批次起 `projectWhy` 的 attempt 在 reviewer 被跳过时多一个键 `reviewerSkipped`（`rule`、`reason`），它的 `downgraded` 在假定时多一个键 `assumed`（true）；别的时候这两个键都不出现

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含各批次的验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b45` | exit 0 |

`test/acceptance/v046-b45/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径；改动 `src/view.ts`、`src/run.ts` 之外的 `src/` 文件；改任何判定、事件与它们的字段
- 改变没有跳过 reviewer 的运行的 `why` / `report` 输出哪怕一个字节（文字与 JSON 都算）
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b45/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b45` 为提交信息单独提交并推送该文件。
