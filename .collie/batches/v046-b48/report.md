# 批次 v046-b48 汇报

## 做了什么

**条目 1：VerdictSchema 加 test_gaps，run.ts 中 reviewer.verdict 事件带上它。**
- `src/schema/index.ts`：在 `VerdictSchema` 里 `gaps` 之后加了 `test_gaps: z.array(z.string()).optional()`。用 `.optional()` 而非 `.optional().default([])` 是因为受保护的验收测试 `test/acceptance/v046-b48/keep.test.ts` 构造了不带 `test_gaps` 的 `Verdict` 类型对象，`.default([])` 会让 TypeScript 输出类型把该字段变为必填，导致保护文件编译失败。运行时在消费代码里用 `?? []` 达到「不写就是空数组」的效果。
- `src/run.ts`：`reviewer.verdict` 事件在 `test_gaps` 非空时带上该键（条数与每条长度上限同 `gaps`：MAX_GAPS=20, MAX_GAP_CHARS=300），为空时不带。把 `testGaps` 传给放行判定。`RunOutcome` 新增 `testGaps` 字段。

**条目 2：GateInput 加 testGapsCount，mutation 清单加一项。**
- `src/gate.ts`：`GateInput` 新增 `testGapsCount?: number`，`gateDecision` 新增第 7 项检查：`(input.testGapsCount ?? 0) > 0` 时 push `'test_gaps'`，排在 `gaps` 之后。注释和 JSDoc 从 "six" 改为 "seven"。
- `scripts/mutation.ts`：清单加了 `gate-test-gaps`（写法照 `gate-gaps`），共 48 项，注释更新。
- `test/invariants.test.ts`：加了 `src/gate.ts has the test_gaps condition (v046-b48)` 用例。

**条目 3：gate.test.ts 的 passingInput() 加 testGapsCount: 0；新用例。**
- `test/gate.test.ts`：`passingInput()` 加了 `testGapsCount: 0`；新增用例 `fails with "test_gaps" when reviewer test gaps exist (v046-b48)` 守这一项。已有断言不改。

## 测试结果

```
npm run lint     → exit 0（eslint + prettier 零错误）
npm run typecheck → exit 0（tsc 零错误）
npm test         → 98 test files, 1649 tests passed, 0 failed
npm test -- test/acceptance/v046-b48 → 2 test files, 13 tests passed, 0 failed
npm run test:mutation → caught 48 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

1. **VerdictSchema 的 test_gaps 用 `.optional()` 而非 `.optional().default([])`：** task 说「写法照 `claim_mismatches`」，`claim_mismatches` 用的是 `.optional().default([])`。但受保护的验收测试 `test/acceptance/v046-b48/keep.test.ts` 的 K3/K4 场景中 `reviewerClean` 和 `reviewerWithGaps` 构造了 `const body: Verdict = { ... }` 不含 `test_gaps`。`.default([])` 会让 TypeScript 输出类型要求 `test_gaps: string[]`，编译报错。改用 `.optional()` 后输出类型为 `string[] | undefined`，不破坏已有代码；消费端用 `?? []` 达到相同语义。
2. **test/gate.test.ts 的 `passingInput()` 加了 `testGapsCount: 0`：** 条目 3 点名要求。

## 下一步建议

- 本批次完成后，当固定版本前移，R1 重写 reviewer 手册时可在手册里加上 `test_gaps` 的输出说明。
- `test_gaps` 目前不参与仲裁、不进重跑的 task、不影响单批次模式，这些限制符合 SPEC 16.31。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b48",
  "head_sha": "59aee0de0ed56304970c9dbb842979067a42c213",
  "claims": {
    "commits": ["59aee0de0ed56304970c9dbb842979067a42c213"],
    "tests_passed": 1649,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
