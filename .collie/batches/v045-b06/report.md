# 批次 v045-b06 汇报

## 做了什么

**条目 1：开始、墙钟与合计。**

根因是 `runQueue` 从不写 `run.started`（队首是 `queue.preflight`），所以 `projectReport` 里原来的 `findEvent(queueEvents, 'run.started')` 一直是 `undefined`，开始与墙钟恒为 `—`。现在：

- `src/view.ts` 的 `projectReport`：开始 = `queueEvents[0].ts`（`queue.preflight` 或 `queue.batch_started` 都适用）；墙钟 = `queue.finished.ts − 开始`。
- `projectTimeline`：循环改成带下标的 `entries()`，`q-` 开头的 journal 在 `eventIndex === 0` 时输出 `queue_start` 节点，时间取同一条事件。旧 journal 如果第一条是 `run.started`，行为与以前一致。
- `formatReport` 的「实际经过」表末尾追加一行 `| 合计 | …`：用时、worker 花费、reviewer 花费、合计花费各自对非空值求和，全为空时显示 `—`；左侧各列留空。
- 「实际经过」表的 worker 轮数一列改用 `formatTurns(workerTurns, workerMaxTurns)`，数据来自 `worker.started.max_turns`（旧 journal 没有该字段则只显示轮数）。
- 删除了 `test/report.test.ts` 中手工写进 `q-` journal 的 `run.started` 夹具（改为 `queue.batch_started`），开始/墙钟/合计三条断言全部由 `Sandbox` 真实跑 `run --continue` 后读产出，不手写事件。

**条目 2：轮数上限。**

`src/run.ts` 只改两处记录：`worker.started` 追加 `max_turns: config.agent.worker.max_turns`，`reviewer.started` 追加 `max_turns: config.agent.reviewer.max_turns`。新增 `formatTurns`：`<轮数>/<上限>`，相等时加 `（到上限）`，无上限数据时只显示轮数。`why` 的 `worker:` / `reviewer:` 行与 `report` 表的 worker 轮数一列都用它。

**条目 3：其余补齐。**

- 「放行与打扰」加 `tool.denied：<n>`（合计本次队列各运行的 `tool.denied` 条数：批运行 journal 加队列 journal 本身）与每条 `batch.status`（`batch.status: <批次> <from> → <to>`）。注意常态 PASS/BLOCK 的 `batch.status` 记在**批运行** journal（`run.ts:2066` 用批的 `rec`），队列 journal 只有 `updateBacklogToDisk` 的升级路径，因此两处都收集。
- `why` 的 `ci:` 行在 `waited` 之后追加 `polls=<n>` 与 `run_url`；`ci.verdict_commit:` 行末尾在有值时追加 `run_url=<url>`。
- 测试：`test/report.test.ts`（合计、开始/墙钟来自真实队列 journal、tool.denied 与 batch.status）、`test/why.test.ts`（`turns=12/200`、`turns=5/60`、`polls=`、两处 `run_url`、`到上限`、旧 journal 无上限）、`test/timeline.test.ts`（Sandbox 真实 `run --continue` 的 `queue_start` 时间戳）、`test/journal-fields.test.ts`（两个 `started` 事件的 `max_turns`）、`test/invariants.test.ts`（`src/run.ts` 含 `max_turns`）。

## 测试结果

```
npm run lint      → exit 0（eslint 通过，prettier --check 全部符合）
npm run typecheck → exit 0（tsc -p tsconfig.json 无输出）
npm test          → Test Files 56 passed (56), Tests 1085 passed (1085)，19.90s
npm test -- test/report.test.ts test/why.test.ts test/timeline.test.ts test/journal-fields.test.ts
                  → Test Files 4 passed (4), Tests 69 passed (69)，12.35s
```

验收 grep 全部 exit 0（`! grep -A3 … run.started`、run.ts 与 journal-fields 的 `max_turns`、view.ts 与 why.test 的 `到上限`、view.ts 与 why.test 的 `polls=`、timeline 的 `queue_start` + `Sandbox.create`、invariants 的 `max_turns`）。

## 偏离或疑问

- 「放行与打扰」的 `batch.status` 来源：SPEC 14.10 只说「每条 `batch.status`」，没点名 journal。实测普通 PASS 流程的 `batch.status` 记在批运行 journal（`run.ts:2057-2069`，`rec` 是批的 recorder），只有升级路径（`updateBacklogToDisk`）写进队列 journal。实现上两处都收集，否则正常队列的 report 里一条都不会出现。若 R1 预期只读队列 journal，这里会多出普通批的状态行，请确认。
- 合计行的 `用时` 是各行 `run.finished.ts − run.started.ts` 的算术和，不是墙钟；两者在有等待/重试间隔时不同，这是按 SPEC「用时」列的语义理解的。
- 改了 `test/report.test.ts` 三处表格行过滤器（追加 `!line.includes('合计')`），仅因为新增了合计行，原断言的数量与内容未放宽。
- `src/view.ts` 里 `queue_start` 的 `runId` 改为取 `rd.events[0].run_id`，对同一条 journal 恒等于 `e.run_id`，仅为防御性写法，无行为差异。

## 下一步建议

- R1 确认 `batch.status` 是否应同时包含批运行 journal 中的记录（见上）；若只保留队列 journal，改动只在 `projectReport` 一段。
- 旧队列 journal（首事件是 `run.started`）现在也能给出开始与墙钟，建议在下一轮回归时用一份 v045 之前的真实 journal 抽查一次 `report` 输出。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b06",
  "head_sha": "cb01b5dea3cd74583a3403273f6e53ab1562a20d",
  "claims": {
    "commits": ["cb01b5d"],
    "tests_passed": 1085,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
