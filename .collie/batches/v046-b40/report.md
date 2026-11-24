# 批次 v046-b40 汇报

## 做了什么

**条目 1 — `src/backlog.ts` 归档文件支持：**
- 导出常量 `BACKLOG_ARCHIVE_RELATIVE_PATH`（`docs/backlog-archive.md`）。
- `loadBacklog` 在归档文件存在时两处都读：先用 `extractOverviewIds` 从两个文件中各提取批次 ID 集合，然后分别调用 `parseBacklog` 时传入对方的 ID 作为 `externalIds`，使跨文件依赖在单文件验证时就能通过。
- 归档里的批次排在前面（`[...archiveBatches, ...mainBatches]`）。
- 归档批次状态必须是 `passed` 或 `blocked`，否则抛 `BacklogError`（信息含批次号）。
- 同一批次号在两处都有时抛 `BacklogError`（信息含批次号和归档文件名）。
- `parseBacklog` 新增可选第三参数 `externalIds?: ReadonlySet<string>`，用于传入「另一处已有的批次号」，使依赖检查在并集里核对。单文件使用时行为不变。

**条目 2 — 受保护路径与变异清单：**
- `src/evidence.ts` 的 `PROTECTED_PATHS` 加上 `'docs/backlog-archive.md'`。
- `scripts/mutation.ts` 的清单加一项 `protected:docs/backlog-archive.md`，共 47 项；注释里的项数从 46 改为 47，protected paths 子标题从 10 改为 11。

**条目 3 — 测试：**
- `test/evidence.test.ts` 加一条 `counts docs/backlog-archive.md as protected (SPEC 16.27)`。
- `test/mutation.test.ts` 的 `every protected path is in the mutation list`：13 改成 14（条目 3 点名允许的改写）。
- `test/invariants.test.ts` 加一条 `src/evidence.ts has docs/backlog-archive.md in PROTECTED_PATHS (v046-b40)`。

## 测试结果

```
npm run lint      → exit 0（ESLint + Prettier 零错误）
npm run typecheck → exit 0（tsc 零错误）
npm test          → exit 0（82 test files, 1569 tests passed）
npm test -- test/acceptance/v046-b40 → exit 0（2 files, 9 tests passed）
grep -qF "protected:docs/backlog-archive.md" scripts/mutation.ts → exit 0
npm run test:mutation → caught 47 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

- `test/mutation.test.ts` 的 `every protected path is in the mutation list`：原值 13，新值 14。原因：新增了一项受保护路径 `docs/backlog-archive.md`，对应的变异检查项使 protected 项总数从 13 变为 14。这是条目 3 点名允许的改写。

## 下一步建议

- R1 可以开始将已了结的批次从 `docs/backlog.md` 挪入 `docs/backlog-archive.md`，`loadBacklog` 已经能正确合并两处。
- 后续可考虑给 `collie show` / `collie status` 加上归档文件来源标记，方便区分哪些批次来自归档。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b40",
  "head_sha": "85bdf6c53f493550e9e4fbc1106328158f5ab960",
  "claims": {
    "commits": ["85bdf6c53f493550e9e4fbc1106328158f5ab960"],
    "tests_passed": 1569,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
