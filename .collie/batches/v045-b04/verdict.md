I now have all the evidence needed to write the verdict. Let me compile the final assessment.

# 批次 v045-b04 审核

## 取证过程

### 1. 提交验证

```
git log --oneline 480a537bff..b46efc808a
b46efc8 cli: add collie follow command, tests, and invariant (SPEC 14.4)
c670074 docs: issue v045-b04 task envelope
```

两个提交，均在 diff 范围内。完整 SHA：
- `b46efc808a63c46ade62d0b80826e846cf17772c`
- `c67007492b4c6576053b52791e7fcd49b567eb20`

已验证 head SHA 是远端 main (`4cbf86cf`) 的祖先，即已推送。

### 2. 受保护文件

```
git diff --stat 480a537bff..b46efc808a -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空——无受保护文件被改动。spec_diff_lines = 0。

### 3. 依赖变化

```
git diff 480a537bff..b46efc808a -- package.json package-lock.json
```
输出为空——无依赖变化。

### 4. 文件范围

```
.collie/batches/v045-b04/task.md   ← 任务信封
.gitignore                          ← follow.json 条目
src/cli.ts                          ← follow 命令接线
src/follow.ts                       ← 新建主模块
test/follow.test.ts                 ← 新建测试
test/invariants.test.ts             ← 不变量补充
```

均在条目 1-3 所要求的范围内。未触及 `run.ts`、`gate.ts`、`arbiter.ts`（额外禁止项）。

## 逐条验收

| # | 说明 | 命令 | 实测退出码 | 通过 |
|---|---|---|---|---|
| 1 | 代码规范零错误 | `npm run lint` | 0 | ✅ |
| 2 | 类型检查零错误 | `npm run typecheck` | 0 | ✅ |
| 3 | 全部测试通过 | `npm test` | 0 (56 files, 1059 tests) | ✅ |
| 4 | follow 专项测试通过 | `npm test -- test/follow.test.ts` | 0 (10 tests passed) | ✅ |
| 5 | 专项测试不少于 9 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(9\|[1-9][0-9])$"` | 0 (计数=10) | ✅ |
| 6 | 专项测试用 Sandbox | `grep -qE "Sandbox\.create" test/follow.test.ts` | 0 | ✅ |
| 7 | 专项测试不用真实定时器 | `test -f test/follow.test.ts && ! grep -qE "setInterval\|setTimeout\(" test/follow.test.ts` | 0 | ✅ |
| 8 | 命令已接线且有 dry-run | `npx tsx src/cli.ts follow --help 2>&1 \| grep -qE "dry-run"` | 0 | ✅ |
| 9 | 汇报用 ops 前缀提交 | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "ops: report queue"` | 0 | ✅ |
| 10 | 状态文件不进仓库 | `grep -qE "follow\.json" .gitignore` | 0 | ✅ |
| 11 | 不变量同步 | `grep -qE "follow\.ts" test/invariants.test.ts` | 0 | ✅ |

全部 11 条验收命令通过。

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新建 `src/follow.ts` | 条目 1 | `src/follow.ts:1` — 新建文件，527 行 | ✅ |
| 使用 `handoff.ts`（parseNext, decide） | 条目 1 | `src/follow.ts:16` — `import { parseNext, decide, type FollowState, type DecideAction } from './handoff.js';` | ✅ |
| `--once` 选项 | 条目 1 | `src/follow.ts:48` — `once?: boolean;`, `src/cli.ts:1004` — `.option('--once', ...)` | ✅ |
| `--dry-run` 选项 | 条目 1 | `src/follow.ts:49` — `dryRun?: boolean;`, `src/cli.ts:1005` — `.option('--dry-run', ...)` | ✅ |
| `--interval` 选项 | 条目 1 | `src/follow.ts:50` — `intervalSecs?: number;`, `src/cli.ts:1006` — `.option('--interval <secs>', ...)` | ✅ |
| `--timeout` 选项 | 条目 1 | `src/follow.ts:51` — `timeoutSecs?: number;`, `src/cli.ts:1007` — `.option('--timeout <secs>', ...)` | ✅ |
| 每圈 pull | 条目 1 | `src/follow.ts:398` — `await git(root, ['pull', '--ff-only', '--quiet']);` | ✅ |
| 读 `docs/ops/next.md` | 条目 1 | `src/follow.ts:408` — `nextContent = readFileSync(nextPath, 'utf8');` (nextPath = `docs/ops/next.md`) | ✅ |
| 状态落在 `.collie/follow.json` | 条目 1 | `src/follow.ts:80` — `const FOLLOW_STATE_PATH = '.collie/follow.json';`, `src/follow.ts:97-103` — saveFollowState | ✅ |
| 时钟注入，缺省才用真实 | 条目 1 | `src/follow.ts:52-53` — `now?: () => number;`, `src/follow.ts:355` — `opts.now ?? (() => Date.now())` | ✅ |
| 睡眠注入，缺省才用真实 | 条目 1 | `src/follow.ts:55` — `sleep?: (ms: number) => Promise<void>;`, `src/follow.ts:356` — `opts.sleep ?? defaultSleep` | ✅ |
| 子进程注入 `(参数, cwd) → 退出码与输出` | 条目 1 | `src/follow.ts:32` — `type SpawnFn = (args: readonly string[], cwd: string) => Promise<SpawnResult>;`, `src/follow.ts:357` — `opts.spawn ?? defaultSpawn` | ✅ |
| 通知注入 | 条目 1 | `src/follow.ts:59` — `sendNotify?: NotifySender;`, `src/follow.ts:360-370` — 缺省用 realNotify | ✅ |
| `--dry-run` 不 pull、不起子进程、不写文件、不发通知 | 条目 1 | `src/follow.ts:396` — `if (!dryRun)` 跳过 pull；`src/follow.ts:421-425` — dry-run 只打印 action 后返回，不进入 switch 执行 | ✅ |
| 固定版本目录按 sha 建，不在原地切换 | 条目 2 | `src/follow.ts:135-136` — `const dirName = \`collie-r2-\${name}-\${shaPrefix}\``; `src/follow.ts:141` — `git worktree add --detach` 到独立目录 | ✅ |
| preflight --smoke 没过不记为已处理 | 条目 2 | `src/follow.ts:263` — `return { handled: false, newNotified };` | ✅ |
| 汇报只提交 `docs/ops/queue-<q_run_id>.md` | 条目 2 | `src/follow.ts:299-303` — `git add -- <reportFile>`; `git commit -m <commitMsg> -- <reportFile>`，只操作 queue 文件 | ✅ |
| 提交信息 `ops: report queue <q_run_id>` | 条目 2 | `src/follow.ts:300` — `const commitMsg = \`ops: report queue \${qRunId}\`;` | ✅ |
| report 失败时写最小汇报 | 条目 2 | `src/follow.ts:294-296` — `if (!reportGenerated) { writeMinimalReport(...) }` | ✅ |
| 推送失败下一圈先重试 | 条目 2 | `src/follow.ts:387-393` — 加载 pendingPush 后 `retryPendingPush` | ✅ |
| CLI 接线进 `cli.ts` | 条目 2 | `src/cli.ts:1001-1020` — `program.command('follow')...` | ✅ |
| `.collie/follow.json` 加进 `.gitignore` | 条目 2 | `.gitignore` diff 添加了 `.collie/follow.json` | ✅ |
| `.collie/follow.json` 加进 `collie init` 忽略清单 | 条目 2 | `src/cli.ts:88` — `GITIGNORE_ENTRIES` 包含 `'.collie/follow.json'` | ✅ |
| 测试用 Sandbox | 条目 3 | `test/follow.test.ts:10` — `import { Sandbox }` ; `test/follow.test.ts:106` — `box = await Sandbox.create();` | ✅ |
| 子进程用注入的假函数 | 条目 3 | `test/follow.test.ts:54-68` — `createFakeSpawn`; `test/follow.test.ts:71-86` — `createArgSpawn`，所有测试都传 spawn 参数 | ✅ |
| 时钟与睡眠用注入的 | 条目 3 | `test/follow.test.ts:40-49` — `createFakeClock`，所有测试传 `clock.now` 和 `clock.sleep` | ✅ |
| 不用真实定时器 | 条目 3 | grep 确认无 `setInterval` 或 `setTimeout(` 出现 | ✅ |
| 不变量：`src/follow.ts` 存在且用了 `handoff.ts` | 条目 3 | `test/invariants.test.ts` diff — 新增 `it('src/follow.ts exists and uses handoff.ts (v045-b04)')` | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 无受保护文件 | ✅ |
| 不删除或跳过测试 | 额外禁止 | diff 只添加，无删除现有测试 | ✅ |
| 不改注释/字面凑验收 | 额外禁止 | 无此类改动 | ✅ |
| 不拉起真实 runner/npx/网络 | 额外禁止 | 全部注入假函数 | ✅ |
| 不写 queue-*.md 之外的仓库文件 | 额外禁止 | `writeFileSync` 仅用于 `.collie/follow.json`（不入仓）和 `docs/ops/queue-*.md` | ✅ |
| 不改 run.ts/gate.ts/arbiter.ts | 额外禁止 | `git diff` 确认无这些文件的改动 | ✅ |
| 无新增依赖 | 额外禁止 | package.json 无变化 | ✅ |

### 行为要求

| 要求 | 出处 | 证据（命令 + 输出） | 满足 |
|---|---|---|---|
| 开跑 → preflight、run、report、提交推送、通知、记 handledBase | 条目 3 | `npx vitest run test/follow.test.ts` — Tests 10 passed，测试 #1 "开跑 → starts preflight, run, report; commits and pushes; notifies; records handledBase" 通过 | ✅ |
| 同一基准提交第二圈不再跑 | 条目 3 | 同上，测试 #2 "same baseSha second time → does not run again" 通过 | ✅ |
| preflight 没过只通知一次、下一圈重试 | 条目 3 | 同上，测试 #3 "preflight failure → notify once, does not record handledBase, retries" 通过 | ✅ |
| 等所有者裁定只通知一次 | 条目 3 | 同上，测试 #4 "等所有者裁定 → notify once then wait on second call" 通过 | ✅ |
| 收工通知后退出 | 条目 3 | 同上，测试 #5 "收工 → notify and exit on second call" 通过 | ✅ |
| 格式错只通知一次 | 条目 3 | 同上，测试 #6 "format error in next.md → notify once then wait" 通过 | ✅ |
| 基准提交不是 HEAD 祖先不跑 | 条目 3 | 同上，测试 #7 "baseSha not ancestor of HEAD → notifies and does not run" 通过 | ✅ |
| --dry-run 无副作用 | 条目 3 | 同上，测试 #8 "--dry-run prints action but does nothing" 通过 | ✅ |
| report 失败时有最小汇报 | 条目 3 | 同上，测试 #9 "report command fails → writes minimal report with stdout/stderr tail" 通过 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 的 diff 仅新增了一个 `it(...)` 测试用例，无数值上下限改动。

## 声称与实测的差异

无。

## 结论与理由

全部 11 条验收命令实测通过。代码结构清晰，所有副作用（时钟、睡眠、子进程、通知）均通过参数注入，测试全用假实现。固定版本目录按 sha 独立建（`git worktree add --detach`），不在原地切换。汇报只提交 `docs/ops/queue-*.md`，提交信息格式正确。`--dry-run` 正确跳过所有副作用（pull、spawn、写文件、通知）。10 个测试覆盖了任务要求的所有场景，均使用 Sandbox 且无真实定时器。受保护文件未被触碰，无新增依赖，文件范围完全在条目之内。

**结论：PASS**

```json
{
  "schema_version": 1,
  "batch_id": "v045-b04",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "c67007492b4c6576053b52791e7fcd49b567eb20",
      "b46efc808a63c46ade62d0b80826e846cf17772c"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "56 files, 1059 tests passed" },
      { "cmd": "npm test -- test/follow.test.ts", "exit_code": 0, "summary": "1 file, 10 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/follow.test.ts | grep -qE \"^(9|[1-9][0-9])$\"", "exit_code": 0, "summary": "count=10 ≥ 9" },
      { "cmd": "grep -qE \"Sandbox\\.create\" test/follow.test.ts", "exit_code": 0, "summary": "Sandbox.create found" },
      { "cmd": "test -f test/follow.test.ts && ! grep -qE \"setInterval|setTimeout\\(\" test/follow.test.ts", "exit_code": 0, "summary": "no real timers in test" },
      { "cmd": "npx tsx src/cli.ts follow --help 2>&1 | grep -qE \"dry-run\"", "exit_code": 0, "summary": "--dry-run in help output" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"ops: report queue\"", "exit_code": 0, "summary": "ops: report queue in non-comment code" },
      { "cmd": "grep -qE \"follow\\.json\" .gitignore", "exit_code": 0, "summary": "follow.json in .gitignore" },
      { "cmd": "grep -qE \"follow\\.ts\" test/invariants.test.ts", "exit_code": 0, "summary": "follow.ts in invariants" }
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
  "reason": "All 11 acceptance commands pass. Code implements all SPEC 14.4 requirements: injected side-effects, per-sha pinned directories, dry-run with zero side-effects, minimal report fallback, push retry. 10 tests pass using Sandbox with fake clock/sleep/spawn/notify. No protected files modified, no new deps, scope fully within task items. CI 以 R2 取证为准。"
}
```
