# 批次 v02-e-fix 汇报

## 做了什么

**条目 1：worker 随 R2 死（SPEC 11.3）**

- `src/runner/claude.ts`：spawn 时加 `detached: true`，使 worker 拥有独立进程组。
- `src/run.ts`：新增 `spawnGuardDaemon(r2Pid, workerPid)` 函数，生成一个轻量 `node -e` 守护进程，脱离 R2 进程组，每 2 秒探测 R2 pid，R2 消失则 SIGKILL worker 后自退。新增 `registerWorkerKillHandlers` 在 R2 的 exit/SIGTERM/SIGINT 信号上向 `-worker_pid`（进程组）发 SIGTERM。`onPid` 回调中启动守护和注册 handler，`cleanupTimers` 中清理。
- `src/heartbeat.ts`：HeartbeatSchema 加 `guard_pid` 字段；`checkHeartbeat` 三个 pid 任一存活即拒绝启动；`updateHeartbeat` 支持 `worker_pid: null` 清除字段。
- `test/guard.test.ts`（新文件）：两个集成测试——"SIGKILL 父进程后 worker 5 秒内死亡"和"worker 已死时 guard 仍正常退出"。
- `test/heartbeat.test.ts`：加 guard_pid 存活拒绝启动用例 + 三 pid 全死返回 orphan。
- `test/runner-claude.test.ts`：结构断言 `detached: true` 存在。
- `test/invariants.test.ts`：加 `detached: true` 不变量。

**条目 2：取证范围 base_sha 沿用（SPEC 11.7）**

- `src/run.ts`：evidence 和 reviewer 的 base 从 `taskSha` 改为 `baseSha`（首次运行的基线），同时传 `taskSha` 给 evidence 用于 protectedDiff。
- `src/evidence.ts`：`EvidenceInput` 新增可选 `taskSha` 字段。`collectEvidence` 在 multi-attempt 时将 protectedDiff 拆为两段：baseSha..taskSha 排除 `docs/progress.md`（R2 自己写的），taskSha..headSha 全量保护路径。这样 R2 自己的 progress 提交不触发规则 2，但 rescue 中的 SPEC.md 改动仍被检出。commits_actual 使用 baseSha 包含前次尝试的提交。
- `test/scenario-e.test.ts`：加 "attempt 2 commits_actual 含 attempt 1 提交" 和 "attempt 1 偷改 SPEC 时 attempt 2 被规则 2 BLOCK" 两个断言。
- `test/invariants.test.ts`：加 `baseSha: taskSha` 不应出现的不变量。

**条目 3：interrupted_at 来源（SPEC 11.7）**

- `src/run.ts`：`batchHistory` 的结束原因优先级改为 `worker_stop_reason → result → orphaned → unknown`。`finished === undefined`（无 run.finished，即 R2 崩溃）时标记为 `orphaned`。新增 `readStreamLastEvent` 函数读取 stream.ndjson 末行作为最后事件的 fallback。
- `src/roles/worker.ts`：`renderInterruptSection` 在无 `rescue_sha` 时写 "上一轮未留下救援提交，请从 `git log` 核实已完成到哪一步"。
- `test/scenario-e.test.ts`：加 3 个测试——orphaned 运行检测（interrupted_at 含 orphaned 且事件类型来自 stream.ndjson 不是 worker.started）、无 stream.ndjson fallback 到 journal 末行、无 rescue_sha 时 task.md 的 fallback 文本。

## 测试结果

```
npm run lint   → exit 0 (eslint + prettier clean)
npm run typecheck → exit 0
npm test       → 670 passed, 0 failed, 34 test files
npm test -- test/scenario-e.test.ts → 13 passed, 0 failed
```

全部 8 项验收 grep 均通过。

## 偏离或疑问

条目 2 的 protectedDiff 拆分策略：SPEC 11.7 要求 evidence 使用首次 baseSha，但直接用 baseSha 做 protectedDiff 的基线会把 R2 自己的 `docs/progress.md` 变更算入 spec_diff_lines，导致正常运行被规则 2 误判为 BLOCK。解决方案：将 protectedDiff 拆为两段——baseSha..taskSha 范围排除 `docs/progress.md`（因为这段只有 R2 的系统提交会写它），taskSha..headSha 范围保留全部保护路径。这保证了：
- rescue 中的 SPEC.md 变更被检出（baseSha..taskSha 范围内，不在排除列表中）
- R2 的 progress.md 不触发误报
- worker 当前尝试若改 progress.md 仍会被 taskSha..headSha 范围检出

这一设计取舍未改变 SPEC 条款，仅在实现层面细化了 diff 范围的计算方式。

## 下一步建议

- 本批次三个条目均已完成并通过全部测试。可进入审核。
- 如果后续 R2 还会写其他受保护路径，`PROTECTED_MINUS_R2` 常量需要同步更新。
- guard daemon 的 2 秒轮询间隔是硬编码常量 `GUARD_POLL_MS`；若需要可配置化可在后续批次处理。

```json
{
  "schema_version": 1,
  "batch_id": "v02-e-fix",
  "head_sha": "6d777f6bac2371b64bee858cfcde3ddf5aab99e9",
  "claims": {
    "commits": [
      "e67a2f64ccc035cceb154e948f8fc5e461a55328",
      "6d777f6bac2371b64bee858cfcde3ddf5aab99e9"
    ],
    "tests_passed": 670,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
