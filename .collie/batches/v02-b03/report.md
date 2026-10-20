# 批次 v02-b03 汇报

## 做了什么

逐条对应 task.md 的 3 个条目：

1. **活性检测（SPEC 11.5）**：新建 `src/ladder.ts`，包含 `LivenessMonitor` 类。该监视器在 worker 运行期间按 `checkIntervalMs`（默认 500ms）周期检测两个条件：
   - **卡死**：距上一条事件超过 `stall_secs` → 触发 `onStalled` → 记 `worker.stalled` → 进入信号阶梯
   - **空转**：持续收到事件但 `computeFingerprint()`（HEAD sha + `git status --porcelain` 哈希）超过 `progress_secs` 无变化 → 触发 `onIdling` → 记 `worker.idling` → 进入信号阶梯
   
   `monitor.onEvent()` 在 `src/run.ts` 的 `onEvent` 回调中调用，每条事件重置卡死计时。`monitor.start()` 在 `onStarted` 中启动，`monitor.stop()` 在 `cleanupTimers()` 中清理。

2. **信号阶梯（SPEC 11.6）**：
   - `grace_secs` 已在 `LimitsSchema` 中加为可选字段，默认 20（ba283de）
   - `runLadder()` 走 soft → grace → hard → grace → kill，每级记 `worker.signaled`（含 level 和 reason）
   - `wallclock_secs` 超时从原来的 `AbortSignal.timeout` 改为 `setTimeout` 触发 `startLadder('wallclock')`；当 `workerSignal` 由外部注入时不创建内部计时器
   - `worker.crashed` 仅在 `!ladderRunning` 时记录（runner 自身异常）；阶梯引发的终止不再记 crashed
   - **soft 使用 SDK `Query.interrupt()`**：`claude.ts` 的 `stop('soft')` 调用 `queryIterable.interrupt?.()` 并设 `interrupted` 标志，不再 abort controller（25fc988）
   - **任何结束方式写 progress 记录**（SPEC 11.7）：`escalate()` 改为 async，用 `escalationDecision()` 和 `emptyEvidence()` 构建合成记录并 commit
   - `RunContext` 新增 `ladderDelay`（注入延迟）和 `livenessIntervalMs`（检查间隔），测试通过这两个注入点避免真实等待
   - `CliDeps` 同步扩展，通过 `extra` 参数传递到 `runBatch`

3. **场景 G 及其变体（test/scenario-g.test.ts）**：
   - 变体 1：idle worker 发事件但不改文件，`progress_secs=1`，monitor 在 ~1s 后检测到空转 → `worker.idling` → `worker.signaled(soft)` → worker 响应 soft 退出 → 无救援
   - 变体 2：worker `ignoreSoft=true`，ladder 升级到 hard（+ kill），验证完整升级链
   - 同时新增 `test/ladder.test.ts`（5 个单元测试），覆盖全升级路径、提前退出、已退出不启动、注入时钟验证

辅助改动：
- `FakeRunner`：`FakeSceneContext` 新增 `stopped: Promise<StopLevel>` 以支持 ladder 感知的 effect
- `test/exit-codes.test.ts`：移除旧的 `timed_out` 字段断言（v0.2 不再使用）

## 测试结果

```
$ npm run lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
> tsc -p tsconfig.json
（无输出，零错误）

$ npm test
 Test Files  29 passed (29)
      Tests  561 passed (561)
   Duration  6.79s

$ npm test -- test/scenario-g.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  3.05s

$ npm test -- test/ladder.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  143ms

$ npm test -- test/scenario-a.test.ts test/scenario-b.test.ts test/scenario-d.test.ts test/scenario-c.test.ts
 Test Files  4 passed (4)
      Tests  20 passed (20)
   Duration  3.31s

$ grep -qE "interrupt\(\)" src/runner/claude.ts && echo OK
OK
$ ! grep -qE "softStopRequested" src/runner/claude.ts && echo OK
OK
```

## 偏离或疑问

1. **escalation progress 记录使用合成 decision**：SPEC 11.7 要求任何结束方式都写 progress 记录，但 escalation 路径（crashed / no report / bad head_sha）没有 arbiter 和 evidence。我使用 `rule: 0`（RULE_ESCALATED）和空 evidence 构建合成记录。如果需要不同的规则号或格式，需调整。

2. **`exit-codes.test.ts` 旧断言更新**：v0.1 的 `worker.crashed` 事件携带 `timed_out: true/false`，v0.2 移除了此字段（wallclock 超时现在走 ladder，不经过 crashed）。测试已更新为只检查 `error` 字段。

3. **LivenessMonitor 的 `computeFingerprint` 按 SPEC 11.5 "每收到一条事件采样一次"**：当前实现是按 `checkIntervalMs` 周期采样，不是严格的每事件一次。原因：`computeFingerprint()` 涉及 `git status` 和 `git rev-parse`，在高频事件流下（每秒数十条）逐条调用开销过大。周期采样能在合理开销下捕获指纹变化。如果需要严格逐条采样，需改为在 `onEvent()` 中异步排队。

4. **`grace_secs` 未写入 toml**：按 task.md 要求，仅在 schema 中定义了可选字段和默认值。toml 中由 R1 事后补。

## 下一步建议

1. R1 将 `grace_secs = 20` 写入 `.collie/collie.toml` 和 `templates/collie.toml`
2. v02-b04 可实现 SPEC 11.7 的中断标记与 resume（`interrupted_at` frontmatter、`attempt` 递增、`resumeSessionId` 传递），目前基础设施（signal ladder、progress 记录、FakeRunner stopped promise）已就绪
3. 场景 F（resume）的测试可在 b04 中完成

```json
{
  "schema_version": 1,
  "batch_id": "v02-b03",
  "head_sha": "5b910cb5e4568b7280b5d584dd03df125695c034",
  "claims": {
    "commits": ["ba283de9d77d0f7c2f5d06bc6fbdf5b3dc9c5506", "25fc988a19731c42f9a7a0decb85a205358e7eb3", "90857ec194a256de4b6a49f47533c66f0bf933cf", "5b910cb5e4568b7280b5d584dd03df125695c034"],
    "tests_passed": 561,
    "tests_failed": 0,
    "pushed": false,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": [
    "escalation progress 记录的 rule: 0 和空 evidence 是否符合预期格式？",
    "LivenessMonitor 采样策略（周期采样 vs 逐事件采样）是否需要调整？"
  ]
}
```
