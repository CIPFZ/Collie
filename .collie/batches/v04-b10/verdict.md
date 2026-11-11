`RULE_UNPARSEABLE = 1` ✓. The `hasBatchRetried` function correctly only matches `rule === 1` events, so interrupt retry events (which have `cause: 'interrupted'` and no `rule` field) won't be picked up. ✓

---

Here is my complete verdict:

# 批次 v04-b10 审核

## 取证过程

### 提交事实

```
$ git log --oneline c1d97b4d..76f7693a
76f7693 cli: interrupt auto-retry, acceptance.failed all verdicts, queue.gate_passed (SPEC 13.14)
32e3365 docs: issue v04-b10 task envelope
```

两个提交，SHA 分别为：
- `32e336517ff2a2e708557b66b3c024a5377bab76`（task envelope）
- `76f7693ac53e1063afb662d64a43e36afbe1ea9a`（实现 + 测试）

远端确认：`git branch -r --contains 76f7693a` → `origin/main`，已推送。

### 受保护路径

```
$ git diff --stat c1d97b4d..76f7693a -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
（空输出）
```

无受保护文件被修改。spec_diff_lines = 0。

### 依赖变化

```
$ git diff c1d97b4d..76f7693a -- package.json package-lock.json
（空输出）
```

无依赖变化。

### 验收命令逐条实跑

1. **`npm run lint`** → exit 0 ✓
2. **`npm run typecheck`** → exit 0 ✓
3. **`npm test`** → 48 files, 922 tests passed, exit 0 ✓
4. **`npm test -- test/scenario-n.test.ts`** → 1 file, 6 tests passed, exit 0 ✓
5. **`grep -cE "^\s+it\(" test/scenario-n.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"`** → exit 0 ✓（计数为 6）
6. **`test -f test/scenario-n.test.ts && ! grep -qE "setInterval|setTimeout\(" test/scenario-n.test.ts`** → exit 0 ✓
7. **`grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "interrupt_retry" && grep -qE "interrupt_retry" test/scenario-n.test.ts`** → exit 0 ✓
8. **`grep -qE "queue\.gate_passed" src/schema/index.ts && grep -qE "queue\.gate_passed" test/scenario-n.test.ts`** → exit 0 ✓
9. **`grep -qE "queue\.gate_passed" test/invariants.test.ts`** → exit 0 ✓

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 48 files, 922 tests, exit 0 | ✅ |
| 场景 N 通过 | `npm test -- test/scenario-n.test.ts` | 1 file, 6 tests, exit 0 | ✅ |
| 场景 N 不少于 6 个用例 | grep 计数 | 6 ≥ 6, exit 0 | ✅ |
| 场景 N 不用真实定时器 | grep setTimeout(/setInterval | 无匹配, exit 0 | ✅ |
| 续跑原因进代码与测试 | grep interrupt_retry | 匹配, exit 0 | ✅ |
| 放行事件进 schema 与测试 | grep queue.gate_passed | 匹配, exit 0 | ✅ |
| 不变量同步 | grep queue.gate_passed invariants | 匹配, exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：中断续跑

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| `--continue` 下走上报路径且 `worker_stop_reason` 是 `idling`/`stalled`/`wallclock` 的运行第一次自动重跑 | task 条目 1 | `src/run.ts:2220-2251`：检查 `outcome.escalation !== undefined && outcome.workerStopReason !== undefined && INTERRUPT_STOP_REASONS.has(outcome.workerStopReason) && !interruptRetried.has(currentBatchId)`，INTERRUPT_STOP_REASONS 为 `{idling, stalled, wallclock}` | ✅ |
| 记 `batch.retried`（cause `interrupted`、带 stop_reason） | task 条目 1 | `src/run.ts:2234-2238`：`queueRec.record('batch.retried', { batch_id, cause: 'interrupted', stop_reason: outcome.workerStopReason })` | ✅ |
| 不计 `fix_max` 与 `--max` | task 条目 1 | `src/run.ts:2240`：`batchesRun.pop()` 移除当前运行不计入 max；interrupt retry 在 BLOCK 分支，不进入 FIX 分支的 fixCounts 逻辑 | ✅ |
| backlog 状态改回 `pending` | task 条目 1 | `src/run.ts:2242`：`updateBacklogToDisk(root, currentBatchId, 'pending', queueRec)` | ✅ |
| `queue.batch_started.why` 为 `interrupt_retry` | task 条目 1 | `src/run.ts:2250`：`nextWhy = 'interrupt_retry'` | ✅ |
| 第二次仍中断则停，退出码 20 | task 条目 1 | `src/run.ts:2231`：`!interruptRetried.has(currentBatchId)` 使第二次不进入重试，落入后续 BLOCK 处理，exit 20。`npx vitest run test/scenario-n.test.ts` → Tests 6 passed（含 "idle twice → exit 20 (BLOCK)" 用例） | ✅ |
| worker 崩溃不重跑 | task 条目 1 | `src/run.ts:1457`：crash 时 `workerStopReason = 'error'`，不在 INTERRUPT_STOP_REASONS 中。`npx vitest run test/scenario-n.test.ts` → Tests 6 passed（含 "worker crash → no interrupt retry" 用例） | ✅ |
| `turns_exhausted` 不重跑 | task 条目 1 | `turns_exhausted` 不在 `INTERRUPT_STOP_REASONS` 集合 `{idling, stalled, wallclock}` 中，不会触发重试 | ✅ |
| reviewer 失败不重跑 | task 条目 1 | reviewer 失败时 worker 已正常完成，`workerStopReason` 为 `undefined` 或 `end_turn`，不在 INTERRUPT_STOP_REASONS 中；且无 escalation 字段 | ✅ |
| 规则 1 的重跑判断只认带 `rule: 1` 的 `batch.retried` | task 条目 1 | `src/run.ts:2020-2026`：`hasBatchRetried` 检查 `event.rule === RULE_UNPARSEABLE`（1），interrupt retry 的 `batch.retried` 没有 `rule` 字段 | ✅ |

**行为要求实跑**：`npx vitest run test/scenario-n.test.ts` → `Tests 6 passed`

### 条目 2：留痕

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| R2 实测未满足的每条验收不论裁决都记 `acceptance.failed` | task 条目 2 | `src/run.ts:1669-1677`：`r2FailedAcceptance` 从 `collected.verify.filter(r => !r.passed)` 提取，在 arbitrate 之前；`src/run.ts:1696-1703`：遍历 `r2FailedAcceptance`（而非 `decision.failedAcceptance`）记录 acceptance.failed | ✅ |
| 规则 8 的判定不变 | task 条目 2 | `r2FailedAcceptance` 同时传入 `arbitrate()` 的 `failedAcceptance` 参数（`src/run.ts:1686`），仲裁逻辑未改 | ✅ |
| PASS 后放行判定通过时记 `queue.gate_passed` | task 条目 2 | `src/run.ts:2152-2156`：在 gate.pass 为 true 之后记录 `queue.gate_passed` | ✅ |
| `queue.gate_passed` 字段为 batch_id / batch_run_id | task 条目 2 | `src/run.ts:2153-2156`：`{ batch_id: currentBatchId, batch_run_id: runId }` | ✅ |
| 不得用 `run_id` 作扩展字段名 | task 条目 2 | `src/run.ts:2153-2156`：扩展字段只有 `batch_id` 和 `batch_run_id`，无额外 `run_id` | ✅ |

**行为要求实跑**：`npx vitest run test/scenario-n.test.ts` → `Tests 6 passed`（含 "reviewer FIX with failing acceptance → journal has acceptance.failed" 和 "PASS with clean gate records queue.gate_passed" 用例）

### 条目 3：测试

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 新建 `test/scenario-n.test.ts` | task 条目 3 | 文件存在，551 行 | ✅ |
| 时钟与产出指纹按场景 G 的做法注入 | task 条目 3 | `test/scenario-n.test.ts:21-44`：`fakeClock`、`instantDelay`、`fakeSetTimer`；`test/scenario-n.test.ts:46-67`：`controllableFingerprint`；`test/scenario-n.test.ts:303-313`：`livenessOpts` 组装注入 | ✅ |
| 不用真实定时器 | task 条目 3 | `grep -qE "setInterval\|setTimeout\(" test/scenario-n.test.ts` 无匹配（`setTimeout` 仅出现在 `ReturnType<typeof setTimeout>` 类型标注中） | ✅ |
| 空转一次后续跑 PASS、队列继续 | task 条目 3 | `test/scenario-n.test.ts:336-372` 测试 "idle once → interrupt retry → PASS → queue continues (exit 0)"。`npx vitest run test/scenario-n.test.ts` → Tests 6 passed | ✅ |
| 连续两次空转退出码 20 | task 条目 3 | `test/scenario-n.test.ts:374-401` 测试 "idle twice → exit 20 (BLOCK)"。Tests 6 passed | ✅ |
| worker 崩溃不续跑 | task 条目 3 | `test/scenario-n.test.ts:403-425` 测试 "worker crash → no interrupt retry"。Tests 6 passed | ✅ |
| 续跑不占 `fix_max` | task 条目 3 | `test/scenario-n.test.ts:427-457` 测试 "interrupt retry does not consume fix_max"。Tests 6 passed | ✅ |
| reviewer 判 FIX 时 journal 有 `acceptance.failed` | task 条目 3 | `test/scenario-n.test.ts:470-508` 测试 "reviewer FIX with failing acceptance → journal has acceptance.failed"。Tests 6 passed | ✅ |
| PASS 后队列 journal 有 `queue.gate_passed` | task 条目 3 | `test/scenario-n.test.ts:527-550` 测试 "PASS with clean gate records queue.gate_passed"。Tests 6 passed | ✅ |
| invariants 加 `queue.gate_passed` | task 条目 3 | `test/invariants.test.ts:342-345`：`expect(content).toContain('queue.gate_passed')` | ✅ |
| invariants 加 `interrupt_retry` | task 条目 3 | `test/invariants.test.ts:347-350`：`expect(content).toContain('interrupt_retry')` | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | task 额外禁止 | `git diff --stat` 对受保护路径为空 | ✅ |
| 为了让测试过而删除或跳过任何测试 | task 额外禁止 | diff 只有新增，无 `.skip`、`.only`、删除测试 | ✅ |
| 为了让验收命令通过而改注释或字面 | task 额外禁止 | 无此类改动 | ✅ |
| 改动规则 1~10 的判定 | task 额外禁止 | arbiter 逻辑未改；`hasBatchRetried` 增加了 `rule === RULE_UNPARSEABLE` 条件，这是收窄匹配以区分两种 retry，不改变规则 1 判定本身 | ✅ |
| 改动放行判定的六项 | task 额外禁止 | `gateDecision` 函数未修改 | ✅ |
| 改动 `fix_max` 与各项阈值的默认值 | task 额外禁止 | 未改动 | ✅ |
| 新增依赖 | task 额外禁止 | package.json 无变化 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 9 条验收命令实跑通过。3 个条目的结构要求逐条核对均满足。6 个场景 N 测试用例全部实跑通过，覆盖了中断续跑、acceptance.failed 留痕、queue.gate_passed 留痕的行为要求。无受保护文件修改、无依赖变化、无范围蔓延。提交已推送到远端。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b10",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "32e336517ff2a2e708557b66b3c024a5377bab76",
      "76f7693ac53e1063afb662d64a43e36afbe1ea9a"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "48 files, 922 tests passed" },
      { "cmd": "npm test -- test/scenario-n.test.ts", "exit_code": 0, "summary": "1 file, 6 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/scenario-n.test.ts | grep -qE \"^([6-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "count=6, >= 6" },
      { "cmd": "test -f test/scenario-n.test.ts && ! grep -qE \"setInterval|setTimeout\\(\" test/scenario-n.test.ts", "exit_code": 0, "summary": "no real timers found" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qE \"interrupt_retry\" && grep -qE \"interrupt_retry\" test/scenario-n.test.ts", "exit_code": 0, "summary": "interrupt_retry in code and test" },
      { "cmd": "grep -qE \"queue\\.gate_passed\" src/schema/index.ts && grep -qE \"queue\\.gate_passed\" test/scenario-n.test.ts", "exit_code": 0, "summary": "queue.gate_passed in schema and test" },
      { "cmd": "grep -qE \"queue\\.gate_passed\" test/invariants.test.ts", "exit_code": 0, "summary": "queue.gate_passed in invariants" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "All 9 acceptance commands pass. All 3 task conditions implemented correctly: interrupt auto-retry with proper guard (idling/stalled/wallclock only, one retry per batch per session), acceptance.failed now recorded for all R2-measured failures regardless of verdict, queue.gate_passed recorded after gate passes. 6 scenario N tests cover all behavioral requirements and pass. No protected files modified, no dependency changes, no scope creep. CI 以 R2 取证为准。"
}
```
