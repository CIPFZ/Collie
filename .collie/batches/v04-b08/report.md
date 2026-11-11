# 批次 v04-b08 汇报

## 做了什么

### 条目 1：投影取值修补

**attempt 推算（SPEC 13.13）。** 在 `src/view.ts` 新增导出函数 `computeAttempt(allRunData, targetRunId, targetBatchId)`，按 R2 口径计算 attempt：`1 + 同一批次中在目标运行之前开始、且结论不是 PASS 的批次运行数`（没有 `run.finished` 的也算非 PASS）。`buildStatus` 的当前运行段和 `projectTimeline` 的 `run_end` 节点都改用此函数，删除了对 `batchSelected.attempt` 和 `run.finished` 事件上 `attempt` 字段的读取。

**运行用时（SPEC 13.13）。** `projectRun` 和 `projectTimeline` 的 `durationMs` 改为 `run.finished.ts − run.started.ts`（实际运行时长），不再读 `worker.finished.duration_ms`（那是 worker 阶段时长，SPEC 明确说要另列）。

**花费缺数据的 —（SPEC 13.13）。** `formatVersionSummary` 在某版本的全部运行都没有花费数据时（`runsWithoutCost === runCount`）显示 `cost: —`，而非 `$0.00`。

### 条目 2：空数据的 --json

**status --json。** 当 `loadRuns` 返回空列表时：文本模式照旧输出 `no runs recorded`，JSON 模式不再提前返回 `{"message":…}`，而是走正常路径 `buildStatus([], batches, now)` 输出 `{current, queue, lastQueue}` 结构。

**timeline --json。** 空数据 + JSON 模式输出 `[]` 而非 `{"message":…}`。

### 条目 3：测试

**test/view-real.test.ts（5 个 `it` 块）。** 用 `Sandbox.create()` 创建真实沙盒仓库，先 FIX 再 PASS 跑两轮 `collie run`：
- attempt 为 1（FIX 轮）和 2（PASS 轮），分别等于各自 `task.md` frontmatter 的 `attempt`
- 完成的运行 `durationMs` 不为 null
- 版本汇总在无花费数据时输出 `cost: —` 而非 `$0.00`
- timeline `run_end` 节点携带正确的 attempt 值

**夹具清理。** `test/view.test.ts` 和 `test/timeline.test.ts` 的 `batch.selected` 事件中删除了 R2 不写的 `attempt` 字段。`durationMs` 的断言改为基于 `run.finished.ts − run.started.ts` 的期望值。

**test/invariants.test.ts。** 新增两条：
- `src/view.ts` 非注释代码不含 `batchSelected.attempt`
- `test/view-real.test.ts` 含 `Sandbox.create`

## 测试结果

```
npm run lint       → exit 0
npm run typecheck  → exit 0
npm test           → 46 files, 898 passed, 0 failed (14.97s)
npm test -- test/view-real.test.ts → 1 file, 5 passed (1.01s)
```

验收命令逐条验证：
1. lint: exit 0 ✓
2. typecheck: exit 0 ✓
3. test: exit 0 ✓
4. view-real test: exit 0 ✓
5. Sandbox.create grep: exit 0 ✓
6. it( count ≥ 4: count=5 ✓
7. batchSelected.attempt 不在非注释代码: exit 0 ✓
8. status --json 有 current/queue/lastQueue: exit 0 ✓（在无 .collie/runs/ 的临时目录中验证）
9. timeline --json 是数组: exit 0 ✓（同上）
10. invariants 含 view-real: exit 0 ✓

## 偏离或疑问

无。

## 下一步建议

- v04-b09（`collie why`）可以利用 `computeAttempt` 在 why 输出中展示每次运行的 attempt。
- timeline 里队列的开始节点（依赖 `queue.batch_started` 落在队列 journal）待固定版本前移后实现。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b08",
  "head_sha": "c94222e0ec8ba4477cc2e1e85d4854dc8a2dad57",
  "claims": {
    "commits": ["c94222e0ec8ba4477cc2e1e85d4854dc8a2dad57"],
    "tests_passed": 898,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
