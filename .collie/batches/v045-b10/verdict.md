The code change is clean and minimal. The old `batchesRun.length >= ctx.max` (counting all runs) is replaced by `batchesRun.filter((b) => b.verdict === 'PASS').length >= ctx.max` (counting only PASS verdicts). The `queue.finished.batches` still uses the full `batchesRun` array, unchanged.

Now I have all the evidence I need. Let me compile the verdict.

# 批次 v045-b10 审核

## 取证过程

### 1. 提交事实

```
git log --oneline 526aa1ec..bfaec1bb
bfaec1b runner: --max counts only PASS verdicts, not total runs (SPEC 14.14, v045-b10)
a6a0bad docs: issue v045-b10 task envelope
```

两个提交，均在范围内。`git branch -r --contains bfaec1bbc1` 显示 `origin/main` 包含该 commit，已推送。

### 2. 受保护文件

```
git diff --stat 526aa1ec..bfaec1bb -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空，无受保护文件被修改。

### 3. 额外禁止路径

```
git diff 526aa1ec..bfaec1bb -- src/arbiter.ts src/gate.ts src/evidence.ts src/follow.ts src/view.ts .github/ eslint.config.js vitest.config.ts package.json
```
输出为空，无禁止文件被修改。

### 4. 依赖变化

```
git diff 526aa1ec..bfaec1bb -- package.json package-lock.json
```
输出为空，无依赖变化。

### 5. 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 均通过 |
| 2 | `npm run typecheck` | 0 | tsc 无错误 |
| 3 | `npm test` | 0 | 58 test files, 1140 tests passed, 20.15s |
| 4 | `npm test -- test/queue-limit.test.ts` | 0 | 1 file, 4 tests passed |
| 5 | `grep -cE ...` | 0 | 计数为 4，满足 ≥4 |
| 6 | `grep -qE "FakeRunner" ... && grep -qE "--max" ...` | 0 | 两个 pattern 均找到 |
| 7 | `! grep ... batchesRun\.length >= ctx\.max` | 0 | 非注释代码行中不含旧模式 |
| 8 | `grep -qE "batchesRun" test/invariants.test.ts` | 0 | 找到 |

### 6. 行为测试实跑

```
npx vitest run test/queue-limit.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)

npx vitest run test/invariants.test.ts
 Test Files  1 passed (1)
      Tests  67 passed (67)
```

### 7. CI

```
ci_conclusion: unknown
ci_branch_matched: null
```
CI 以 R2 取证为准。无 GitHub 凭据。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1140 passed | ✅ |
| --max 专项测试通过 | `npm test -- test/queue-limit.test.ts` | exit 0, 4 passed | ✅ |
| 专项测试不少于 4 个 | grep 计数命令 | exit 0（计数 = 4） | ✅ |
| 专项测试跑真实队列 | grep FakeRunner && grep --max | exit 0 | ✅ |
| 不再按运行次数到数 | `! grep ... batchesRun.length >= ctx.max` | exit 0 | ✅ |
| 不变量同步 | `grep batchesRun test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 到数判断改为 PASS 计数 | 条目 1 | `src/run.ts:2601` — `const passedCount = batchesRun.filter((b) => b.verdict === 'PASS').length;` | ✅ |
| `queue.finished.batches` 照旧列全部运行 | 条目 1 | `src/run.ts:2605` — `batches: batchesRun,`（未变） | ✅ |
| `fix_max` 计数与处理不变 | 条目 1 | diff 中 fix_max 相关代码未触及（仅 2599-2609 行改动） | ✅ |
| 新文件 `test/queue-limit.test.ts` | 条目 2 | 文件存在，359 行 | ✅ |
| 使用 FakeRunner | 条目 2 | `test/queue-limit.test.ts:6` — `import { FakeRunner } from '../src/runner/fake.js';` | ✅ |
| 跑真实 `run --continue --max N` | 条目 2 | `test/queue-limit.test.ts:197` — `box.cli(['run', '--continue', '--max', '2'], runner)` 等 | ✅ |
| `test/invariants.test.ts` 加不变量 | 条目 2 | `test/invariants.test.ts:505` — `it('src/run.ts does not contain batchesRun.length >= ctx.max (v045-b10)', ...)` | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 确认无 | ✅ |
| 不改 .github/ eslint vitest package.json | 额外禁止 | `git diff` 确认无 | ✅ |
| 不改 arbiter/gate/evidence/follow/view | 额外禁止 | `git diff` 确认无 | ✅ |
| 不删/跳过测试 | 额外禁止 | diff 仅有纯新增 | ✅ |
| 不改写已有断言 | 额外禁止 | invariants.test.ts diff 只有 `+` 行 | ✅ |
| 不新增依赖 | 额外禁止 | package.json 无变化 | ✅ |
| 不用真实 runner/网络 | 额外禁止 | 测试使用 FakeRunner + Sandbox | ✅ |

### 行为要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| --max 2，FIX→PASS→PASS：两批通过，reason=limit，batches 3 项 | 条目 1（加粗 1） | `npx vitest run test/queue-limit.test.ts` — Tests 4 passed；测试 1 断言 `reason: 'limit'`、`batches.length=3`、backlog 两条 `passed` | ✅ |
| --max 1，FIX→PASS：第一批通过停下，第二批 pending，batches 2 项 | 条目 1（加粗 2） | 同上测试 2 断言 `reason: 'limit'`、`batches.length=2`、第二批 `pending` | ✅ |
| --max 1，FIX 超 fix_max：exit 20，escalated reason fix_max | 条目 2 | 同上测试 3 断言 `code=20`、`reason: 'fix_max'`、`escalated` 事件 | ✅ |
| 无 --max，两批一次通过：exit 0，两个 passed | 条目 2 | 同上测试 4 断言 `code=0`、`reason: 'exhausted'`、两条 `passed` | ✅ |
| 断言 batch_started why | 条目 2 | 测试 1：`batchStarted` 3 项 `new/fix_retry/new`；测试 2：2 项 `new/fix_retry` | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增一个测试用例，没有修改任何已有的数值上下限。

### 被改写或删去的断言

无。diff 中所有已有测试文件（`test/invariants.test.ts`）的改动仅为纯新增（`+` 行），没有删除或修改任何现有 `expect(...)` 语句。

## 声称与实测的差异

无。

## 结论与理由

全部 8 条验收命令实跑通过。代码改动精确地将 `batchesRun.length >= ctx.max` 替换为 `passedCount >= ctx.max`（只计 PASS），符合条目 1 的要求。`queue.finished.batches` 形状不变，`fix_max` 逻辑未触及。新测试文件 4 个用例覆盖了全部指定场景（两个加粗情形 + fix_max 超限 + 无 max 耗尽），使用 FakeRunner 跑真实队列循环，断言了 backlog 状态、queue.finished reason/batches、batch_started why。不变量测试已同步。无受保护文件修改、无依赖变化、无已有断言改写。范围完全在条目之内，无蔓延。

PASS。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b10",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "a6a0bad9fd455055e42f97fb4ebe3ac46b2da4a4",
      "bfaec1bbc11e8a2a18e0b1e801fd92981f5a0fe6"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier passed" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "58 files, 1140 tests passed" },
      { "cmd": "npm test -- test/queue-limit.test.ts", "exit_code": 0, "summary": "1 file, 4 tests passed" },
      { "cmd": "grep -cE '\\s+it\\(' test/queue-limit.test.ts | grep -qE '^([4-9]|[1-9][0-9])$'", "exit_code": 0, "summary": "count=4, >= 4" },
      { "cmd": "grep -qE 'FakeRunner' test/queue-limit.test.ts && grep -qE -e '--max' test/queue-limit.test.ts", "exit_code": 0, "summary": "both patterns found" },
      { "cmd": "! grep -vE '^\\s*(//|\\*|/\\*)' src/run.ts | grep -qE 'batchesRun\\.length >= ctx\\.max'", "exit_code": 0, "summary": "old pattern absent from code lines" },
      { "cmd": "grep -qE 'batchesRun' test/invariants.test.ts", "exit_code": 0, "summary": "pattern found" }
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
  "reason": "All 8 acceptance commands pass. Code change correctly replaces batchesRun.length with PASS-only count. 4 test cases cover all specified scenarios using FakeRunner with real queue. No protected files modified, no dependency changes, no existing assertions altered. CI 以 R2 取证为准。"
}
```
