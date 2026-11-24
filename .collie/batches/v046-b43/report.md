# 批次 v046-b43 汇报

## 做了什么

**条目 1：`src/run.ts` 先取证再审核。**
在 `withHeadWorktree` 回调中重组执行顺序：先收集证据（CI 查询 + evidence 收集），然后构造合成 PASS 裁决调用 `arbitrate()` 进行预仲裁。若结果不是 PASS，记录 `reviewer.skipped` 事件（含 `rule` 和 `reason`），跳过 reviewer，直接使用预仲裁结果；若结果是 PASS，正常拉起 reviewer。`reviewer.skipped` 事件已添加到 `src/schema/index.ts` 的 `EVENT_TYPES`（第 45 个）。`verdict.downgraded` 在 reviewer 被跳过时多带 `assumed: true`。未修改 `src/arbiter.ts`。

**条目 2：旧测试适配。**
按三类允许的改动更新了旧测试：
- (a) 移除不再被调用的 reviewer 场景：
  - `test/rule9-same-head.test.ts`：4 个用例各移除了 CI failure 导致 rule 9 时的 reviewerPass 场景（共 10 个场景）
  - `test/scenario-l.test.ts`：3 个用例各移除了 no-push → rule 9 时的第一个 reviewerClean 场景
  - `test/queue-journal.test.ts`：3 个用例移除了 rule 9 时的 reviewer 场景，1 个 CI failure variant 用例移除了全部 reviewer 场景；删除了不再使用的 `unpushedReviewerPassScene` 函数
  - `test/scenario-m.test.ts`：CI failure retry 用例移除了全部 3 个 reviewerPass 场景
- (b) 断言改为 reviewer.skipped：
  - `test/scenario-a.test.ts`："reviewer skipped because rule 7" 用例断言无 `reviewer.started` 且有 `reviewer.skipped rule=7`；"collie show" 用例用 `reviewer.skipped rule=7` 替换了 `"verdict": "PASS"` 断言
  - `test/scenario-d.test.ts`："collie show" 用例用 `reviewer.skipped rule=8` 替换了 `"verdict": "PASS"` 断言
- (c) 事件序列调整：
  - `test/exit-codes.test.ts`：`ci.resolved` 和 `evidence.collected` 移到 `reviewer.started` 之前
  - `test/schema.test.ts`：事件类型个数 44 → 45

**条目 3：不变量和变异测试。**
`test/invariants.test.ts` 新增用例 `src/run.ts records reviewer.skipped (v046-b43)`，检查 `src/run.ts` 包含 `reviewer.skipped`。`npm run test:mutation` 结果为 `caught 47 survived 0 invalid 0 timeout 0 stale 0`，无需同步 `scripts/mutation.ts`。

## 测试结果

```
npm run lint       → exit 0（ESLint + Prettier 均通过）
npm run typecheck  → exit 0（tsc 零错误）
npm test           → 1597 passed, 1 failed（88 test files; 87 passed, 1 failed）
npm test -- test/acceptance/v046-b43 → 8 passed（2 test files）
npm run test:mutation → caught 47 survived 0 invalid 0 timeout 0 stale 0
```

验收标准自检：
- `npm run lint` → exit 0 ✓
- `npm run typecheck` → exit 0 ✓
- `npm test -- test/acceptance/v046-b43` → exit 0 ✓
- `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "reviewer.skipped"` → exit 0 ✓
- `grep -qF "reviewer.skipped" src/schema/index.ts` → exit 0 ✓
- `grep -qF "records reviewer.skipped (v046-b43)" test/invariants.test.ts` → exit 0 ✓

## 偏离或疑问

1. **`test/exit-codes.test.ts` "reviewer.stream.ndjson masks secrets with redact" 失败（1 个）。**
   该测试在 `beforeEach` 里往 `.collie/collie.toml` 写入 `token_file` 行，worker 场景的 `git add -A` 把这个改动提交了。`.collie/collie.toml` 在 `src/evidence.ts` 的 `PROTECTED_PATHS` 中，导致 `spec_diff_lines > 0`，预仲裁 rule 2 触发 → reviewer 被跳过 → 没有 `reviewer.stream.ndjson` 文件 → 测试读文件时 ENOENT。
   这不属于条目 2 的三类允许改动（它不是移除 reviewer 场景、不是改断言方向、不是调事件顺序），且该测试测的是 reviewer 流的 secret 遮蔽功能，改它需要重构测试的 CI token 注入方式，超出本批次范围。
   条目 2 明确要求「别的断言一条都不许动：哪一条不动就过不了，停下，在偏离或疑问里写明」，故照此处理。

2. **改写/删除的断言逐条说明：**
   - `test/scenario-a.test.ts` "reviewer skipped because rule 7"：原断言 `reviewer calls = 1`，现断言 `reviewer.started count = 0` + `reviewer.skipped exists with rule=7`（(b) 类改动，reviewer 被跳过）
   - `test/scenario-a.test.ts` "collie show reconstructs the decision"：原断言含 `"verdict": "PASS"`（来自 verdict.md），现改为 `reviewer.skipped rule=7`（reviewer 被跳过无 verdict.md，改查 journal）
   - `test/scenario-d.test.ts` "collie show reconstructs the failed command"：原断言含 `"verdict": "PASS"`，现改为 `reviewer.skipped rule=8`（同上理由）
   - `test/schema.test.ts`：EVENT_TYPES length 44 → 45（新增 `reviewer.skipped`）
   - `test/exit-codes.test.ts` "records the v0.1 event sequence in order"：`ci.resolved` 和 `evidence.collected` 从 reviewer 之后移到 reviewer 之前（(c) 类改动）
   - `test/queue-journal.test.ts`：删除了 `unpushedReviewerPassScene` 函数（移除场景后无调用者，lint 要求删除）

## 下一步建议

1. `test/exit-codes.test.ts` 的 redaction 测试需要修复：建议下一批次把测试的 token_file 注入方式改为不修改 `.collie/collie.toml`（例如用环境变量或在 worker 场景之前还原 toml），使 reviewer 能正常拉起。
2. 本批次完成了「先取证再审核」的第一批，reviewer 被拉起后的流程（SPEC 16.29 第 2 批）可在后续批次实现。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b43",
  "head_sha": "90e25a69c809ef5dce3453d5953436b4b9ef7d75",
  "claims": {
    "commits": ["9381223ae46097841ee7007db71edbb05773817e", "90e25a69c809ef5dce3453d5953436b4b9ef7d75"],
    "tests_passed": 1597,
    "tests_failed": 1,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": [
    "test/exit-codes.test.ts redaction test fails because .collie/collie.toml modification triggers rule 2 → reviewer skipped → no reviewer.stream.ndjson. This is a pre-existing test design issue exposed by the new evidence-before-reviewer flow. Fix requires restructuring the test's token injection, which is outside the 3 allowed change types for this batch."
  ]
}
```
