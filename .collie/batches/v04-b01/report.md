# 批次 v04-b01 汇报（attempt 3）

## 做了什么

本轮为 attempt 3。前两轮（attempt 1、2）所有 10 条验收命令均已通过，代码完整无缺口。
FIX 原因均为「规则 9，ci_conclusion=unknown, ci_branch_matched=null」——仲裁器无法验证 CI。
代码提交 `7600a4c` / `89288a6` / `e0dcdcf` 均来自 attempt 1，本轮无新代码提交。

三个条目的实现回顾（均在 attempt 1 完成，本轮验证仍全部通过）：

**条目 1：清理 gate.ts 判定第 6 项与 README**

- `src/gate.ts`：删除 `protectedDiffLines` 字段及 `protected` 原因码，判定从七项改为六项。
- `src/run.ts`：调用 `gateDecision` 时移除 `protectedDiffLines` 字段。
- `test/gate.test.ts`：删除 `protected` 的独立测试用例，`passingInput()` 不再包含该字段。
- `README.md`：状态行改为「v0.3 功能批次已完成，v0.4 进行中」；铁律条数改为 26 条。

**条目 2：运行级数据进 journal（SPEC 13.1）**

- `src/runner/index.ts`：`Usage` 增加可选 cache 字段；`RunResult` 增加 `numTurns` / `costUsd` / `durationMs`。
- `src/runner/claude.ts`：从 SDK `ResultMessage` 提取 `total_cost_usd` / `num_turns` / cache tokens。
- `src/schema/index.ts`：EVENT_TYPES 新增 `reviewer.finished` 和 `evidence.collected`。
- `src/run.ts`：`worker.started` / `reviewer.started` 加 `model`；`worker.finished` 加运行级字段；新增 `reviewer.finished` 事件。
- `test/runner-claude.test.ts`：增加 cost / turns / cache 提取与 omission 测试。

**条目 3：批次级与裁定依据进 journal（SPEC 13.1）**

- `src/run.ts`：新增 `evidence.collected` 事件；`run.finished` 加 `rule` / `reason`；`reviewer.verdict` 加 `gaps`。
- `test/journal-fields.test.ts`（新建）：9 个测试用例覆盖完整字段和 omission 场景。
- `test/invariants.test.ts`：增加 `evidence.collected` / `reviewer.finished` / `protectedDiffLines` 不变量。

## 测试结果

```
$ npm run lint
Checking formatting... All matched files use Prettier code style!

$ npm run typecheck
> tsc -p tsconfig.json (exit 0)

$ npm test
 Test Files  40 passed (40)
      Tests  826 passed (826)
   Duration  13.00s
```

全部 10 条验收命令逐个实跑 exit 0（与 attempt 1、2 结果一致）。

## 偏离或疑问

前两轮 FIX 原因均为 ci_conclusion=unknown / ci_branch_matched=null。这属于 reviewer 环境无法查询 GitHub CI 所致，
不是代码缺陷。本轮代码无任何变更，仅确认远端已包含全部提交并重新提交 report。
按 AGENT-worker.md 要求，worker 不等 CI、不查 CI、不探测 token。

## 下一步建议

v04-b02 投影模块与 `collie status` 命令：`src/view.ts` 读取 journal 并投影为结构化数据。
本批次已补齐 journal 所需的全部字段，view.ts 可直接使用。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b01",
  "head_sha": "e0dcdcfb4469ad135b163ea1ed8c4ccbfff9c0e0",
  "claims": {
    "commits": ["7600a4c6ca44043248fb252da31b817878e0d9d2", "89288a6377921144297bf96684874b6da4c47bdf", "e0dcdcfb4469ad135b163ea1ed8c4ccbfff9c0e0"],
    "tests_passed": 826,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
