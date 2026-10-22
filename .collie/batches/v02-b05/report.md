# 批次 v02-b05 汇报

## 做了什么

### 条目 1：中断判定与 task.md 注入（SPEC 11.7）

- **`TaskFrontmatterSchema`**（`src/schema/index.ts`）：`interrupted_at` 改为 `z.string().nullable()`（原来只接受 `z.null()`），加可选 `rescue_sha: ShaSchema.optional()`。未升 `SCHEMA_VERSION`。
- **`src/roles/worker.ts`**：`TaskContext` 接口增加 `interrupted_at?` 和 `rescue_sha?`。新增 `renderInterruptSection(ctx)` 生成「上一轮中断」正文段。`buildTask()` 条件性地写入 `rescue_sha` 到 frontmatter 并附加中断段到 body。
- **`src/run.ts`**：新增 `batchHistory(root, batchId, excludeRunId?)` 函数，遍历 `.collie/runs/` 下所有日志，分析先前运行的 `attempt`、`baseSha`（SPEC 4.3：后续 attempt 沿用首次）、`interruptedAt`、`rescueSha`、`lastSessionId`、`resumeCount`。`excludeRunId` 参数排除当前运行自身（否则 `run.started` 会被误判为中断）。
- **escalate 路径**（`src/run.ts`）：用 git 实测 `base_sha..HEAD` 的提交和推送状态写入 progress。措辞改为 `上报：无 report — <reason>`。
- **`src/progress.ts`**：`decision.rule === 0` 时直接输出 `decision.reason`，不再出现「规则 0」。

### 条目 2：resume 策略（SPEC 11.7）

- **resume 决策**（`src/run.ts`）：根据 `config.limits.resume_max` 与 `history.resumeCount` 决定是否传 `resumeSessionId`。达到上限时传 `undefined`。
- **`worker.resumed` 事件**：当 `history.attempt > 1` 时记录，包含 `session_id`（可能为 null）和 `attempt`。
- **`worker.finished` 扩展**：记录 `session_id` 字段以供下一轮 resume。
- **`ci.resolved` 事件**（SPEC 3.6）：CI 取证成功时记录，包含 `conclusion`、`branch_matched`、`run_url`、`waited_secs`、`polls`。覆盖了 waitForCi 路径和单次查询路径。
- **短 sha 展开**（`src/evidence.ts`）：在 `collectEvidence` 入口调用 `revParse(root, input.headSha)` 将短 sha 展开为 40 位，确保 GitHub API 查询准确。
- **3 次 no_runs 转后代**（`src/ci.ts`）：`waitForCi` 新增 `consecutiveNoRuns` 计数器，连续 3 次 `no_runs` 则提前返回，让调用方尝试后代归属。
- **`EVENT_TYPES`**（`src/schema/index.ts`）：从 19 增至 21，新增 `worker.resumed` 和 `ci.resolved`。

### 条目 3：测试

- **`test/scenario-e.test.ts` 补全**：后半段测试 — `batchHistory` 返回 `attempt=2`、`interruptedAt`、`rescueSha`、`baseSha` 沿用；第二轮任务包含「上一轮中断」段；PASS 后 interrupt 状态被清除。
- **`test/scenario-f.test.ts` 新增**：resume_max 阈值测试 — 前两次 resume 传 `resumeSessionId`，第四次（超出 resume_max=2）不传；`worker.resumed` 事件携带 `session_id` 和 `attempt`；PASS 不计入中断。
- **`test/show.test.ts` 新增**：`collie show` 还原 E（rescue + resumed）、F（resumed + session_id）、G（idling + signaled）和 ci.resolved 事件链。
- **`test/ci.test.ts` 扩展**：3 次 no_runs 提前返回测试、no_runs 计数器重置测试、短 sha 文档测试。
- **`test/evidence.test.ts` 扩展**：短 sha 展开 — 7 位 sha 在 CI 查询 URL 中被展开为 40 位。
- **`test/invariants.test.ts` 扩展**：ci.resolved 出现在 schema 和 run.ts 中。
- **`test/support/sandbox.ts`**：`tick` 计数器改为类字段（持久化），多轮运行获得不同的 `run_id`。
- **`test/envelope.test.ts`**：`interrupted_at` 接受字符串（SPEC 11.7）。
- **`test/schema.test.ts`**：EVENT_TYPES 长度从 19 改为 21，rejection 测试改用 `worker.hypothetical`。
- **`test/exit-codes.test.ts`**：预期事件序列加入 `ci.resolved`。

## 测试结果

```
npm run lint    → exit 0（eslint + prettier，零报错）
npm run typecheck → exit 0（tsc，零错误）
npm test        → 33 test files, 635 tests, 0 failures
```

各条目专项：
- `npm test -- test/scenario-e.test.ts` → 8 passed
- `npm test -- test/scenario-f.test.ts` → 4 passed
- `npm test -- test/show.test.ts` → 5 passed

验收 grep：
- `ci.resolved` 在 `src/schema/index.ts`、`src/run.ts`、`test/invariants.test.ts` → 全部命中
- `resume_max` 在 `test/scenario-f.test.ts` → 命中
- `base_sha` 在 `test/scenario-e.test.ts` → 命中
- `revParse` 在 `src/evidence.ts`，`no_runs` 在 `test/ci.test.ts`，`short sha|expands` 在 `test/evidence.test.ts` → 全部命中

## 偏离或疑问

1. **`batchHistory` 需要 `excludeRunId`**：发现 `batchHistory()` 在 `run.started` 之后调用，会把当前运行自身的 `run.started`（无 `run.finished`）误判为中断运行。添加 `excludeRunId` 参数排除当前 `runId`。这是实现层面的必要修正，不改变 SPEC 语义。

2. **sandbox.ts `tick` 计数器改为持久化**：原来每次 `cli()` 调用都重置 `tick=0`，导致多轮运行生成相同的 `run_id`，日志写入同一文件。改为类字段后，每次 `Sandbox.create()` 仍从 0 开始，但同一 sandbox 内多轮运行产生不同 run_id。不影响现有单轮测试。

3. **PASS 后 `attempt` 不重置**：`batchHistory` 的 `attempt` 变量只在遇到中断运行时递增，PASS 运行清除中断上下文但不重置 `attempt`。因为已 PASS 的批次不会被再次运行，这不影响实际行为。

## 下一步建议

- v02-b05 的三个条目已全部落地并通过验收。
- `batchHistory` 的 `excludeRunId` 机制可在后续批次做更精确的测试（比如模拟 orphan 后的 resume）。
- 后代归属的端到端场景（evidence.ts 中的 `no_runs → descendant` 路径）目前只在 `ci.test.ts` 单元层面覆盖，如有需要可在后续批次加入 sandbox 集成测试。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b05",
  "head_sha": "527f880c7124548e1c26a28c55f3e70eb7dc9be7",
  "claims": {
    "commits": [
      "d6c824a40346b75d16139a5a188034746c9da0eb",
      "527f880c7124548e1c26a28c55f3e70eb7dc9be7"
    ],
    "tests_passed": 635,
    "tests_failed": 0,
    "pushed": false,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
