# 批次 v046-b14 汇报

## 做了什么

**条目 1（测试先行）：** 新建 `test/r2-commits.test.ts`，包含两组 `describe`：

- `rule 2 counts every commit that R2 did not make`：5 个用例。四种 R2 前缀（`docs: issue`、`progress:`、`report(collie):`、`ops:`）各一条，worker 用这些前缀提交修改了 SPEC.md → 结论是 BLOCK、规则 2。另外一条：worker 用 `docs: issue v99-b01 task envelope` 提交了 `test/acceptance/v99-b01/new.test.ts` → BLOCK、规则 2。这 5 条在未改代码时全部失败（返回 PASS，不是规则 2），确认了 R1 的推断。

- `R2 own commits stay out of the count`：5 个用例。
  - FIX → PASS：R2 裁定提交改了 `docs/progress.md`（受保护路径），第 2 次运行 `spec_diff_lines` 仍为 0 → PASS。
  - 规则 1 自动重跑：reviewer 返回垃圾 → BLOCK rule 1 → 重跑 → PASS，R2 重试提交不被计入。
  - 中断自动重跑：worker 在 wallclock 信号下未写 report → 升级 → 重跑 → PASS。
  - R2 提交计数：一次完整运行后 journal 中 `r2.commit` 事件数 > 0，每个事件有 sha 和 subject。
  - 保守行为：删除 `.collie/runs/` 后仅保留带 `batch.selected`（baseSha）但不带 `r2.commit` 的最小 journal → 第 2 次被规则 2 拦下（`spec_diff_lines > 0`）。

**条目 2（代码改动）：**

1. `src/schema/index.ts`：在 `EVENT_TYPES` 末尾追加 `'r2.commit'`（第 42 个事件类型）。

2. `src/run.ts`：
   - 新增辅助函数 `r2Commit(root, subject, paths, rec)`：调用 `commit()` 后记一条 `r2.commit` 事件（`sha`、`subject`）。
   - 原先 8 处 `commit(root, ...)` 全部替换为 `r2Commit(root, ..., rec)`（`runBatch` 中 5 处，`runQueue` 中 3 处）。整个文件仅剩辅助函数内的 1 处直接 `commit(root`。
   - 新增 `collectR2Shas(root)`：扫描所有 journal，收集 `r2.commit` 的 sha、`batch.task_written` 的 commit、`verdict.pushed` / `verdict.push_failed` 的 sha。
   - 在 `collectEvidence` 调用前调用 `collectR2Shas`，将 `r2Shas` 传入。
   - 救援提交（`wip(collie):`）不经过 `r2Commit`，不记 `r2.commit` 事件。

3. `src/evidence.ts`：
   - `EvidenceInput` 新增可选字段 `r2Shas?: ReadonlySet<string>`。
   - 受保护路径的 per-commit diff 改用 sha 匹配（有 `r2Shas` 时）；无 `r2Shas` 时回退到旧的前缀匹配（向下兼容）。
   - `commits_actual` 仍用旧的 `isR2Commit()` 前缀过滤（列法不变）。

**条目 3（schema + invariants 更新）：**

- `test/schema.test.ts`：事件类型数 41 → 42，新增 `toContain('r2.commit')`。
- `test/invariants.test.ts`：新增两条——`commit(root` 在 `src/run.ts` 非注释行恰好 1 处；`r2.commit` 存在于 `src/schema/index.ts`。

## 测试结果

```
npm run lint     → exit 0
npm run typecheck → exit 0
npm test         → 1 failed | 1367 passed (1368)

失败用例：
  test/exit-codes.test.ts > exit-codes: the journal of a full run (SPEC 3.6)
    > records the v0.1 event sequence in order

原因：该用例用 toEqual 断言了完整的事件序列（12 个事件），
新增的 r2.commit 事件出现在 batch.task_written 前和 verdict.pushed 前，
使序列变为 14 个事件。这是条目 2 "每次提交都记一条 r2.commit" 的直接后果。

指定子集：
  npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts → exit 0 (117 passed)
  npx tsx scripts/mutation.ts → caught 43 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

1. **`test/exit-codes.test.ts` 的 "records the v0.1 event sequence in order" 用例失败。**
   该用例断言了完整的 12 个事件序列。条目 2 要求每次 R2 提交都记 `r2.commit` 事件，
   导致完整序列变为 14 个事件（task commit 前 +1，progress commit 前 +1）。
   修复方式很简单：在期望数组的 `'batch.selected'` 后加 `'r2.commit'`，在 `'evidence.collected'` 后加 `'r2.commit'`。
   但本批次「额外禁止」写明「改写条目 3 点名之外的任何已有断言」，R1 查漏了这条用例。
   我遵从「你发现有别的现有用例因此失败，停下，在偏离或疑问里写明是哪一条，不要自己改」的协议。

2. **`test/schema.test.ts` 改写：** 原值 `toHaveLength(41)` → 新值 `toHaveLength(42)`，新增 `toContain('r2.commit')`。
   这是条目 3 点名允许的改写。

## 下一步建议

1. R1 在下一批次签发时将 `test/exit-codes.test.ts` 的事件序列断言列为允许改写，
   或在 task 中直接给出新的期望序列（加两个 `r2.commit`）。这是一行修复。
2. 条目 1~3 的核心功能（sha 识别 R2 提交、helper 函数、journal 收集）已全部实现并通过所有新测试和变异测试。
3. 建议 R2 在验收时允许只改 exit-codes 一条断言。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b14",
  "head_sha": "ee15654",
  "claims": {
    "commits": ["ee15654"],
    "tests_passed": 1367,
    "tests_failed": 1,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": [
    "test/exit-codes.test.ts 的事件序列断言需要 R1 授权改写（加两个 r2.commit），否则 npm test 无法全绿"
  ]
}
```
