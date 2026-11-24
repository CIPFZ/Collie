# 批次 v046-b46 汇报

## 做了什么

**条目 1：EvidenceSchema 导出与 VerdictSchema.evidence 可选化。**
在 `src/schema/index.ts` 中，将原来内联在 VerdictSchema 里的 evidence 对象抽成了独立导出的 `EvidenceSchema`。VerdictSchema 的 `evidence` 字段改为 `EvidenceSchema.optional().default(...)` ——这使得 `safeParse` 可以接受没有 `evidence` 键的裁决 JSON（reviewer 可以省略），同时解析后的 Verdict 类型里 evidence 仍然是必有的（给了空值默认），所以 arbiter.ts 和其他读取 `verdict.evidence.*` 的代码不需要改动。`src/evidence.ts` 的 `Evidence` 类型改为 `z.infer<typeof EvidenceSchema>`，仍然是全字段必有的形状。

**条目 2：reviewer 输入加 evidence、提示词加 R2 取证结果节、run.ts 传递。**
`src/roles/reviewer.ts`：`ReviewerInputSchema` 加了可选的 `evidence` 字段（使用 `EvidenceSchema.optional()`）。`buildReviewerPrompt` 在输入带 evidence 时，在「验收命令」之后、「需要自行阅读的 SPEC 章节」之前，插入一节「## R2 的取证结果」，格式严格按 SPEC 16.30 的代码块：每条验收命令一行（`命令 → exit 退出码：摘要`），然后四行（已推送、CI、受保护文件改动行数、依赖变化）。输入不带 evidence 时，提示词与之前完全相同。
`src/run.ts`：在拉起 reviewer 时把 `collected.evidence` 传入 reviewer input。reviewer 结论里没有 evidence 时，VerdictSchema 解析成功（用默认值），仲裁照常用 R2 自己的证据（代码里已有 `{ ...verdict.value, evidence: collected.evidence }` 的 spread 覆盖），行为不变。

**条目 3：改写允许的旧用例。**
`test/reviewer-isolation.test.ts` 的 `accepts exactly the SPEC 4.2 allow-list of input fields` 用例：类型清单里加了 `'evidence'`。

## 测试结果

```
npm run lint     → exit 0（ESLint + Prettier 均通过）
npm run typecheck → exit 0（零错误）
npm test         → 94 test files, 1624 tests passed
npm test -- test/acceptance/v046-b46 → 2 test files, 8 tests passed
npm run test:mutation → caught 47 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

- 条目 3 点名的改写：`test/reviewer-isolation.test.ts` 的 `accepts exactly the SPEC 4.2 allow-list of input fields`，原断言是类型清单 `'batch_id' | 'base_sha' | 'head_sha' | 'items' | 'acceptance' | 'spec_paths'`，现改为加上 `| 'evidence'`，原因是 ReviewerInput 新增了可选的 evidence 字段。
- VerdictSchema 的 evidence 用了 `.optional().default(emptyEvidence)` 而非纯 `.optional()`。纯 `.optional()` 会让 Verdict 类型的 evidence 变成 `... | undefined`，导致 arbiter.ts（禁止改动）里所有 `evidence.*` 访问产生 TS 错误。使用 `.default()` 与 `claim_mismatches` 的做法一致：schema 接受缺失，但解析后类型始终非空。

## 下一步建议

- 本批次完成了需求审查第 2a 批。进入固定版本后 R1 可重写 AGENT-reviewer.md（16.29 表格里写的：不再重跑验收命令，三件事）和铁律 6 的「只看」清单。
- 第 2b 批（reviewer 输出加 test_gaps）和第 3 批（reviewer 写文件做实验）可以继续签发。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b46",
  "head_sha": "fca77e2705d3223747853ae859db1a3b8a979c0c",
  "claims": {
    "commits": ["fca77e2705d3223747853ae859db1a3b8a979c0c"],
    "tests_passed": 1624,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
