# 批次 v04-b10 汇报

## 做了什么

逐条对应 task.md 的三个条目：

1. **中断续跑（SPEC 13.14）**：在 `src/run.ts` 的 `runQueue` 中新增中断自动续跑逻辑。当批次运行走上报路径（escalation，无可解析 report）且 `worker_stop_reason` 为 `idling`/`stalled`/`wallclock` 之一时，若该批次在本次队列中尚未因中断续跑过，则自动重跑一次。具体做法：
   - 新增 `interruptRetried: Set<string>` 追踪本次队列内已中断续跑过的批次
   - 记录 `batch.retried`（字段 `cause: 'interrupted'`、`stop_reason`）
   - 不计入 `fix_max`、不计入 `--max`（从 `batchesRun` 弹出）
   - 重置 backlog 状态为 `pending`
   - 下次 `queue.batch_started.why` 为 `interrupt_retry`
   - 第二次仍中断则直接 BLOCK（退出码 20）
   - 修复 `hasBatchRetried` 函数只识别 `rule: 1` 的 `batch.retried`，与中断续跑互不干扰
   - 为 `RunOutcome` 新增 `workerStopReason` 字段以便队列读取

2. **验收失败全记（SPEC 13.14）**：将 `acceptance.failed` 的记录源从 `decision.failedAcceptance`（仅规则 8 填充）改为 R2 实测的全部未满足验收命令 `r2FailedAcceptance`。这样无论裁决结果（PASS/FIX/BLOCK）和触发规则，只要 R2 实测未通过的验收都会记录。

3. **放行留痕（SPEC 13.14）**：在 `runQueue` 的 PASS 分支中，gate 判定通过后立即记录 `queue.gate_passed`（字段 `batch_id`/`batch_run_id`）。同时在 `src/schema/index.ts` 的 `EVENT_TYPES` 中新增 `'queue.gate_passed'`。

4. **测试**：新建 `test/scenario-n.test.ts`，6 个用例，按场景 G 的做法注入时钟与指纹：
   - 空转一次 → 续跑 PASS → 队列继续（exit 0）
   - 连续两次空转 → 退出码 20
   - worker 崩溃 → 不续跑
   - 续跑不占 fix_max
   - reviewer 判 FIX 时 journal 有 `acceptance.failed`
   - PASS 后队列 journal 有 `queue.gate_passed`
   
   `test/invariants.test.ts` 新增两条：`queue.gate_passed` 在 schema、`interrupt_retry` 在 run.ts。

## 测试结果

```
npm run lint    → exit 0（ESLint + Prettier 均通过）
npm run typecheck → exit 0（TypeScript strict 零错误）
npm test        → exit 0（48 个文件, 922 个用例, 0 failed）

npm test -- test/scenario-n.test.ts → 6 passed (6)
```

## 偏离或疑问

无。所有实现严格按照 SPEC 13.14 的描述，未发现冲突或歧义。

## 下一步建议

- v04-b11 可实施（R2 后台 git 读取不抢索引锁，SPEC 13.15）。
- 场景 N 的中断续跑测试使用可控指纹注入，与场景 G 一致，不依赖真实定时器。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b10",
  "head_sha": "76f7693ac53e1063afb662d64a43e36afbe1ea9a",
  "claims": {
    "commits": ["76f7693ac53e1063afb662d64a43e36afbe1ea9a"],
    "tests_passed": 922,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
