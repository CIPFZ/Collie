---
schema_version: 1
run_id: r-20261125045724
batch_id: v046-b48
base_sha: 6492c3588a0dc693ddd3f66d0b28ab5042031338
created_at: 2026-11-25T05:10:25.882Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b48：reviewer 的结论多一栏 test_gaps：通过但有测试缺口时队列停下（需求审查第 2b 批，带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.31 的「`test_gaps`（v046-b48）」一段（方案在 16.24 第 ④ 点）。`src/schema/index.ts`：`VerdictSchema` 加可选的 `test_gaps`（字符串数组，不写就是空数组，写法照 `claim_mismatches`）。
   `src/run.ts`：`reviewer.verdict` 事件在 `test_gaps` 非空时带上它（条数与每条长度的上限同 `gaps`），为空时不带这个键；把条数传给放行判定。
2. `src/gate.ts`：`GateInput` 加 `testGapsCount`，大于 0 时原因是 `test_gaps`，排在 `gaps` 之后。`scripts/mutation.ts` 的清单**必须**加一项 `gate-test-gaps`（写法照 `gate-gaps`），共 48 项，清单上方注释里的项数相应改。
   `test/invariants.test.ts` 加一条，用例名 `src/gate.ts has the test_gaps condition (v046-b48)`。
3. 点名允许改写的旧用例，在「偏离或疑问」里列出：`test/gate.test.ts` 的 `passingInput()` 夹具加一行 `testGapsCount: 0`；这个文件里可以再加一条新用例守这一项，已有的断言不改。
   不许变的：`test_gaps` 不参与仲裁，不进重跑的 task；单批次模式不受影响；`gaps` 的行为不变。R1 查过：现有的假 reviewer 的结论都不带 `test_gaps`，加一个可选字段不影响它们；`test/scenario-l.test.ts` 的 group a 断言的是 `reasons` 含 `gaps`，不受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] `VerdictSchema` 解析一份其余都合法、另带 `test_gaps` 的结论，`test_gaps` 是只有一条 `S2 的用例只断言了不报错` 的数组：解析成功，结果里这一条原样在
- S2 [新] `gateDecision` 的输入其余各项都是能放行的值、`testGapsCount` 是 1：`pass` 是 false，`reasons` 恰好是只含 `test_gaps` 的数组
- S3 [新] 沙箱里把批次的状态改成 pending 并提交；假 worker 如实；假 reviewer 的结论 `verdict` 是 `PASS`、`gaps` 是空数组、`test_gaps` 有一条 `S2 的用例只断言了不报错`；队列模式跑一次（`run --continue`）：退出码 30；`docs/backlog.md` 里这个批次的状态是 `passed`；队列 journal 里有 `queue.paused` 事件，它的 `reasons` 含 `test_gaps`
- S4 [新] S3 那一次运行：批次那次运行的 journal 里 `reviewer.verdict` 事件的 `test_gaps` 是只含那一条的数组
- K1 [保持] `VerdictSchema` 解析一份不带 `test_gaps` 的合法结论：解析成功
- K2 [保持] `gateDecision` 的输入各项都是能放行的值、`testGapsCount` 是 0：`pass` 是 true，`reasons` 是空数组
- K3 [保持] 同 S3，但假 reviewer 的结论不带 `test_gaps`：退出码 0；队列 journal 里没有 `queue.paused`；`reviewer.verdict` 事件没有 `test_gaps` 这个键
- K4 [保持] 同 S3，但假 reviewer 的结论不带 `test_gaps`、`gaps` 有一条 `少了一个边界`：退出码 30；`queue.paused` 的 `reasons` 含 `gaps`，不含 `test_gaps`

## 本批次接口

- `src/schema/index.ts` 已有的导出 `VerdictSchema`（用 `safeParse`；现在是严格对象，带不认得的键会被拒绝）；一份合法的结论怎么写，照 `test/support/sandbox.ts` 的 `fooledReviewerScene`。要让假 reviewer 回一份带 `test_gaps` 或带 `gaps` 的结论，在测试文件里自己写一个场景
- `src/gate.ts` 已有的导出 `gateDecision(input)` 与类型 `GateInput`（`downgraded`、`claimMismatches`、`ciConclusion`、`ciBranchMatched`、`depsDiffCount`、`specDiffLines`、`gapsCount`）；能放行的值照 `test/gate.test.ts` 的 `passingInput()`。本批次起多一项 `testGapsCount`，实现之前类型上还没有它
- 队列模式的搭法（把沙箱 backlog 里批次的状态改成 pending 并提交、`box.cli(['run', '--continue'], runner)`、读队列 journal）照 `test/acceptance/v046-b40/new.test.ts` 的 S4 与 `test/scenario-l.test.ts` 的 group a（那里就是「PASS 带 gaps，队列停下，退出码 30」）
- `reviewer.verdict` 事件本批次起在 `test_gaps` 非空时多带这个键；读事件用 `Sandbox` 的 `events()`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含各批次的验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b48` | exit 0 |
| 变异清单里有新的一项 | `grep -qF "gate-test-gaps" scripts/mutation.ts` | exit 0 |
| 不变量同步 | `grep -qF "has the test_gaps condition (v046-b48)" test/invariants.test.ts` | exit 0 |

`test/acceptance/v046-b48/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-reviewer.md`）；改动 `src/arbiter.ts`、`src/roles/`、`src/view.ts`、`src/follow.ts`、`src/runner/`
- 让 `test_gaps` 影响仲裁的结论、返工次数的计数或重跑的 task；改放行判定里已有的六项
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b48/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b48` 为提交信息单独提交并推送该文件。
