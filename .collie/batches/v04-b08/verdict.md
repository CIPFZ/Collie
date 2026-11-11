Good — no test `it(` blocks were deleted. Only fields were removed from fixtures (which is explicitly allowed by the task: "从手写夹具里删掉 R2 不写的字段不算").

Here is my complete verdict:

---

# 批次 v04-b08 审核

## 取证过程

### 1. 提交事实

```
git log --format='%H' a26954825e30ee70bf2685b63db7d3c6958a602c..c94222e0ec8ba4477cc2e1e85d4854dc8a2dad57
```

产出两个提交：
- `b3a6ff9b1fe87784bdadd2bf09ded93c0abc2dba` — docs: issue v04-b08 task envelope
- `c94222e0ec8ba4477cc2e1e85d4854dc8a2dad57` — cli: fix projection values — attempt by R2 formula, run duration from timestamps, cost dash, empty-data JSON (SPEC 13.13)

远端确认：
```
git branch -r --contains c94222e0ec8ba4477cc2e1e85d4854dc8a2dad57
→ origin/HEAD -> origin/main
  origin/main
```
head_sha 已在 `origin/main` 上。

### 2. 受保护路径

```
git diff --stat a26954825e30ee70bf2685b63db7d3c6958a602c..c94222e0ec8ba4477cc2e1e85d4854dc8a2dad57 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空，零改动。

### 3. 依赖变化

```
git diff a26954825e30ee70bf2685b63db7d3c6958a602c..c94222e0ec8ba4477cc2e1e85d4854dc8a2dad57 -- package.json package-lock.json
```
无输出，无依赖变化。

### 4. CI

无 GitHub 凭据，无法查询。`ci_conclusion` 填 `unknown`、`ci_branch_matched` 填 `null`。CI 以 R2 取证为准。

### 5. 验收命令实跑

全部 10 条验收命令逐条实跑，均退出码 0。

| # | 命令 | 退出码 | 摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | ESLint + Prettier all pass |
| 2 | `npm run typecheck` | 0 | tsc 零错误 |
| 3 | `npm test` | 0 | 46 files, 898 tests passed |
| 4 | `npm test -- test/view-real.test.ts` | 0 | 1 file, 5 tests passed |
| 5 | `grep -qE "Sandbox\.create" test/view-real.test.ts` | 0 | 匹配到 |
| 6 | `grep -cE "^\s+it\(" test/view-real.test.ts \| grep -qE "^([4-9]\|[1-9][0-9])$"` | 0 | 计数 5，满足 ≥4 |
| 7 | `! grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "batchSelected\.attempt"` | 0 | 非注释行无 batchSelected.attempt |
| 8 | `npx tsx src/cli.ts status --json \| node -e "..."` | 0 | 输出含 current/queue/lastQueue |
| 9 | `npx tsx src/cli.ts timeline --json \| node -e "..."` | 0 | 输出是数组 |
| 10 | `grep -qE "view-real" test/invariants.test.ts` | 0 | 匹配到 |

### 6. 测试真实数字

全量运行：46 files, **898 tests** passed，15.16s。

专项文件：
- `test/view-real.test.ts`: 5 tests passed
- `test/invariants.test.ts`: 44 tests passed
- `test/timeline.test.ts`: 11 tests passed
- `test/view.test.ts`: 15 tests passed

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 898 passed | ✅ |
| 真实运行夹具的专项测试通过 | `npm test -- test/view-real.test.ts` | exit 0, 5 passed | ✅ |
| 专项测试用 Sandbox 跑真实一轮 | `grep -qE "Sandbox\.create" test/view-real.test.ts` | exit 0 | ✅ |
| 专项测试不少于 4 个 | count = 5, ≥ 4 | exit 0 | ✅ |
| 投影不再读 R2 不写的字段 | non-comment lines no batchSelected.attempt | exit 0 | ✅ |
| 空数据时 status --json 结构不变 | 输出含 current/queue/lastQueue | exit 0 | ✅ |
| 空数据时 timeline --json 是数组 | 输出是 `[]` | exit 0 | ✅ |
| 不变量同步 | grep found view-real | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目要求核对

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `src/view.ts` 加推算 attempt 的函数 | 条目 1 | `src/view.ts:170-198` — `export function computeAttempt(…)` | ✅ |
| status 的「当前」段用 computeAttempt | 条目 1 | `src/view.ts:367-369` — `computeAttempt(runDataList, currentRun.runId, proj.batchId)` | ✅ |
| timeline 的 run_end 用 computeAttempt | 条目 1 | `src/view.ts:505` — `computeAttempt(runDataList, rd.runId, bid)` | ✅ |
| 删掉 `batch.selected.attempt` / `run.finished.attempt` 的读取 | 条目 1 | `grep "batchSelected\.attempt\|run\.finished\.attempt" src/view.ts` → 无匹配（注释行也无）| ✅ |
| 运行用时改为 run.finished.ts − run.started.ts | 条目 1 | `src/view.ts:216-222`（projectRun）与 `src/view.ts:506-511`（projectTimeline）| ✅ |
| 按版本汇总无花费数据时显示 — | 条目 1 | `src/view.ts:821-822` — `if (s.runsWithoutCost === s.runCount) lines.push('  cost: —')` | ✅ |
| status --json 空数据时输出同结构 | 条目 2 | `src/cli.ts:556` — 只有 `!json` 时提前返回；JSON 路径继续执行 `buildStatus` | ✅ |
| timeline --json 空数据时输出 [] | 条目 2 | `src/cli.ts:589` — `deps.out('[]\n')` | ✅ |
| 不再输出 `{"message": …}` | 条目 2 | `src/cli.ts` 差异：status 删除 `JSON.stringify({ message: ... })`，timeline 改为 `[]\n` | ✅ |
| 新建 test/view-real.test.ts 用 Sandbox | 条目 3 | `test/view-real.test.ts:46` — `Sandbox.create()` | ✅ |
| 先 FIX 再 PASS 两次运行 | 条目 3 | `test/view-real.test.ts:48-62` — 第 1 轮 FIX，第 2 轮 PASS | ✅ |
| 断言 attempt 依次 1、2 | 条目 3 | `test/view-real.test.ts:79,90` — `expect(attempt).toBe(1)` / `expect(attempt).toBe(2)` | ✅ |
| attempt 等于 task.md frontmatter 的 attempt | 条目 3 | `test/view-real.test.ts:80,91` — `expect(taskAttemptAfterRun1).toBe(1)` / `toBe(2)` | ✅ |
| 运行用时不为 null | 条目 3 | `test/view-real.test.ts:101` — `expect(p.durationMs).not.toBeNull()` | ✅ |
| 没有花费数据时汇总显示 — | 条目 3 | `test/view-real.test.ts:118` — `expect(text).toContain('cost: —')` | ✅ |
| timeline.test.ts 手写夹具删掉 R2 不写的字段 | 条目 3 | diff 显示删除了 `attempt: 1` 从 `batch.selected` 事件（两处） | ✅ |
| view.test.ts 手写夹具删掉 R2 不写的字段 | 条目 3 | diff 显示删除了 `attempt: 1` / `attempt: 2` 从 `batch.selected` 事件（四处） | ✅ |
| invariants 加两条 | 条目 3 | `test/invariants.test.ts:317-335` — batchSelected.attempt 不变量与 Sandbox.create 不变量 | ✅ |

### 行为要求实跑

| 行为要求 | 测试文件 | 命令与结果 |
|---|---|---|
| 投影 attempt = 1,2 对 FIX+PASS | test/view-real.test.ts | `npx vitest run test/view-real.test.ts` → Tests 5 passed | ✅ |
| 运行用时不为 null | test/view-real.test.ts | 同上 | ✅ |
| 花费汇总显示 — | test/view-real.test.ts | 同上 | ✅ |
| timeline attempt 计算 | test/view-real.test.ts | 同上 | ✅ |
| 不变量检查 | test/invariants.test.ts | `npx vitest run test/invariants.test.ts` → Tests 44 passed | ✅ |
| timeline 测试（含 duration 修正） | test/timeline.test.ts | `npx vitest run test/timeline.test.ts` → Tests 11 passed | ✅ |
| view 测试（含 duration 修正） | test/view.test.ts | `npx vitest run test/view.test.ts` → Tests 15 passed | ✅ |

### 额外禁止核对

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | 额外禁止 1 | `git diff --stat base..head -- <protected files>` 输出为空 | ✅ |
| 为了让测试过而删除或跳过任何测试 | 额外禁止 2 | diff 中无 `it(` 行被删除，只删了夹具里的 `attempt` 字段（允许） | ✅ |
| 为了让验收命令通过而改注释或字面 | 额外禁止 3 | diff 中无可疑的注释修改来匹配 grep | ✅ |
| 改动 run.ts / gate.ts / arbiter.ts | 额外禁止 4 | `git diff --name-only` 确认这三个文件不在改动列表中 | ✅ |
| status/timeline 写文件 | 额外禁止 4 | `src/cli.ts` 的 status 和 timeline 函数只调 `deps.out()`，不写文件 | ✅ |
| 绕过 src/view.ts 直接读 journal | 额外禁止 4 | cli.ts 的 status/timeline 都通过 `loadRuns` (from view.ts) 读取 | ✅ |
| 新增依赖 | 额外禁止 4 | package.json 无改动 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 10 条验收命令实跑通过。三个条目的结构要求与行为要求全部核对通过（附具体文件行号和测试实跑结果）。受保护路径零改动，依赖无变化，scope 完全在 task.md 范围内（只改 `src/view.ts`、`src/cli.ts`、三个测试文件和 task 信封），无额外禁止违反。提交已推送到 `origin/main`。CI 无法查证（无凭据），以 R2 取证为准。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b08",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "b3a6ff9b1fe87784bdadd2bf09ded93c0abc2dba",
      "c94222e0ec8ba4477cc2e1e85d4854dc8a2dad57"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "ESLint + Prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "46 files, 898 tests passed" },
      { "cmd": "npm test -- test/view-real.test.ts", "exit_code": 0, "summary": "5 tests passed" },
      { "cmd": "grep -qE 'Sandbox\\.create' test/view-real.test.ts", "exit_code": 0, "summary": "matched" },
      { "cmd": "grep -cE '^\\s+it\\(' test/view-real.test.ts | grep -qE '^([4-9]|[1-9][0-9])$'", "exit_code": 0, "summary": "count=5, >=4" },
      { "cmd": "! grep -vE '^\\s*(//|\\*|/\\*)' src/view.ts | grep -qE 'batchSelected\\.attempt'", "exit_code": 0, "summary": "no match in non-comment lines" },
      { "cmd": "npx tsx src/cli.ts status --json | node -e '...'", "exit_code": 0, "summary": "output contains current/queue/lastQueue keys" },
      { "cmd": "npx tsx src/cli.ts timeline --json | node -e '...'", "exit_code": 0, "summary": "output is array" },
      { "cmd": "grep -qE 'view-real' test/invariants.test.ts", "exit_code": 0, "summary": "matched" }
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
  "reason": "All 10 acceptance commands pass. Three conditions fully implemented: attempt computed from R2 formula (computeAttempt function), run duration from timestamps, cost dash for no-data versions, empty-data --json outputs correct structure. test/view-real.test.ts has 5 tests using Sandbox with real collie run. Protected paths zero diff, no dependency changes, no prohibited files modified. CI以R2取证为准。"
}
```
