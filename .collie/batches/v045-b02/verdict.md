Now I have all the evidence. Let me compile the verdict.

---

# 批次 v045-b02 审核

## 取证过程

### 1. 受保护文件

```
git diff --stat 6cc1bd50..5146e815 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```

输出为空——零受保护文件被修改。`spec_diff_lines = 0`。

### 2. 依赖变化

```
git diff 6cc1bd50..5146e815 -- package.json package-lock.json
```

输出为空——无依赖变化。`deps_diff = []`。

### 3. 禁止修改的文件

```
git diff --stat 6cc1bd50..5146e815 -- src/run.ts src/gate.ts src/arbiter.ts
```

输出为空——`run.ts`、`gate.ts`、`arbiter.ts` 未被修改。

### 4. view.ts 不写文件

```
grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "writeFileSync|appendFileSync"
```

无匹配——view.ts 不含文件写入调用。

### 5. view.ts diff 范围

view.ts 的变更全部在 `@@ -1436,6 +1436,354 @@`，即在 `formatWhy` 之后追加 354 行新代码，未修改任何已有函数（`formatStatus`、`formatTimeline`、`formatWhy`、`buildStatus` 等不受影响）。

### 6. cli.ts diff 范围

cli.ts 的变更：
- 导入区增加 3 个导入（`formatReport`, `projectReport`, `RunData`）
- 新增 `REPORT_EXIT` 常量
- 新增 `report()` 函数（约 69 行）
- `main()` 中增加 `report` 子命令注册（8 行）

所有变更均为追加，无删除行，不影响现有命令的行为。

### 7. 提交事实

```
git log --format='%H %s' 6cc1bd50..5146e815
```

```
5146e815d7cd34881dcc968f2c73edc3f6b673af test: add report.test.ts and invariant for projectReport (SPEC 14.2)
1b2eb9b093b614f97eddf90228ccf95124e7420a cli: add collie report command and projectReport/formatReport (SPEC 14.2)
ca1416df015d26c38583a114dcd83f43abe93ed9 docs: issue v045-b02 task envelope
```

三个提交均已推送到 origin/main（`5146e815` 是 origin/main `a744dcb7` 的祖先）。

### 8. CI

无 GitHub 凭据，CI 以 R2 取证为准。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 1. 代码规范零错误 | `npm run lint` | exit 0, `All matched files use Prettier code style!` | ✅ |
| 2. 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 3. 全部测试通过 | `npm test` | exit 0, `53 passed (53)`, `1018 passed (1018)` | ✅ |
| 4. report 专项测试通过 | `npm test -- test/report.test.ts` | exit 0, `1 passed (1)`, `15 passed (15)` | ✅ |
| 5. 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/report.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0（实际 15 个 `it` 块） | ✅ |
| 6. 专项测试含真实运行的夹具 | `grep -qE "Sandbox\.create" test/report.test.ts` | exit 0（3 处匹配） | ✅ |
| 7. 没有队列数据时退出码 2 | `npx tsx src/cli.ts report; test $? -eq 2` | exit 0, stderr "no queue runs found on this machine" | ✅ |
| 8. 投影函数进代码与测试 | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "projectReport" && grep -qE "projectReport" test/report.test.ts` | exit 0 | ✅ |
| 9. 投影模块仍然不写文件 | `! grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "writeFileSync\|appendFileSync"` | exit 0 | ✅ |
| 10. 不变量同步 | `grep -qE "projectReport" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：`src/view.ts` 加 `projectReport` 与 `formatReport`（SPEC 14.2）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `projectReport` 函数存在 | task §1 | `src/view.ts:1521` `export function projectReport(` | ✅ |
| `formatReport` 函数存在 | task §1 | `src/view.ts:1686` `export function formatReport(` | ✅ |
| 七节固定、顺序固定 | SPEC 14.2 | `src/view.ts:1695` `# 队列运行`, `:1705` `## 开跑前检查`, `:1719` `## 实际经过`, `:1737` `## 放行与打扰`, `:1752` `## 每个批次`, `:1771` `## 队列 journal`, `:1779` `## 队列剩余` — 顺序正确 | ✅ |
| 取不到的写 `—` | SPEC 14.2 | `src/view.ts:1697-1701` 使用 `dash()` 函数; `:1708` preflight null 时输出 `'—'`; `:1726` 用 `costFmt` 对 null 输出 `'—'` | ✅ |
| §1 退出码映射正确 | SPEC 14.2 §1 | `src/view.ts:1445-1454` `QUEUE_REASON_EXIT`: limit→0, exhausted→0, blocked→20, fix_max→20, escalated→20, evidence_unavailable→20, paused→30, preflight_failed→1 | ✅ |
| §3 attempt 复用 `computeAttempt` | task §1 | `src/view.ts:1575` `const attempt = computeAttempt(allRunData, batchRunId, batchId);` | ✅ |
| §3 用时复用推算 | task §1 | `src/view.ts:1584-1586` 用 `run.started` 和 `run.finished` 的 ts 差，同 why/timeline 的口径; `:1728` 用 `formatDuration` | ✅ |
| §3 花费复用推算 | task §1 | `src/view.ts:1589-1597` 从 `worker.finished`/`reviewer.finished` 取 `cost_usd`，同 why 的口径; `:1726` 用 `COST_DECIMALS` | ✅ |
| §5 复用 `projectWhy`/`formatWhy` | task §1 | `src/cli.ts:696` `const whyProj = projectWhy(runDataList, bid)`, `:698` `formatWhy(whyProj)` | ✅ |
| §6 复用 `show --queue` 的逐行格式 | task §1 | `src/cli.ts:703` `targetRun.events.map(describeEvent).join('\n')` — 与 `showQueue` 函数 (`:363`) 使用同一个 `describeEvent` | ✅ |
| §7 复用 `status` 的队列段 | task §1 | `src/cli.ts:706-721` 加载 backlog 并过滤 pending/blocked，格式为 `pending: <ids>` / `blocked: <ids>`，与 `formatStatus` (view.ts:740-746) 的 `pending:` / `blocked:` 格式一致 | ✅ |

### 条目 2：CLI `collie report` 命令

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `--queue <q_run_id>` 选项 | task §2 / SPEC 14.2 | `src/cli.ts:905` `.option('--queue <q_run_id>', ...)` | ✅ |
| `--json` 选项 | task §2 / SPEC 14.2 | `src/cli.ts:906` `.option('--json', ...)` | ✅ |
| 缺省取最近一次队列运行 | task §2 | `src/cli.ts:678` `targetRun = queueRuns[queueRuns.length - 1]` | ✅ |
| 退出码 0 有数据 | task §2 | `src/cli.ts:690,724` `return REPORT_EXIT.HAS_DATA` (值 0) | ✅ |
| 退出码 2 无数据 | task §2 | `src/cli.ts:674,681` `return REPORT_EXIT.NO_QUEUE_DATA` (值 2) | ✅ |
| cli.ts 只做接线 | task §2 | `src/cli.ts:661-724` 函数只做 I/O 加载 + 调用 `projectReport`/`formatReport` | ✅ |
| 不写任何文件 | task §2 | diff 中 cli.ts 新代码无 `writeFileSync`/`appendFileSync` 调用 | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 至少两组 Sandbox 数据 | task §3 | `test/report.test.ts` 三处 `Sandbox.create()`：两个批次连续 PASS (`:195`), FIX+PASS (`:265`), edge cases (`:332`) | ✅ |
| 一组两个批次连续 PASS | task §3 | `test/report.test.ts:192-258` describe "two batches consecutive PASS" | ✅ |
| 一组先 FIX 后 PASS | task §3 | `test/report.test.ts:263-326` describe "FIX then PASS in same queue" | ✅ |
| fake runner result 能脚本化花费与轮数 | task §3 | `test/report.test.ts:77` `result: { exitCode: 0, costUsd: 5.0, numTurns: 10, durationMs: 60_000 }` | ✅ |
| 七个标题都在且顺序对 | task §3 | `npx vitest run test/report.test.ts` → `Tests 15 passed`; 含 `test/report.test.ts:218` "all seven section headings present and in order" 和 `:281` "七个标题都在且顺序对" | ✅ |
| 实际经过表行数 | task §3 | `test/report.test.ts:230` `expect(tableLines).toHaveLength(2)` (两批次), `:297` `expect(tableLines).toHaveLength(2)` (FIX+PASS) | ✅ |
| attempt/结论/合计花费对 | task §3 | `test/report.test.ts:236` 检查 attempt 1 + PASS, `:252-255` 检查 $5/$1/$6, `:297-307` 检查 FIX/PASS + 费用 | ✅ |
| 打扰数字对 | task §3 | `test/report.test.ts:246` `expect(reportOutput).toContain('打扰：0')`, `:310` 同 | ✅ |
| 旧 journal 第 2 节写 `—` | task §3 | `test/report.test.ts:365-385` 用 `projectReport` + `formatReport` 验证无 preflight 事件时 `§2 → '—'` | ✅ |
| 两个退出码 | task §3 | `test/report.test.ts:339` "exit code 2 when no queue runs exist", `:344` "exit code 2 when specified queue run does not exist" | ✅ |
| `--json` 是合法 JSON | task §3 | `test/report.test.ts:353-363` `JSON.parse(raw)` 成功并检查字段 | ✅ |
| invariants 加 projectReport | task §3 | `test/invariants.test.ts:417` `it('src/view.ts contains projectReport (v045-b02)')` | ✅ |

### 行为要求实跑

| 行为要求 | 测试文件 | 实跑结果 |
|---|---|---|
| 七节输出顺序对 | test/report.test.ts | `npx vitest run test/report.test.ts` → `Tests 15 passed` |
| 表行数与 attempt/结论/花费对 | test/report.test.ts | 同上 15 passed |
| 打扰数字对 | test/report.test.ts | 同上 15 passed |
| 旧 journal §2 写 — | test/report.test.ts | 同上 15 passed |
| 两个退出码 | test/report.test.ts | 同上 15 passed |
| --json 合法 | test/report.test.ts | 同上 15 passed |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | task 额外禁止 | `git diff --stat 6cc1bd50..5146e815 -- SPEC.md CONSTRAINTS.md ...` 输出为空 | ✅ |
| 为了让测试过而删除或跳过任何测试 | task 额外禁止 | view.ts 无删除行; 全套 1018 tests passed | ✅ |
| 为了让验收命令通过而改注释或字面 | task 额外禁止 | 无此行为 | ✅ |
| 改动 run.ts/gate.ts/arbiter.ts | task 额外禁止 | `git diff --stat 6cc1bd50..5146e815 -- src/run.ts src/gate.ts src/arbiter.ts` 输出为空 | ✅ |
| 改动 status/timeline/why/watch/show 的输出 | task 额外禁止 | view.ts diff 仅在 `formatWhy` 之后追加新代码，无修改; cli.ts diff 无删除行 | ✅ |
| 读取 stream.ndjson 或 report.md | task 额外禁止 | grep 新代码无匹配 | ✅ |
| 让 report 写任何文件 | task 额外禁止 | 新代码中无 writeFileSync/appendFileSync | ✅ |
| 新增依赖 | task 额外禁止 | package.json 零变更 | ✅ |

## 不变量数值变化

无。invariants.test.ts 仅追加一个新的 `it` 块（`src/view.ts contains projectReport`），无现有数值上下限改动。

## 声称与实测的差异

无。

## 结论与理由

全部 10 条验收命令实跑通过（exit 0）。三个提交均存在且已推送到 origin/main。无受保护文件被修改，无新增依赖。diff 范围严格落在 task.md 的三个条目之内（view.ts 追加 projectReport/formatReport、cli.ts 追加 report 命令接线、test/report.test.ts 新建 15 个测试、invariants.test.ts 追加 1 个断言），无范围蔓延。条目要求和额外禁止逐条核对均满足。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b02",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "ca1416df015d26c38583a114dcd83f43abe93ed9",
      "1b2eb9b093b614f97eddf90228ccf95124e7420a",
      "5146e815d7cd34881dcc968f2c73edc3f6b673af"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "53 files, 1018 tests passed" },
      { "cmd": "npm test -- test/report.test.ts", "exit_code": 0, "summary": "1 file, 15 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/report.test.ts | grep -qE \"^([6-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "15 test cases found" },
      { "cmd": "grep -qE \"Sandbox\\.create\" test/report.test.ts", "exit_code": 0, "summary": "3 matches" },
      { "cmd": "npx tsx src/cli.ts report; test $? -eq 2", "exit_code": 0, "summary": "exit 2 confirmed" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/view.ts | grep -qE \"projectReport\" && grep -qE \"projectReport\" test/report.test.ts", "exit_code": 0, "summary": "projectReport in code and tests" },
      { "cmd": "! grep -vE \"^\\s*(//|\\*|/\\*)\" src/view.ts | grep -qE \"writeFileSync|appendFileSync\"", "exit_code": 0, "summary": "no file writes in view.ts" },
      { "cmd": "grep -qE \"projectReport\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
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
  "reason": "All 10 acceptance commands pass (exit 0). 15 report-specific tests pass. Three commits pushed to origin/main. No protected files modified, no new dependencies. Implementation adds projectReport/formatReport in view.ts, report CLI command in cli.ts, comprehensive tests in test/report.test.ts, and invariant in test/invariants.test.ts. All task item requirements and prohibitions verified. CI 以 R2 取证为准。"
}
```
