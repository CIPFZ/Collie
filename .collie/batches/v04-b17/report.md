# 批次 v04-b17 汇报

## 做了什么

### 条目 1：`src/view.ts` — why / timeline 补齐 journal 里已有的数据

**timeline 花费口径改为 worker + reviewer。** `projectTimeline` 的 `run_end` 节点现在从 `worker.finished.cost_usd` 和 `reviewer.finished.cost_usd` 两者求和——只加有值的，两者都没有才是 null。`projectVersionSummary` 的 `totalCostUsd` 与 `runsWithoutCost` 同样按此口径计算。

**`projectWhy` / `WhyAttempt` 补四处：**
1. `worker:` 行追加 `model=`（来自 `worker.started.model`）、`duration=`（`worker.finished.duration_ms`，用 `formatDuration`）、`tokens=in<N>/out<M>`（in = `usage` 中 `input_tokens` + `cache_creation_input_tokens` + `cache_read_input_tokens` 之和，out = `output_tokens`）。
2. `reviewer:` 行追加 `model=`（`reviewer.started.model`）、`turns=`、`cost=`、`duration=`（`reviewer.finished`）。
3. 取证行之后加 `head_sha: <40位>`（取 `reviewer.started.head_sha`，没有则取 `ci.resolved.head_sha`）。
4. 列出本次运行的每条 `ci.verdict_commit`：`ci.verdict_commit: <sha> <conclusion> when=<when>`，没有 `when` 字段的写 `startup`。
5. 每个 attempt 的结论行之前加 `cost: worker=<$> reviewer=<$> total=<$>`。

**`--json` 增加对应字段：** `worker.model` / `worker.durationMs` / `worker.tokensIn` / `worker.tokensOut`、`reviewer.model` / `reviewer.turns` / `reviewer.costUsd` / `reviewer.durationMs`、`headSha`、`verdictCommitCi`（数组）、`cost`（含 `worker` / `reviewer` / `total`）。

### 条目 2：声称不符的结论行与 R2 的 rule 修复

**`view.ts` 的 `conclusionLine`：** 当 `run.finished` 没有 `rule`、且 `reason` 以「声称不符：」开头时，结论行写 `结论：FIX，<reason>`，不显示「规则 —」。

**`run.ts` 的 `finish`：** 只在 `decision.rule` 为 1~10 时写 `rule` 字段到 `run.finished` 事件。这样 sha 解析不了的 FIX（rule=0 的 ArbiterDecision）不会在 journal 里产生 `rule: 0`。

### 条目 3：测试

- **`test/why.test.ts`**：
  - 新增 Sandbox 测试组（A2），使用 `FakeRunner` 的 `result` 脚本化 `costUsd=5.25`、`numTurns=15`、`durationMs=240000`、`usage={inputTokens:8000, outputTokens:3000, cacheCreationInputTokens:2000}`（worker）和 `costUsd=1.5`、`numTurns=4`、`durationMs=45000`（reviewer），验证 cost 总和（6.75）、tokens（in10000/out3000）、model、duration 在 projection 和 text 输出中正确。
  - 新增手写 fixture 测试：声称不符 reason → 结论行不含「规则 0」和「规则 —」。
  - 新增手写 fixture 测试：worker model/duration/tokens, reviewer model/turns/cost/duration, headSha, verdictCommitCi, cost, 以及 --json 对应字段。

- **`test/timeline.test.ts`**：
  - 新增三个测试：reviewer.finished 有 cost_usd 时 run_end cost = worker + reviewer；reviewer 没有 cost 时 = worker 的；version summary 的 totalCostUsd 包含 reviewer cost。

- **`test/report-sha.test.ts`**：
  - 在现有不存在 sha 测试中加断言：`finished` 事件 `not.toHaveProperty('rule')`。

- **`test/invariants.test.ts`**：
  - 新增 `src/view.ts` 含 `ci.verdict_commit` 的不变量。

## 测试结果

```
npm run lint   → exit 0
npm run typecheck → exit 0
npm test → 50 files, 975 tests passed, 0 failed
npm test -- test/why.test.ts test/timeline.test.ts test/report-sha.test.ts → 3 files, 47 tests passed
```

所有 10 条验收命令在本地全部通过。

## 偏离或疑问

无。

## 下一步建议

v04-b17 是 13.22 最后一条缺口条目。通过后可按 13.22 末段提请所有者裁定 v0.4 收口。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b17",
  "head_sha": "e701903c11e5184752f82b90466a2a22c34cfe74",
  "claims": {
    "commits": [
      "2fe4abbf7ba365194fa6c1faad35ef17c14da183",
      "e701903c11e5184752f82b90466a2a22c34cfe74"
    ],
    "tests_passed": 975,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
