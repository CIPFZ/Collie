# 批次 v046-b35 汇报

## 做了什么

逐条对应 task.md 的 2 个条目：

1. **`acceptance.failed` 事件带 `output_tail`；`renderFixSection` 渲染围栏代码块；`batchHistory` 取出 `output_tail`**

   在 `src/run.ts` 中做了以下改动：

   - 新增两个具名常量 `OUTPUT_TAIL_MAX_LINES = 20` 和 `OUTPUT_TAIL_MAX_LINE_LENGTH = 300`（SPEC 16.23），带 eslint 注释豁免裸数字规则。
   - 新增导出函数 `buildOutputTail(stdout, stderr, redact)`：合并 stdout（前）和 stderr（后），先对敏感值做全局替换为 `***`，然后按行拆分、去掉末尾空行、取最后 20 行、每行截断到 300 字符。空输出返回 `undefined`。
   - `r2FailedAcceptance` 构建时调用 `buildOutputTail`，从 `VerifyResult` 的 `stdout` 和 `stderr` 生成 `output_tail`。
   - `rec.record('acceptance.failed', ...)` 在有 `output_tail` 时带上该字段（无输出不带）。
   - `batchHistory` 中从 journal 事件重建 `failedAcceptance` 时，当事件带 `output_tail`（字符串类型）时一并取出。
   - `FixInfo` 类型的 `failedAcceptance` 每一项新增可选字段 `output_tail?: string`。
   - `renderFixSection` 中，当 `fa.output_tail` 存在且非空时，在命令行之后渲染一个围栏代码块（``` 包裹）。

2. **不许变的项全部保持**

   - `acceptance.failed` 原有的三个字段 `cmd`、`exit_code`、`expect` 不变。
   - `docs/progress.md` 里每条命令一行的摘要不受影响（`evidence.ts` 里的 `verify_results` 仍只含 `cmd`、`exit_code`、`summary`）。
   - `why` 与 `report` 的输出不受影响（`src/view.ts` 未修改）。
   - 命令通过时不记事件（逻辑不变：只对 `!r.passed` 的结果构建 `r2FailedAcceptance`）。
   - 事件类型的个数不变（`src/schema/index.ts` 未修改）。
   - 已有断言一条都没改。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
（无输出，exit 0）

$ npm test
Test Files  77 passed (77)
Tests  1532 passed (1532)
Duration  26.63s

$ npm test -- test/acceptance/v046-b35
Test Files  2 passed (2)
Tests  8 passed (8)
Duration  3.34s

$ npm run test:mutation
All mutations caught ✓
mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

无

## 下一步建议

本批次已完成。可继续执行 v046-b36（worker 认为验收测试写错了）。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b35",
  "head_sha": "dc2811c68790b834d52b0241c514db234c193f54",
  "claims": {
    "commits": ["dc2811c68790b834d52b0241c514db234c193f54"],
    "tests_passed": 1532,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
