# 批次 v04-b07 审核

## 取证过程

### 1. 提交事实

批次范围：`76a86227acab027934fa99be41c2bfbf4da04c57..c35425a61de0c83c549c5de56b6babeaf66ba3c1`

三个提交：
- `462d0f6b05cf165efb8b8c28fbbc64a804744e58` — `docs: issue v04-b07 task envelope`
- `23a5a01d09beb3a21736e66416b0bb83ed7144ba` — `cli: queue.batch_started field rename to batch_run_id, recorder envelope guard, fix_max push (SPEC 13.10)`
- `c35425a61de0c83c549c5de56b6babeaf66ba3c1` — `test: cover collie queue journal correctness and batch_run_id invariant (SPEC 13.10)`

已推送到 `origin/main`：`git branch -r --contains c35425a` 确认在 `origin/main`。

### 2. 受保护路径

```sh
git diff --stat 76a86227..c35425a -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空。受保护文件未被修改。`spec_diff_lines = 0`。

### 3. 依赖变化

```sh
git diff 76a86227..c35425a -- package.json package-lock.json
```
输出为空。无新增依赖。`deps_diff = []`。

### 4. 验收命令实跑

| # | 命令 | 退出码 | 实测输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | `All matched files use Prettier code style!` |
| 2 | `npm run typecheck` | 0 | 无错误输出 |
| 3 | `npm test` | 0 | 45 test files passed, 891 tests passed |
| 4 | `npm test -- test/queue-journal.test.ts` | 0 | 1 test file passed, 8 tests passed |
| 5 | `grep -cE "^\s+it\(" test/queue-journal.test.ts \| grep -qE "^([7-9]\|[1-9][0-9])$"` | 0 | 8 个测试（≥7） |
| 6 | `grep -qE "interrupted_at" test/queue-journal.test.ts` | 0 | 匹配到 |
| 7 | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "batch_run_id" && grep -qE "batch_run_id" test/queue-journal.test.ts` | 0 | 两侧都匹配 |
| 8 | `grep -rqE "降级原因" src && grep -qE "降级原因" test/queue-journal.test.ts` | 0 | 两侧都匹配 |
| 9 | `grep -qE "batch_run_id" test/invariants.test.ts` | 0 | 匹配到 |

### 5. 行为测试实跑

```sh
npx vitest run test/queue-journal.test.ts
→ Tests 8 passed (8)
```

```sh
npx vitest run test/invariants.test.ts
→ Tests 42 passed (42)
```

```sh
npx vitest run test/cli.test.ts
→ Tests 20 passed (20)
```

### 6. 变更范围

改动的文件：
- `.collie/batches/v04-b07/task.md`（新增，任务信封）
- `src/run.ts`（核心逻辑修改）
- `test/cli.test.ts`（夹具同步）
- `test/invariants.test.ts`（新增不变量测试）
- `test/queue-journal.test.ts`（新增专项测试文件）

所有修改都在 task.md 条目范围内，无范围蔓延。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 891 passed | ✅ |
| 队列 journal 专项测试通过 | `npm test -- test/queue-journal.test.ts` | exit 0, 8 passed | ✅ |
| 专项测试不少于 7 个 | `grep -cE ...` | exit 0 (8 ≥ 7) | ✅ |
| 队列 journal 不算批次运行（有测试） | `grep -qE "interrupted_at" ...` | exit 0 | ✅ |
| 字段改名进代码与测试 | `grep ... batch_run_id` | exit 0 | ✅ |
| 降级原因进 task 生成与测试 | `grep ... 降级原因` | exit 0 | ✅ |
| 不变量同步 | `grep ... batch_run_id` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：journal 归位（SPEC 13.10）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `queue.batch_started` 字段改名 `batch_run_id` | 条目 1 | `src/run.ts:2069` — `batch_run_id: runId,` | ✅ |
| 事件落在队列的 `q-` journal | 条目 1 | `src/run.ts:2068` — `queueRec.record('queue.batch_started', {` 使用 `queueRec`（q- journal recorder，初始化于 2024 行） | ✅ |
| `Recorder.record` 遇到 `ts`/`run_id`/`event` 扩展字段抛错 | 条目 1 | `src/run.ts:163` — `RESERVED_KEYS: ReadonlySet<string> = new Set(['ts', 'run_id', 'event'])`, `src/run.ts:166-169` — throw guard | ✅ |
| 测试验证 Recorder 拒绝信封键 | 条目 1 | `npx vitest run test/queue-journal.test.ts` → Tests 8 passed，其中 test "Recorder rejects extension fields..." 验证了 RESERVED_KEYS 存在且 batch_run_id 已替代 run_id | ✅ |
| `show --queue` 与现有夹具同步 | 条目 1 | `test/cli.test.ts:244` — `batch_run_id: 'r-20261019120000'` 已添加；`npx vitest run test/cli.test.ts` → Tests 20 passed | ✅ |
| `reviewer.verdict` 的 `gaps` 在 verdict 可解析时总是写，没有缺口写空数组 | 条目 1 | `src/run.ts:1573-1574` — `gaps: truncatedGaps` 不再是条件写入 | ✅ |
| 测试验证 gaps 空数组 | 条目 1 | `npx vitest run test/queue-journal.test.ts` → Tests 8 passed，其中 test "reviewer.verdict has gaps=[] when verdict is parseable and no gaps" | ✅ |
| `batchHistory`/`allBatchEvents` 只把含 `run.started` 的 journal 当成一次批次运行 | 条目 1 | `src/run.ts:634-635` — `if (runId.startsWith('q-')) continue;`，`src/run.ts:638` — `if (!events.some((e) => e.event === 'run.started'))` | ✅ |
| 测试验证 q- journal 不算批次运行 | 条目 1 | `npx vitest run test/queue-journal.test.ts` → Tests 8 passed，其中 "batch first run in queue has attempt=1 when q- journal has queue.batch_started" 和 "--continue first run has attempt=1..." | ✅ |

### 条目 2：fix_max 升级时 backlog 提交推送

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| fix_max 升级时按 SPEC 12.1 推送 | 条目 2 | `src/run.ts:2243` — `await push(root, ctx.remote, config.ci.expected_branch)` | ✅ |
| 在队列 journal 记 `verdict.pushed` | 条目 2 | `src/run.ts:2245` — `queueRec.record('verdict.pushed', {` | ✅ |
| 在队列 journal 记 `verdict.push_failed` | 条目 2 | `src/run.ts:2251` — `queueRec.record('verdict.push_failed', {` | ✅ |
| 测试验证 fix_max push | 条目 2 | `npx vitest run test/queue-journal.test.ts` → Tests 8 passed，其中 "fix_max escalation pushes to remote and records verdict.pushed" | ✅ |

### 条目 3：FIX 重跑 task 降级原因

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 「上一轮判 FIX」加小节「降级原因」 | 条目 3 | `src/run.ts:423-424` — `lines.push('### 降级原因')` | ✅ |
| 写上一轮 `verdict.downgraded` 的规则号与 `reason` | 条目 3 | `src/run.ts:426` — `` lines.push(`- 规则 ${String(info.downgrade.rule)}：${info.downgrade.reason}`) `` | ✅ |
| 有 `cause`/`detail` 时一并写 | 条目 3 | `src/run.ts:427-432` — 条件写 cause 和 detail | ✅ |
| 测试验证规则 9 降级原因 | 条目 3 | `npx vitest run test/queue-journal.test.ts` → Tests 8 passed，其中 "rule 9 FIX rerun task contains 降级原因 with rule and reason" | ✅ |
| 提交清单只列 worker 代码提交（R2 前缀排除） | 条目 3 | `src/run.ts:732` 使用 `verdict.evidence.commits_actual`，该字段在 `src/evidence.ts:190,285` 已排除 R2 提交 | ✅ |
| 测试验证清单不含 `docs: issue` 提交 | 条目 3 | `npx vitest run test/queue-journal.test.ts` → Tests 8 passed，其中 "FIX rerun task commit list excludes docs: issue commits" | ✅ |
| 新建 `test/queue-journal.test.ts` | 条目 3 | 文件存在，673 行，8 个测试 | ✅ |
| `test/invariants.test.ts` 加 `batch_run_id` 不变量 | 条目 3 | `test/invariants.test.ts:249-254` — `it('src/run.ts contains batch_run_id...')` | ✅ |
| `--continue` 下批次第一次运行 attempt 是 1、interrupted_at 为 null，FIX 重跑是 2 | 条目 3 | `npx vitest run test/queue-journal.test.ts` → Tests 8 passed，其中 "--continue first run has attempt=1 and interrupted_at=null; FIX rerun has attempt=2" | ✅ |

### 额外禁止核对

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | task.md | `git diff --stat` 输出为空 | ✅ |
| 为了让测试过而删除或跳过任何测试 | task.md | diff 中未见 `.skip`/`.only` 或测试删除 | ✅ |
| 为了让验收命令通过而改注释或字面（铁律 26） | task.md | diff 审查未发现此类问题 | ✅ |
| 改动规则 1~10、放行判定、fix_max 默认值与计数方式 | task.md | diff 中仅有 `renderFixSection`（显示）和 `batchHistory`（数据读取）的修改，无 gate/arbitrate 逻辑变更 | ✅ |
| 新增依赖 | task.md | `package.json` 无变化 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

所有 9 条验收命令全部退出码为 0。三个条目的每项结构要求与行为要求均已核对通过并附具体证据。受保护文件未被修改，无新增依赖，无范围蔓延。提交已推送到远端。额外禁止项全部遵守。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b07",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "462d0f6b05cf165efb8b8c28fbbc64a804744e58",
      "23a5a01d09beb3a21736e66416b0bb83ed7144ba",
      "c35425a61de0c83c549c5de56b6babeaf66ba3c1"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "All matched files use Prettier code style!" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "45 test files passed, 891 tests passed" },
      { "cmd": "npm test -- test/queue-journal.test.ts", "exit_code": 0, "summary": "1 test file passed, 8 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/queue-journal.test.ts | grep -qE \"^([7-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "8 tests found (>= 7)" },
      { "cmd": "grep -qE \"interrupted_at\" test/queue-journal.test.ts", "exit_code": 0, "summary": "match found" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qE \"batch_run_id\" && grep -qE \"batch_run_id\" test/queue-journal.test.ts", "exit_code": 0, "summary": "batch_run_id in code and tests" },
      { "cmd": "grep -rqE \"降级原因\" src && grep -qE \"降级原因\" test/queue-journal.test.ts", "exit_code": 0, "summary": "降级原因 in source and tests" },
      { "cmd": "grep -qE \"batch_run_id\" test/invariants.test.ts", "exit_code": 0, "summary": "match found" }
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
  "reason": "All 9 acceptance commands pass (exit 0). All 3 task items implemented correctly: batch_run_id field rename in queue.batch_started, Recorder envelope key guard, allBatchEvents q- journal exclusion, fix_max push with verdict.pushed/push_failed, 降级原因 subsection in FIX rerun task, gaps always present as empty array. 8 queue-journal tests pass, invariants test updated, cli fixture synced. No protected files modified, no new dependencies. CI 以 R2 取证为准。"
}
```
