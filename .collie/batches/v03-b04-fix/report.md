# 批次 v03-b04-fix 汇报

## 做了什么

### 条目 1：FIX 重跑的 task 语义

在 `src/run.ts` 中：
- 新增 `classifyRun` 函数，将运行结果分为三类：`pass`、`fix`、`interrupted`。FIX 不再被归类为中断。
- `batchHistory` 中 FIX 路径：`attempt` 递增但 `interruptedAt` 保持 `null`，同时从 `verdict.md` 和 journal 中收集 gaps、失败的验收命令、提交列表，存入 `FixInfo`。
- 新增 `renderFixSection(info: FixInfo)` 函数，生成「上一轮判 FIX」一节，包含 gaps 原样、未通过的验收命令与退出码、上一轮代码提交清单、「只补缺口，不要重做」。
- `runBatch` 在 `history.fixInfo` 存在时将渲染好的 fix section 传给 `buildTask`。

在 `src/roles/worker.ts` 中：
- `TaskContext` 新增可选 `fixSection` 字段。
- `buildTask` 将 `fixSection` 追加到 task body 末尾。

场景测试（`test/scenario-j.test.ts` group 4）：第 1 轮 fake reviewer 判 FIX 带 gaps，第 2 轮 worker 捕获 task.md 并断言：含「上一轮判 FIX」、含 gaps 文本、不含「上一轮中断」、`interrupted_at: null`、含「只补缺口，不要重做」。

### 条目 2：fix_max 只计本次队列

在 `src/run.ts` 的 `runQueue` 中：
- 移除 `countBatchFinished` 函数（原先扫描全部历史 journal 的 `run.finished` 事件）。
- 改用 `fixCounts: Map<string, number>` 内存计数器，仅在当前 `--continue` 会话内累计每个批次的 FIX 次数。
- FIX 路径中 `currentFixes` 递增后与 `config.limits.fix_max` 比较。

场景测试（group 5）：预先放置 2 个该批次的历史 FIX journal，运行 `--continue`，验证仍需 3 次 FIX 才触发 escalated（历史不计入）。

### 条目 3：队列 journal 与 show --queue

在 `src/run.ts` 的 `runQueue` 中：
- 每次拉起批次运行前调用 `queueRec.record('queue.batch_started', { run_id, batch_id, attempt, why })`，`why` 取 `new` / `fix_retry` / `rule1_retry`。
- `QueueOutcome.batches` 从 `string[]` 改为 `{ batch_id, run_id, verdict }[]`。
- `batchesRun.push` 改为对象形式。

在 `src/schema/index.ts` 中：
- `EVENT_TYPES` 新增 `'queue.batch_started'`。

在 `src/cli.ts` 中：
- 新增 `showQueue` 函数，从 queue run 的 events.ndjson 打印时间线。
- `show` 命令新增 `--queue <q_run_id>` 选项。
- `runContinue` 输出格式更新为 `batch_id:verdict`。

在 `test/invariants.test.ts` 中：
- 新增「src/run.ts 含 queue.batch_started」不变量。
- 新增「src/run.ts 不含 countBatchFinished（排除注释）」不变量。

在 `test/cli.test.ts` 中：
- 新增 `show --queue` 测试组：验证打印时间线和不存在的 q-run_id 返回 exit 1。

在 `test/schema.test.ts` 中：
- EVENT_TYPES 长度从 31 更新为 32，新增 `queue.batch_started` 断言。

在 `test/scenario-j.test.ts` 中：
- 更新 group 1 和 group 3 的 `finished.batches` 断言为对象数组格式。

## 测试结果

```
npm run lint   → 0 errors
npm run typecheck → 0 errors
npm test → 801 passed, 0 failed
```

验收命令逐条通过：
1. `npm run lint` → exit 0
2. `npm run typecheck` → exit 0
3. `npm test` → exit 0
4. `grep -qE "上一轮判 FIX" src/run.ts && grep -qE "上一轮判 FIX" test/scenario-*.test.ts` → exit 0
5. `! grep -v '^\s*//' src/run.ts | grep -qE "countBatchFinished" && grep -qE "escalated" test/scenario-*.test.ts` → exit 0
6. `grep -qE "queue\.batch_started" src/schema/index.ts && grep -qE "fix_retry" src/run.ts` → exit 0
7. `grep -qE "\-\-queue" src/cli.ts && grep -qE "\-\-queue" test/cli.test.ts` → exit 0
8. `grep -qE "queue\.batch_started" test/invariants.test.ts` → exit 0

## 偏离或疑问

无。所有实现均按 task.md 条目和 SPEC 规定完成。

## 下一步建议

- 本批次 3 个条目均已完成并通过全部验收。
- 后续可考虑为 `collie show --queue` 增加更丰富的格式化（如按批次分组、显示耗时等）。
- `FixInfo` 的 `failedAcceptance` 数据来源依赖 journal 中 `acceptance.failed` 事件，若 reviewer 没有记录该事件则为空——这是当前 reviewer 实现的正常行为，不影响功能。

```json
{
  "schema_version": 1,
  "batch_id": "v03-b04-fix",
  "head_sha": "ebc4154895d6c9152efc3c07379338c3a05eee15",
  "claims": {
    "commits": ["ebc4154895d6c9152efc3c07379338c3a05eee15"],
    "tests_passed": 801,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
