I now have all evidence. Let me compile the full verdict.

# 批次 v045-b11 审核

## 取证过程

### 1. 提交事实

```
$ git log --format="%H %s" cf4e02bc..658a0700
658a0700f2abc4ee34d4527c3dbb943453cbc1d8 cli: preserve syncFailures in run action state save (SPEC 14.15, v045-b11 FIX)
545ec900f8c70a0cd6e4ad493cf5eb9feb77e57e docs: issue v045-b11 task envelope
9b5242b87839cfbceb97fbf4a4be6826bd8a67d8 progress: v045-b11 FIX
ed3a1ae77d38e73d12b00214964c71ad0f60ec1c report(collie): v045-b11
613b95cb7684f5e1ddaf4362813b7cc8f7b32367 test: add sync failure and commit failure tests for follow (SPEC 14.15, v045-b11)
47dac0748998c4804c87f555a36e5dd561fa08ee cli: add syncFailures tracking and report commit failure handling (SPEC 14.15)
53e5dcfa07e2e36d6fc7e12fe13cb54aaa1303a5 docs: issue v045-b11 task envelope
```

Worker 代码提交（3 个）：`47dac07`、`613b95c`、`658a070`。

```
$ git merge-base --is-ancestor 658a0700 ac4f4a50 && echo "YES"
YES
```
head_sha 是远端 HEAD 的祖先，已推送。

### 2. 受保护路径

```
$ git diff --stat cf4e02bc..658a070 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
 docs/progress.md | 22 +++
```

`docs/progress.md` 有 22 行增加，但改动完全来自 R2 的 commit `9b5242b`（`progress: v045-b11 FIX`），不是 worker。Worker 的三个提交只改动 `src/follow.ts`、`test/follow.test.ts`、`test/invariants.test.ts`。

### 3. 依赖变化

```
$ git diff cf4e02bc..658a070 -- package.json package-lock.json
（无输出）
```

无依赖变化。

### 4. 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | All matched files use Prettier code style! |
| 2 | `npm run typecheck` | 0 | （无错误输出） |
| 3 | `npm test` | 0 | 58 test files, 1144 passed, 0 failed |
| 4 | `npm test -- test/follow.test.ts` | 0 | 1 test file, 33 passed, 0 failed |
| 5 | `grep -cE ...` | 0 | 计数 33，匹配 ≥33 |
| 6 | `d=$(mktemp -d) && TMPDIR=$d ...` | 0 | 33 passed, 无残留目录 |
| 7 | `grep ... syncFailures` | 0 | 匹配成功 |
| 8 | `grep ... git pull 连续失败` | 0 | 匹配成功 |
| 9 | `grep ... 汇报没能提交` | 0 | 匹配成功 |
| 10 | `grep -qE syncFailures test/invariants.test.ts` | 0 | 匹配成功 |

全部 10 条通过。

### 5. 行为测试单独实跑

| 测试 | 命令 | 结果 |
|---|---|---|
| Test 31: 远端不可达 5+1+3 | `npx vitest run test/follow.test.ts -t "remote unreachable"` | Tests 1 passed |
| Test 32: pull blocked by untracked file | `npx vitest run test/follow.test.ts -t "pull blocked by untracked file"` | Tests 1 passed |
| Test 33: report commit failure | `npx vitest run test/follow.test.ts -t "report commit failure"` | Tests 1 passed |
| Test 20（改写）: broken remote 4 cycles | `npx vitest run test/follow.test.ts -t "broken remote 4 cycles"` | Tests 1 passed |
| Test 22（改写）: remote extra commit | `npx vitest run test/follow.test.ts -t "remote extra commit during queue"` | Tests 1 passed |

### 6. CI

无 GitHub 凭据，无法查到 CI 结果。`ci_conclusion` 填 `unknown`，`ci_branch_matched` 填 `null`。CI 以 R2 取证为准。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1144 passed | ✅ |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0, 33 passed | ✅ |
| 专项测试不少于 33 个 | `grep -cE ...` | exit 0, 计数 33 | ✅ |
| 不留固定版本目录 | `d=$(mktemp -d) && ...` | exit 0 | ✅ |
| 同步失败有计数且有测试 | `grep ... syncFailures` | exit 0 | ✅ |
| 连续失败通知补回且有测试 | `grep ... git pull 连续失败` | exit 0 | ✅ |
| 汇报没提交成有通知且有测试 | `grep ... 汇报没能提交` | exit 0 | ✅ |
| 不变量同步 | `grep -qE syncFailures test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `follow.json` 有 `syncFailures` 字段 | 条目 1 | `src/follow.ts:67`: `syncFailures?: number;` | ✅ |
| 通知键为 `pull` | 条目 1 | `src/follow.ts:803`: `stateJson.notified = [...stateJson.notified, 'pull'];` | ✅ |
| 通知文本 `[Collie] git pull 连续失败` | 条目 1 | `src/follow.ts:802`: `await sendNotify('[Collie] git pull 连续失败');` | ✅ |
| 成功时 `syncFailures` 清零并去掉 `pull` 键 | 条目 1 | `src/follow.ts:809-810`: `stateJson.syncFailures = 0; stateJson.notified = stateJson.notified.filter((k) => k !== 'pull');` | ✅ |
| 阈值为连续 3 圈 | 条目 1/SPEC 14.15 | `src/follow.ts:120`: `const SYNC_FAILURE_THRESHOLD = 3;`; `src/follow.ts:799`: `stateJson.syncFailures >= SYNC_FAILURE_THRESHOLD` | ✅ |
| `fetch` 失败算同步失败 | 条目 1/SPEC 14.15 | `src/follow.ts:623-624`: catch block sets `syncFailed = true` | ✅ |
| 需要拉取而 `pull --ff-only` 失败算同步失败 | 条目 1/SPEC 14.15 | `src/follow.ts:659-661`: catch block returns `syncFailed: true` | ✅ |
| 提交后 `git status --porcelain` 检查 | 条目 2 | `src/follow.ts:569`: `await git(root, ['status', '--porcelain', '--', reportFile])` | ✅ |
| 不为空则不记 `pendingReport` | 条目 2 | `src/follow.ts:580-589`: if `!reportCommitted` → return without `pendingReport` | ✅ |
| 通知键为 `commit:<队列号>` | 条目 2 | `src/follow.ts:581`: `const commitKey = \`commit:\${qRunId}\`;` | ✅ |
| 通知文本含「汇报没能提交」、队列号、退出码 | 条目 2 | `src/follow.ts:583-585`: `\`[Collie] 队列 \${qRunId} 结束：\${reason}，退出码 \${String(runExitCode)}；汇报没能提交…\`` | ✅ |
| 通知不含「到对话里说」 | 条目 2 | `src/follow.ts:584`: 文本里无「到对话里说」 | ✅ |
| 基准照样记为已处理 | 条目 2 | `src/follow.ts:589`: `return { handled: true, ... }` | ✅ |
| run action 保存状态时保留 `syncFailures` | FIX gap | `src/follow.ts:904`: `syncFailures: stateJson.syncFailures,` | ✅ |
| `test/invariants.test.ts` 加 `syncFailures` | 条目 3 | `test/invariants.test.ts:523-526`: 新用例 `expect(content).toContain('syncFailures')` | ✅ |
| 不改受保护路径 | 额外禁止 | worker 的 3 个提交只改 `src/follow.ts`、`test/follow.test.ts`、`test/invariants.test.ts` | ✅ |
| 不改 `src/handoff.ts`、`src/run.ts`、`src/view.ts`、`src/preflight.ts` | 额外禁止 | 同上 | ✅ |
| 不改 `package.json`、`.github/`、`eslint.config.js`、`vitest.config.ts` | 额外禁止 | 同上 | ✅ |
| 无新增依赖 | 额外禁止 | `git diff ... -- package.json package-lock.json` 无输出 | ✅ |

### 行为要求

| 要求 | 出处 | 测试证据 | 满足 |
|---|---|---|---|
| 远端不可达 5 圈：通知 1 条出现在第 3 圈；恢复 1 圈后 syncFailures=0；再不可达 3 圈：再通知 1 条共 2 条 | 条目 1 加粗 | `npx vitest run test/follow.test.ts -t "remote unreachable"` → Tests 1 passed | ✅ |
| 本地落后快进被未跟踪同名文件挡住 3 圈：通知 1 条 | 条目 1 加粗 | `npx vitest run test/follow.test.ts -t "pull blocked by untracked file"` → Tests 1 passed | ✅ |
| pre-commit 钩子让提交失败，走 3 圈：run --continue 只起 1 次，通知 1 条含「汇报没能提交」不含「到对话里说」 | 条目 2/3 | `npx vitest run test/follow.test.ts -t "report commit failure"` → Tests 1 passed | ✅ |
| 每条多圈用例断言实际走了几圈 | 条目 3 | test 31: `expect(sleepCount).toBe(5)`, `expect(sleepCount).toBe(3)` (l.1902,1949); test 32: `expect(sleepCount).toBe(3)` (l.2001); test 33: `expect(sleepCount).toBe(3)` (l.2074) | ✅ |

**行为验证详情 — 多圈断言：**

- Test 31（5+1+3 圈）：Phase 1 `expect(sleepCount).toBe(PHASE1_CYCLES)` where `PHASE1_CYCLES=5`（1902 行），Phase 3 `expect(sleepCount).toBe(PHASE3_CYCLES)` where `PHASE3_CYCLES=3`（1949 行）。测试还断言了 Phase 2 后 `state.syncFailures === 0`（1927 行）和总通知数 2（1951 行）。
- Test 32（3 圈）：`expect(sleepCount).toBe(CYCLES)` where `CYCLES=3`（2001 行），通知数 1（2003-2004 行）。
- Test 33（3 圈）：`expect(sleepCount).toBe(CYCLES)` where `CYCLES=3`（2074 行），`expect(runContinueCount).toBe(1)`（2076 行），通知数 1（2079-2080 行），通知含 qRunId（2082 行），通知不含「到对话里说」（2084 行），`pendingReport` 为 undefined（2093 行），`handledBase` 已设置（2095 行）。

### 不变量数值变化

无。`test/invariants.test.ts` 只新增了一条检查（`syncFailures`），未改动任何已有数值上下限。

### 被改写或删去的断言

无删去的 `expect()` 行（`git diff ... -- test/follow.test.ts | grep "^-.*expect("` 输出为空）。

改写的用例（均在条目 3 允许范围内，且 worker 在「偏离或疑问」中列出）：

1. **Test 20**（`// 20. SPEC 14.9 item 2`）：名称从 `broken remote 4 cycles → no crash, no queue-end notification` 改为 `broken remote 4 cycles → 1 "git pull 连续失败" notification at cycle 3, no queue-end`。原断言 `endNotifs.length === 0` 保留；新增 `pullNotifs.length === 1` 和 `sleepCount === CYCLES`。测试结构从 `once: true` 改为 `timeoutSecs` 驱动的多圈循环。
2. **Test 22**（「队列期间远端多一个提交」）：名称末尾加 `, 4 cycles`。从两个 `follow({ once: true })` 调用改为一个 `timeoutSecs` 驱动的 4 圈循环，远端额外提交移到 `countedSleep` 回调中注入。原断言 `remoteLog contains 'ops: report queue'`、`remoteLog contains 'extra commit'`、`localHead === remoteHead`、`divergedNotifs.length === 0` 全部保留。新增 `sleepCount === CYCLES`。

## 声称与实测的差异

1. **head_sha**：report.md 声称 `head_sha` 为 `613b95cb7684f5e1ddaf4362813b7cc8f7b32367`，实际 head 是 `658a0700f2abc4ee34d4527c3dbb943453cbc1d8`（FIX 后新增了一个提交）。report.md 写在 attempt 1，FIX 提交在 attempt 2，report 未更新。
2. **commits 数量**：report.md 声称 2 个提交（`47dac07`、`613b95c`），实际 worker 有 3 个提交（加上 FIX 的 `658a070`）。同理由。

## 结论与理由

**PASS。**

全部 10 条验收命令通过。三条新增行为测试、两条改写测试均实跑通过。代码实现完全匹配 SPEC 14.15 的两个条目：

1. 同步失败计数（`syncFailures`）在 `follow.json` 中持久化，`git fetch` 失败和 `git pull --ff-only` 失败都正确标记 `syncFailed = true`；主循环中递增计数、达阈值通知（键 `pull`）、成功时清零并移除通知键；FIX 修复了 run action 状态保存丢失 `syncFailures` 的问题。
2. 汇报提交失败通过 `git status --porcelain` 检测，不记 `pendingReport`，通知文本符合 SPEC 格式（含「汇报没能提交」、队列号、退出码，不含「到对话里说」），基准仍标记为已处理。

Worker 未改动任何受保护文件或禁止文件，无新增依赖，无删除的断言。`docs/progress.md` 的 22 行变动来自 R2 的 `progress: v045-b11 FIX` 提交（`9b5242b`），非 worker 行为。

声称差异仅因 report.md 在 attempt 1 写成而 FIX 提交在 attempt 2，属正常工作流。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b11",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "47dac0748998c4804c87f555a36e5dd561fa08ee",
      "613b95cb7684f5e1ddaf4362813b7cc8f7b32367",
      "658a0700f2abc4ee34d4527c3dbb943453cbc1d8"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "All matched files use Prettier code style!" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc -p tsconfig.json, no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "58 test files, 1144 passed, 0 failed" },
      { "cmd": "npm test -- test/follow.test.ts", "exit_code": 0, "summary": "1 test file, 33 passed, 0 failed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/follow.test.ts | grep -qE \"^(3[3-9]|[4-9][0-9])$\"", "exit_code": 0, "summary": "count=33, matches >=33" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d \"$d\"/collie-r2-* >/dev/null 2>&1", "exit_code": 0, "summary": "33 passed, no leftover dirs" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"syncFailures\" && grep -qE \"syncFailures\" test/follow.test.ts", "exit_code": 0, "summary": "both matched" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"git pull 连续失败\" && grep -vE \"^\\s*(//|\\*|/\\*)\" test/follow.test.ts | grep -qE \"git pull 连续失败\"", "exit_code": 0, "summary": "both matched" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"汇报没能提交\" && grep -vE \"^\\s*(//|\\*|/\\*)\" test/follow.test.ts | grep -qE \"汇报没能提交\"", "exit_code": 0, "summary": "both matched" },
      { "cmd": "grep -qE \"syncFailures\" test/invariants.test.ts", "exit_code": 0, "summary": "matched" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 22
  },
  "claim_mismatches": [
    "report.md 声称 head_sha 为 613b95cb7684f5e1ddaf4362813b7cc8f7b32367，实际 head 为 658a0700f2abc4ee34d4527c3dbb943453cbc1d8（FIX 提交在 report 之后）",
    "report.md 声称 commits 为 2 个，实际 worker 有 3 个提交（FIX 的 658a070 未列入）"
  ],
  "gaps": [],
  "reason": "全部 10 条验收命令通过；3 条新增行为测试和 2 条改写测试均实跑通过；实现匹配 SPEC 14.15；无受保护文件被 worker 改动（spec_diff_lines 22 行来自 R2 的 progress 提交 9b5242b，非 worker）；无新增依赖；无删除的断言。声称差异仅因 report 在 attempt 1 写成而 FIX 在 attempt 2。CI 以 R2 取证为准。"
}
```
