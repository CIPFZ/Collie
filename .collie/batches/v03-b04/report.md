# 批次 v03-b04 汇报

## 做了什么

### 条目 1：放行判定（gate decision）

在 `src/gate.ts` 中实现了纯函数 `gateDecision(input): GateResult`，检查 SPEC 12.3 列出的七项自动放行条件：
- `downgraded`：verdict 是否被仲裁降级
- `claim_mismatches`：声称与证据不符的数量
- `ci`：CI 结论非 success 或分支不匹配（`ciConclusion !== 'success' || ciBranchMatched !== true`）
- `deps_diff`：依赖变更数量
- `spec_diff`：受保护文件 diff 行数
- `protected`：受保护文件 diff 行数（独立输入，便于测试）
- `gaps`：reviewer 提出的 gaps 数量

任一不满足则返回 `{ pass: false, reasons: [...] }`。

`src/schema/index.ts` 新增两个事件类型 `queue.paused` 和 `batch.retried`（29→31 个事件类型）。

`src/run.ts` 中 `runQueue` 在 PASS 之后、选下一批之前调用 `gateDecision`，失败则记录 `queue.paused`、`queue.finished(reason='paused')`、返回退出码 30。

`src/cli.ts` 更新了 run 命令描述，包含退出码 30。

`EXIT_CODES` 增加 `PAUSED: 30`。

单批次模式（`collie run <batch>`）不调用 gate，因为 gate 仅在 `runQueue` 中运行。

### 条目 2：规则 1 自动重跑与规则 9 连续两次

**规则 1 自动重跑**：在 `runQueue` 的 BLOCK 分支中，当 `decision.rule === 1`（unparseable verdict）且 `hasBatchRetried(root, batchId)` 返回 false 时：
- 记录 `batch.retried` 事件（含 `rule: 1`）到队列级 journal
- 从 `batchesRun` 中弹出（retry 不计入 --max）
- 重置 backlog 状态为 `pending`（关键修复：`runBatch` 在 BLOCK 时已将状态设为 'blocked'，必须重置才能让 `selectNextBatch` 再次选中该批次）
- `continue` 重跑，不计入 `fix_max`
- 第二次规则 1 BLOCK 则正常处理（停止，退出码 20）

**规则 9 连续两次**：初始实现检查当前 outcome 的 `decision.downgraded`，但这有 bug——规则 9 将 PASS 降为 FIX，所以 PASS 分支中永远不会看到规则 9。修复为使用 `hasBatchRule9Downgrade(root, batchId)` 扫描 journal 中该批次所有历史 run 的 `verdict.downgraded` 事件（rule=9）。这样即使批次经历了 FIX→retry→PASS，仍能检测到第一次 attempt 的规则 9 降级。当连续两个批次都有规则 9 降级时，记录 `queue.paused(reasons=['rule9_twice'])`，退出码 30。

### 条目 3：测试

**`test/gate.test.ts`**：11 个 `it` 块覆盖所有七项条件各自独立不满足，加上 `ciBranchMatched=false`/`null` 的边界，以及多条件同时失败的情况。

**`test/scenario-l.test.ts`**：3 组共 10 个 `it` 块：
- 组 a（4 个 it）：PASS 但 reviewer gaps 非空 → `queue.paused` reasons 含 'gaps'、backlog 状态 'passed'、退出码 30、`queue.finished` paused_count=1
- 组 b（3 个 it）：第一轮 reviewer 输出坏 JSON（规则 1 BLOCK）→ `batch.retried` rule=1 → 重跑 PASS → 继续到下一批、fix_max 计数未增加
- 组 c（3 个 it）：两个批次各自第一次 attempt 不 push（规则 9 降级 FIX）、retry push 后 PASS → 第二个批次 PASS 后 `queue.paused` reason='rule9_twice'、journal 有两个 `verdict.downgraded` rule=9

**`test/invariants.test.ts`**：新增 2 个不变量：
- `src/gate.ts` 存在且不 import runner 或 journal
- `test/scenario-l.test.ts` 存在且包含 gate/retry/rule9_twice 关键字

**`test/schema.test.ts`**：事件数量从 29 更新为 31，新增 `queue.paused` 和 `batch.retried` 断言。

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

 RUN  v5.0.5 /data/workspace/Collie

 Test Files  39 passed (39)
      Tests  792 passed (792)
   Start at  13:45:34
   Duration  17.98s (tests 94%, import 5%, transform 1%)
```

## 偏离或疑问

1. **规则 1 retry 需要重置 backlog 状态**：task.md 未明确说明这一点，但 `runBatch` 在 BLOCK 时会将 backlog 状态设为 'blocked'，如果不重置，`selectNextBatch` 无法再次选中该批次。因此在规则 1 retry 路径中增加了 `updateBacklogToDisk(root, currentBatchId, 'pending', ...)` 和对应的 commit。

2. **规则 9 连续检查需要扫描 journal 而非当前 outcome**：task.md 说"连续两个批次都有 `verdict.downgraded` rule=9"，但规则 9 将 PASS 降为 FIX，所以当批次最终 PASS 时，当前 outcome 的 `decision.downgraded` 为 false。修复为使用 `hasBatchRule9Downgrade` 扫描 journal 中所有历史 run 的 `verdict.downgraded` 事件。

3. **`updateBacklogToDisk` 参数类型扩展**：原来只接受 `'passed' | 'blocked'`，改为 `BatchStatus`（包含 'pending'），以支持规则 1 retry 的状态重置。

## 下一步建议

本批次三个条目全部完成。建议：
- 下一批次可实现 SPEC 12.3 中其他 queue mode 增强（如 `--dry-run` 预检、gate 条件可配置化）
- 考虑为 `hasBatchRule9Downgrade` 和 `hasBatchRetried` 增加缓存以避免反复扫描 journal

```json
{
  "schema_version": 1,
  "batch_id": "v03-b04",
  "head_sha": "8beae0d569fa96b2c2c94bb16781cd4278d62bf2",
  "claims": {
    "commits": ["8beae0d569fa96b2c2c94bb16781cd4278d62bf2"],
    "tests_passed": 792,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
