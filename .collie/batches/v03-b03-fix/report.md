# 批次 v03-b03-fix 汇报

## 做了什么

**条目 1：head_sha 检查与 R2 提交过滤**

- `src/run.ts`：将 `head_sha` 校验从"是 taskSha 的后代"改为"是 first base_sha 的后代 AND 是当前 HEAD 的祖先或等于 HEAD"。这样跨 attempt 引用更早 attempt 的代码提交也能通过校验。
- `src/evidence.ts`：新增 `R2_COMMIT_PREFIXES` 数组和 `isR2Commit()` 函数（导出），用于识别 R2/操作员提交（`docs: issue `、`progress: `、`report(collie): `、`ops: `）。`commits_actual` 现在只包含非 R2 提交。protected path 检查从 range diff 改为逐 worker 提交的 per-commit diff，避免 R2 提交（如 progress.md 更新）被误判为 worker 修改保护文件。

**条目 2：continuation cost 判断**

- `src/run.ts`：在 `BatchHistory` 接口增加 `lastRunClean` 字段。当上次运行有 `worker.finished` 且无 `worker.rescued` 时设为 true。在 `runBatch` 中，当 `lastRunClean` 为 true 且 `resumeSessionId` 存在时，检查 baseSha..HEAD 之间的非 R2 提交是否已在远端；若是则不 resume（`resumeSessionId = undefined`），因为工作已推送，只需重新开始写 report。
- `test/scenario-f.test.ts`：新增测试"does not resume when last run pushed code and only report is missing"。

**条目 3：stop_reason 记录与 CLI 改进**

- `src/run.ts`：新增 `ladderReason` 变量，在 `startLadder()` 中记录触发原因（wallclock/stalled/idling）。`worker.finished` 事件中 `stop_reason` 使用 `ladderReason ?? result.stopReason`，当 ladder 覆盖时额外记录 `sdk_stop_reason`。`batchHistory` 的 `interrupted_at` 优先使用 `worker.signaled.reason`。新增 `workerSignal` abort 监听器，将外部信号连接到 `startLadder('wallclock')`。
- `src/cli.ts`：summary 行不再为 escalation path（rule 0）输出 "rule 0:" 前缀。`collie audit` 在 reviewer stream 缺失或为空时输出 "no reviewer in run ... (escalation path or worker crash); nothing to audit"。
- `test/scenario-e.test.ts`：新增两个测试块——head_sha 跨 attempt 校验 + R2 提交排除，wallclock interrupt stop_reason 正确性。
- `test/cli.test.ts`：新增"escalation path summary does not print 'rule 0:'"测试；更新已有 audit 测试断言。
- `test/invariants.test.ts`：新增 3 条不变量（cli.ts 无 "rule 0"、evidence.ts 含 "report(collie)"、run.ts 含 "sdk_stop_reason"）。

## 测试结果

```
$ npm run lint && npm run typecheck && npm test

> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

> collie@0.1.0 typecheck
> tsc -p tsconfig.json

> collie@0.1.0 test
> vitest run

 Test Files  37 passed (37)
      Tests  750 passed (750)
   Duration  14.02s
```

全部 750 测试通过，无 lint 或类型错误。

## 偏离或疑问

1. **wallclock 测试中 sdk_stop_reason 为 'stopped' 而非 'error'**：FakeRunner 在 `handle.stop()` 后统一返回 `stopReason: 'stopped'`（第 181 行），与真实 SDK 可能返回 'error' 不同。测试断言已调整为 'stopped' 以匹配 FakeRunner 行为。真实 SDK 场景下 sdk_stop_reason 可能为 'error' 或其他值，但逻辑是正确的——无论 SDK 返回什么都会被保留在 `sdk_stop_reason` 中。

2. **workerSignal abort listener**：task.md 未明确要求在 `run.ts` 中为 `ctx.workerSignal` 添加 abort listener，但这是让 workerSignal 实际触发 wallclock ladder 的必要连接。没有这个 listener，workerSignal 只会替换掉内部计时器但不会触发 ladder，使得该测试钩子无法工作。

## 下一步建议

- 条目 1-3 全部完成，可进入 R2 审核。
- 未来可考虑让 FakeRunner 在 stop 场景中保留 scene 原始的 stopReason，使测试更贴近真实 SDK 行为。

```json
{
  "schema_version": 1,
  "batch_id": "v03-b03-fix",
  "head_sha": "2196fc6e2221252d8ee9fa19266009abc5bfd5d8",
  "claims": {
    "commits": ["2196fc6e2221252d8ee9fa19266009abc5bfd5d8"],
    "tests_passed": 750,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
