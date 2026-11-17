# 批次 v045-b18 汇报

## 做了什么

### 条目 1：SDK 抛错分支补充结束原因

在 `src/runner/claude.ts` 的 `run()` 方法 catch 块中，当已收集到 result messages 且 SDK 随后抛错时，
调用 `aggregateResults` 汇总后可能没有 `stopReason`（比如所有 result 都是 `success` 但 SDK 随后断流）。
修复方式：在返回时用 `rest.stopReason ?? 'error'` 确保失败返回值一定带结束原因。

- 被软停（interrupted）的仍保持 `stopped`
- 有 `error_max_turns` 的仍保持 `turns_exhausted`
- 其余汇总后无结束原因的，记为 `error`

另外两处（`subtype: success` 但 `is_error: true` → `error`；成功但文本为空 → 不带 `finalText`）
是 v045-b15 已实现的正确行为，只补了测试。

做完之后，`run` 的任何返回值，只要退出码不是 0，就带结束原因——三条路径分别是：
1. catch 块有 results → `aggregateResults` + `?? 'error'` 兜底
2. catch 块无 results 但有 sessionId → 硬编码 `stopReason: 'error'`
3. catch 块无 results 无 sessionId → 直接 throw（不返回 RunResult）

正常路径中，`aggregateResults` 的 `!allSucceeded` 分支已经填 `'error'`，
`interrupted` 填 `'stopped'`，`error_max_turns` 填 `'turns_exhausted'`，
只有全部成功时 `stopReason` 为 undefined（此时 exitCode 也是 0，符合要求）。

### 条目 2：新测试组

在 `test/runner-claude.test.ts` 新增 describe `'runner-claude: failed runs always carry a stop reason'`，包含 4 条用例：

1. 一条成功 result 后 SDK 抛错 → exitCode 1、stopReason `error`、cost/turns/usage/sessionId 正常带回、无 finalText
2. 两条成功 result 后 SDK 抛错 → 同上，numTurns 是两条之和
3. `subtype: success` 但 `is_error: true` → exitCode 1、stopReason `error`、无 finalText
4. 成功但 result 文本为空串 → exitCode 0、返回值里没有 `finalText` 键

未修改任何已有用例。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(exit 0, no errors)

$ npm test
 Test Files  60 passed (60)
      Tests  1196 passed (1196)
   Duration  21.02s

$ npm test -- test/runner-claude.test.ts
 Test Files  1 passed (1)
      Tests  79 passed (79)
   Duration  345ms

$ grep -qF "failed runs always carry a stop reason" test/runner-claude.test.ts
(exit 0)
```

## 偏离或疑问

无

## 下一步建议

本批次完成了 SPEC 14.22 的要求。可以考虑在不变量测试里增加一条结构性断言：
「`run()` 的所有 exitCode !== 0 路径都设置了 stopReason」，作为防回归护栏。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b18",
  "head_sha": "ced58c76e3ca4e8ddeefeca8e42e4b15c0d0cabc",
  "claims": {
    "commits": ["ced58c7"],
    "tests_passed": 1196,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
