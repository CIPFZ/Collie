# 批次 v04-b15 汇报

## 做了什么

1. **结论行的 rule/reason 回退取值（SPEC 13.20）**：修改 `src/view.ts` 的 `projectWhyAttempt`，使 `rule` 和 `reason` 字段按顺序取值：`run.finished.rule` → 最后一条 `verdict.downgraded.rule` → `null`；`reason` 同理。同时将 `verdict.downgraded` 的查找从 `findEvent`（第一条）改为 `findLastEvent`（最后一条），符合 SPEC 要求。修改 `conclusionLine` 函数：当 rule 为 null 时显示 `规则 —`，消除了旧 journal 中 `结论：FIX，` 以逗号结尾的问题。`--json` 输出的 `rule`/`reason` 由于直接序列化 `WhyAttempt`，自动获得相同的回退逻辑。

2. **测试用例（`test/why.test.ts`）**：新增 6 个手写夹具测试：
   - 无 `rule` 但有 `verdict.downgraded` rule 9 → 结论行含 `规则 9`，文本含 `证据缺失`
   - 两者都无 → 含 `规则 —`，不以逗号结尾
   - `run.finished` 自带 rule → 输出不变
   - `--json` rule/reason 从 downgraded 回退取值
   - `--json` 都取不到时为 null

3. **不变量（`test/invariants.test.ts`）**：新增「`src/view.ts` 含 `规则 —`」检查。

## 测试结果

```
npm run lint && npm run typecheck && npm test

lint: exit 0 (eslint + prettier clean)
typecheck: exit 0 (tsc clean)
test: 50 files, 961 tests passed, 0 failed

npm test -- test/why.test.ts
1 file, 19 tests passed (含新增 6 个), 0 failed
```

所有 7 条验收命令均通过。

## 偏离或疑问

无。

## 下一步建议

v04-b15 的三个条目已全部完成。可继续推进 v04-b16（report sha 解析不了的处理）。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b15",
  "head_sha": "dc366ea89b8a6a9b1efe054aedd9cb9e489d2cba",
  "claims": {
    "commits": ["dc366ea"],
    "tests_passed": 961,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
