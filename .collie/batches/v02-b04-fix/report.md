# 批次 v02-b04-fix 汇报

## 做了什么

### Item 1: 修复 `interrupt()` 的 `this` 绑定 (SPEC 11.2)

`src/runner/claude.ts` 中有两处将 `interrupt` 作为变量提取后调用，丢失了 `this` 上下文：

1. **Lazy wrapper（约 L116）**：原先将 `resolvedIterable` 的 `interrupt` 赋值给局部变量再调用。修改为在 lazy wrapper 的 `interrupt()` 方法中直接调用 `resolvedIterable.interrupt()`，保留 `this` 绑定。

2. **stop('soft')（约 L224）**：同样改为直接调用 `queryIterable.interrupt()` 而非提取后调用。

新增回归测试 `test/runner-claude.test.ts`：构造一个 `interrupt()` 内部读取 `this.state` 的 double，验证调用时 `this` 不是 `undefined`（否则抛 TypeError）。

### Item 2: R2 异常兜底 (SPEC 11.3) 与 ladder 容错 (SPEC 11.6)

**`src/run.ts` — R2 异常兜底**：
- 在 heartbeat 写入之后的主体外围包裹 `try/catch/finally`。
- 注册 `unhandledRejection` 处理器捕获 `void runLadder()` 的 fire-and-forget 拒绝。
- catch 分支：记录 `run.finished(result:'error')`、rescue dirty workspace、写 progress、删 heartbeat，返回 BLOCK 结果而非让进程崩溃。
- finally 分支：移除 `unhandledRejection` 监听。

**`src/ladder.ts` — ladder 容错**：
- `onSignaled` 回调新增可选 `error?: string` 参数。
- `runLadder` 中 `stop()` 包裹在 try/catch 中：成功时正常记录 signaled；失败时记录带 error 字段的 signaled 事件，跳过 grace 直接升级到下一级；`kill` 级失败则 re-throw 由 11.3 兜底。

**`src/run.ts` — onSignaled 传递 error**：
- `startLadder` 中的 `onSignaled` 回调将 error 字段传入 journal.record。

新增测试：
- `test/ladder.test.ts`：添加 "soft throws → records error field → escalates to hard" 单元测试。
- `test/run-fallback.test.ts`（新建）：验证 worker crash → `run.finished(error)` 存在、heartbeat 已删、进程不崩溃。

### Item 3: 输出指纹内容感知 + 可注入 (SPEC 11.5)

**`src/ladder.ts` — `computeFingerprint` 重写**：
- 原指纹：`HEAD sha + git status --porcelain` 拼接。对同一个已 dirty 文件的二次编辑无法区分（status 行不变）。
- 新指纹：`HEAD sha + sha256(git diff HEAD) + sha256(untracked files path\tsize\tmtime)` 三段组合的 sha256。`git diff HEAD` 会输出实际 diff 内容，同一文件的不同编辑产生不同哈希。untracked 文件取 `(path, size, mtime)` 三元组。

**`src/ladder.ts` — LivenessConfig 可注入**：
- 新增 `fingerprint?: (root: string) => Promise<string>` 字段。
- `LivenessMonitor` 构造时存储 `fingerprintFn`，`check()` 中使用它替代直接调用 `computeFingerprint`。

**`src/run.ts` + `src/cli.ts` — 注入管道**：
- `RunContext` 新增 `livenessFingerprint?` 字段，传递给 LivenessMonitor。
- `CliDeps` 新增 `livenessFingerprint?` 字段，传递给 runBatch。

**测试**：
- `test/scenario-g.test.ts` 新增 `computeFingerprint: content-sensitive` 单元测试：在 sandbox 中对同一 tracked 文件修改两次，验证两次指纹不同。
- 集成测试（idle worker 场景）使用真实 `computeFingerprint`（不注入 fake），因为 fake fingerprint 的瞬时 resolve 会导致 liveness check 在 microtask 队列中连续链式执行，在 worker 的 git I/O 完成前就触发 idle 检测，造成 ladder 完整执行 soft→hard→kill 的时序竞态。真实指纹的 git 子进程自然间隔了检查节奏，且指纹随 commit 变化，正确反映了 worker 的进展。

## 测试结果

```
npm run lint   → eslint + prettier: 0 errors, 0 warnings
npm run typecheck → tsc: no errors
npm test       → 30 test files, 583 tests passed, 0 failed
                  Duration 8.16s
```

场景 G 额外跑了 5 次连续验证，全部通过，无闪烁。

## 偏离或疑问

无。

三个 item 均严格按照 task.md 和 SPEC 对应章节实现。未新增第三方依赖，未修改任何受保护文件。

## 下一步建议

- v02-b04-fix2（如存在）可继续处理 progress_secs / wallclock_secs 恢复为默认值、resume 机制等后续内容。
- 当前的 `computeFingerprint` 在每次 check 时调用三个 git 子进程；如果 check interval 较短（如 500ms），可能对性能有影响。未来可考虑缓存或增量指纹方案，但当前满足 SPEC 要求。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b04-fix",
  "head_sha": "dbe276b60b3a915fcf3fe5cc0185d6d49fd681da",
  "claims": {
    "commits": [
      "ad7ad75",
      "857e378",
      "dbe276b"
    ],
    "tests_passed": 583,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
