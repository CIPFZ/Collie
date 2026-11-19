Now I'll compile the full verdict:

# 批次 v046-b15 审核

## 取证过程

### 1. 受保护文件

```
$ git diff --stat 9e4884e..5f6a1f8 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(无输出)
```
零行改动。

### 2. 额外禁止路径

```
$ git diff --stat 9e4884e..5f6a1f8 -- .github/ eslint.config.js vitest.config.ts package.json src/acceptance.ts src/redcheck.ts 'src/roles/' 'src/runner/' src/arbiter.ts src/gate.ts src/evidence.ts src/backlog.ts src/view.ts src/follow.ts AGENT-tester.md AGENT-worker.md
(无输出)
```
无禁止文件被修改。

### 3. 依赖变化

```
$ git diff 9e4884e..5f6a1f8 -- package.json package-lock.json
(无输出)
```
零依赖变化。

### 4. `test/acceptance/` 目录

```
$ test -d test/acceptance && echo "EXISTS" || echo "NOT EXISTS"
NOT EXISTS
```

### 5. 提交确认

```
$ git log --format='%H' 9e4884e..5f6a1f8 -- . ':(exclude).collie/batches'
5f6a1f811378265dc57d481a7a28df558fde67d5
05f5644ac1c08302d0848435e47c522f543c8a6a
```

```
$ git branch -r --contains 5f6a1f811378265dc57d481a7a28df558fde67d5
  origin/HEAD -> origin/main
  origin/main
```
两个提交均已推送到远端 origin/main。

### 6. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 通过 |
| 2 | `npm run typecheck` | 0 | tsc 通过 |
| 3 | `npm test` | 0 | 67 passed, 1385 tests |
| 4 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | 0 | 67 passed, 1385 tests |
| 5 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts test/heartbeat.test.ts` | 0 | 4 files, 143 tests |
| 6 | grep 三组用例名 | 0 | (silent success) |
| 7 | `grep -vE ... src/run.ts \| grep -qE "acceptance\.js"` | 0 | (silent success) |
| 8 | 模板配置 + 本仓库配置 | 0 | (silent success) |
| 9 | 变异检查 | 0 | caught 43 survived 0 |
| 10 | `grep -qF "tester.stream.ndjson" test/invariants.test.ts` | 0 | (silent success) |

**全部 10 条验收命令通过。**

### 7. 行为要求实跑

```
$ npx vitest run test/tester-step.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

9 个用例全部通过。

```
$ npx vitest run test/invariants.test.ts
 Test Files  1 passed (1)
      Tests  85 passed (85)
```

```
$ npx vitest run test/exit-codes.test.ts
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✓ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✓ |
| 全部测试通过 | `npm test` | exit 0, 67 files, 1385 tests | ✓ |
| 无全局 git 身份全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0, 67 files, 1385 tests | ✓ |
| 接线、配置、事件类型测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts test/heartbeat.test.ts` | exit 0, 4 files, 143 tests | ✓ |
| 三组用例在 | grep -qF × 3 | exit 0 | ✓ |
| 队列用上了这个模块 | grep … src/run.ts | exit 0 | ✓ |
| 模板有新配置项，本仓库配置没被动 | grep … templates/collie.toml && ! grep … .collie/collie.toml | exit 0 | ✓ |
| 变异检查 | `npx tsx scripts/mutation.ts` | caught 43 survived 0 | ✓ |
| 不变量同步 | `grep -qF "tester.stream.ndjson" test/invariants.test.ts` | exit 0 | ✓ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `RunContext` 加可选 `redCheck` | item 1 | `src/run.ts:131` — `redCheck?: RedCheckFn;` | ✓ |
| `RunContext` 加可选 `testerSignal` | item 1 | `src/run.ts:129` — `testerSignal?: AbortSignal;` | ✓ |
| `testerSignal` 做法照 `workerSignal` | item 1 | `src/run.ts:1485-1486` — `ctx.testerSignal ?? AbortSignal.timeout(config.limits.wallclock_secs * MS_PER_SECOND)` | ✓ |
| heartbeat 阶段加 `tester` | item 1 | `src/heartbeat.ts:11` — `z.enum(['tester', 'worker', 'reviewer', 'ci', 'arbiter'])` | ✓ |
| `limits.redcheck_secs` 正整数可选缺省 600 | item 1 | `src/schema/index.ts:143` — `z.number().int().positive().optional().default(DEFAULT_REDCHECK_SECS)` | ✓ |
| `DEFAULT_REDCHECK_SECS = 600` | item 1 | `src/schema/index.ts:38` — `export const DEFAULT_REDCHECK_SECS = 600;` | ✓ |
| 模板 `redcheck_secs = 600` 带注释 | item 1 | `templates/collie.toml:44-45` — `# SPEC 16.14...` / `redcheck_secs = 600` | ✓ |
| 本仓库 `.collie/collie.toml` 不动 | item 1 | `git diff --stat 9e4884e..5f6a1f8 -- .collie/collie.toml` 无输出 | ✓ |
| 配置检查在写 heartbeat 之前 | item 1 | `src/run.ts:1143-1149` — config check; `src/run.ts:1220` — writeHeartbeat 在后 | ✓ |
| 配置检查报错退出码 1 | item 1 | `src/run.ts:1148` — `return { final: 'BLOCK', exitCode: EXIT_CODES.ERROR }` (ERROR=1) | ✓ |
| 事件流用 `appendStream` 写 `tester.stream.ndjson` | item 1 | `src/run.ts:1508-1509` — `appendStream(root, runId, event, TESTER_STREAM_FILE_NAME)` | ✓ |
| `TESTER_STREAM_FILE_NAME = 'tester.stream.ndjson'` | item 1 | `src/run.ts:89` — `export const TESTER_STREAM_FILE_NAME = 'tester.stream.ndjson';` | ✓ |
| 信封提交经 r2Commit | item 1 | `src/run.ts:1673` — `await r2Commit(root, 'docs: issue …', commitPaths, rec)` | ✓ |
| 裁定提交经 r2Commit | item 1 | `src/run.ts:1627` — `await r2Commit(root, 'progress: …', escalateEnvelopes, rec)` | ✓ |
| `redCheck` 原样交给 `prepareAcceptance` | item 1 | `src/run.ts:1506` — `...(ctx.redCheck !== undefined ? { redCheck: ctx.redCheck } : {})` | ✓ |
| tester.md 写入并在裁定提交里（red_check/misclassified） | item 2 | `src/run.ts:1553-1555` — 写 tester.md; `src/run.ts:1606` — 加入提交列表 | ✓ |
| 不建 `test/acceptance/` 目录 | 额外禁止 | `test -d test/acceptance` → NOT EXISTS | ✓ |
| 不改受保护路径 | 额外禁止 | 受保护文件 diff 0 行 | ✓ |
| 不改 `src/acceptance.ts` 等禁止文件 | 额外禁止 | 额外禁止文件 diff 0 行 | ✓ |
| 不新增依赖 | 额外禁止 | package.json diff 0 行 | ✓ |
| 新文件 `test/tester-step.test.ts` 有三组 describe | item 3 | grep 三组名字 exit 0 | ✓ |
| `test/invariants.test.ts` 加 `tester.stream.ndjson` | item 3 | `test/invariants.test.ts:680-684` — 新增不变量断言 | ✓ |

### 行为要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 带情形批次、红检查一次过：tester, worker, reviewer 顺序 | item 1 bold | `npx vitest run test/tester-step.test.ts` → Tests 9 passed；测试 "with scenarios, red check passes first time" 断言 `runner.calls[0].role=tester, [1].role=worker, [2].role=reviewer`，断言 tester.started < tester.finished < redcheck.result < batch.task_written，断言 task 信封提交含 task.md + new.test.ts + MAP.md | ✓ |
| 不带情形的批次：只 worker, reviewer，无 tester 事件 | item 1 bold | `npx vitest run test/tester-step.test.ts` → Tests 9 passed；测试 "without scenarios" 断言 runner.calls=2，role=worker/reviewer，无 tester./redcheck. 事件，无 tester.stream.ndjson | ✓ |
| red_check 两次不过 → exit 20 | item 2 | `npx vitest run test/tester-step.test.ts` → Tests 9 passed；测试 "red check fails twice" 断言 exit=20，escalated 含 'red_check'，tester.md 存在且在 git 里 | ✓ |
| misclassified → 只拉起 1 次 | item 2 | 同上；测试 "misclassified" 断言 tester calls=1，escalated 含 'misclassified'，tester.md 含 'S1' | ✓ |
| tester_touched_main_tree → 文件留在工作区 | item 2 | 同上；测试 "writes to main workspace" 断言 exit=20，escalated 含 'tester_touched_main_tree'，rogue.txt 还在 | ✓ |
| testerSignal 中止 → escalated tester_failed | item 2 | 同上；测试 "testerSignal aborts" 断言 exit=20，escalated 含 'tester_failed' | ✓ |
| 无 [agent.tester] → exit 1，stderr 点名 | item 2 | 同上；测试 "no [agent.tester]" 断言 exit=1，output 含 '[agent.tester]'，HEAD 不变 | ✓ |
| HEAD 已有 new.test.ts → tester 不拉起 | item 3 | 同上；测试 "HEAD already has new.test.ts" 断言 runner.calls=2，worker+reviewer，无 tester 事件 | ✓ |
| FIX→PASS 时 tester 只第 1 次 | item 2 bold | 测试 "FIX rerun after first PASS" 存在但见下方缺口分析 | ⚠ |

### 上报文字格式核查

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 上报说明文字为「上报：验收测试没有准备好 — <原因>」 | item 1 | `src/run.ts:1571` — `上报：验收测试没有准备好 — ${escalateReason}` | ✓ 仅限 custom path |
| 不带「无 report」 | item 1 | `src/run.ts:1521` — `tester_touched_main_tree` 调用 generic `escalate()`，该函数 at line 1325 用 `上报：无 report — ${reason}` | **✗** |
| `escalated` 原因以 `red_check_failed` 开头 | item 2 | `src/run.ts:1570` — `rec.record('escalated', { reason: '上报：验收测试没有准备好 — red_check_failed: ...' })` → 以 "上报" 开头而非 "red_check_failed" | **✗** |
| `escalated` 原因以 `misclassified` 开头 | item 2 | 同上，reason 以 "上报" 开头 | **✗** |
| `escalated` 原因以 `tester_touched_main_tree` 开头 | item 2 | generic `escalate` at line 1323 records bare reason → "tester_touched_main_tree: ..." → 正确以该前缀开头 | ✓ |
| `escalated` 原因以 `tester_failed` 开头 | item 2 | custom path same issue as red_check — 以 "上报" 开头 | **✗** |

### 被改写或删去的断言

| 文件 | 用例名 | 原断言 | 现断言 | SPEC 仍有效 |
|---|---|---|---|---|
| `test/config.test.ts` | `has the limits of SPEC 3.1` | 期望对象无 `redcheck_secs` | 加 `redcheck_secs: 600` | ✓ 新字段 |
| `test/config.test.ts` | VALID_TOML 内联配置 | 无 `redcheck_secs` 行 | 加 `redcheck_secs = 600` | ✓ 跟模板 |
| `test/schema.test.ts` | validConfig.limits 夹具 | 无 `redcheck_secs` | 加 `redcheck_secs: 600` | ✓ 类型要求 |
| `test/invariants.test.ts` | `src/run.ts non-comment lines do not contain acceptance.js (v046-b08)` | `expect(hasAcceptance).toBe(false)` | `expect(hasAcceptance).toBe(true)`，名字改为 `reference acceptance.js (v046-b15)` | ✓ 任务明确要求改写 |
| `test/invariants.test.ts` | push count upper bound | `expect(pushLines.length).toBeLessThanOrEqual(5)` | `...toBeLessThanOrEqual(6)` | ✓ 新增 1 个 tester escalation push |

以上全部在 task item 3 允许改写的四处范围内，以及"新行为直接要求的最小改动"（push 上限 +1）。无断言被删除或改松。

### 不变量数值变化

- `test/invariants.test.ts` push count 上限: 5 → 6（新增 tester escalation push 路径，理由正当——src/run.ts:1631 是 tester escalation 专用的 push）
- `test/invariants.test.ts` acceptance.js 断言: `false` → `true`（task 明确要求）

无未写明的放宽。

## 结论与理由

**结论：FIX**

所有 10 条验收命令通过，全部 1385 个测试通过，无受保护文件改动，无新增依赖，无范围蔓延。整体实现质量高，三组测试覆盖了核心场景。

但核对条目正文的具体实现要求时发现以下缺口：

**缺口 1：`tester_touched_main_tree` 的上报文字含「无 report」**

task item 1 明确写："上报时的说明文字写「上报：验收测试没有准备好 — <原因>」，不带「无 report」"。

`src/run.ts:1521` 的 `tester_touched_main_tree` 分支调用了通用的 `escalate()` 函数（line 1322），而该函数在 line 1325 使用的前缀是 `上报：无 report — ${reason}`。结果是 `tester_touched_main_tree` 的裁定说明文字变成了 `上报：无 report — tester_touched_main_tree: rogue.txt`，违反了"不带「无 report」"的要求。

修复方式：让 `tester_touched_main_tree` 分支走与 red_check / misclassified 相同的自定义上报路径，或将 `escalate()` 参数化以接受不同前缀。

**缺口 2：custom tester 上报路径把完整前缀写进了 `escalated` 事件的 `reason` 字段**

`src/run.ts:1570`：`rec.record('escalated', { reason: '上报：验收测试没有准备好 — red_check_failed: ...' })`

task item 2 写："`escalated` 的原因以 `red_check_failed` 开头"、"以 `misclassified` 开头"、"以 `tester_failed` 开头"。但实际事件的 `reason` 以 "上报：验收测试没有准备好 — " 开头，不以期望的前缀开头。

对比通用 `escalate()` 在 line 1323 的写法——只记录裸原因、前缀单独用于 decision——自定义路径不一致。

修复方式：`rec.record('escalated', { reason: escalateReason })` （裸原因），前缀仅用于 `escalationReason`（decision 文字）。测试断言也应从 `.toContain()` 改为验证 `.startsWith()`。

**缺口 3：「先 FIX 再 PASS」测试实际跑的是「先 PASS 再 PASS」**

task item 2 bold 和 item 3 describe group 3 要求测试"同一个批次先 FIX 再 PASS：测试 agent 只在第 1 次被拉起，整个队列里运行器被调用的先后是 tester、worker、reviewer、worker、reviewer"。

`test/tester-step.test.ts:625` 的测试 "FIX rerun after first PASS" 两次 `box.run` 都以 PASS 结束（exit 0），不是"先 FIX 再 PASS"。虽然底层机制（文件已在树里→跳过 tester）相同，但场景不符，且未验证完整的五步调用序列。

修复方式：第一次运行让 reviewer 给出 FIX 裁定，第二次给出 PASS；或用 `--continue` 模式单次运行整个队列，断言合并的 runner 调用序列为 tester → worker → reviewer → worker → reviewer。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b15",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [
      "05f5644ac1c08302d0848435e47c522f543c8a6a",
      "5f6a1f811378265dc57d481a7a28df558fde67d5"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "67 files, 1385 tests passed" },
      { "cmd": "e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test", "exit_code": 0, "summary": "67 files, 1385 tests passed" },
      { "cmd": "npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts test/heartbeat.test.ts", "exit_code": 0, "summary": "4 files, 143 tests passed" },
      { "cmd": "grep -qF ... test/tester-step.test.ts (3 groups)", "exit_code": 0, "summary": "all three describe groups found" },
      { "cmd": "grep ... src/run.ts | grep -qE acceptance.js", "exit_code": 0, "summary": "acceptance.js found in non-comment code" },
      { "cmd": "grep ... templates/collie.toml && ! grep ... .collie/collie.toml", "exit_code": 0, "summary": "template has config, local config untouched" },
      { "cmd": "npx tsx scripts/mutation.ts", "exit_code": 0, "summary": "caught 43 survived 0" },
      { "cmd": "grep -qF tester.stream.ndjson test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [
    "tester_touched_main_tree 分支（src/run.ts:1521）调用通用 escalate()，导致裁定说明文字为「上报：无 report — ...」而非 task 要求的「上报：验收测试没有准备好 — ...」。需走自定义上报路径或参数化 escalate()",
    "自定义 tester 上报路径（src/run.ts:1570）把完整前缀写入 escalated 事件的 reason 字段（'上报：验收测试没有准备好 — red_check_failed: ...'），应只写裸原因（'red_check_failed: ...'）使之以 task 要求的前缀开头；测试断言也应从 .toContain() 改为验证前缀",
    "test/tester-step.test.ts:625「FIX rerun after first PASS」两次运行都以 PASS 结束，不是 task 要求的「先 FIX 再 PASS」场景。需第一次给 FIX 裁定、第二次给 PASS，并验证合并调用序列 tester→worker→reviewer→worker→reviewer"
  ],
  "reason": "全部 10 条验收命令通过、1385 测试通过、无保护文件改动、无新增依赖。但 tester_touched_main_tree 的上报文字含禁止的「无 report」、custom 上报路径把前缀写入了 escalated 事件 reason（不以 task 要求的 red_check_failed/misclassified/tester_failed 开头）、FIX→PASS 测试场景实际跑的是 PASS→PASS。CI 以 R2 取证为准。"
}
```
