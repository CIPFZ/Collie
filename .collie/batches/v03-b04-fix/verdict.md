No tests were deleted or skipped.

Now I have all the evidence I need. Let me compile the verdict.

# 批次 v03-b04-fix 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline 57bb7bf..ebc4154
ebc4154 roles: FIX rerun task semantics, fix_max per-queue counting, queue journal
b170eb0 docs: issue v03-b04-fix task envelope
```

两个提交，head_sha = `ebc4154895d6c9152efc3c07379338c3a05eee15`。

远端推送确认：`git branch -r --contains ebc4154` → `origin/main` 包含此 sha（它是 `a2ec47d report(collie)` 的祖先）。

### 2. 受保护文件

```
$ git diff --stat 57bb7bf..ebc4154 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(空输出)
```

未修改任何受保护文件。`spec_diff_lines = 0`。

### 3. 依赖变化

```
$ git diff 57bb7bf..ebc4154 -- package.json package-lock.json
(空输出)
```

无依赖变化。

### 4. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 全通过 |
| 2 | `npm run typecheck` | 0 | tsc 零错误 |
| 3 | `npm test` | 0 | 39 files, 801 tests passed |
| 4 | `grep -qE "上一轮判 FIX" src/run.ts && grep -qE "上一轮判 FIX" test/scenario-*.test.ts` | 0 | 匹配 |
| 5 | `! grep -v '^\s*//' src/run.ts \| grep -qE "countBatchFinished" && grep -qE "escalated" test/scenario-*.test.ts` | 0 | countBatchFinished 不在非注释行；escalated 出现在测试中 |
| 6 | `grep -qE "queue\.batch_started" src/schema/index.ts && grep -qE "fix_retry" src/run.ts` | 0 | 两者均匹配 |
| 7 | `grep -qE "\-\-queue" src/cli.ts && grep -qE "\-\-queue" test/cli.test.ts` | 0 | 两者均匹配 |
| 8 | `grep -qE "queue\.batch_started" test/invariants.test.ts` | 0 | 匹配 |

全部 8 条验收命令退出码为 0。

### 5. 行为测试实跑

```
$ npx vitest run test/scenario-j.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ npx vitest run test/invariants.test.ts
 Test Files  1 passed (1)
      Tests  34 passed (34)

$ npx vitest run test/cli.test.ts
 Test Files  1 passed (1)
      Tests  20 passed (20)

$ npx vitest run test/schema.test.ts
 Test Files  1 passed (1)
      Tests  70 passed (70)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 801 passed | ✅ |
| FIX 重跑不写中断 | `grep -qE "上一轮判 FIX" ...` | exit 0 | ✅ |
| fix_max 只计本次队列 | `! grep ... countBatchFinished && grep ... escalated` | exit 0 | ✅ |
| 队列事件进 schema | `grep ... queue.batch_started && grep ... fix_retry` | exit 0 | ✅ |
| show --queue | `grep ... --queue ...` | exit 0 | ✅ |
| 不变量同步 | `grep ... queue.batch_started ...` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1: FIX 重跑的 task 语义

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| `run.finished.verdict === 'FIX'` 时 `interrupted_at: null` | task.md 条目1 | `src/run.ts:672` — `interruptedAt = undefined;` (FIX 分支); `src/roles/worker.ts:158` — `interrupted_at: ctx.interrupted_at ?? null` | ✅ |
| 不写「上一轮中断」 | task.md 条目1 | `src/run.ts:672` — FIX 分支 sets `interruptedAt = undefined`; `src/roles/worker.ts:166` — `interruptSection` only appended when `ctx.interrupted_at !== undefined` | ✅ |
| 改写「上一轮判 FIX」一节含 gaps 原样 | task.md 条目1 | `src/run.ts:411-417` — `renderFixSection` iterates `info.gaps` as `- ${gap}` | ✅ |
| 含未通过的验收命令与退出码 | task.md 条目1 | `src/run.ts:420-424` — renders `failedAcceptance` with cmd and exit_code | ✅ |
| 含上一轮代码提交清单 | task.md 条目1 | `src/run.ts:428-432` — renders `info.commits` | ✅ |
| 含「只补缺口，不要重做」 | task.md 条目1 | `src/run.ts:436` — `'这些提交已在审核范围内，只补缺口，不要重做。'` | ✅ |
| 场景测试：第1轮 FIX 带 gaps，第2轮 task.md 含 gaps、`interrupted_at` null、不含「上一轮中断」 | task.md 条目1 | `npx vitest run test/scenario-j.test.ts` — Tests 8 passed; group 4 test at `test/scenario-j.test.ts:399-468` asserts `capturedTask.toContain('上一轮判 FIX')`, gaps text, `not.toContain('上一轮中断')`, `match(/interrupted_at:\s*null/)` | ✅ |

### 条目 2: fix_max 只计本次队列

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 内存计数而非 `countBatchFinished` | task.md 条目2 | `src/run.ts:1838` — `const fixCounts = new Map<string, number>();`; `countBatchFinished` function removed (diff confirmed); only comment reference at `src/run.ts:1837` | ✅ |
| 场景测试：预先放两个历史 FIX journal 仍可重跑 | task.md 条目2 | `test/scenario-j.test.ts:477-529` — group 5 pre-places 2 historical FIX journals, runs 3 FIX rounds before escalation; `npx vitest run test/scenario-j.test.ts` — Tests 8 passed | ✅ |

### 条目 3: 队列 journal

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| `queueRec.record('queue.batch_started', ...)` before batch run | task.md 条目3 | `src/run.ts:1872-1877` — records with `run_id, batch_id, attempt, why` | ✅ |
| `why` 取 `new` / `fix_retry` / `rule1_retry` | task.md 条目3 | `src/run.ts:1842` — `let nextWhy = 'new'`; `src/run.ts:1984` — `nextWhy = 'rule1_retry'`; `src/run.ts:2008` — `nextWhy = 'fix_retry'` | ✅ |
| `queue.finished.batches` 改为 `{batch_id, run_id, verdict}[]` | task.md 条目3 | `src/run.ts:1702` — type `{ batch_id: string; run_id: string; verdict: string }[]`; `src/run.ts:1895` — `batchesRun.push({ batch_id: ..., run_id: ..., verdict: ... })` | ✅ |
| schema 同步: `queue.batch_started` in EVENT_TYPES | task.md 条目3 | `src/schema/index.ts:209-211` — `'queue.batch_started'` added to EVENT_TYPES | ✅ |
| `collie show --queue <q-run_id>` 按 journal 打印时间线 | task.md 条目3 | `src/cli.ts:304-319` — `showQueue` function; `src/cli.ts:531-540` — `--queue` option registration | ✅ |
| invariants: `src/run.ts` 含 `queue.batch_started` | task.md 条目3 | `test/invariants.test.ts:253-255` — test verifying `queue.batch_started` exists in run.ts | ✅ |
| invariants: `src/run.ts` 不含 `countBatchFinished` | task.md 条目3 | `test/invariants.test.ts:257-264` — test verifying non-comment lines don't contain `countBatchFinished`; `npx vitest run test/invariants.test.ts` — Tests 34 passed | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动受保护路径 | task.md 额外禁止 | `git diff --stat ... -- <protected>` 空输出 | ✅ |
| 删除或跳过测试 | task.md 额外禁止 | diff 中无删除 `it(`/`test(`/`.skip`/`.only` 行 | ✅ |
| 改注释/字面凑通过验收命令 | task.md 额外禁止 (铁律26) | 验收命令均匹配实际代码/测试结构，无注释凑数 | ✅ |
| 改动 gate.ts / 规则1-10 / fix_max 默认值 | task.md 额外禁止 | `git diff ... -- src/gate.ts` 空输出；`fix_max` 默认在 schema 中无变化 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 8 条验收命令实跑通过（exit 0）。三个条目的结构要求和行为要求均满足，场景测试（scenario-j group 4 和 group 5）已实跑通过。无受保护文件被修改，无依赖变化，无范围蔓延，无删除/跳过测试。提交已推送到远端。结论为 PASS。

```json
{
  "schema_version": 1,
  "batch_id": "v03-b04-fix",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "b170eb09b1ca63ca73a72a81ce460d126fd42397",
      "ebc4154895d6c9152efc3c07379338c3a05eee15"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "39 files, 801 tests passed" },
      { "cmd": "grep -qE \"上一轮判 FIX\" src/run.ts && grep -qE \"上一轮判 FIX\" test/scenario-*.test.ts", "exit_code": 0, "summary": "matched in both" },
      { "cmd": "! grep -v '^\\s*//' src/run.ts | grep -qE \"countBatchFinished\" && grep -qE \"escalated\" test/scenario-*.test.ts", "exit_code": 0, "summary": "countBatchFinished absent from non-comment lines; escalated present in tests" },
      { "cmd": "grep -qE \"queue\\.batch_started\" src/schema/index.ts && grep -qE \"fix_retry\" src/run.ts", "exit_code": 0, "summary": "both matched" },
      { "cmd": "grep -qE \"\\-\\-queue\" src/cli.ts && grep -qE \"\\-\\-queue\" test/cli.test.ts", "exit_code": 0, "summary": "both matched" },
      { "cmd": "grep -qE \"queue\\.batch_started\" test/invariants.test.ts", "exit_code": 0, "summary": "matched" }
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
  "reason": "All 8 acceptance commands pass (exit 0). Scenario-j groups 4 & 5 verify FIX rerun task semantics and per-queue fix_max counting behaviorally. No protected files changed, no dependency changes, no scope creep. CI 以 R2 取证为准。"
}
```
