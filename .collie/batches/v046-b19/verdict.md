I now have all the evidence I need. Let me compile the verdict.

# 批次 v046-b19 审核

## 取证过程

### 1. 验收命令实跑

**命令 1：`npm run lint`**
```
> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✓

**命令 2：`npm run typecheck`**
```
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```
退出码：0 ✓

**命令 3：`npm test`**
```
 Test Files  67 passed (67)
      Tests  1408 passed (1408)
   Duration  24.06s
```
退出码：0 ✓

**命令 4：`npm test -- test/why.test.ts test/report.test.ts`**
```
 Test Files  2 passed (2)
      Tests  49 passed (49)
   Duration  12.62s
```
退出码：0 ✓

**命令 5：`grep -qF "tester.finished" src/view.ts && grep -qF "tester.finished" test/why.test.ts && grep -qF "tester.finished" test/report.test.ts`**
退出码：0 ✓

### 2. 提交事实

- 单一工作提交：`711507c13d7af0fdf7f7c9d558987940599d48a2` — `cli: display tester agent cost/turns/duration in why and report (SPEC 16.16)`
- 信封提交：`2c126554e63a81658fbd1cca8617236688cf2ef9` — `docs: issue v046-b19 task envelope`
- `git merge-base --is-ancestor 711507c origin/main` → 是 origin/main 的祖先，已推送 ✓
- `git log --oneline origin/main | head -5` 确认 `711507c` 在 origin/main 链上

### 3. 受保护路径

```
git diff --stat 228d28f..711507c -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance
```
输出为空——无受保护文件被改动。

`git log --format='%h %s' 228d28f..711507c -- test/acceptance` 输出为空——worker 未触碰 test/acceptance。

### 4. 依赖变化

`git diff 228d28f..711507c -- package.json package-lock.json` 输出为空——无依赖变更。

### 5. 不变量数值变化

`git diff 228d28f..711507c -- test/invariants.test.ts` 输出为空——无。

### 6. 被改写或删去的断言

检查两个测试文件的 diff 中是否有被删除的行（`^-` 且非 `^---`）：
- `test/why.test.ts`：无删除行
- `test/report.test.ts`：无删除行

两个文件的改动都是纯追加，起始位置分别在原文件末尾（why.test.ts:1262, report.test.ts:535），没有任何现有断言被改写或删去。

无。

### 7. 范围检查

`git diff --stat 228d28f..711507c -- . ':(exclude).collie/batches'`：
```
 src/view.ts         | 156 ++++++++++++++++++++++----
 test/report.test.ts | 313 ++++++++++++++++++++++++++++++++++++++++++++++++++++
 test/why.test.ts    | 232 ++++++++++++++++++++++++++++++++++++++
 3 files changed, 679 insertions(+), 22 deletions(-)
```

仅修改了 `src/view.ts`（实现）和两个测试文件——完全在 task.md 指定的范围内。

非目标目录的文件（`src/view.ts` 以外的 `src/` 文件）：
`git diff 228d28f..711507c -- . ':(exclude).collie/batches' ':(exclude)src/view.ts'` 仅显示两个测试文件的 diff——没有碰任何被禁止的文件。

### 8. 行为测试实跑

**`npx vitest run test/why.test.ts`**
```
 Test Files  1 passed (1)
      Tests  28 passed (28)
```
28 条全部通过（含新增的 3 条 tester agent 测试）。

**`npx vitest run test/report.test.ts`**
```
 Test Files  1 passed (1)
      Tests  21 passed (21)
```
21 条全部通过（含新增的 3 条 tester agent 测试）。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, 无错误输出 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, 无错误输出 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 67 files / 1408 tests passed | ✅ |
| why 与 report 的测试通过 | `npm test -- test/why.test.ts test/report.test.ts` | exit 0, 2 files / 49 tests passed | ✅ |
| 视图读了测试 agent 的事件 | `grep -qF "tester.finished" src/view.ts && grep -qF "tester.finished" test/why.test.ts && grep -qF "tester.finished" test/report.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `why` 读 `tester.started` / `tester.finished` 事件 | task 条目 1 | `src/view.ts:1147` — `events.filter((e) => e.event === 'tester.finished')` | ✅ |
| `why` 显示测试 agent 轮数、花费、用时，与 worker 并列 | task 条目 1 | `src/view.ts:1375-1385` — `if (a.tester !== null)` 条件下 push tester 行，紧随 worker 行之后 | ✅ |
| 多次拉起时合计 | task 条目 1 | `src/view.ts:1149-1178` — 循环 `testerFinishedAll` 累加 `sumTurns`/`sumCost`/`sumDuration` | ✅ |
| 多次拉起合计——行为验证 | task 条目 1 | `npx vitest run test/why.test.ts` → Tests 28 passed；用例 "multiple tester invocations: aggregated turns, cost, and duration" 断言 `turns=8 (5+3)`, `costUsd≈2.3 (1.5+0.8)`, `invocations=2` | ✅ |
| 没有 `tester.*` 事件时，`why` 输出逐字节相同 | task 条目 1 | `src/view.ts:1376` — `if (a.tester !== null)` 控制 tester 行；`src/view.ts:1498-1503` — cost 行用老格式 `cost: worker=X reviewer=Y total=Z` | ✅ |
| 没有 tester 时逐字节相同——行为验证 | task 条目 1 | `npx vitest run test/why.test.ts` → Tests 28 passed；用例 "no tester events: output identical…" 断言 `not.toContain('tester:')` 和 `not.toMatch(/cost:.*tester/)` | ✅ |
| `report` 合计花费包含 tester | task 条目 1 | `src/view.ts:1713-1740` — `projectReport` 中累加 `testerCost`，`totalCost = worker + reviewer + tester` | ✅ |
| `report` 合计花费包含 tester——行为验证 | task 条目 1 | `npx vitest run test/report.test.ts` → Tests 21 passed；用例 "tester.finished cost included in total" 断言 `totalCost≈7.5 (5+1+1.5)` | ✅ |
| `report` 拉起两次合计——行为验证 | task 条目 1 | `npx vitest run test/report.test.ts` → Tests 21 passed；用例 "two tester invocations…aggregated" 断言 `testerCost≈1.75 (1+0.75)`, `totalCost≈6.25` | ✅ |
| 没有 `tester.*` 事件时 `report` 输出逐字节相同 | task 条目 1 | `src/view.ts:1878` — `hasTester = proj.batchRows.some(r => r.testerCost !== null)`，false 时用原始表头 | ✅ |
| `report` 无 tester 逐字节——行为验证 | task 条目 1 | `npx vitest run test/report.test.ts` → Tests 21 passed；用例 "no tester events: output byte-identical" 断言 `not.toContain('tester 花费')` 且原始表头完整 | ✅ |
| `test/why.test.ts` 有测试 agent 用例 | task 条目 2 | `test/why.test.ts:1268-1496` — describe "why — tester agent display (SPEC 16.16)" 含 3 个 it 块 | ✅ |
| `test/report.test.ts` 有测试 agent 用例 | task 条目 2 | `test/report.test.ts:537-850` — describe "collie report: tester agent cost (SPEC 16.16)" 含 3 个 it 块 | ✅ |
| 已有断言一条都不改 | task 条目 2 | 两个测试文件的 diff 均为纯追加（grep 删除行为空），无任何已有断言被修改 | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 遵守 |
|---|---|---|---|
| 改动任何受保护路径 | task 额外禁止 | `git diff --stat` 对保护路径输出为空 | ✅ |
| 改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | task 额外禁止 | diff stat 只含 3 个文件：`src/view.ts`、`test/report.test.ts`、`test/why.test.ts` | ✅ |
| 改动 `src/run.ts` 等禁止文件 | task 额外禁止 | 除 `src/view.ts` 外无其他 `src/` 文件被改 | ✅ |
| 改变无 tester 时 `why`/`report` 输出哪怕一个字节 | task 额外禁止 | 代码逻辑：tester 为 null 时 why 不输出 tester 行、cost 行用原格式；report 中 `hasTester=false` 时用原始表头。测试验证通过 | ✅ |
| 删除或跳过测试 | task 额外禁止 | 测试文件无删除行；总测试数 1408 | ✅ |
| 改写已有断言 | task 额外禁止 | 测试文件无删除行 | ✅ |
| 为让验收通过而改注释/字面 | task 额外禁止 | 验收命令均自然通过 | ✅ |
| 测试拉起真实 runner / 真实网络请求 | task 额外禁止 | 新测试使用内存中构造的 Event 数组和临时目录，无进程启动/网络调用 | ✅ |
| 新增依赖 | task 额外禁止 | package.json 无变更 | ✅ |

### 不变量数值变化

无。

### 被改写或删去的断言

无。

## 结论与理由

全部 5 条验收命令实跑通过。代码变更仅涉及 `src/view.ts`（实现）和两个测试文件（新增 6 个用例），完全在 task 范围内。没有修改任何受保护文件、禁止文件或已有断言。测试覆盖了三种情形（有 tester、多次拉起合计、无 tester 逐字不变）。提交已推送至 origin/main。无依赖变更，无范围蔓延。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b19",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "711507c13d7af0fdf7f7c9d558987940599d48a2"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "67 files, 1408 tests passed" },
      { "cmd": "npm test -- test/why.test.ts test/report.test.ts", "exit_code": 0, "summary": "2 files, 49 tests passed" },
      { "cmd": "grep -qF \"tester.finished\" src/view.ts && grep -qF \"tester.finished\" test/why.test.ts && grep -qF \"tester.finished\" test/report.test.ts", "exit_code": 0, "summary": "all three files contain tester.finished" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 5 acceptance commands pass. Implementation in src/view.ts correctly adds tester agent display to why and report, with aggregation for multiple invocations and byte-identical output when no tester events exist. Tests cover all three scenarios in both test files. No protected files modified, no existing assertions changed, no forbidden files touched, no new dependencies. CI verification deferred to R2."
}
```
