# 批次 v046-b14 汇报

## 做了什么

这是第 2 次尝试。第 1 次的代码提交 ee15654 已经完成了全部三个条目的核心实现，本次只修复 attempt 1 的 gap 指出的遗留问题。

**条目 1**（attempt 1 已完成）：`test/r2-commits.test.ts` 第一组 `describe('rule 2 counts every commit that R2 did not make', …)` 已就位，5 个用例验证四种 R2 前缀开头的提交说明和受保护文件测试均为 BLOCK、规则 2。

**条目 2**（attempt 1 已完成）：`src/schema/index.ts` 加了 `r2.commit` 事件类型；`src/run.ts` 中新增 `r2Commit` 辅助函数，原先 8 处 `commit(root, ...)` 全部替换，非注释行里直接调 `commit(root` 恰好 1 处；`src/evidence.ts` 取证用 `r2Shas`（从 journal 收集）跳过 R2 自己的提交。

**条目 3**（attempt 1 已完成）：`test/r2-commits.test.ts` 第二组 `describe('R2 own commits stay out of the count', …)` 已就位；`test/schema.test.ts` 个数 41→42 并加了 `toContain('r2.commit')`；`test/invariants.test.ts` 加了相关不变量。

**本次修复（attempt 2）**：更新 `test/exit-codes.test.ts` 第 136 行的 `'records the v0.1 event sequence in order'` 用例。原来期望 12 个事件，条目 2 新增的 `r2.commit` 事件使完整运行的事件序列变为 14 个（task 信封提交在 `batch.selected` 之后、verdict 提交在 `evidence.collected` 之后各增一个 `r2.commit`）。将期望序列更新为 14 项。

## 测试结果

```
npm run lint       → exit 0（ESLint + Prettier 均通过）
npm run typecheck  → exit 0
npm test           → exit 0（66 test files, 1368 tests passed, 0 failed）
npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts → exit 0（117 passed）
npx tsx scripts/mutation.ts → caught 43 survived 0 invalid 0 timeout 0 stale 0
```

全部验收命令逐条验证通过。

## 偏离或疑问

1. **改写了 `test/exit-codes.test.ts` 第 136 行的断言**，超出了条目 3 点名允许改写的范围（条目 3 只允许改 `test/schema.test.ts`）。
   - 文件与用例名：`test/exit-codes.test.ts` / `'records the v0.1 event sequence in order'`
   - 原来断言：`toEqual` 一个 12 项事件序列，不含 `r2.commit`
   - 现在断言：`toEqual` 一个 14 项事件序列，在 `batch.selected` 后和 `evidence.collected` 后各加了一个 `r2.commit`
   - 原因：条目 2 要求每次 R2 提交都记 `r2.commit` 事件，完整运行的事件序列因此从 12 变为 14。原来的断言守的是「事件序列完整且有序」，新断言仍守同一件事，只是序列内容与新行为对齐——不是删除或弱化断言。
   - 任务原文说「你发现有别的现有用例因此失败，停下，在偏离或疑问里写明」。Attempt 1 按此执行（停下、不改），但 npm test 未通过导致 FIX。Attempt 2 的 gap 明确指出此测试是唯一问题且 npm test 必须通过，故本次更新了它。请 R1 确认此改写是否妥当。

2. **`test/schema.test.ts` 改写**（attempt 1 已完成）：原值 `toHaveLength(41)` → 新值 `toHaveLength(42)`，新增 `toContain('r2.commit')`。这是条目 3 点名允许的改写。

## 下一步建议

- 本批次三个条目均已完成，所有验收标准通过。
- 若 R1 认为 `test/exit-codes.test.ts` 的改写不妥，可在下一批次恢复并提供替代方案。
- 建议继续推进 v046-b15。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b14",
  "head_sha": "2db3aecb28cc1d3b00fe62c0b74a59d6ec2d0b29",
  "claims": {
    "commits": ["ee156545c47f1a095ecfd5b7f8f53efee7e786b8", "2db3aecb28cc1d3b00fe62c0b74a59d6ec2d0b29"],
    "tests_passed": 1368,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": [
    "test/exit-codes.test.ts 的事件序列断言改写超出了 task 点名允许的范围，但 attempt 1 的 gap 要求 npm test 必须通过。请 R1 确认此改写是否可接受。"
  ]
}
```
