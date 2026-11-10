# 批次 v04-b01 汇报

## 做了什么

**条目 1：清理 gate.ts 判定第 6 项与 README**

- `src/gate.ts`：删除 `protectedDiffLines` 字段及 `protected` 原因码，判定从七项改为六项（SPEC 12.3 v04-b01 注），注释与 JSDoc 同步更新。
- `src/run.ts`：调用 `gateDecision` 时移除 `protectedDiffLines` 字段。
- `test/gate.test.ts`：删除 `protected` 的独立测试用例，`passingInput()` 不再包含 `protectedDiffLines`；共 10 个用例保留，覆盖全部六项条件。
- `README.md`：状态行改为「v0.3 功能批次已完成，v0.4 进行中」；铁律条数改为 26 条。

**条目 2：运行级数据进 journal（SPEC 13.1）**

- `src/runner/index.ts`：`Usage` 增加可选 `cacheCreationInputTokens` / `cacheReadInputTokens`；`RunResult` 增加可选 `numTurns` / `costUsd` / `durationMs`。
- `src/runner/claude.ts`：`ResultMessage` 扩展 `total_cost_usd` / `num_turns` / cache token 字段；`toUsage()` 透传 cache 字段；`run()` 用 `Date.now()` 测量 `durationMs`，从 SDK result 提取 `costUsd` 和 `numTurns`。
- `src/schema/index.ts`：EVENT_TYPES 新增 `reviewer.finished` 和 `evidence.collected`。
- `src/run.ts`：
  - `worker.started` / `reviewer.started` 增加 `model` 字段（取自 config）。
  - `worker.finished` 增加 `num_turns` / `cost_usd` / `duration_ms` / `usage`（含 cache 字段），runner 没给的不写。
  - 新增 `reviewer.finished` 事件：reviewer 返回后、verdict 解析前记录，带 `exit_code` 加同一组运行级字段。
- `test/runner-claude.test.ts`：增加 3 个新测试验证 `total_cost_usd`、`num_turns`、cache token 提取及 omission 行为；已有 result mapping 测试改用 `toMatchObject` 适配新增 `durationMs`。
- `test/schema.test.ts`：EVENT_TYPES 长度更新为 34，增加 `reviewer.finished` 和 `evidence.collected` 检查。
- `test/exit-codes.test.ts`：事件序列中加入 `reviewer.finished` 和 `evidence.collected`。
- fake runner 无需改动：FakeScene.result 已经是 `RunResult` 类型，新字段自然透传。

**条目 3：批次级与裁定依据进 journal（SPEC 13.1）**

- `src/run.ts`：
  - 新增 `evidence.collected` 事件：取证完成后记录 commits / tests_passed / tests_failed / acceptance_passed / acceptance_total / spec_diff_lines / deps_diff / remote_has_head。
  - `run.finished` 增加 `rule` / `reason`（截断至 500 字）取自 arbiter decision。
  - `reviewer.verdict` 增加 `gaps`（至多 20 条，每条截断至 300 字），空时不写。
- `test/journal-fields.test.ts`（新建）：9 个测试用例，分两组：
  - Group 1（7 个）：runner 提供完整 usage，断言 worker.started.model、worker.finished 全部字段、reviewer.started.model、reviewer.finished 全部字段、evidence.collected 摘要字段、run.finished.rule/reason、reviewer.verdict.verdict。
  - Group 2（2 个）：runner 不提供 usage，断言 worker.finished 和 reviewer.finished 不含 num_turns / cost_usd / duration_ms / usage。
- `test/invariants.test.ts`：增加两个不变量：
  - `evidence.collected` 和 `reviewer.finished` 存在于 `src/schema/index.ts`。
  - `protectedDiffLines` 不存在于 `src/gate.ts`。

## 测试结果

```
$ npm run lint
Checking formatting... All matched files use Prettier code style!

$ npm run typecheck
> tsc -p tsconfig.json (exit 0)

$ npm test
 Test Files  40 passed (40)
      Tests  826 passed (826)
   Duration  13.10s
```

全部 10 条验收命令逐个实跑 exit 0。

## 偏离或疑问

无。所有实现严格按 SPEC 13.1 描述执行，无新增依赖，无 SCHEMA_VERSION 变更。

## 下一步建议

v04-b02 投影模块与 `collie status` 命令：`src/view.ts` 读取 journal 并投影为结构化数据，实现 `collie status [--json]`。本批次已经补齐了 journal 所需的全部字段，view.ts 可以直接读取。

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
