# 批次 v02-b04 汇报

## 做了什么

逐条对应 task.md 的 3 个条目：

**条目 1：心跳覆盖整个 run（SPEC 11.3）**
- `HeartbeatSchema` 新增 `phase`（必填，取值 worker | reviewer | ci | arbiter）和 `worker_pid`（可选正整数）字段
- 新增 `updateHeartbeat()` 函数，用于更新 phase 和 worker_pid
- `checkHeartbeat()` 改为检查 `pid` 和 `worker_pid` 两个进程——任一存活即判 alive
- `run.ts` 中心跳生命周期重构：`run.started` 后立即写入（phase=worker），`onStarted` 时追加 worker_pid，worker 结束后更新 phase 为 reviewer，reviewer 结束后更新为 ci，证据收集后更新为 arbiter，最终在 `run.finished` 事件写入后才删除
- 移除了 worker 结束路径和 crash 路径中的提前 `removeHeartbeat` 调用
- `test/heartbeat.test.ts` 新增 7 个测试：双 pid 检测、updateHeartbeat phase/worker_pid 更新、reviewer/ci/arbiter 阶段的并行启动拒绝

**条目 2：claude.ts stop('soft') 必调并 await interrupt()（SPEC 11.2）+ run.finished 带 worker 退出信息（SPEC 11.7）**
- `ClaudeQueryIterable.interrupt` 类型改为 `() => void | Promise<void>`（保持可选以表示 SDK 可能不提供）
- `stop('soft')` 中通过类型收窄检查 interrupt 是否存在，缺失则抛错，存在则 `await` 调用——消除所有 `interrupt?.` 可选链
- `lazySdkQuery.interrupt()` 改用显式 null 检查代替可选链
- `run.finished` 事件新增 `worker_exit_code` 和 `worker_stop_reason` 字段
- `ProgressEntry` 新增 `workerExitCode` / `workerStopReason`，`renderEntry` 输出 worker 退出码行
- worker crash 路径也记录 exit_code=1 和 stop_reason='error'
- `test/runner-claude.test.ts` 新增测试：soft stop 在 interrupt 缺失时抛错

**条目 3：LivenessMonitor 注入 now() / setTimer()（SPEC 11.5）**
- `LivenessConfig` 新增可选 `now?: () => number` 和 `setTimer?` 字段，默认值分别为 `Date.now` 和 `setTimeout`
- `LivenessMonitor` 内部全部 `Date.now()` 替换为 `this.nowFn()`，`setTimeout` 替换为 `this.setTimerFn()`
- `RunContext` 和 `CliDeps` 新增 `livenessNow` / `livenessSetTimer` 透传字段
- `test/scenario-g.test.ts`：移除所有 `Date.now` 和 `toBeLessThan(2000)` 断言，改用 `fakeClock()` 注入快进时钟
- `test/ladder.test.ts`：移除 `Date.now` + `toBeLessThan(2000)` 断言

## 测试结果

```
$ npm run lint && npm run typecheck && npm test
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

> tsc -p tsconfig.json

> vitest run
 Test Files  29 passed (29)
      Tests  572 passed (572)

$ npm test && npm test && npm test
 Test Files  29 passed (29)  Tests  572 passed (572)
 Test Files  29 passed (29)  Tests  572 passed (572)
 Test Files  29 passed (29)  Tests  572 passed (572)
```

验收命令验证：
- `! grep -qE "toBeLessThan\(2000\)|Date.now" test/scenario-g.test.ts` → exit 0 ✓
- `! grep -qE "interrupt\?\." src/runner/claude.ts` → exit 0 ✓
- `grep -qE "reviewer" test/heartbeat.test.ts` → exit 0 ✓

## 偏离或疑问

无。三个条目均严格按 SPEC 11.2、11.3、11.5 实现，未偏离任何规定。

## 下一步建议

- v02-b05 可实现 resume / 中断标记注入（task.md frontmatter 的 `interrupted_at` / `attempt` 递增 / `rescue_sha`）
- 非 worker 阶段的心跳 `updated_at` 周期性更新（每 `ci_poll_secs` 更新一次）可在后续批次细化
- progress 记录的 worker 退出码信息已就绪，可供 `collie show` 展示使用

````json
{
  "schema_version": 1,
  "batch_id": "v02-b04",
  "head_sha": "ff0f05754945bdcdca8ae0504c649ea721a0018c",
  "claims": {
    "commits": ["ff0f05754945bdcdca8ae0504c649ea721a0018c"],
    "tests_passed": 572,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
````
