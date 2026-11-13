Now I have all the evidence needed. Let me compile the verdict.

---

# 批次 v04-b17 审核

## 取证过程

### 1. 提交存在

```
$ git rev-parse e701903c11e5184752f82b90466a2a22c34cfe74
e701903c11e5184752f82b90466a2a22c34cfe74
```

三个提交（新→旧）：
- `e701903c11e5184752f82b90466a2a22c34cfe74` — test: why/timeline reviewer cost, model, tokens, sha-no-rule, invariants
- `2fe4abbf7ba365194fa6c1faad35ef17c14da183` — cli: why/timeline show reviewer cost, model, tokens, head_sha, ci.verdict_commit
- `0df5f9d5b9240f309c029a35139a6fd2ba40305e` — docs: issue v04-b17 task envelope

### 2. 远端推送

```
$ git ls-remote origin | grep e701903c
NOT FOUND ON REMOTE
```

`remote_has_head` = false。

### 3. 受保护文件

```
$ git diff --stat 85819ca..e701903 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(no output)
```

无受保护文件被改。`spec_diff_lines` = 0。

### 4. 依赖变化

```
$ git diff 85819ca..e701903 -- package.json package-lock.json
(no output)
```

无依赖变化。

### 5. CI

没有 GitHub 凭据，查不到 CI 状态。`ci_conclusion` = `unknown`，`ci_branch_matched` = `null`。CI 以 R2 取证为准。

### 6. 验收命令逐条实跑

| # | 命令 | 退出码 | 结果摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | All matched files use Prettier code style! |
| 2 | `npm run typecheck` | 0 | 无错误 |
| 3 | `npm test` | 0 | 50 test files, 975 tests passed |
| 4 | `npm test -- test/why.test.ts test/timeline.test.ts test/report-sha.test.ts` | 0 | 3 test files, 47 tests passed |
| 5 | `grep -vE ... src/view.ts \| grep -qE "ci\.verdict_commit" && grep -qE "ci\.verdict_commit" test/why.test.ts` | 0 | 通过 |
| 6 | `grep -vE ... src/view.ts \| grep -qE "model=" && grep -qE "model=" test/why.test.ts` | 0 | 通过 |
| 7 | `grep -qE "reviewer\.finished" test/timeline.test.ts` | 0 | 通过 |
| 8 | `grep -qE "声称不符" test/why.test.ts` | 0 | 通过 |
| 9 | `grep -qE "not\.toHaveProperty\(.rule.\)" test/report-sha.test.ts` | 0 | 通过 |
| 10 | `grep -qE "ci\.verdict_commit" test/invariants.test.ts` | 0 | 通过 |

### 7. 行为测试实跑

```
$ npx vitest run test/why.test.ts
 Test Files  1 passed (1)
      Tests  23 passed (23)

$ npx vitest run test/timeline.test.ts
 Test Files  1 passed (1)
      Tests  14 passed (14)

$ npx vitest run test/report-sha.test.ts
 Test Files  1 passed (1)
      Tests  10 passed (10)

$ npx vitest run test/invariants.test.ts
 Test Files  1 passed (1)
      Tests  55 passed (55)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 975 passed | ✅ |
| 投影专项测试通过 | `npm test -- test/why.test.ts test/timeline.test.ts test/report-sha.test.ts` | exit 0, 47 passed | ✅ |
| why 显示裁定提交 CI | grep ci.verdict_commit | exit 0 | ✅ |
| why 显示模型 | grep model= | exit 0 | ✅ |
| timeline 测试覆盖 reviewer 花费 | grep reviewer.finished | exit 0 | ✅ |
| 声称不符的结论行有测试 | grep 声称不符 | exit 0 | ✅ |
| sha 写错时 run.finished 不带 rule | grep not.toHaveProperty(.rule.) | exit 0 | ✅ |
| 不变量同步 | grep ci.verdict_commit | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：src/view.ts 花费 = worker + reviewer

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| timeline run_end 花费 = worker + reviewer | task.md 条目 1 | `src/view.ts:513-519` — `const wCost = wf !== undefined ? asNumber(wf.cost_usd) : null; const rCost = rf !== undefined ? asNumber(rf.cost_usd) : null; if (wCost !== null \|\| rCost !== null) { costUsd = (wCost ?? 0) + (rCost ?? 0); }` | ✅ |
| 只加有的，两者都没有才算缺数据 | task.md 条目 1 | `src/view.ts:518` — `if (wCost !== null \|\| rCost !== null)` — 任一不为 null 就算有 | ✅ |
| why 补 worker 模型 | task.md 条目 1 | `src/view.ts:964` — `const workerModel = workerStarted !== undefined ? asString(workerStarted.model) : null;` | ✅ |
| why 补 worker 用时 | task.md 条目 1 | `src/view.ts:996` — `durationMs: asNumber(workerFinished.duration_ms),` | ✅ |
| why 补 worker token（input+cache+cacheRead） | task.md 条目 1 | `src/view.ts:976-979` — `workerTokensIn = inputTokens + cacheCreation + cacheRead;` | ✅ |
| why 补 reviewer 模型 | task.md 条目 1 | `src/view.ts:1034` — `model: reviewerStarted !== undefined ? asString(reviewerStarted.model) : null,` | ✅ |
| why 补 reviewer 轮数 | task.md 条目 1 | `src/view.ts:1036` — `turns: reviewerFinished !== undefined ? asNumber(reviewerFinished.num_turns) : null,` | ✅ |
| why 补 reviewer 花费 | task.md 条目 1 | `src/view.ts:1037` — `costUsd: reviewerFinished !== undefined ? asNumber(reviewerFinished.cost_usd) : null,` | ✅ |
| why 补 reviewer 用时 | task.md 条目 1 | `src/view.ts:1039` — `durationMs: reviewerFinished !== undefined ? asNumber(reviewerFinished.duration_ms) : null,` | ✅ |
| why 补 head_sha | task.md 条目 1 | `src/view.ts:1103-1107` — `const headSha = headShaFromReviewer ?? headShaFromCi;` | ✅ |
| why 补 ci.verdict_commit | task.md 条目 1 | `src/view.ts:1110-1116` — `const verdictCommitCi = events.filter((e) => e.event === 'ci.verdict_commit')...` | ✅ |
| 每个 attempt cost: worker=…reviewer=…total=… | task.md 条目 1 | `src/view.ts:1404-1408` — `lines.push(\`cost: worker=${wc} reviewer=${rc} total=${tc}\`);` | ✅ |
| 对应 --json 字段 | task.md 条目 1 | `src/view.ts:897-903` — `WhyAttempt` interface has `headSha`, `verdictCommitCi`, `cost` fields | ✅ |

### 条目 2：声称不符结论行 & run.ts finish rule 范围

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| view.ts: reason 以「声称不符：」开头且没有 rule 时写 `结论：FIX，<reason>` | task.md 条目 2 | `src/view.ts:1265-1267` — `if (a.rule === null && a.reason?.startsWith('声称不符：') === true) { return \`结论：${a.verdict}，${a.reason}\`; }` | ✅ |
| run.ts finish: 只在规则号 1~10 时写 rule | task.md 条目 2 | `src/run.ts:1180-1185` — `extra.decision.rule >= 1 && extra.decision.rule <= 10 ? { rule: extra.decision.rule } : {}` | ✅ |
| run.ts 只许改这一处 | task.md 条目 2 | `git diff -- src/run.ts` 显示仅一处改动（finish 函数 rule 条件），10 删 + 14 增（含注释和 eslint 指令），不涉及 sha 校验、仲裁或队列逻辑 | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| why.test.ts 加用例 | task.md 条目 3 | `test/why.test.ts:183-1021` — 新增 "Sandbox with scripted cost/model/tokens" (Sandbox 跑真实 collie run) + "声称不符 reason" + "why shows worker model…" 共 3 组新用例 | ✅ |
| why.test.ts Sandbox 用例 costUsd/numTurns/durationMs/usage 脚本化 | task.md 条目 3 | `test/why.test.ts:222-223` — `result: { exitCode: 0, costUsd: 5.25, numTurns: 15, durationMs: 240000, usage: {...} }` | ✅ |
| timeline.test.ts 加用例 | task.md 条目 3 | `test/timeline.test.ts:425-565` — 新增 3 个测试：worker+reviewer 花费之和、仅 worker 有花费、version summary 含 reviewer 花费 | ✅ |
| timeline 花费 = worker + reviewer | task.md 条目 3 | `npx vitest run test/timeline.test.ts` — Tests 14 passed，含 "run_end cost equals worker + reviewer" 测试通过 | ✅ |
| timeline 只有 worker 花费时等于 worker 的 | task.md 条目 3 | `npx vitest run test/timeline.test.ts` — Tests 14 passed，含 "run_end cost equals only worker cost" 测试通过 | ✅ |
| why 四处与 --json 字段 | task.md 条目 3 | `npx vitest run test/why.test.ts` — Tests 23 passed，含 "why shows worker model, duration, tokens and reviewer model, turns, cost, duration" 和 "--json fields" 断言 | ✅ |
| sha 写错那次运行结论行含「声称不符」、不含「规则 0」与「规则 —」 | task.md 条目 3 | `npx vitest run test/why.test.ts` — Tests 23 passed，含 "声称不符 reason → conclusion shows reason without 规则" 测试（line 873-875: `expect(text).not.toContain('规则 0'); expect(text).not.toContain('规则 —');`） | ✅ |
| report-sha.test.ts 加断言: sha 解析不了时 run.finished 没有 rule | task.md 条目 3 | `test/report-sha.test.ts:92` — `expect(finished).not.toHaveProperty('rule');`；`npx vitest run test/report-sha.test.ts` — Tests 10 passed | ✅ |
| invariants.test.ts 加 ci.verdict_commit | task.md 条目 3 | `test/invariants.test.ts:402-405` — `it('src/view.ts contains ci.verdict_commit (v04-b17)')` | ✅ |

### 额外禁止

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动受保护路径 | task.md 禁止 1 | `git diff --stat -- SPEC.md CONSTRAINTS.md ...` 无输出 | ✅ |
| 不删除或跳过测试 | task.md 禁止 2 | diff 中无 `.skip`、无 `it.todo`、无删除测试行 | ✅ |
| 不为验收命令通过改注释 | task.md 禁止 3 | 验收命令全部原样通过，无注释改动 | ✅ |
| 不新增事件或字段 | task.md 禁止 4 | view.ts 只读取现有 journal 事件，不写任何文件 | ✅ |
| 不读 stream.ndjson 或 report.md | task.md 禁止 4 | view.ts import 列表不含 stream/report，只用 journal.replay | ✅ |
| run.ts 除条目 2 那一处外无改动 | task.md 禁止 5 | `git diff -- src/run.ts` 仅一处 hunk，改在 finish 函数的 rule 条件 | ✅ |
| 不改规则 1~10、放行判定、各项阈值 | task.md 禁止 5 | run.ts 改动只增加了 range check，不改规则定义或阈值 | ✅ |
| 不新增依赖 | task.md 禁止 5 | `git diff -- package.json package-lock.json` 无输出 | ✅ |

### 不变量数值变化

无。invariants.test.ts 只新增了一个 invariant（`ci.verdict_commit`），未修改任何已有的数值上下限。

## 声称与实测的差异

无。

## 结论与理由

所有 10 条验收命令实跑通过（退出码均为 0）。975 个测试全部通过。三条条目的实现均满足 task.md 的要求：

1. **view.ts** 正确实现 timeline run_end 花费 = worker + reviewer（只加有的），why 补齐了 worker 模型/用时/token，reviewer 模型/轮数/花费/用时，head_sha，ci.verdict_commit，每个 attempt 的 cost 分拆行，以及对应 --json 字段。
2. **run.ts** 的 finish 函数仅在 rule 1~10 时写 rule 字段；view.ts 对 reason 以「声称不符：」开头且无 rule 的情况直接输出 reason。run.ts 仅此一处改动。
3. **测试** 覆盖充分：why.test.ts 有 Sandbox 跑真实 collie run 的用例（脚本化 costUsd/numTurns/durationMs/usage），timeline.test.ts 覆盖 worker+reviewer 花费之和/仅 worker 花费，why 四处新字段与 --json，声称不符结论行不含规则 0/规则 —，report-sha.test.ts 断言 run.finished 无 rule，invariants 同步。

无受保护文件被修改，无新增依赖，diff 范围落在 task.md 条目之内，无范围蔓延。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b17",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "e701903c11e5184752f82b90466a2a22c34cfe74",
      "2fe4abbf7ba365194fa6c1faad35ef17c14da183",
      "0df5f9d5b9240f309c029a35139a6fd2ba40305e"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "50 files, 975 tests passed" },
      { "cmd": "npm test -- test/why.test.ts test/timeline.test.ts test/report-sha.test.ts", "exit_code": 0, "summary": "3 files, 47 tests passed" },
      { "cmd": "grep ci.verdict_commit in view.ts (non-comment) and why.test.ts", "exit_code": 0, "summary": "both found" },
      { "cmd": "grep model= in view.ts (non-comment) and why.test.ts", "exit_code": 0, "summary": "both found" },
      { "cmd": "grep reviewer.finished in timeline.test.ts", "exit_code": 0, "summary": "found" },
      { "cmd": "grep 声称不符 in why.test.ts", "exit_code": 0, "summary": "found" },
      { "cmd": "grep not.toHaveProperty(.rule.) in report-sha.test.ts", "exit_code": 0, "summary": "found" },
      { "cmd": "grep ci.verdict_commit in invariants.test.ts", "exit_code": 0, "summary": "found" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "All 10 acceptance commands pass (exit 0). 975 tests pass. view.ts correctly adds worker+reviewer cost to timeline and why projections. run.ts finish only writes rule for 1-10. Tests cover Sandbox scripted cost, timeline reviewer cost, 声称不符 conclusion, sha-no-rule assertion, and invariant sync. No protected files changed, no new deps. CI 以 R2 取证为准。"
}
```
