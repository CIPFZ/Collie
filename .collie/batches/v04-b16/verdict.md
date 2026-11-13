OK, imported from evidence.js - same filtering used elsewhere.

Now I have all the evidence I need. Let me compile the final verdict.

# 批次 v04-b16 审核

## 取证过程

### 1. 提交事实

```
git log --oneline 261918b..9437943
9437943 cli: unresolvable report sha → claim.mismatch FIX, not BLOCK escalation (SPEC 13.21)
7f4f3eb docs: issue v04-b16 task envelope
```

两个提交都存在。`git ls-remote` 确认远端 main 在 `83de38c`，即 head_sha 之后仅有 `report(collie): v04-b16` 一条信封提交（不在取证范围内）。head_sha 在 main 分支上。

### 2. 受保护文件

```
git diff --stat 261918b..9437943 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```

输出为空，零行变更。spec_diff_lines = 0。

### 3. 依赖变化

```
git diff 261918b..9437943 -- package.json package-lock.json
```

输出为空，无依赖变化。

### 4. 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | "All matched files use Prettier code style!" |
| 2 | `npm run typecheck` | 0 | 无错误输出 |
| 3 | `npm test` | 0 | 50 test files, 965 tests passed |
| 4 | `npm test -- test/report-sha.test.ts` | 0 | 1 file, 10 tests passed |
| 5 | `grep -cE "^\s+it\(" test/report-sha.test.ts \| grep -qE "^(9\|[1-9][0-9])$"` | 0 | 计数为 10 ≥ 9 |
| 6 | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "unresolvable" && grep -qE "unresolvable" test/report-sha.test.ts` | 0 | 两处均匹配 |
| 7 | `grep -qE "claim\.mismatch" test/report-sha.test.ts && grep -qE "fix_retry" test/report-sha.test.ts` | 0 | 两处均匹配 |
| 8 | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "声称不符" && grep -qE "声称不符" test/report-sha.test.ts` | 0 | 两处均匹配 |
| 9 | `grep -qE "unresolvable" test/invariants.test.ts` | 0 | 匹配 |

全部 9 条验收命令退出码 0。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 965 passed | ✅ |
| sha 校验专项测试通过 | `npm test -- test/report-sha.test.ts` | exit 0, 10 passed | ✅ |
| 专项测试不少于 9 个 | grep 计数 | 10 ≥ 9 | ✅ |
| 改判进代码与测试 | grep unresolvable | 两处均有 | ✅ |
| 测试断言了声称不符事件与自动重跑 | grep claim.mismatch + fix_retry | 两处均有 | ✅ |
| 重跑说明进 task 生成与测试 | grep 声称不符 | 两处均有 | ✅ |
| 不变量同步 | grep unresolvable invariants | 有 | ✅ |

## 条目要求与额外禁止

### 条目 1：改判 — 解析不了时记 `claim.mismatch`，不拉 reviewer，结论 FIX、退出码 10

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 解析不了时记 `claim.mismatch`（field/claimed/actual=`unresolvable`，不带 rule） | task 条目 1 | `src/run.ts:1607-1612`：`rec.record('claim.mismatch', { field: m.field, claimed: m.claimed, actual: 'unresolvable' })`，无 rule 字段 | ✅ |
| 不拉起 reviewer | task 条目 1 | `src/run.ts:1615`：注释 "no reviewer, no CI, no acceptance"；代码在 `unresolvableMismatches.length > 0` 时直接 `return finish('FIX', ...)` at line 1692，不经过 reviewer 段 | ✅ |
| 结论 FIX | task 条目 1 | `src/run.ts:1692`：`return finish('FIX', { decision, evidence })` 其中 `decision.final = 'FIX'` at line 1647 | ✅ |
| 退出码 10 | task 条目 1 | `src/run.ts:65-67`：`EXIT_CODES = { PASS: 0, FIX: 10, ... }`；`finish('FIX',...)` → `exitCode: EXIT_CODES[final]` = 10 | ✅ |
| progress 写一条记录并照常提交推送 | task 条目 1 | `src/run.ts:1663`：`writeProgress(root, {...})`; `src/run.ts:1670`：`await commit(root, ...)`; `src/run.ts:1674`：`await push(root, ...)` | ✅ |
| 「不是后代」「不是祖先」与 git 命令失败仍是上报 BLOCK | task 条目 1 | `src/run.ts:1700-1710`：`escalate(... "is not a descendant of base_sha" ...)`; `src/run.ts:1720-1730`：`escalate(... "is not an ancestor of HEAD" ...)`; `src/run.ts:1700`：git error → `escalate(...)` | ✅ |
| **行为验证**: 非存在 sha → exit 10 FIX，有 claim.mismatch，无 reviewer.started/escalated | test/report-sha.test.ts | `npx vitest run test/report-sha.test.ts` → Tests 10 passed | ✅ |

### 条目 2：重跑 — 「上一轮判 FIX」一节加小节「声称不符」

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| `renderFixSection` 加「声称不符」小节，列出上一轮每条 `claim.mismatch` | task 条目 2 | `src/run.ts:424-433`：`'### 声称不符'`、`for (const m of info.claimMismatches)` 逐条列出 | ✅ |
| `FixInfo` 增加 `claimMismatches` 字段 | task 条目 2 | `src/run.ts:600-601`：`claimMismatches?: readonly { field: string; claimed: string; actual: string }[]` | ✅ |
| 上一轮没有 `reviewer.verdict` 时不读 `verdict.md` | task 条目 2 | `src/run.ts:756-767`：`const hasReviewerVerdict = batchEvents.some(e => e.event === 'reviewer.verdict'); if (hasReviewerVerdict) { ... readVerdict ... }` | ✅ |
| 没有 reviewer.verdict 时提交清单取 `base_sha..HEAD` 的 worker 代码提交 | task 条目 2 | `src/run.ts:769-777`：`if (!hasReviewerVerdict && baseSha !== undefined) { const allCommits = await log(root, baseSha, await revParse(root, 'HEAD')); commits = allCommits.filter(c => !isR2Commit(c.subject)).map(c => c.sha); }` | ✅ |
| `--continue` 下按普通 FIX 计入 `fix_max` 并重跑，不加新的队列分支 | task 条目 2 | 代码不改 fix_max 计入逻辑（diff 不触碰 `src/run.ts:2551-2555` 的 `currentFixes <= config.limits.fix_max` 判断），`finish('FIX',...)` 返回后进入 queue 的标准 FIX 重跑分支 | ✅ |
| **行为验证**: --continue fix_retry 及 声称不符 出现在 task 中 | test/report-sha.test.ts | `npx vitest run test/report-sha.test.ts` → Tests 10 passed | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 「不存在的 sha → 退出码 20」改成新行为 | task 条目 3 | test/report-sha.test.ts 第一个 it 改为 `'non-existent 40-char head_sha → exit 10 FIX, claim.mismatch with actual=unresolvable, no reviewer.started or escalated'`，断言 `expect(code).toBe(EXIT_CODES.FIX)` | ✅ |
| journal 有 `claim.mismatch`（actual 为 `unresolvable`） | task 条目 3 | test/report-sha.test.ts:74-77：`expect(headMismatch?.actual).toBe('unresolvable')` | ✅ |
| 没有 `reviewer.started` 与 `escalated` | task 条目 3 | test/report-sha.test.ts:80-85：`expect(reviewerStarted).toHaveLength(0)` + `expect(escalated).toHaveLength(0)` | ✅ |
| `--continue` 下第1次写错、第2次写对 → PASS | task 条目 3 | test/report-sha.test.ts:287-345：badShaScene 后 goodScene → `expect(code).toBe(EXIT_CODES.PASS)` | ✅ |
| 第2次的 `queue.batch_started.why` 是 `fix_retry` | task 条目 3 | test/report-sha.test.ts:356：`expect(batchStarted[1]?.why).toBe('fix_retry')` | ✅ |
| task 含「声称不符」与写错的 sha | task 条目 3 | test/report-sha.test.ts:360：`expect(taskContent).toContain('声称不符')` | ✅ |
| 仓库里留着更早一轮的 `verdict.md` 时 task 不引用它的 gaps | task 条目 3 | test/report-sha.test.ts:366-418：单独测试，run 1 PASS 产生 verdict.md，run 2 unresolvable FIX，run 3 rerun 检查 task 含声称不符但不含第一轮 reviewer 内容 | ✅ |
| 连续写错超过 `fix_max` → 退出码 20 | task 条目 3 | test/report-sha.test.ts:424-488：3 个 badScene（fix_max=2），`expect(code).toBe(EXIT_CODES.BLOCK)` + `expect(fixFinished).toHaveLength(3)` + 有 `escalated` reason='fix_max' | ✅ |
| 「不是后代」仍是退出码 20 | task 条目 3 | test/report-sha.test.ts:163-175：`expect(code).toBe(EXIT_CODES.BLOCK)` + `expect(reason).toContain('is not a descendant')` (v04-b13 原有，未删除) | ✅ |
| `test/invariants.test.ts` 加「`src/run.ts` 含 `unresolvable`」 | task 条目 3 | test/invariants.test.ts:397-400：`expect(content).toContain('unresolvable')` | ✅ |
| **行为验证**: 所有 report-sha tests 通过 | test/report-sha.test.ts | `npx vitest run test/report-sha.test.ts` → Tests 10 passed | ✅ |
| **行为验证**: 所有 invariants tests 通过 | test/invariants.test.ts | `npx vitest run test/invariants.test.ts` → Tests 54 passed | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动受保护路径 | task 额外禁止 | `git diff --stat ... -- SPEC.md CONSTRAINTS.md ...` → 空输出 | ✅ |
| 不删除或跳过任何测试 | task 额外禁止 | 「不存在的 sha → 退出码 20」被改为新行为（exit 10 FIX），这是允许的。「不是后代」测试保留。无 `.skip` 或 `.todo` 出现 | ✅ |
| 不为让验收命令通过而改注释或字面 | task 额外禁止 | `unresolvable` 和 `声称不符` 出现在非注释代码行中（`src/run.ts:1611` actual: 'unresolvable'，`src/run.ts:1619` 声称不符） | ✅ |
| 不改动规则 1~10 判定 | task 额外禁止 | diff 不触及 arbiter/gate 逻辑 | ✅ |
| 不让「不是后代」「不是祖先」变成 FIX | task 额外禁止 | `src/run.ts:1706-1710, 1726-1730`：这两条路径仍调用 `escalate()` → BLOCK | ✅ |
| 不改动放行判定、`fix_max`、各项阈值 | task 额外禁止 | diff 不触碰 fix_max 判定（`src/run.ts:2555`）或阈值常量 | ✅ |
| 不新增依赖 | task 额外禁止 | package.json 无变更 | ✅ |

## 声称与实测的差异

无。

## 范围检查

变更文件：
- `.collie/batches/v04-b16/task.md` — 任务信封（scope内）
- `src/run.ts` — 改判逻辑 + 重跑逻辑（scope内）
- `test/report-sha.test.ts` — 新增/改写测试（scope内）
- `test/invariants.test.ts` — 不变量同步（scope内）
- `test/scenario-e.test.ts` — `batchHistory` async 适配（机械变更，scope内，因 `batchHistory` 变 async）
- `test/scenario-f.test.ts` — 同上

所有变更落在 task.md 条目范围内。scenario-e/f 的变更是 `batchHistory` 变 async 的必要适配。

## 结论与理由

全部 9 条验收命令实跑通过。3 个条目的结构要求和行为要求逐条核对均满足。无受保护文件被修改，无新增依赖，无范围蔓延。额外禁止事项全部合规。提交已推送到远端。代码实现与 SPEC 13.21 对应：解析不了的 sha 记 claim.mismatch + FIX（退出码 10），不拉 reviewer；「不是后代」「不是祖先」仍走 BLOCK。重跑时正确处理无 reviewer.verdict 的场景。测试覆盖了所有指定场景。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b16",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "7f4f3eb3d9f8268b0dc09fe55c6f78a8d964b104",
      "9437943164b2a3a7dd2b04c13e2082126d1d0e46"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "50 files, 965 tests passed" },
      { "cmd": "npm test -- test/report-sha.test.ts", "exit_code": 0, "summary": "1 file, 10 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/report-sha.test.ts | grep -qE \"^(9|[1-9][0-9])$\"", "exit_code": 0, "summary": "count=10 >= 9" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qE \"unresolvable\" && grep -qE \"unresolvable\" test/report-sha.test.ts", "exit_code": 0, "summary": "both match" },
      { "cmd": "grep -qE \"claim\\.mismatch\" test/report-sha.test.ts && grep -qE \"fix_retry\" test/report-sha.test.ts", "exit_code": 0, "summary": "both match" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qE \"声称不符\" && grep -qE \"声称不符\" test/report-sha.test.ts", "exit_code": 0, "summary": "both match" },
      { "cmd": "grep -qE \"unresolvable\" test/invariants.test.ts", "exit_code": 0, "summary": "match found" }
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
  "reason": "全部 9 条验收命令通过，3 个条目结构与行为核对均满足，无保护文件变更、无新依赖、scope 无蔓延。CI 以 R2 取证为准。"
}
```
