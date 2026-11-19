# 批次 v046-b15 汇报

## 做了什么

本轮是 attempt 2，修复上一轮遗留的三个 gap：

1. **Gap 1 — `tester_touched_main_tree` 走错误的上报路径**：之前调用通用 `escalate()`，导致裁定说明文字是「上报：无 report — …」而不是任务要求的「上报：验收测试没有准备好 — …」。修复方式：在 tester step 的 `if (!headHasAcceptanceTest)` 块内新增一个 `testerEscalate` 局部函数，它记录 `escalated` 事件（bare reason）、用「上报：验收测试没有准备好 — <reason>」作为裁定描述，然后走与其它 tester 失败路径完全相同的 progress/backlog/commit/push 流程。`tester_touched_main_tree` 和 tester 失败（red_check_failed / misclassified / tester_failed）都通过这个函数上报，消除了重复代码。

2. **Gap 2 — `escalated` 事件 reason 包含完整前缀**：之前 `rec.record('escalated', { reason: '上报：验收测试没有准备好 — red_check_failed: ...' })` 导致 reason 不以 `red_check_failed` 开头。修复：`escalated` 事件只写 bare reason（如 `red_check_failed: ...`），前缀只用于裁定描述。同时把四个测试断言从 `.toContain()` 改为 `.startsWith()` 验证前缀。

3. **Gap 3 — FIX 重跑测试两次都 PASS**：修复：`reviewerScene()` 接受可选的 verdict 参数（`'PASS' | 'FIX'`，默认 PASS）。测试改为：第一轮用 `reviewerScene('FIX')` 得到 exit 10；第二轮接受测试已在树里因此跳过 tester，用 `reviewerScene()` 得到 exit 0。最后断言两个 runner 的合并调用序列为 `['tester', 'worker', 'reviewer', 'worker', 'reviewer']`。

另外修复了一个 invariant 测试（`push(` 周围 5 行内需有 `push_failed` 或 `verdict`）：给新增的 `testerEscalate` 里的 push 调用加了 SPEC 12.1 注释。

## 测试结果

```
npm run lint    → exit 0 (eslint + prettier 都过)
npm run typecheck → exit 0
npm test        → 67 passed (67), Tests: 1385 passed (1385)
GIT_CONFIG_GLOBAL=$(mktemp) GIT_CONFIG_NOSYSTEM=1 npm test → 67 passed (67), Tests: 1385 passed (1385)
npx tsx scripts/mutation.ts → caught 43 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

以下五处已有断言被改写（条目 3 点名允许的不在此列）：

1. `test/tester-step.test.ts` — `red check fails twice → exit 20, escalated with red_check`：原断言 `expect(escalated?.reason as string).toContain('red_check')`，现断言 `expect((escalated?.reason as string).startsWith('red_check_failed')).toBe(true)`。原因：Gap 2 要求 reason 是 bare reason 且以 `red_check_failed` 开头，`.toContain()` 无法验证前缀。

2. `test/tester-step.test.ts` — `tester declares misclassified`：原断言 `.toContain('misclassified')`，现断言 `.startsWith('misclassified')`。同理。

3. `test/tester-step.test.ts` — `tester writes to main workspace`：原断言 `.toContain('tester_touched_main_tree')`，现断言 `.startsWith('tester_touched_main_tree')`。同理。

4. `test/tester-step.test.ts` — `testerSignal aborts`：原断言 `.toContain('tester_failed')`，现断言 `.startsWith('tester_failed')`。同理。

5. `test/tester-step.test.ts` — `FIX rerun after first PASS`（已改名为 `FIX rerun after first FIX`）：原断言两次 exit 都为 0（PASS），现断言第一次 exit 为 10（FIX）、第二次为 0（PASS），并新增合并调用序列断言 `['tester', 'worker', 'reviewer', 'worker', 'reviewer']`。原因：Gap 3 要求实现「先 FIX 再 PASS」场景。

以上五处都是 Gap 修复直接要求的最小改动：前四处因 bare reason 要验前缀，第五处因测试场景从 PASS+PASS 改为 FIX+PASS。

## 下一步建议

v046-b15 的三个 gap 已全部修复。可以进入审核。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b15",
  "head_sha": "1a9002de8b4c5fed572e827b769b740cd901e820",
  "claims": {
    "commits": ["1a9002de8b4c5fed572e827b769b740cd901e820"],
    "tests_passed": 1385,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
