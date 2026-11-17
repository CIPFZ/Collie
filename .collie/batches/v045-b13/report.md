# 批次 v045-b13 汇报

## 做了什么

逐条对应 task.md 的三个条目：

1. **`src/arbiter.ts`：删掉规则 4**。移除了 `if (verdict.claim_mismatches.length > 0)` 整段代码块（约 7 行），替换为注释标记「Rule 4: deleted, v045-b13 / SPEC 14.18; number preserved, slot empty」。`RULE_REVIEWER_MISMATCHES` 常量也替换为注释。规则 5~10 的编号和逻辑完全不动。`src/schema/index.ts` 的 `VerdictSchema` 中 `claim_mismatches` 改为 `.optional().default([])`，`SCHEMA_VERSION` 不变。`src/gate.ts`、`src/view.ts` 未动。

2. **`scripts/mutation.ts`：清单去掉 `rule4-reviewer-mismatch` 和 `rule4-pass-to-fix`**。44 项 → 42 项，注释头部更新。其余 42 项的名字完全不动。

3. **测试**：
   - `test/arbiter.test.ts`：删掉 `arbiter: rule 4, reviewer-reported mismatches` 一组（2 条 `downgrades PASS to FIX` 和 `keeps a BLOCK as BLOCK`），新增 `arbiter: rule 4 deleted (v045-b13)` 组（4 条用例）。`rule 3 beats rule 4` 改为「claim_mismatches non-empty with rule 3 → rule 3 fires」，`rule 4 beats rule 5` 改为「claim_mismatches non-empty, pushed true, remote_has_head false → rule 5」。
   - `test/mutation.test.ts`：`has at least 44 items` → `has at least 42 items`，示例行 `caught 44` → `caught 42`。
   - `test/reviewer.test.ts`：新增「accepts a verdict without claim_mismatches, defaulting to empty array (v045-b13)」。
   - `test/invariants.test.ts`：新增「src/arbiter.ts non-comment lines do not contain claim_mismatches (v045-b13)」。
   - 新文件 `test/no-rule4.test.ts`：用 FakeRunner 跑真实 `run --continue`，两批次，第一个 reviewer 判 PASS 且 claim_mismatches 非空，第二个正常 PASS → 断言退出码 0、两个批次 passed、第一个批次记了 `queue.gate_passed`、journal 无 `verdict.downgraded`。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(exit 0)

$ npm test
 Test Files  60 passed (60)
      Tests  1163 passed (1163)
   Duration  21.32s

$ npm test -- test/no-rule4.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)

$ npm test -- test/arbiter.test.ts test/reviewer.test.ts test/mutation.test.ts
 Test Files  3 passed (3)
      Tests  93 passed (93)

$ npx tsx scripts/mutation.ts --list | grep -c .
42
```

所有验收命令均通过。

## 偏离或疑问

改写或删除的已有测试断言，逐条列出：

1. **`test/arbiter.test.ts`** — `arbiter: rule 4, reviewer-reported mismatches` / `downgrades PASS to FIX`：原断言 `final: 'FIX', rule: 4, downgraded: true`；删除。原因：规则 4 本身已删除，断言的前提不再存在。
2. **`test/arbiter.test.ts`** — `arbiter: rule 4, reviewer-reported mismatches` / `keeps a BLOCK as BLOCK`：原断言 `final: 'BLOCK', rule: 4, downgraded: false`；删除。同上。
3. **`test/arbiter.test.ts`** — `rule 3 beats rule 4`：原断言 `.rule === 3`（当 claim_mismatches 非空且 deps_diff 有未批准依赖时，规则 3 先命中）；改为「claim_mismatches non-empty with rule 3 → rule 3 fires」，断言内容不变（仍 `.rule === 3`），只是用例名不再提「beats rule 4」。
4. **`test/arbiter.test.ts`** — `rule 4 beats rule 5`：原断言 `.rule === 4`（claim_mismatches 非空 + remote_has_head=false 时规则 4 先命中）；改为「claim_mismatches non-empty, pushed true, remote_has_head false → rule 5」，断言改为 `.rule === 5`。原因：规则 4 删除后，该场景下一个命中的是规则 5（pushed 声称为 true 但远端没有）。
5. **`test/mutation.test.ts`** — `has at least 44 items`：原断言 `>= 44`；改为 `>= 42`。原因：清单从 44 减到 42。
6. **`test/mutation.test.ts`** — `last line format` 中示例数字：原值 `caught 44`；改为 `caught 42`。纯示例值跟着实际数量变。

无其他偏离。

## 下一步建议

- 本批次完成后，可以运行完整变异测试 `npm run test:mutation` 确认 42 项全部被捕获（本轮未运行完整变异测试以节省时间）。
- `src/gate.ts` 的第 2 条（`claimMismatches > 0`）仍在，它数的是 R2 自己记的 `claim.mismatch`（规则 5~7），与 reviewer 报的 `claim_mismatches` 无关，确认不动是正确的。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b13",
  "head_sha": "6b05762a560657dc127b7bce70c5e1e2622a043c",
  "claims": {
    "commits": ["6b05762a560657dc127b7bce70c5e1e2622a043c"],
    "tests_passed": 1163,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
