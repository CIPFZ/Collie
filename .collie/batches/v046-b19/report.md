# 批次 v046-b19 汇报

## 做了什么

### 条目 1：`src/view.ts` — why 与 report 显示测试 agent 的花费

在 `projectWhyAttempt` 中新增对 `tester.finished` 事件的读取和聚合逻辑：

- 新增 `WhyAttempt.tester` 字段（turns / costUsd / durationMs / invocations），当 journal 中无 `tester.finished` 事件时为 `null`。
- 多次拉起测试 agent 时，将所有 `tester.finished` 的 turns、cost、duration 求和。
- 花费总计（`cost.total`）加入 tester 花费；`cost` 对象新增 `tester` 字段。
- `formatWhy`：在 worker 行之后、evidence 行之前，条件显示 `tester:` 行（turns / cost / duration / invocations）；`cost:` 行条件加入 `tester=` 部分。无 tester 事件时不输出任何 tester 相关内容。

在 `projectReport` 中：

- `ReportBatchRow` 新增 `testerCost` 字段。
- 聚合批次 journal 中所有 `tester.finished` 的 `cost_usd`，纳入 `totalCost` 合计。
- `formatReport`：当至少一个批次行有 tester 花费时，表格增加 `tester 花费` 列（header、数据行、空行、合计行）；无 tester 数据时表格结构与原先逐字节相同。

### 条目 2：测试用例

**test/why.test.ts** 新增 3 条用例（describe `why — tester agent display (SPEC 16.16)`）：
1. `single tester.finished`：验证 tester 字段填充正确、cost breakdown 含 tester、文本包含 `tester:` 行与 tester 花费。
2. `multiple tester invocations`：验证聚合逻辑（turns / cost / duration 求和、invocations=2）。
3. `no tester events`：验证 tester 为 null、文本无 `tester:` 行、cost 行不含 tester 字样。

**test/report.test.ts** 新增 3 条用例（describe `collie report: tester agent cost (SPEC 16.16)`）：
1. `tester.finished cost included in total; tester column appears`：验证 testerCost 正确、totalCost 含 tester、formatReport 表格含 `tester 花费` 列。
2. `two tester invocations in one run: aggregated in total`：验证多次 tester 花费聚合。
3. `no tester events: output byte-identical (no tester column)`：验证无 tester 时表头完全不变。

**未改动任何已有断言。**

## 测试结果

```
npm run lint      → exit 0
npm run typecheck → exit 0
npm test          → exit 0 (67 files, 1408 passed, 0 failed)
npm test -- test/why.test.ts test/report.test.ts → exit 0 (49 passed)
grep -qF "tester.finished" src/view.ts && grep -qF "tester.finished" test/why.test.ts && grep -qF "tester.finished" test/report.test.ts → exit 0
```

## 偏离或疑问

无

## 下一步建议

- 测试 agent 的花费显示已就绪，R1 可以签发第一个带情形的批次。
- timeline 的 `run_end` 节点花费目前仍只统计 worker + reviewer；如需包含 tester，可在后续批次补上。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b19",
  "head_sha": "711507c13d7af0fdf7f7c9d558987940599d48a2",
  "claims": {
    "commits": ["711507c"],
    "tests_passed": 1408,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
