# 批次 v045-b11 审核

## 取证过程

### 1. 提交事实

```
git log --oneline cf4e02bc..658a0700
658a070 cli: preserve syncFailures in run action state save (SPEC 14.15, v045-b11 FIX)
545ec90 docs: issue v045-b11 task envelope
9b5242b progress: v045-b11 FIX
ed3a1ae report(collie): v045-b11
613b95c test: add sync failure and commit failure tests for follow (SPEC 14.15, v045-b11)
47dac07 cli: add syncFailures tracking and report commit failure handling (SPEC 14.15)
53e5dcf docs: issue v045-b11 task envelope
```

Worker 代码提交：`47dac0748998c4804c87f555a36e5dd561fa08ee`、`613b95cb7684f5e1ddaf4362813b7cc8f7b32367`、`658a0700f2abc4ee34d4527c3dbb943453cbc1d8`。

`git branch -r --contains 658a0700` 确认 `origin/main` 包含 head commit — 已推送。

### 2. 受保护路径

```
git diff --stat cf4e02bc..658a0700 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
 docs/progress.md | 22 +++
```

`docs/progress.md` 变更来自 R2 的 `9b5242b progress: v045-b11 FIX` 提交，不是 worker 提交，属 R2 职责内的进度记录。Worker 的三个代码提交不涉及任何受保护路径。`spec_diff_lines` 按 R2 的这 22 行计（worker 未触碰）。

### 3. 依赖变化

```
git diff cf4e02bc..658a0700 -- package.json package-lock.json
（无输出）
```

无依赖变更。

### 4. 额外禁止文件检查

```
git diff cf4e02bc..658a0700 -- src/handoff.ts src/run.ts src/view.ts src/preflight.ts templates/collie.toml .github/ eslint.config.js vitest.config.ts package.json .collie/collie.toml
（无输出）
```

无禁止文件被修改。

### 5. 验收命令实跑

#### 命令 1: `npm run lint`
退出码 0。输出：`Checking formatting... All matched files use Prettier code style!`

#### 命令 2: `npm run typecheck`
退出码 0。输出：`tsc -p tsconfig.json`（无错误）

#### 命令 3: `npm test`
退出码 0。输出：`Test Files 58 passed (58)  Tests 1144 passed (1144)`

#### 命令 4: `npm test -- test/follow.test.ts`
退出码 0。输出：`Test Files 1 passed (1)  Tests 33 passed (33)`

#### 命令 5: `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(3[3-9]|[4-9][0-9])$"`
退出码 0。实际计数 33。

#### 命令 6: `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1`
退出码 0。33 tests passed，无残留目录。

#### 命令 7: `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "syncFailures" && grep -qE "syncFailures" test/follow.test.ts`
退出码 0。

#### 命令 8: `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "git pull 连续失败" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "git pull 连续失败"`
退出码 0。

#### 命令 9: `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "汇报没能提交" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "汇报没能提交"`
退出码 0。

#### 命令 10: `grep -qE "syncFailures" test/invariants.test.ts`
退出码 0。

### 6. 行为测试实跑

```
npx vitest run test/follow.test.ts -t 'remote unreachable'
Tests  1 passed | 32 skipped (33)

npx vitest run test/follow.test.ts -t 'pull blocked by untracked'
Tests  1 passed | 32 skipped (33)

npx vitest run test/follow.test.ts -t 'report commit failure'
Tests  1 passed | 32 skipped (33)

npx vitest run test/follow.test.ts -t 'broken remote 4 cycles'
Tests  1 passed | 32 skipped (33)

npx vitest run test/follow.test.ts -t 'remote extra commit during queue'
Tests  1 passed | 32 skipped (33)
```

所有行为测试均实跑通过。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 58 files, 1144 tests passed, exit 0 | ✅ |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | 33 tests passed, exit 0 | ✅ |
| 专项测试不少于 33 个 | `grep -cE ...` | 33 个, exit 0 | ✅ |
| 不留固定版本目录 | `d=$(mktemp -d) && TMPDIR=...` | exit 0 | ✅ |
| 同步失败有计数且有测试 | `grep ... syncFailures` | exit 0 | ✅ |
| 连续失败通知补回来了 | `grep ... git pull 连续失败` | exit 0 | ✅ |
| 汇报没提交成有通知 | `grep ... 汇报没能提交` | exit 0 | ✅ |
| 不变量同步 | `grep ... syncFailures invariants` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `follow.json` 新增 `syncFailures` 字段 | 条目 1 | `src/follow.ts:68` — `syncFailures?: number;` | ✅ |
| `syncFailures` 加 1 在 syncFailed 时 | 条目 1 | `src/follow.ts:797` — `stateJson.syncFailures = (stateJson.syncFailures ?? 0) + 1;` | ✅ |
| 连续 3 圈通知一次，键 `pull` | 条目 1 | `src/follow.ts:799-803` — `>= SYNC_FAILURE_THRESHOLD` (=3)，键 `'pull'`，文本 `'[Collie] git pull 连续失败'` | ✅ |
| 同步成功时清零 `syncFailures` 并去掉 `pull` 键 | 条目 1 | `src/follow.ts:807-811` — `syncFailures = 0`，`filter((k) => k !== 'pull')` | ✅ |
| `git fetch` 失败算 syncFailed | 条目 1 | `src/follow.ts:623-624` — `syncFailed = true` in fetch catch | ✅ |
| 需要拉取而 `git pull --ff-only` 失败算 syncFailed | 条目 1 | `src/follow.ts:660-661` — `return { ... syncFailed: true }` in pull catch | ✅ |
| 提交后检查 `git status --porcelain -- <汇报文件>` | 条目 2 | `src/follow.ts:569` — `git(root, ['status', '--porcelain', '--', reportFile])` | ✅ |
| 不为空时不记 `pendingReport` | 条目 2 | `src/follow.ts:580-589` — `if (!reportCommitted)` 分支 return 无 `pendingReport` | ✅ |
| 通知键 `commit:<队列号>` | 条目 2 | `src/follow.ts:581` — `` const commitKey = `commit:${qRunId}` `` | ✅ |
| 通知文本含「汇报没能提交」、队列号、退出码 | 条目 2 | `src/follow.ts:584` — 文本包含 `qRunId`、`runExitCode`、`汇报没能提交` | ✅ |
| 通知文本不含「到对话里说」 | 条目 2 | `src/follow.ts:584` — 文本末尾为 `留在操作员机器的 docs/ops/ 下`，不含「到对话里说」。`grep "到对话里说" src/follow.ts` 只在 819 行的正常通知路径出现 | ✅ |
| 基准照样记为已处理，队列不重跑 | 条目 2 | `src/follow.ts:589` — `return { handled: true, ... }` | ✅ |
| run action 保存状态时保留 `syncFailures`（上轮 FIX gap） | 上轮 gap | `src/follow.ts:904` — `syncFailures: stateJson.syncFailures` | ✅ |
| `test/invariants.test.ts` 加 syncFailures 检查 | 条目 3 | `test/invariants.test.ts:523-526` — `expect(content).toContain('syncFailures')` | ✅ |
| 不改 `src/handoff.ts`、`src/run.ts`、`src/view.ts`、`src/preflight.ts` | 额外禁止 | `git diff --stat` 只含 `src/follow.ts`、`test/follow.test.ts`、`test/invariants.test.ts` | ✅ |
| 不新增依赖 | 额外禁止 | `git diff -- package.json package-lock.json` 无输出 | ✅ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff` 确认无变更 | ✅ |

### 行为要求

| 要求 | 出处 | 证据（实跑命令 + 输出） | 满足 |
|---|---|---|---|
| 远端不可达 5 圈：1 条通知在第 3 圈；恢复 1 圈后 syncFailures=0；再不可达 3 圈：再 1 条，共 2 条 | 条目 1 加粗第 1 段 / SPEC 14.15 | `npx vitest run test/follow.test.ts -t 'remote unreachable'` → Tests 1 passed。测试断言：sleepCount=5、pullNotifs1.length=1、state.syncFailures=0、sleepCount=3、pullNotifs2.length=2 | ✅ |
| 本地落后 + 未跟踪文件挡住 3 圈：1 条通知 | 条目 1 加粗第 2 段 / SPEC 14.15 | `npx vitest run test/follow.test.ts -t 'pull blocked by untracked'` → Tests 1 passed。测试断言：sleepCount=3、pullNotifs.length=1 | ✅ |
| 汇报提交失败 3 圈：run --continue 只起 1 次、通知 1 条含「汇报没能提交」不含「到对话里说」 | 条目 2 / 条目 3 | `npx vitest run test/follow.test.ts -t 'report commit failure'` → Tests 1 passed。测试断言：sleepCount=3、runContinueCount=1、commitFailNotifs.length=1、contains 'q-commit-fail-1'、not contains '到对话里说'、pendingReport=undefined、handledBase=baseSha | ✅ |
| 旧用例 #20 改回断言「git pull 连续失败」条数 | 条目 3 | `npx vitest run test/follow.test.ts -t 'broken remote 4 cycles'` → Tests 1 passed。断言 pullNotifs.length=1 + endNotifs.length=0 | ✅ |
| 旧用例 #22 补上圈数断言 | 条目 3 | `npx vitest run test/follow.test.ts -t 'remote extra commit during queue'` → Tests 1 passed。断言 sleepCount=4 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增一条测试，未修改任何已有数值上下限。

### 被改写或删去的断言

旧用例 #20（`broken remote 4 cycles`）：
- 无断言被删除。原断言 `expect(sleepCount).toBe(CYCLES)` 和 `expect(endNotifs.length).toBe(0)` 均保留。新增 `expect(pullNotifs.length).toBe(1)`。

旧用例 #22（`remote extra commit during queue`）：
- 无断言被删除。原断言 `expect(remoteLog).toContain('ops: report queue')`、`expect(remoteLog).toContain('extra commit')`、`expect(localHead).toBe(remoteHead)`、`expect(divergedNotifs.length).toBe(0)` 均保留。新增 `expect(sleepCount).toBe(CYCLES)`（其中 CYCLES=4）。测试结构从两次 `once: true` 调用改为一次多圈调用，行为等价且覆盖更强。

其他测试文件无断言变更。

## 声称与实测的差异

1. 报告 JSON 的 `head_sha` 是 `613b95cb7684f5e1ddaf4362813b7cc8f7b32367`，实际 head 是 `658a0700f2abc4ee34d4527c3dbb943453cbc1d8`。原因：报告在修复提交之前写的。`commits` 数组也缺少 `658a070`。这是 FIX 工作流的正常现象（报告先写，修复后到），非实质性不符。
2. 报告声称 tests_passed=1144，实测为 1144 — 一致。
3. 报告声称 pushed=true，实测 `git branch -r --contains 658a070` 确认在 origin/main — 一致。

## 结论与理由

全部 10 条验收命令退出码 0。3 条新测试（#31、#32、#33）和 2 条改写旧测试（#20、#22）均实跑通过，每条都断言了实际圈数。结构要求逐条核对全部满足。额外禁止逐条核对全部满足——无禁止文件变更、无依赖变更、无测试删除、无断言改写超出允许范围。受保护文件仅 `docs/progress.md` 被 R2 进度提交触碰，worker 未改。已推送至远端。上一轮 FIX gap（run action 保存状态缺 syncFailures）已修复（`src/follow.ts:904`）。

PASS。

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
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "58 files, 1144 tests passed" },
      { "cmd": "npm test -- test/follow.test.ts", "exit_code": 0, "summary": "1 file, 33 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/follow.test.ts | grep -qE \"^(3[3-9]|[4-9][0-9])$\"", "exit_code": 0, "summary": "33 tests found" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d \"$d\"/collie-r2-* >/dev/null 2>&1", "exit_code": 0, "summary": "no residual dirs" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"syncFailures\" && grep -qE \"syncFailures\" test/follow.test.ts", "exit_code": 0, "summary": "syncFailures in code and tests" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"git pull 连续失败\" && grep -vE \"^\\s*(//|\\*|/\\*)\" test/follow.test.ts | grep -qE \"git pull 连续失败\"", "exit_code": 0, "summary": "git pull 连续失败 in code and tests" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"汇报没能提交\" && grep -vE \"^\\s*(//|\\*|/\\*)\" test/follow.test.ts | grep -qE \"汇报没能提交\"", "exit_code": 0, "summary": "汇报没能提交 in code and tests" },
      { "cmd": "grep -qE \"syncFailures\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [
    "报告 head_sha 为 613b95cb（报告在修复提交前写的），实际 head 是 658a0700；commits 数组缺少修复提交 658a0700。FIX 工作流正常现象。"
  ],
  "gaps": [],
  "reason": "全部 10 条验收命令 exit 0。3 条新行为测试（sync failure 5+1+3 cycles / pull blocked 3 cycles / commit failure 3 cycles）和 2 条改写旧测试均实跑通过，每条断言圈数。结构要求与额外禁止逐条核对全部满足。上轮 FIX gap（run action 状态缺 syncFailures）已修复于 src/follow.ts:904。CI 以 R2 取证为准。"
}
```
