---
schema_version: 1
run_id: r-20261123144144
batch_id: v046-b38
base_sha: 40bab59047adc7e4e51b59fbc1df687631cf756c
created_at: 2026-11-23T14:41:45.272Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b38：三处上报合成一个函数，推送由 9 处变成 7 处（只重构）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.25 的「三处上报合成一个」一段。`src/run.ts`：三条上报路径**必须**共用同一个函数来做「取提交清单与推送状态、写 progress、改状态格、提交、推送、返回 BLOCK」。
   三处不同的地方作为参数传进去：`escalated` 事件的 `reason` 与附加字段（如 `disputed`）、progress 说明文字的前缀（「上报：无 report — 」「上报：验收测试没有准备好 — 」「上报：worker 认为验收测试有错 — 」）、
   随裁定提交一起提交的附加文件（如 `tester.md`）、取提交清单用的基准（「没有有效汇报」那条路径上可以没有）。
   各条路径记的事件、事件的字段与先后、progress 里的文字、提交里的文件、退出码，都与现在相同。
2. `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)`：上限 9 改成 7，上面那句注释里的清单相应改（点名允许的改写，是改严；在「偏离或疑问」里列出）。
   合并之后 `src/run.ts` 的非注释行里 `await push(` 必须恰好 7 处。
3. 不加新测试，不改别的测试。三条路径现在各有测试守着：`test/exit-codes.test.ts`、`test/scenario-e.test.ts`、`test/tester-step.test.ts`、`test/blocked-cleanup.test.ts`、`test/acceptance/v046-b36/`。它们都必须照常通过。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 三条上报路径的测试通过 | `npm test -- test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36` | exit 0 |
| 推送恰好 7 处（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cF "await push(" \| grep -qx 7` | exit 0 |
| 不变量的上限同步成 7 | `grep -qF "toBeLessThanOrEqual(7)" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts` 之外的 `src/` 文件；改变任何一条上报路径的事件、字段、文字、提交的文件或退出码；改任何一条规则的判定、队列的重跑与收尾
- 顺手做别的重构或改名
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b38/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b38` 为提交信息单独提交并推送该文件。
