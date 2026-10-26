# 批次 v02-e-fix2 汇报

## 做了什么

三个条目逐一实现：

1. **`run.ts` rescue_sha 跨轮查找**：修改 `batchHistory()` 在主循环之前先从被排除的当前运行的 journal 中收集 `run.orphaned` 事件的心跳 `updated_at`（用于 `readStreamLastEvent` 的时间戳回退），以及 `worker.rescued` 事件的 `sha`（孤儿救援路径）。主循环结束后，若当前运行有 `worker.rescued`，用它覆盖 `rescueSha`。这解决了演练发现的问题：孤儿救援记在当前运行的 journal 里，而 `batchHistory` 排除了当前运行，导致 `rescue_sha` 未能进入 task.md。

2. **`readStreamLastEvent` 细化**：新增 `refineEventType()` 辅助函数，当 SDK 事件的 `type` 为 `assistant` 或 `user` 时，优先从 `content` 数组中提取 `tool_use` 的 `name`（返回 `tool_use/<name>`），其次用 `type/subtype`。时间戳改为读取 SDK 消息的 `timestamp` 字段（而非旧代码的 `ts`），未找到则向前逐行搜索最近一条有 `timestamp` 的行，再退到 `heartbeatUpdatedAt` 参数，最终兜底为 `'unknown'`——保证返回值的 `ts` 永不为空。同步更新了已有测试中 stream 事件的字段名（`ts` → `timestamp`）。

3. **`test/scenario-e.test.ts` 孤儿救援路径测试**：新增 `describe` 块含两个测试用例：
   - 主测试：手动写入心跳（死 PID）、orphan 运行的 journal（无 `run.finished`）、stream.ndjson（最后一行是无 `timestamp` 的 `user` 消息，含 `tool_use` content），以及脏文件。然后通过 `box.run()` 执行第二轮。断言 task.md 的 `rescue_sha` 等于 `worker.rescued.sha`、正文含「请先核实」、`interrupted_at` 含 `orphaned`、时间非空且为 ISO 日期、事件类型为 `tool_use/Bash`（不是裸 `user`）。
   - 心跳回退变体：stream 中完全无 `timestamp`，断言 `interrupted_at` 的时间部分包含心跳的 `updated_at`。

   还在 `test/invariants.test.ts` 新增不变量测试，验证 `rescue_sha` 和 `请先核实` 在 `run.ts` 和 `worker.ts` 中存在。

## 测试结果

```
$ npm run lint
All matched files use Prettier code style!

$ npm run typecheck
> tsc -p tsconfig.json
(exit 0)

$ npm test
 Test Files  34 passed (34)
      Tests  677 passed (677)

$ npm test -- test/scenario-e.test.ts
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

所有 7 条验收命令均通过（exit 0）。

## 偏离或疑问

无。三个条目严格按 SPEC 11.7 和 task.md 要求实现，未引入新依赖，未修改受保护文件。

## 下一步建议

本批次是 v0.2 的收口批次。若 PASS，v0.2 即完成。

```json
{
  "schema_version": 1,
  "batch_id": "v02-e-fix2",
  "head_sha": "43e22ecd775f5d988c04f9aed821b3cf4932be06",
  "claims": {
    "commits": ["43e22ecd775f5d988c04f9aed821b3cf4932be06"],
    "tests_passed": 677,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
