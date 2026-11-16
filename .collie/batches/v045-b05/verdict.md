I now have all the evidence I need. Let me compose the full verdict.

# 批次 v045-b05 审核

## 取证过程

### 1. 受保护路径检查

```
$ git diff --stat 8572394..68038df -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(no output — zero changes)
```

受保护路径零修改。

### 2. 禁止修改的文件检查

```
$ git diff --stat 8572394..68038df -- src/handoff.ts src/run.ts src/gate.ts src/arbiter.ts templates/collie.toml
(no output — zero changes)
```

禁止文件零修改。

### 3. 依赖变化检查

```
$ git diff 8572394..68038df -- package.json package-lock.json
(no output — zero changes)
```

无新增依赖。

### 4. 提交存在与推送确认

```
$ git rev-parse 68038df889fa72b66aa7197aa341cd5c5ec1b9fe
68038df889fa72b66aa7197aa341cd5c5ec1b9fe

$ git branch -r --contains 68038df889fa72b66aa7197aa341cd5c5ec1b9fe
  origin/HEAD -> origin/main
  origin/main
```

提交存在且已推送到远端 origin/main。

### 5. 验收命令逐条实跑

**5.1 npm run lint** — exit 0
```
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

**5.2 npm run typecheck** — exit 0
```
> tsc -p tsconfig.json
(clean exit)
```

**5.3 npm test** — exit 0
```
 Test Files  56 passed (56)
      Tests  1076 passed (1076)
   Duration  17.60s
```

**5.4 npm test -- test/follow.test.ts** — exit 0
```
 Test Files  1 passed (1)
      Tests  20 passed (20)
   Duration  4.61s
```

**5.5 专项测试 ≥16 个** — exit 0
```
$ grep -cE "^\s+it\(" test/follow.test.ts
20

$ grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(1[6-9]|[2-9][0-9])$"
(exit 0)
```

**5.6 TMPDIR 隔离** — exit 0
```
$ d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1
PASS: no collie-r2 dirs in tmpdir
```

**5.7 退避代码与测试** — exit 0
```
$ grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "notBefore" && grep -qE "notBefore" test/follow.test.ts
(exit 0)
```

**5.8 基准提交标记与附录** — exit 0
```
$ grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "\(base " && grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "follow 记录"
(exit 0)
```

**5.9 无 execFileSync** — exit 0
```
$ ! grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "execFileSync"
(exit 0)
```

**5.10 sandbox webhook_file** — exit 0
```
$ grep -qE "webhook_file" test/support/sandbox.ts
(exit 0)
```

**5.11 不变量同步** — exit 0
```
$ grep -qE "execFileSync" test/invariants.test.ts
(exit 0)
```

### 6. 行为测试单独实跑

```
$ npx vitest run test/follow.test.ts
 Test Files  1 passed (1)
      Tests  20 passed (20)

$ npx vitest run test/invariants.test.ts
 Test Files  1 passed (1)
      Tests  62 passed (62)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 56 files, 1076 tests passed, exit 0 | ✅ |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | 1 file, 20 tests passed, exit 0 | ✅ |
| 专项测试 ≥16 个 | `grep -cE ...` | 20 个 it( | ✅ |
| 不留固定版本目录 | `TMPDIR=$d npm test ...` | 无残留 collie-r2-* | ✅ |
| 退避代码与测试 | `grep ... notBefore` | 两处均找到 | ✅ |
| 基准提交与附录 | `grep ... (base / follow 记录` | 两处均找到 | ✅ |
| 无 execFileSync | `! grep ... execFileSync` | 未找到 (exit 0) | ✅ |
| sandbox webhook_file | `grep ... webhook_file` | 找到 | ✅ |
| 不变量同步 | `grep ... execFileSync` | 找到 | ✅ |

## 条目要求与额外禁止

### 条目 1: "已处理"与推送

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 汇报提交信息加 `(base <12位>)` | task item 1 | `src/follow.ts:521` — `const commitMsg = \`ops: report queue ${qRunId} (base ${baseShaPrefix})\`` | ✅ |
| "已处理"= git log marker 或 handledBase | task item 1 | `src/follow.ts:226-237` — `isHandledInGitLog` 检查 git log; `src/follow.ts:405-407` — 若找到 marker 直接 return handled:true | ✅ |
| run --continue 后不论失败都记 handledBase | task item 1 | `src/follow.ts:551-552` — `return { handled: true, ...}` 无条件 | ✅ |
| 本地领先远端时每圈先推送 | task item 1 | `src/follow.ts:572-596` — `pushIfAhead` 在 executeRun 之前调用（`src/follow.ts:733-738`） | ✅ |
| 推送失败通知一次 | task item 1 | `src/follow.ts:534-539` — `if (!notifiedSet.has(key))` 去重 | ✅ |
| **3圈push失败 → run --continue 只起1次，仓库1份汇报** | task item 1 bold | `npx vitest run test/follow.test.ts` Tests 20 passed；test #11（line 584）真走3+圈，assert `runContinueCount === 1`（line 643）、`queueReports.length === 1`（line 650）、`pushNotifs.length === 1`（line 654） | ✅ |

### 条目 2: 失败只通知一次并退避、通知内容、子进程

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 按 14.9 通知键去重 | task item 2 | `src/follow.ts:384` — `const notifiedSet = new Set(stateJson.notified);`，各处均 `if (!notifiedSet.has(key))` | ✅ |
| 退避 5min起、翻倍、最长60min | task item 2 | `src/follow.ts:96` — `BACKOFF_INITIAL_MS = 5 * 60 * MS_PER_SEC`; `src/follow.ts:99` — `BACKOFF_MAX_MS = 60 * 60 * MS_PER_SEC`; `src/follow.ts:240-243` — `Math.pow(2, failures-1)` + `Math.min(..., BACKOFF_MAX_MS)` | ✅ |
| 退避期内不起子进程 | task item 2 | `src/follow.ts:411-413` — `if (stateJson.retry !== undefined && nowFn() < stateJson.retry.notBefore)` return 跳过 | ✅ |
| preflight 用 --json 只列失败项名字 | task item 2 | `src/follow.ts:436` — 命令含 `'--json'`; `src/follow.ts:247-257` — `extractPreflightFailNames` 只提取 `.name` 不带路径 | ✅ |
| 队列结束原因取 journal | task item 2 | `src/follow.ts:503-508` — 调用 `report --queue <id> --json` 取 JSON；`src/follow.ts:543-544` — `extractQueueReason` 取 reason 字段 | ✅ |
| 注入子进程函数收完整命令行 | task item 2 | `src/follow.ts:32` — `SpawnFn = (cmd: readonly string[], cwd) => ...`; `src/follow.ts:436` — `['npx', 'tsx', pinnedCli, 'preflight', ...]`; `src/follow.ts:465` — `['npx', 'tsx', pinnedCli, 'run', ...]` | ✅ |
| npm ci 不经 npx tsx | task item 2 | `src/follow.ts:189` — `await spawnFn(['npm', 'ci'], pinnedDir)` | ✅ |
| 缺省实现边跑边转发、末200行 | task item 2 | `src/follow.ts:784-835` — 使用 `child_process.spawn` 流式输出，`process.stdout.write(line + '\n')` 转发每行，`if (lines.length > SPAWN_TAIL_LINES) lines.shift()` 限制 200 行 | ✅ |
| **preflight连续失败3圈：preflight起1次、通知1条；5min后第2次，通知仍1条** | task item 2 bold | `npx vitest run test/follow.test.ts` Tests 20 passed；test #12（line 660）真走3圈+1圈，assert `preflightCount === 1`（line 706）、`preflightNotifs.length === 1`（line 709）、5min后 `preflightCount === 2`（line 728）、`preflightNotifs2.length === 1`（line 731） | ✅ |

### 条目 3: 汇报附录、目录注入与测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 汇报末尾加 `## 运行环境（follow 记录）` | task item 3 | `src/follow.ts:310-343` — `buildAppendix` 函数；`src/follow.ts:487-496` — 拼接到 report content | ✅ |
| 固定版本目录父目录可注入 | task item 3 | `src/follow.ts:72-73` — `pinnedParentDir?: string`; `src/follow.ts:615` — 默认 `tmpdir()` | ✅ |
| sandbox.ts 去掉 webhook_file | task item 3 | `test/support/sandbox.ts:121-122` — `.replace(/^webhook_file = .*$/m, '# webhook_file removed for sandbox')` | ✅ |
| 测试：基准不是祖先3圈 → 1通知、不起子进程 | task item 3 | test #13（line 737）：`ancestorNotifs.length === 1`（line 771）、`subprocessCount === 0`（line 773）；npx vitest run test/follow.test.ts — Tests 20 passed | ✅ |
| 测试：follow.json 删掉后同一基准不再跑 | task item 3 | test #14（line 779）：先运行、删 follow.json、再运行、`runCount === 0`（line 840）；Tests 20 passed | ✅ |
| 测试：preflight 通知不含 `/` | task item 3 | test #15（line 846）：`expect(preflightNotif).not.toContain('/')`（line 884）；Tests 20 passed | ✅ |
| 测试：通知原因来自 journal（limit ≠ exhausted） | task item 3 | test #16（line 890）：`expect(endNotif).toContain('limit')`、`expect(endNotif).not.toContain('exhausted')`（line 929-930）；Tests 20 passed | ✅ |
| 测试：锁文件不同 → npm 是第一个词 | task item 3 | test #17（line 936）：`expect(npmCiCall?.cmd[0]).toBe('npm')`（line 994）；Tests 20 passed | ✅ |
| 测试：汇报里有附录一节 | task item 3 | test #18（line 1000）：`expect(content).toContain('## 运行环境（follow 记录）')`（line 1046）；Tests 20 passed | ✅ |
| 测试：跑完后注入父目录之外无新建固定版本目录 | task item 3 | test #19（line 1056）：`expect(newInSysTmp.length).toBe(0)`（line 1101）；Tests 20 passed | ✅ |
| invariants: `src/follow.ts` 不含 `execFileSync` | task item 3 | `test/invariants.test.ts:448-458` — 新增 invariant，过滤注释后检查无 execFileSync；Tests 62 passed | ✅ |

### 额外禁止核对

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径（含 .collie/collie.toml） | task 额外禁止 | `git diff --stat ... -- SPEC.md ...` 无输出 | ✅ |
| 不改 templates/collie.toml | task 额外禁止 | `git diff --stat ... -- templates/collie.toml` 无输出 | ✅ |
| 不删/跳过测试 | task 额外禁止 | 旧测试被改写以适应新行为，无 `.skip`/`.only`，总数从原有增至 20 | ✅ |
| 不为验收命令改注释/字面 | task 额外禁止 | diff 中注释改动都是功能性备注更新（如 SPEC 14.4 → 14.4/14.9），非为通过验收 | ✅ |
| 测试不拉起真实 runner/npx/网络 | task 额外禁止 | 所有测试使用 fakeSpawn、fakeClock、collector；无真实 `npx`/网络 | ✅ |
| 不改 handoff.ts/run.ts/gate.ts/arbiter.ts | task 额外禁止 | `git diff --stat` 这些文件无输出 | ✅ |
| 不新增依赖 | task 额外禁止 | package.json/package-lock.json 无改动 | ✅ |

### 不变量数值变化

`git diff` 中 `test/invariants.test.ts` 只新增了一条 invariant（`src/follow.ts` 不含 `execFileSync`），无任何已有数值上下限的改动。无。

## 声称与实测的差异

无。

## 结论与理由

所有 11 条验收命令全部以 exit 0 通过。三个条目的全部要求逐一核对，均有代码位置或测试执行证据支持。两个加粗的行为要求（push 失败 3 圈 / preflight 失败 3 圈+退避）均有对应的多圈测试（test #11、#12），实跑确认 20 test 全部通过。无受保护文件或禁止文件被修改，无新增依赖，提交已推送到远端。结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b05",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "2ad2d2f5439a9936893cd7fda7b0e929747df9e4",
      "68038df889fa72b66aa7197aa341cd5c5ec1b9fe"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "56 files, 1076 tests passed" },
      { "cmd": "npm test -- test/follow.test.ts", "exit_code": 0, "summary": "1 file, 20 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/follow.test.ts | grep -qE \"^(1[6-9]|[2-9][0-9])$\"", "exit_code": 0, "summary": "20 it() blocks >= 16" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d \"$d\"/collie-r2-* >/dev/null 2>&1", "exit_code": 0, "summary": "no collie-r2-* dirs in tmpdir" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"notBefore\" && grep -qE \"notBefore\" test/follow.test.ts", "exit_code": 0, "summary": "notBefore found in code and tests" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"\\(base \" && grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"follow 记录\"", "exit_code": 0, "summary": "base marker and appendix found" },
      { "cmd": "! grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"execFileSync\"", "exit_code": 0, "summary": "no execFileSync in non-comment code" },
      { "cmd": "grep -qE \"webhook_file\" test/support/sandbox.ts", "exit_code": 0, "summary": "webhook_file handled in sandbox" },
      { "cmd": "grep -qE \"execFileSync\" test/invariants.test.ts", "exit_code": 0, "summary": "execFileSync invariant present" }
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
  "reason": "All 11 acceptance commands pass (exit 0). 20 follow tests pass including multi-cycle behavioral tests for push-failure dedup (#11) and preflight-backoff (#12). No protected/prohibited files modified, no new dependencies. Commits on remote. CI 以 R2 取证为准。"
}
```
