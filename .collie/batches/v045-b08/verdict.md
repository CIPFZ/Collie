The worker's code commits are:
1. `7bf4a6d4a5c4b75181f6cf9e6b87d93775833b1d` — main implementation
2. `572836a93a1fdcfa20cce29bb5c00fd081f5e597` — tests
3. `0dfe9d4ed1240bc7307e6e7ad37e43a194aa2290` — FIX (defaultSpawn test fix)

Now I have all the evidence I need. Let me compile the final verdict.

# 批次 v045-b08 审核

## 取证过程

### 1. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | Checking formatting... All matched files use Prettier code style! |
| 2 | `npm run typecheck` | 0 | tsc -p tsconfig.json (无错误) |
| 3 | `npm test` | 0 | 57 passed (57), Tests 1119 passed (1119) |
| 4 | `npm test -- test/follow.test.ts` | 0 | 1 passed (1), Tests 30 passed (30) |
| 5 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(2[8-9]\|[3-9][0-9])$"` | 0 | 匹配 30（≥28） |
| 6 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` | 0 | 无固定版本目录残留 |
| 7 | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "rebase" && grep -qE "rebase" test/follow.test.ts` | 0 | 源码和测试都包含 rebase |
| 8 | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "pendingReport" && grep -qE "pendingReport" test/follow.test.ts` | 0 | 源码和测试都包含 pendingReport |
| 9 | `! grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "pendingPush"` | 0 | pendingPush 在源码非注释行中不存在 |
| 10 | `grep -qE "pendingPush" test/invariants.test.ts` | 0 | 不变量测试包含 pendingPush 检查 |

### 2. 提交事实

- worker 代码提交：`7bf4a6d4a5c4b75181f6cf9e6b87d93775833b1d`、`572836a93a1fdcfa20cce29bb5c00fd081f5e597`、`0dfe9d4ed1240bc7307e6e7ad37e43a194aa2290`
- `git branch -r --contains 0dfe9d4ed1240bc7307e6e7ad37e43a194aa2290` → `origin/main` — 已推送

### 3. 受保护文件

`git diff --stat 99baf56..0dfe9d4 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml` → `docs/progress.md | 22 +`。
此修改来自 R2 工作流提交 `097fbda progress: v045-b08 FIX`，是标准的 FIX 记录，非 worker 操作。

### 4. 额外禁止路径

`git diff --stat` 检查 `templates/collie.toml`、`eslint.config.js`、`vitest.config.ts`、`handoff.ts`、`run.ts`、`gate.ts`、`arbiter.ts` → 均无改动。

### 5. 依赖变化

`git diff 99baf56..0dfe9d4 -- package.json package-lock.json` → 无输出，无依赖变化。

### 6. 测试真实数字

- 全量测试：57 文件通过，1119 条通过
- follow 专项：1 文件通过，30 条通过
- invariants 专项：1 文件通过，65 条通过

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1119 passed | ✅ |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0, 30 passed | ✅ |
| 专项测试不少于 28 个 | `grep -cE ...` | 30, exit 0 | ✅ |
| 不留固定版本目录 | `d=$(mktemp -d) && ...` | exit 0 | ✅ |
| 分叉时 rebase 且有测试 | `grep ... rebase` | exit 0 | ✅ |
| pendingReport 存在且有测试 | `grep ... pendingReport` | exit 0 | ✅ |
| pendingPush 已删除 | `! grep ... pendingPush` | exit 0 | ✅ |
| 不变量同步 | `grep ... pendingPush` in invariants | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 每圈在读 next.md 之前 `git fetch` | 条目 1 | `src/follow.ts:749-752`：`if (!dryRun) { ... syncWithRemote(root, sendNotify, notifiedSet)` → 在读 `nextPath` (line 771) 之前；`src/follow.ts:586`：`await git(root, ['fetch', '--quiet', 'origin', 'main'])` | ✅ |
| fetch/pull/push 写明 origin 与 main | 条目 1 | `src/follow.ts:586`：`'fetch', '--quiet', 'origin', 'main'`；`src/follow.ts:622`：`'pull', '--ff-only', '--quiet', 'origin', 'main'`；`src/follow.ts:632`：`push(root, 'origin', 'main')`；`src/follow.ts:668`：`'pull', '--rebase', '--quiet', 'origin', 'main'`；`src/follow.ts:671`：`push(root, 'origin', 'main')` | ✅ |
| 不领先/领先/分叉三情况处理 | 条目 1 | `src/follow.ts:619`：Case 1 local behind (pull); `src/follow.ts:629`：Case 2 local ahead (push); `src/follow.ts:645`：Case 3 diverged | ✅ |
| 分叉时只有本地全是 `ops: report queue` 才 rebase | 条目 1 | `src/follow.ts:649-663`：检查 `localOnlyLog` 中每行 subject 是否 `startsWith('ops: report queue')`，`allReport` 为 true 才进入 rebase 分支 (line 665) | ✅ |
| 冲突就 `rebase --abort` | 条目 1 | `src/follow.ts:683-688`：catch 块中 `git(root, ['rebase', '--abort'])` | ✅ |
| 队列结束通知记进 pendingReport | 条目 1 | `src/follow.ts:558-560`：`const pendingReportEntry: PendingReport = { qRunId, reason, exitCode: runExitCode }` 在 `executeRun` 返回值中传出；`src/follow.ts:846`：`pendingReport: result.pendingReport ?? stateJson.pendingReport` 写入 follow.json | ✅ |
| 本地不再领先时才发通知、只发一次 | 条目 1 | `src/follow.ts:759-766`：`if (stateJson.pendingReport !== undefined && !syncResult.localAhead)` → 发通知后 `stateJson.pendingReport = undefined` 并保存 | ✅ |
| 删掉 pendingPush | 条目 1 | `grep -n pendingPush src/follow.ts` → 无匹配 | ✅ |
| 注入子进程函数多 mode 参数 | 条目 2 | `src/follow.ts:35-39`：`SpawnFn = (cmd, cwd, mode: OutputMode) => Promise<SpawnResult>` | ✅ |
| 留行逻辑写成不起子进程的函数 | 条目 2 | `src/follow.ts:248-253`：`export function keepLines(text: string, mode: OutputMode): string` — 纯函数，无子进程依赖 | ✅ |
| report/report --json/preflight --json 用完整输出 | 条目 2 | `src/follow.ts:467`：preflight → `'full'`；`src/follow.ts:511`：report → `'full'`；`src/follow.ts:532`：report --json → `'full'` | ✅ |
| npm ci 退出码非 0 时删目录 | 条目 2 | `src/follow.ts:209-215`：`if (npmResult.exitCode !== 0) { git(root, ['worktree', 'remove', '--force', pinnedDir]) ... throw }` | ✅ |
| npm ci 失败按 `pinned:<固定版本>` 通知一次并退避 | 条目 2 | `src/follow.ts:450-461`：catch 块 `key = 'pinned:${pinnedSha}'`，通知 + 计算 backoff | ✅ |
| defaultSpawn 程序不存在返回 127 不抛出 | 条目 2 | `src/follow.ts:910-921`：`child.on('error', ...)` → `err.code === 'ENOENT' ? EXIT_NOT_FOUND : 1` → `resolve(...)` 不 throw | ✅ |
| 退避状态随基准提交清零 | 条目 3 | `src/follow.ts:822-827`：`if (stateJson.retryBase !== undefined && stateJson.retryBase !== action.baseSha) { stateJson.retry = undefined; stateJson.retryBase = undefined; }` | ✅ |
| 附录写 `preflight：ok` | 条目 3 | `src/follow.ts:357`：`'preflight：ok'` | ✅ |
| invariants 加 pendingPush 不变量 | 条目 3 | `test/invariants.test.ts:487`：`it('src/follow.ts does not contain pendingPush (v045-b08)')` | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 仅有 R2 的 `docs/progress.md`，worker 未动 | ✅ |
| 不改 templates/collie.toml、eslint.config.js、vitest.config.ts | 额外禁止 | diff 无这些文件 | ✅ |
| 不改 handoff.ts、run.ts、gate.ts、arbiter.ts | 额外禁止 | diff 无这些文件 | ✅ |
| 无新增依赖 | 额外禁止 | package.json/lock 无改动 | ✅ |

### 行为要求实测

| 要求 | 出处 | 测试文件与命令 | 实测结果 | 满足 |
|---|---|---|---|---|
| 推送失败 3 圈→恢复→再走 3 圈：run --continue 只起 1 次、通知 1 条且在恢复之后 | 条目 1 加粗 | test #21 (line 1219) `npx vitest run test/follow.test.ts` | Tests 30 passed — test 21 passed，断言 `runContinueCount===1`、Phase1 无 endNotifs、Phase2 `endNotifs.length===1`、`sleepCount===3` (each phase) | ✅ |
| 队列期间远端多了提交：远端同时有两个提交、本地不领先不落后、不发 diverged 通知 | 条目 1 加粗 | test #22 (line 1325) | Tests 30 passed — test 22 passed，断言 remoteLog 含 'ops: report queue' 和 'extra commit'、`localHead===remoteHead`、`divergedNotifs.length===0` | ✅ |
| 本地有非汇报未推送提交且远端前进→不 rebase，3 圈只 1 条 diverged | 条目 3 | test #23 (line 1403) | Tests 30 passed — test 23 passed，断言 `sleepCount===CYCLES`、`divergedNotifs.length===1` | ✅ |
| rebase 冲突→放弃、仓库回到 rebase 之前、通知 1 条 | 条目 3 | test #24 (line 1456) | Tests 30 passed — test 24 passed，断言 `localHeadAfter===localHeadBefore`、`divergedNotifs.length===1` | ✅ |
| keepLines 500 行：完整 500 行都在、末尾只剩 200 | 条目 3 | test #25 (line 1529) | Tests 30 passed — test 25 passed，断言 `full.split('\n').length===500`、`tailLines.length===200` | ✅ |
| 注入子进程函数收到的模式：report/report --json/preflight --json=full，run --continue/npm ci=tail | 条目 3 | test #26 (line 1549) | Tests 30 passed — test 26 passed，逐项断言各 mode | ✅ |
| 远端有新提交而本地不领先→HEAD 等于远端、没有 pull 通知 | 条目 3 | test #27 (line 1620) | Tests 30 passed — test 27 passed，断言 `localHead===remoteHeadBefore`、`pullNotifs.length===0` | ✅ |
| npm ci 失败后目录不存在、之后成功能接着跑 | 条目 3 | test #28 (line 1664) | Tests 30 passed — test 28 passed，断言 `pinnedItems.length===0`、`npmCiCallCount===2` | ✅ |
| 不存在的程序名调 defaultSpawn 得到退出码 127 | 条目 3 | test #29 (line 1752) | Tests 30 passed — test 29 passed，调用真实 `defaultSpawn(['collie-nonexistent-program-xyz-9999'], ...)`，断言 `result.exitCode===127` | ✅ |
| 换了基准提交后不沿用上一个基准的退避 | 条目 3 | test #30 (line 1764) | Tests 30 passed — test 30 passed，断言 `preflightCount===2`（backoff 被新 base 清除） | ✅ |
| 多圈用例断言实际走了几圈 | 条目 3 | tests #1,#11,#12,#13,#17,#20,#21,#23 均有 `expect(sleepCount).toBe(...)` | Tests 30 passed | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 的 diff 仅新增了一个 `pendingPush` 检查测试（line 487-497），未修改任何已有数值上下限。

## 声称与实测的差异

无。

## 结论与理由

全部 10 条验收命令通过。条目 1-3 的全部结构要求与行为要求均已逐项核对，每一项在源码中有对应实现，在测试中有对应用例且实跑通过。受保护文件仅有 R2 工作流对 `docs/progress.md` 的标准记录更新，非 worker 修改。无新增依赖、无范围蔓延、无禁止路径被修改。上一轮 FIX 的两个缺口（Prettier 格式和 defaultSpawn 测试同义反复）均已修复。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b08",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "7bf4a6d4a5c4b75181f6cf9e6b87d93775833b1d",
      "572836a93a1fdcfa20cce29bb5c00fd081f5e597",
      "0dfe9d4ed1240bc7307e6e7ad37e43a194aa2290"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "All matched files use Prettier code style!" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc -p tsconfig.json (no errors)" },
      { "cmd": "npm test", "exit_code": 0, "summary": "57 files, 1119 tests passed" },
      { "cmd": "npm test -- test/follow.test.ts", "exit_code": 0, "summary": "30 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/follow.test.ts | grep -qE \"^(2[8-9]|[3-9][0-9])$\"", "exit_code": 0, "summary": "30 tests (>=28)" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d \"$d\"/collie-r2-* >/dev/null 2>&1", "exit_code": 0, "summary": "no pinned dirs left behind" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"rebase\" && grep -qE \"rebase\" test/follow.test.ts", "exit_code": 0, "summary": "rebase in source and tests" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"pendingReport\" && grep -qE \"pendingReport\" test/follow.test.ts", "exit_code": 0, "summary": "pendingReport in source and tests" },
      { "cmd": "! grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"pendingPush\"", "exit_code": 0, "summary": "pendingPush absent from non-comment code" },
      { "cmd": "grep -qE \"pendingPush\" test/invariants.test.ts", "exit_code": 0, "summary": "pendingPush invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 22
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "All 10 acceptance commands pass. All structural and behavioral requirements from items 1-3 verified in source and tests. Protected file change (docs/progress.md +22 lines) is from R2 operational commit 097fbda, not worker. No new dependencies, no scope creep, no forbidden paths modified. Previous FIX gaps (Prettier format, defaultSpawn tautological test) both resolved. CI conclusion unknown — CI 以 R2 取证为准。"
}
```
