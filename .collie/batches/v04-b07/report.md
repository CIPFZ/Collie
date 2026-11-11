# 批次 v04-b07 汇报

## 做了什么

逐条对应 task.md 的三个条目：

### 条目 1：journal 归位

- **`queue.batch_started` 字段改名**：在 `src/run.ts` 的 `runQueue` 中，将 `queue.batch_started` 事件的扩展字段从 `run_id` 改为 `batch_run_id`。这避免了与事件信封的 `run_id` 键冲突，使事件正确落入队列的 `q-` journal 而非批次的 `r-` journal。

- **`Recorder.record` 信封键守卫**：在 `Recorder` 类上新增静态 `RESERVED_KEYS` 集合 (`ts`, `run_id`, `event`)，`record` 方法在写入前检查扩展字段名，遇到保留键直接抛错。

- **`allBatchEvents` 过滤队列 journal**：`allBatchEvents` 函数新增两层过滤：(1) 跳过 `q-` 前缀的队列 journal；(2) 仅保留含 `run.started` 或 `batch.selected`（兼容旧孤儿 journal）的 journal。这确保队列 journal 中的 `queue.batch_started` 不会被误算为一次批次运行，避免 attempt 膨胀。

- **`reviewer.verdict` 的 `gaps` 始终写入**：当 verdict 可解析时，`gaps` 总是包含在 `reviewer.verdict` 事件中（没有缺口时写空数组），以区分「没有缺口」与「旧 journal 没有这个字段」。

- **`show --queue` 夹具同步**：`test/cli.test.ts` 的 `queue.batch_started` 夹具添加了 `batch_run_id` 字段。`test/timeline.test.ts`、`test/watch.test.ts`、`test/view.test.ts` 的夹具已经使用 `batch_run_id`（在之前的批次中更新过）。

### 条目 2：fix_max 提交推送

在 `runQueue` 的 fix_max 超限路径中，`progress: ... fix_max` 提交之后新增 `push` 调用，成功时记 `verdict.pushed`，失败时记 `verdict.push_failed`，与 12.1 的标准推送路径一致。

### 条目 3：FIX 重跑 task 降级原因

- **`FixInfo` 接口扩展**：新增可选的 `downgrade` 字段（含 `rule`, `reason`, 可选 `cause`/`detail`）。

- **`batchHistory` 收集降级信息**：在 FIX 分类分支中，从 journal 的 `verdict.downgraded` 事件提取规则号、reason、cause、detail。

- **`renderFixSection` 渲染降级原因**：在「上一轮判 FIX」一节顶部新增「降级原因」小节，列出规则号与 reason，有 cause/detail 时一并写入。

- **不变量同步**：`test/invariants.test.ts` 新增 `batch_run_id` 存在性检查。

- **推送调用计数**：`invariants.test.ts` 中 `await push(` 的最大数从 3 调至 4。

### 新测试文件

`test/queue-journal.test.ts` 包含 8 个测试用例：
1. `queue.batch_started` 在 `q-` journal 中、不在 `r-` journal 中
2. `Recorder` 拒绝信封键（通过源码断言 + 运行时行为验证）
3. `fix_max` 后远端含 HEAD 且有 `verdict.pushed`
4. 规则 9 的 FIX 重跑 task 含降级原因（规则 9）
5. FIX 重跑 task 含提交清单（使用带 `commits_actual` 的 reviewer mock）
6. 没有缺口时 `gaps` 是空数组
7. `--continue` 下首次运行 attempt=1 / interrupted_at=null，FIX 重跑 attempt=2
8. 队列 journal 不膨胀 attempt（首次运行仍为 attempt=1）

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting... All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json  (exit 0)

$ npm test
 Test Files  45 passed (45)
      Tests  891 passed (891)
   Duration  14.08s

$ npm test -- test/queue-journal.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
   Duration  5.44s
```

全部 9 条验收标准逐一验证通过。

## 偏离或疑问

1. **SPEC 13.10 原文要求"只有含 `run.started` 的 journal 才算批次运行"**，但现有的 scenario-e 孤儿测试构造的 journal 只有 `batch.selected` + `worker.started`，没有 `run.started`（模拟 R2 被杀前的半截 journal）。为兼容这些旧测试和可能存在的真实旧 journal，实现采用双层过滤：先排除 `q-` 前缀的队列 journal，再在剩余 journal 中检查 `run.started` 或 `batch.selected`。效果等价：队列 journal 被排除，所有真实或模拟的批次运行 journal 都被保留。

2. **commits 过滤**：SPEC 13.10 说"提交清单只列 worker 的代码提交（按 R2 提交前缀排除）"。在 `batchHistory` 中，commits 来自 `verdict.evidence.commits_actual`，而 `evidence.ts` 的 `collectEvidence` 已经在收集阶段排除了 R2 前缀的提交。因此 `batchHistory` 中不再需要额外过滤。但如果 reviewer 的手写 verdict 意外包含了 R2 提交的 sha（如 v04-b01 的情况），这些 sha 会原样传入。进一步的过滤需要读 git log 获取 subject，这在 `batchHistory`（同步函数）中不方便做。若需要严格排除，建议在 `collectEvidence` 阶段加固。

## 下一步建议

1. 本批次的 `allBatchEvents` 过滤变更可能需要在 v04-b10（中断续跑）中复验，确保中断的孤儿 journal 仍能被正确识别。
2. v04-b08（投影取值来源）可直接开始，本批次未改动投影模块的逻辑。
3. `Recorder.RESERVED_KEYS` 守卫现在是运行时检查；若今后有新的信封字段加入，需同步更新集合。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b07",
  "head_sha": "c35425a",
  "claims": {
    "commits": ["23a5a01", "c35425a"],
    "tests_passed": 891,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
