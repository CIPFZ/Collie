All evidence gathered. Let me compile the final verdict.

# 批次 v04-b14 审核

## 取证过程

### 1. 受保护路径检查
```
git diff --stat 612f68cc..0a0ef2a2 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出：空（无修改）。spec_diff_lines = 0。

### 2. 依赖变化
```
git diff 612f68cc..0a0ef2a2 -- package.json package-lock.json
```
输出：空（无变化）。

### 3. 提交事实
两个提交在范围内：
- `0774ad2ae6f467b5786a44804065f6d30534f6ab` — docs: issue v04-b14 task envelope
- `0a0ef2a233956f5a53d239513fe7477c07187fc1` — test: verdict CI recheck after evidence, when field (SPEC 13.18)

`git merge-base --is-ancestor 0a0ef2a 0596a07` → 确认 head 是远端 main 的祖先，已推送。

### 4. CI 检查
`git ls-remote origin` 返回 `refs/heads/main` 指向 `0596a07...`（report 信封提交）。无 GitHub 凭据，CI 无法查询。

### 5. 验收命令逐条实跑

**命令 1**: `npm run lint` → exit 0, "All matched files use Prettier code style!"
**命令 2**: `npm run typecheck` → exit 0, 无输出
**命令 3**: `npm test` → exit 0, "Test Files 50 passed (50), Tests 955 passed (955)"
**命令 4**: `npm test -- test/verdict-ci-recheck.test.ts` → exit 0, "Test Files 1 passed (1), Tests 8 passed (8)"
**命令 5**: `grep -cE "^\s+it\(" test/verdict-ci-recheck.test.ts | grep -qE "^([5-9]|[1-9][0-9])$"` → exit 0 (count = 8)
**命令 6**: `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "after_evidence" && grep -qE "after_evidence" test/verdict-ci-recheck.test.ts` → exit 0
**命令 7**: `grep -qE "previous verdict commit" test/verdict-ci-recheck.test.ts` → exit 0
**命令 8**: `grep -qE "after_evidence" test/invariants.test.ts` → exit 0

### 6. 行为要求实跑

**verdict-ci-recheck.test.ts**: `npx vitest run test/verdict-ci-recheck.test.ts` → Tests 8 passed (8)
**invariants.test.ts**: `npx vitest run test/invariants.test.ts` → Tests 52 passed (52)

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 50 files, 955 tests passed | ✅ |
| 补查专项测试通过 | `npm test -- test/verdict-ci-recheck.test.ts` | exit 0, 8 tests passed | ✅ |
| 专项测试不少于 5 个 | `grep -cE ...` | 8 个 it()，exit 0 | ✅ |
| 补查标记进代码与测试 | `grep -vE ... && grep ...` | exit 0 | ✅ |
| 测试断言了警告文字 | `grep -qE "previous verdict commit"` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "after_evidence" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1: 补查逻辑

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| pending 时记住 sha | 条目 1 | `src/run.ts:1106-1110` — `ciResult.state === 'pending'` 时 `verdictCiRecheckSha = lastVerdictSha` | ✅ |
| no_runs 时记住 sha | 条目 1 | `src/run.ts:1107` — `ciResult.state === 'none' && ciResult.runs.length === 0` | ✅ |
| 取证后再 queryCi 一次 | 条目 1 | `src/run.ts:1767-1775` — 在 `outcome` 取得后调用 `queryCi` | ✅ |
| 有结论照 12.1 记事件 | 条目 1 | `src/run.ts:1783-1788` — `rec.record('ci.verdict_commit', { ... when: 'after_evidence' })` | ✅ |
| failure/cancelled 打印 warning | 条目 1 | `src/run.ts:1778-1781` — `ctx.err?.('warning: previous verdict commit ...')` | ✅ |
| 同一 sha 至多记一次 | 条目 1 | `verdictCiRecheckSha` 只在 startup 不记录时设置，recheck 只执行一次 | ✅ |
| 上报路径不补查 | 条目 1 | `src/run.ts:1147-1225` — escalate() 返回 RunOutcome，不经过 1765 行处的 recheck 代码 | ✅ |
| 行为验证: startup pending → recheck success 记 after_evidence | 条目 1 | `npx vitest run test/verdict-ci-recheck.test.ts` → Tests 8 passed | ✅ |
| 行为验证: recheck failure → 有事件+警告+结论不变 | 条目 1 | 同上，test #2 & #8 pass | ✅ |
| 行为验证: 两次 pending → 不记 | 条目 1 | 同上，test #3 pass | ✅ |
| 行为验证: escalation path → 不补查 | 条目 1 | 同上，test #5 pass（assert verdictCallCount === 1） | ✅ |

### 条目 2: 事件字段 `when`

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| startup 时写 `when: 'startup'` | 条目 2 | `src/run.ts:1094` — failure/cancelled 路径; `src/run.ts:1101` — success 路径 | ✅ |
| 补查写 `when: 'after_evidence'` | 条目 2 | `src/run.ts:1787` — `when: 'after_evidence'` | ✅ |
| 补查不改结论 | 条目 2 | recheck 代码块（1765-1794）不修改 `verdict` 或 `collected` | ✅ |
| 补查不影响放行判定 | 条目 2 | 同上，recheck 在 verdict 确定后执行 | ✅ |
| 补查不停队列 | 条目 2 | recheck 用 try/catch 包裹，异常不抛出（1793） | ✅ |
| 行为验证: startup completed → 只有 startup 事件 | 条目 2 | `npx vitest run test/verdict-ci-recheck.test.ts` → Tests 8 passed (test #4) | ✅ |

### 条目 3: 测试文件

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新建 test/verdict-ci-recheck.test.ts | 条目 3 | `git diff --stat` 确认 new file | ✅ |
| 用 Sandbox | 条目 3 | `test/verdict-ci-recheck.test.ts:12` — `import { ... Sandbox ... }` | ✅ |
| 用测试注入的 fetch | 条目 3 | `test/verdict-ci-recheck.test.ts:29-76` — `buildFetch` 和 `noRunsFetch` 按 sha 与调用次数返回不同结果 | ✅ |
| 测试 invariants 加 after_evidence | 条目 3 | `test/invariants.test.ts:387-389` — `expect(content).toContain('after_evidence')` | ✅ |
| 行为验证: 全部 8 个测试通过 | 条目 3 | `npx vitest run test/verdict-ci-recheck.test.ts` → Tests 8 passed | ✅ |

### 额外禁止

| 禁止项 | 证据 | 满足 |
|---|---|---|
| 不改受保护路径 | `git diff --stat ... --` 输出为空 | ✅ |
| 不删除/跳过测试 | diff 中无 `.skip` 或删除测试的痕迹 | ✅ |
| 不改注释/字面凑通过 | diff 审查：所有改动都是功能性代码 | ✅ |
| 补查不改结论/放行/退出码 | recheck 代码（1765-1794）不修改 verdict/collected/exitCode | ✅ |
| 不改规则/阈值 | diff 仅涉及新增 recheck 逻辑和 when 字段 | ✅ |
| 不新增依赖 | package.json/lock 无变化 | ✅ |

## 声称与实测的差异

无

## 结论与理由

所有 8 条验收命令实跑通过。代码改动范围精确落在 task.md 3 个条目之内：`src/run.ts` 增加补查逻辑和 `when` 字段，新建 `test/verdict-ci-recheck.test.ts`（8 个测试全部通过），`test/invariants.test.ts` 增加不变量断言。无受保护文件修改，无依赖变化，无范围蔓延。提交已推送至远端。结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b14",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "0774ad2ae6f467b5786a44804065f6d30534f6ab",
      "0a0ef2a233956f5a53d239513fe7477c07187fc1"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "50 files, 955 tests passed" },
      { "cmd": "npm test -- test/verdict-ci-recheck.test.ts", "exit_code": 0, "summary": "1 file, 8 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/verdict-ci-recheck.test.ts | grep -qE \"^([5-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "8 it() blocks found" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qE \"after_evidence\" && grep -qE \"after_evidence\" test/verdict-ci-recheck.test.ts", "exit_code": 0, "summary": "after_evidence in non-comment code and test" },
      { "cmd": "grep -qE \"previous verdict commit\" test/verdict-ci-recheck.test.ts", "exit_code": 0, "summary": "warning text found in test" },
      { "cmd": "grep -qE \"after_evidence\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant assertion present" }
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
  "reason": "All 8 acceptance commands pass. Code changes correctly implement SPEC 13.18 recheck logic with when field. 8 behavioral tests all pass. No protected files modified, no dependency changes. CI以R2取证为准。"
}
```
