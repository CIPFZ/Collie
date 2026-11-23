# 批次 v046-b38 汇报

## 做了什么

**条目 1：三处上报路径合成 `escalateAndCommit` 函数。**
在 `runBatch` 内部（`finish` 之后、`escalate` 之前）新增了 `escalateAndCommit` 闭包函数，它接受五个参数：
- `reason`：裸原因字符串，同时用于 `escalated` 事件的 `reason` 字段和 `finish()` 的 `escalation`
- `escalatedExtra`：`escalated` 事件的附加字段（如 `disputed`），可选
- `progressPrefix`：进度说明文字前缀（三条路径各不相同）
- `extraCommitFiles`：随裁定提交一起提交的附加文件（如 `tester.md`），可选
- `evidenceBaseSha`：取提交清单的基准 sha，undefined 时使用空 evidence

函数体包含：记录 `escalated` 事件 → 构造 `escalationDecision` → 收集 evidence → 写 progress → 更新 backlog 状态 → `r2Commit` → `push` 并记录 `verdict.pushed`/`verdict.push_failed` → 返回 `finish('BLOCK', ...)`。

三条原路径现在各自只是薄包装：
- `escalate`（无 report）：直接调用 `escalateAndCommit`，前缀 `上报：无 report — `
- `testerEscalate`（验收测试没准备好）：调用 `escalateAndCommit`，前缀 `上报：验收测试没有准备好 — `，传入 `extraCommitFiles` 和固定的 `baseSha`
- disputed（worker 认为验收测试有错）：调用 `escalateAndCommit`，前缀 `上报：worker 认为验收测试有错 — `，传入 `escalatedExtra: { disputed }` 和 `baseSha`

行为完全不变：每条路径记录的事件、事件字段与先后顺序、progress 文字、提交的文件、退出码全部与重构前相同。

**条目 2：不变量上限 9 → 7。**
`test/invariants.test.ts` 中 `every await push( in run.ts has push_failed or verdict within 5 lines above` 用例的上限从 `toBeLessThanOrEqual(9)` 改为 `toBeLessThanOrEqual(7)`，注释里的清单也做了相应更新，列出了 7 处 push 的来源。

**条目 3：不加新测试、不改别的测试。**
确认所有现有测试（包括 exit-codes、scenario-e、tester-step、blocked-cleanup、acceptance/v046-b36）全部通过，无需任何其他改动。

## 测试结果

```
npm run lint       → exit 0（ESLint + Prettier 零错误）
npm run typecheck  → exit 0（tsc 零错误）
npm test           → 80 test files, 1556 tests passed, 0 failed
npm test -- test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36
                   → 6 test files, 77 tests passed, 0 failed
npm run test:mutation → caught 46 survived 0 invalid 0 timeout 0 stale 0
grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cF "await push(" → 7
grep -qF "toBeLessThanOrEqual(7)" test/invariants.test.ts → exit 0
```

## 偏离或疑问

- 条目 2 点名允许的改写：`test/invariants.test.ts` 第 181–183 行，`toBeLessThanOrEqual(9)` → `toBeLessThanOrEqual(7)`，注释从 "expect exactly 9 push calls after v046-b36 (3 from v03-b01-fix + 1 for fix_max + 1 for unresolvable sha FIX + 1 for tester escalation + 1 for batch cleanup + 1 for rule9_same_head + 1 for disputed acceptance)" 更新为 "expect exactly 7 push calls after v046-b38 (3 escalation paths merged into escalateAndCommit with 1 push + 1 for catch-up + 1 for unresolvable sha FIX + 1 for normal verdict + 1 for batch cleanup + 1 for fix_max + 1 for rule9_same_head)"。这是在改严（上限从 9 降到 7），符合条目要求。

## 下一步建议

无。三处上报路径已合并，推送从 9 处变成 7 处，所有现有测试照常通过。后续如有第 5 步的流程改动，只需修改 `escalateAndCommit` 一处即可。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b38",
  "head_sha": "57866f65e95ec64576afbafad6e47b987f827483",
  "claims": {
    "commits": ["57866f65e95ec64576afbafad6e47b987f827483"],
    "tests_passed": 1556,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
