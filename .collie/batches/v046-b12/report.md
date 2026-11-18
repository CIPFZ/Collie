# 批次 v046-b12 汇报

## 做了什么

三个条目全部完成（代码来自上一轮 attempt 1，本轮仅补 report）：

1. **tester opts 与事件**：`src/roles/tester.ts` 的 `runTester` 加了第五个可选参数 `opts`（`signal`、`onEvent`、`redact`），原样交给运行器，写法与 `runReviewer` 一致。`src/acceptance.ts` 的 `prepareAcceptance` 新增 `signal`、`onTesterEvent(attempt, event)`、`redact`；`signal` 已中止时不再拉起下一次，按 `tester_failed` 结束。事件字段：`tester.started` 含 `attempt`/`model`/`max_turns`；`tester.finished` 含 `attempt`/`exit_code`/`num_turns`/`cost_usd`/`duration_ms`/`usage`。旧的 `exitCode` 已改名为 `exit_code`。

2. **misclassified 声明**：数组里的每项可以是字符串或 `{ id, why }` 对象；失败返回值的 `misclassified` 把对象转成 `<id>：<why>` 格式的字符串，没有声明时为空数组。

3. **测试**：
   - `test/prepare-acceptance.test.ts` 新加 `describe('prepareAcceptance: tester events, signal and misclassified list', …)`，覆盖事件转发、signal 中止、misclassified 对象转换、字符串写法。
   - `test/tester.test.ts` 新加 `describe('tester: run options are forwarded', …)`。
   - `test/redcheck.test.ts`：临时目录改名、断言无 `collie-redcheck-*` 残留、新加 `describe('runRedCheck: leaves nothing behind', …)`。
   - `test/prepare-acceptance.test.ts` 的建仓库辅助函数已隔离 git 全局配置（`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_NOSYSTEM`）。
   - 真实 vitest 子进程的用例 `timeoutMs` 改为 240 秒，用例自身超时设 300 秒。
   - `test/invariants.test.ts` 加了 `onTesterEvent` 检查。

## 测试结果

```
npm run lint       → exit 0
npm run typecheck  → exit 0
npm test           → 64 passed (1351 tests), 0 failed
npm test -- test/prepare-acceptance.test.ts test/tester.test.ts test/redcheck.test.ts
                   → 3 passed (78 tests), 0 failed
GIT_CONFIG_GLOBAL=<gpgsign> GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts
                   → 1 passed (24 tests), 0 failed
```

全部 9 条验收命令均 exit 0。

## 偏离或疑问

无。所有工作在 attempt 1 已完成并推送，本轮仅补缺失的 report。

## 下一步建议

v046-b12 的三个条目完成后，`prepareAcceptance` 已具备事件转发、signal 中止和 misclassified 解析能力，可以在后续批次将其接入队列。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b12",
  "head_sha": "dbc2f9636f7da1f8fc9742077297bf39715d9147",
  "claims": {
    "commits": [
      "bf74064c45a51c52cd428566ced1d92db1fea7dd",
      "dbc2f9636f7da1f8fc9742077297bf39715d9147"
    ],
    "tests_passed": 1351,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
