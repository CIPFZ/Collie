# 批次 v045-b14 汇报

## 做了什么

### 条目 1：`src/runner/claude.ts` — SDK 抛错但已有结果消息时带回花费与轮数

在 `run()` 方法的 `catch (error)` 块中，新增了对 `result !== undefined` 的检查。
当消息循环抛错时，如果之前已经收到过结果消息（`isResultMessage` 为 true），
返回的 `RunResult` 现在包含：
- `costUsd`（来自 `result.total_cost_usd`）
- `numTurns`（来自 `result.num_turns`）
- `usage`（来自 `result.usage`，经 `toUsage()` 转换）
- `sessionId`（来自 `result.session_id` 或 `lastSessionId`）
- `stopReason`：如果结果消息的 `subtype` 是 `error_max_turns`，映射为 `turns_exhausted`；其他情况映射为 `error`。这与正常结束时的映射逻辑一致。
- `durationMs`：墙钟时间

行为不变之处：
- `exitCode` 始终为 1（非 0），不带 `finalText`
- 没有收到过结果消息的情况，行为完全不变（原有的 `lastSessionId` 分支和 `throw error` 分支）
- 被 signal 中止的情况不受影响（`opts.signal?.aborted` 检查在新逻辑之前）

### 条目 2：`test/runner-claude.test.ts` — 新用例组

新增 `describe('claude runner: result message before the SDK throws', …)` 包含 3 条用例：
1. `error_max_turns` 结果消息 + 抛错 → 返回 `costUsd`=3.14, `numTurns`=25, `stopReason`='turns_exhausted', `exitCode`=1, 无 `finalText`, 有 `usage` 和 `sessionId`
2. `error_during_execution` 结果消息 + 抛错 → 返回 `costUsd`=0.42, `numTurns`=3, `stopReason`='error', `exitCode`=1, 无 `finalText`
3. 无结果消息就抛错 → 和现在一样，reject with 原始错误

已有用例一条都没有改。

## 测试结果

```
npm run lint      → exit 0 (eslint + prettier 均通过)
npm run typecheck → exit 0 (tsc 零错误)
npm test          → exit 0 (60 test files, 1166 tests passed, 0 failed)
npm test -- test/runner-claude.test.ts → exit 0 (70 tests passed)
grep -qF "result message before the SDK throws" test/runner-claude.test.ts → exit 0
```

## 偏离或疑问

无

## 下一步建议

无特别建议。本批次范围清晰且已完成。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b14",
  "head_sha": "4aacee5a15fddeb04aeebbf57d44c3f8fefbc01d",
  "claims": {
    "commits": ["4aacee5a15fddeb04aeebbf57d44c3f8fefbc01d"],
    "tests_passed": 1166,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
