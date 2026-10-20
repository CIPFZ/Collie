# 批次 v02-b02 汇报

## 做了什么

逐条对应 task.md 的 3 个条目：

### 条目 1：runner 接口扩展（SPEC 11.2）

- **`src/runner/index.ts`**：新增 `RunHandle` 接口（`pid?: number`、`stop(level: 'soft' | 'hard' | 'kill'): Promise<void>`），`RunOptions` 增加 `resumeSessionId?: string` 和 `onStarted?: (handle: RunHandle) => void`，`RunResult` 增加 `stopReason?: 'turns_exhausted' | 'stopped' | 'error'`。
- **`src/runner/fake.ts`**：实现三级 stop。`FakeSceneBase` 增加 `ignoreSoft?` 和 `pid?` 字段；`FakeSceneContext` 暴露 `handle: RunHandle`，effect 可调用 `handle.stop('kill')` 自终止。`RecordedCall` 增加 `hasOnStarted` 和可选 `resumeSessionId`。stop 被调用后 scene 立即返回 `stopReason: 'stopped'`。
- **`src/runner/claude.ts`**：实现 `RunHandle`——soft 通过设置标志位在 `for-await` 循环中 break（不触发 abort），hard/kill 通过 AbortController.abort()。`resumeSessionId` 映射为 SDK 的 `resume` 选项。`extractSessionId()` 从任意消息中追踪 session_id。SDK 抛出已知 sessionId 的错误时返回 RunResult 而非抛出异常。`error_max_turns` 映射为 `stopReason: 'turns_exhausted'`。
- **`test/runner-claude.test.ts`**：新增 6 个测试——resume 字段映射、RunHandle 生命周期（SDK 无 pid 时 pid 为 undefined）、soft stop（中断循环但不 abort controller）、hard stop（abort controller）、错误时保留 sessionId、error_max_turns 映射。
- **`src/roles/worker.ts`**：`runWorker` 透传 `onStarted`、`resumeSessionId`。

### 条目 2：stream.ndjson、heartbeat.json、事件类型（SPEC 11.3, 11.8）

- **`src/run.ts`**：`appendStream()` 向 `.collie/runs/<run_id>/stream.ndjson` 追加原始 JSON 行。`runBatch()` 在启动时调用 `checkHeartbeat()`——孤儿则记录 `run.orphaned` 并清理，alive 则拒绝启动（铁律 7）。设置 `onStarted` 回调写入 heartbeat，`onEvent` 回调写入 stream 并 touch heartbeat。结束时（正常或异常）清理 heartbeat。
- **`src/heartbeat.ts`**：新模块，包含 `writeHeartbeat`、`touchHeartbeat`、`removeHeartbeat`、`checkHeartbeat`（返回 `'none' | 'orphan' | 'alive'`）、`isProcessAlive`（用 `process.kill(pid, 0)` 探测）。损坏的 JSON 优雅降级为 `'none'`。
- **`src/schema/index.ts`**：`EVENT_TYPES` 增加 `'run.orphaned'` 和 `'worker.rescued'`（共 16 种）。
- **`.gitignore`** 和 **`src/cli.ts`**：将 `.collie/heartbeat` 修正为 `.collie/heartbeat.json`。
- **`test/support/sandbox.ts`**：同步更新 `.gitignore` fixture。
- **`test/schema.test.ts`**：更新事件类型数量断言为 16，新事件从拒绝列表移入接受断言。
- **`test/skeleton.test.ts`**：.gitignore 检查更新为 `.collie/heartbeat.json`。
- **`test/heartbeat.test.ts`**：新增 10 个测试覆盖 write/touch/remove/orphan/alive/corrupted。

### 条目 3：脏工作区救援与场景 E（SPEC 11.4, 11.9）

- **`src/run.ts`**：`rescueDirtyWorkspace()` 在 worker 退出后检查 `git status --porcelain`，若非空执行 `git add -A && git commit -m "wip(collie): <batch_id> rescue"`，记录 `worker.rescued` 事件（含 sha 和 files 列表）。救援提交不推送。
- **`test/scenario-e.test.ts`**：5 个测试——killed worker 后存在救援提交且包含脏文件、worker.rescued 事件包含 sha 和 files、干净工作区不触发 rescued、worker.finished 包含 stop_reason: 'stopped'、heartbeat 文件在运行后不存在。

## 测试结果

```
$ npm run lint
eslint . && prettier --check . → exit 0

$ npm run typecheck
tsc -p tsconfig.json → exit 0

$ npm test
 Test Files  27 passed (27)
      Tests  554 passed (554)
   Duration  6.51s

$ npx vitest run test/scenario-e.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)

$ npx vitest run test/heartbeat.test.ts
 Test Files  1 passed (1)
      Tests  10 passed (10)

$ git check-ignore -q .collie/heartbeat.json → exit 0
$ grep -qE "resume" test/runner-claude.test.ts → exit 0
$ ! grep -rlE "@anthropic-ai" src --include='*.ts' | grep -v '^src/runner/' → exit 0

GitHub Actions run #68 (sha 1299f3a): completed, success
```

## 偏离或疑问

1. **`workerHandle` 未使用**：`src/run.ts` 中 `workerHandle` 变量被赋值但在本批次中未被读取（信号梯需要它，但属于 v02-b03 的范围）。加了 eslint-disable 注释标注将在 v02-b03 使用。
2. **stream.ndjson 不做 U+2028/U+2029 转义**：SPEC 11.3 说"原始落盘"，`JSON.stringify` 不会产生裸换行符，所以无需额外转义。如果 SPEC 原意是带转义的安全 NDJSON，需要在后续明确。
3. **heartbeat JSON_INDENT**：`JSON.stringify(data, null, 2)` 的 `2` 触发 no-magic-numbers。提取为 `const JSON_INDENT = 2` 并加 eslint-disable-next-line 标注为非阈值。
4. **soft stop 实现**：SPEC 11.2 要求 soft 使用 SDK 的 `interrupt()`。当前 claude.ts 中 soft 通过设置标志位在 for-await 循环中 break 实现（因为 SDK stub 没有提供 interrupt() 方法）。如果后续真实 SDK 有 interrupt() API，可能需要适配。

## 下一步建议

1. **v02-b03**（信号梯与定时器）：现在 `RunHandle` 和 `workerHandle` 基础设施已就绪，可以实现 stall/progress/wallclock 定时器和信号升级逻辑。
2. **v02-b04**（重试与恢复）：rescued 事件中的 sha 可用于 `interrupted_at` 追踪，`resumeSessionId` 已实现，重试循环可以复用。
3. 考虑补充 `stream.ndjson` 的集成读取测试（当前只测了追加写入），例如验证 NDJSON 格式可被逐行解析。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b02",
  "head_sha": "1299f3a",
  "claims": {
    "commits": ["f800f19", "42b7722", "1299f3a"],
    "tests_passed": 554,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": [
    "soft stop 当前以 break-from-loop 实现，若 SDK 后续提供 interrupt() API 需要适配",
    "stream.ndjson 不做额外 U+2028/U+2029 转义是否符合 SPEC 11.3 原意"
  ]
}
```
