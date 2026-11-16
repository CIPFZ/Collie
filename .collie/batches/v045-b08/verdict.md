Now I have all the evidence needed. Let me compile the verdict.

# 批次 v045-b08 审核

## 取证过程

### 1. 受保护文件检查

```
git diff --stat 99baf56..572836a -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护文件无改动。

### 2. 额外禁止路径检查

```
git diff --stat 99baf56..572836a -- templates/collie.toml eslint.config.js vitest.config.ts src/handoff.ts src/run.ts src/gate.ts src/arbiter.ts
```
结果：无输出。额外禁止的文件无改动。

### 3. 依赖变化检查

```
git diff 99baf56..572836a -- package.json package-lock.json
```
结果：无输出。无依赖变化。

### 4. 提交事实

三个提交在范围内：
- `132bf2f91590c10f843c9aa5ea97dfcdc1acb604` — docs: issue v045-b08 task envelope
- `7bf4a6d4a5c4b75181f6cf9e6b87d93775833b1d` — cli: sync follow with remote...
- `572836a93a1fdcfa20cce29bb5c00fd081f5e597` — test: add follow sync/deferred-notification...

远端 `main` 指向 `f637468ee71c57de5370c1060358b3c6c56e996a`（`report(collie): v045-b08` 信封提交），包含了 head_sha 的全部内容。`remote_has_head` = true。

### 5. 验收命令实跑

#### 验收 #1 `npm run lint`
```
Exit code 1
Checking formatting...
[warn] src/follow.ts
[warn] Code style issues found in the above file.
```
**失败。** Prettier 自动格式化与文件不一致。具体两处差异：
- 第 35 行：`SpawnFn` 类型签名单行 vs Prettier 要求多行拆分
- 第 646 行：`localOnlyLog.trim().split('\n').filter(...)` 单行链式调用 vs Prettier 要求多行拆分

#### 验收 #2 `npm run typecheck`
退出码 0。通过。

#### 验收 #3 `npm test`
退出码 0。57 个测试文件、1119 个测试全部通过。

#### 验收 #4 `npm test -- test/follow.test.ts`
退出码 0。1 个文件、30 个测试全部通过。

#### 验收 #5 test count ≥ 28
```
grep -cE "^\s+it\(" test/follow.test.ts
# 输出：30
```
退出码 0。通过。

#### 验收 #6 临时目录无残留
退出码 0。通过。

#### 验收 #7 rebase 存在
退出码 0。通过。

#### 验收 #8 pendingReport 存在
退出码 0。通过。

#### 验收 #9 pendingPush 已删
退出码 0。通过。

#### 验收 #10 不变量同步
退出码 0。通过。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 1, Prettier formatting issue in src/follow.ts | ❌ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 57 files 1119 tests passed | ✅ |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0, 30 tests passed | ✅ |
| 专项测试不少于 28 个 | `grep -cE ...` | 30 | ✅ |
| 不留固定版本目录 | TMPDIR test | exit 0 | ✅ |
| 分叉时会 rebase | grep rebase | exit 0 | ✅ |
| pendingReport 存在 | grep pendingReport | exit 0 | ✅ |
| pendingPush 已删 | ! grep pendingPush | exit 0 | ✅ |
| 不变量同步 | grep pendingPush invariants | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| SpawnFn 多一个 OutputMode 参数 | 条目 2 | `src/follow.ts:35` — `export type SpawnFn = (cmd: readonly string[], cwd: string, mode: OutputMode) => Promise<SpawnResult>` | ✅ |
| keepLines 纯函数（不起子进程） | 条目 2 | `src/follow.ts:244-249` — `export function keepLines(text: string, mode: OutputMode): string` 无任何 async/subprocess 依赖 | ✅ |
| report/report --json/preflight --json 用完整输出 | 条目 2 | `src/follow.ts:463` preflight `'full'`; `src/follow.ts:507` report `'full'`; `src/follow.ts:528` report --json `'full'` | ✅ |
| run --continue 用 tail | 条目 2 | `src/follow.ts:490` — `await spawnFn(runCmd, root, 'tail')` | ✅ |
| npm ci 用 tail | 条目 2 | `src/follow.ts:204` — `await spawnFn(['npm', 'ci'], pinnedDir, 'tail')` | ✅ |
| npm ci ≠ 0 → 删目录、通知 pinned:sha、退避 | 条目 2 | `src/follow.ts:205-212` — rmdir + throw; `src/follow.ts:447-458` — catch + notify `pinned:${pinnedSha}` + backoff | ✅ |
| defaultSpawn 程序不存在 → exit 127 不抛出 | 条目 2 | `src/follow.ts:903-914` — `child.on('error', ...)` returns 127 for ENOENT | ✅ |
| fetch/pull/push 显式写 origin 和 main | 条目 1 | `src/follow.ts:582,618,628,661,664` 全部含 `'origin', 'main'` | ✅ |
| 分叉时仅本地全是 `ops: report queue` 才 rebase | 条目 1 | `src/follow.ts:643-656` — `lines.every(l => ... subject.startsWith('ops: report queue'))` | ✅ |
| 冲突 → rebase --abort | 条目 1 | `src/follow.ts:678-680` — `await git(root, ['rebase', '--abort'])` | ✅ |
| pendingReport 记入 follow.json | 条目 1 | `src/follow.ts:46-51` — `PendingReport` interface; `src/follow.ts:839` — `pendingReport: result.pendingReport ?? stateJson.pendingReport` | ✅ |
| 本地不再领先时才发、只发一次 | 条目 1 | `src/follow.ts:752-759` — `if (stateJson.pendingReport !== undefined && !syncResult.localAhead)` then send + clear | ✅ |
| pendingPush 已删 | 条目 1 | grep 确认 src/follow.ts 无任何 pendingPush（含注释） | ✅ |
| 退避状态随基准提交清零 | 条目 3 | `src/follow.ts:816-820` — `if (stateJson.retryBase !== undefined && stateJson.retryBase !== action.baseSha)` clear | ✅ |
| 附录写 preflight：ok | 条目 3 | `src/follow.ts:353` — `'preflight：ok'` | ✅ |
| invariants 加 pendingPush 检查 | 条目 3 | `test/invariants.test.ts:488-500` — 检查 src/follow.ts 非注释行不含 pendingPush | ✅ |
| 无受保护路径改动 | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 无禁止文件改动 | 额外禁止 | templates/collie.toml, eslint.config.js, vitest.config.ts, handoff/run/gate/arbiter 无改动 | ✅ |
| 无新增依赖 | 额外禁止 | package.json/package-lock.json 无 diff | ✅ |

### 行为要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 推送失败 3 圈 → 恢复 → 再走 3 圈：run --continue 只起 1 次、1 条通知 | 条目 1 加粗 1 | `npx vitest run test/follow.test.ts`：test #21 "push fail 3 → restore remote → 3 more → remote has report, run --continue once, 1 queue-end notification after restore" — Tests 30 passed | ✅ |
| 队列期间远端多了提交：不发 diverged | 条目 1 加粗 2 | `npx vitest run test/follow.test.ts`：test #22 "remote extra commit during queue → rebase, remote has both commits, no diverged notification" — Tests 30 passed | ✅ |
| 本地非汇报未推送 + 远端前进 → 不 rebase, 3 圈 1 条 diverged | 条目 3 | `npx vitest run test/follow.test.ts`：test #23 "local non-report unpushed commit + remote ahead → no rebase, 3 cycles only 1 diverged" — Tests 30 passed; 断言 `sleepCount === 3`, `divergedNotifs.length === 1` | ✅ |
| rebase 冲突 → 放弃、仓库回到之前、1 条通知 | 条目 3 | `npx vitest run test/follow.test.ts`：test #24 "rebase conflict → abort, repo back to pre-rebase state, 1 diverged notification" — Tests 30 passed; 断言 `localHeadAfter === localHeadBefore`, `divergedNotifs.length === 1` | ✅ |
| keepLines 500 行：full 500 行、tail 200 行 | 条目 3 | `npx vitest run test/follow.test.ts`：test #25 "keepLines: full mode preserves all 500 lines, tail mode keeps last 200" — Tests 30 passed | ✅ |
| 注入 spawn 收到正确 mode | 条目 3 | `npx vitest run test/follow.test.ts`：test #26 — Tests 30 passed; 断言 npm ci=tail, preflight=full, run --continue=tail, report=full, report --json=full | ✅ |
| 远端新提交 + 本地不领先 → HEAD 等远端、无 pull 通知 | 条目 3 | `npx vitest run test/follow.test.ts`：test #27 — Tests 30 passed; 断言 `localHead === remoteHeadBefore`, `pullNotifs.length === 0` | ✅ |
| npm ci 失败 → 目录不存在、之后成功能接着跑 | 条目 3 | `npx vitest run test/follow.test.ts`：test #28 — Tests 30 passed; 断言 `pinnedItems.length === 0` 后重试 `npmCiCallCount === 2` | ✅ |
| 不存在的程序名调缺省子进程实现 → 127 | 条目 3 | test #29 "default spawn with nonexistent program returns exit code 127"：**测试创建了一个返回 127 的 fake SpawnFn，并不调用真正的 defaultSpawn。这是同义反复——测试的是 fake 而非实际代码。** | ❌ |
| 换基准提交后不沿用退避 | 条目 3 | `npx vitest run test/follow.test.ts`：test #30 "changing base commit clears backoff from previous base" — Tests 30 passed; 断言 `preflightCount === 2`（退避被清零后立即重试） | ✅ |
| 多圈用例断言实际走了几圈 | 条目 3 | test #1 sleepCount=2; #11 sleepCount=3; #12 sleepCount=3; #13 sleepCount=3; #16 sleepCount=2; #20 sleepCount=4; #21 两阶段各 sleepCount=3; #23 sleepCount=3 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增了一个新 test case，未修改任何已有数值上下限。

## 声称与实测的差异

1. **test #29 声称测试 defaultSpawn 对不存在程序返回 127**：实测该测试创建了 `const fakeSpawnNotFound: SpawnFn = async () => { return { exitCode: 127, ... } }`，然后调用这个 fake 验证它返回 127。这是同义反复，完全没有测试 `src/follow.ts` 中第 903-914 行的 `child.on('error', ...)` 代码路径。条目 3 明确要求 "用一个不存在的程序名**调缺省的子进程实现**"，即必须调用真正的 `defaultSpawn`。

## 结论与理由

**FIX**。存在两个可在同批次内修复的具体缺口：

1. **验收命令 #1 失败**：`npm run lint` 因 `src/follow.ts` 存在 2 处 Prettier 格式不一致而退出码 1。需要 `npx prettier --write src/follow.ts` 修复后重新提交。

2. **test #29 不测试真正的 defaultSpawn**：条目 3 要求 "用一个不存在的程序名调缺省的子进程实现（不会起任何进程）得到退出码 127"。当前测试 #29 创建一个 fake SpawnFn 返回 127 然后验证它返回 127，这是同义反复，没有调用 `src/follow.ts` 中的 `defaultSpawn` 函数。需要重写此测试：要么 export `defaultSpawn` 后直接调用，要么调用 `follow()` 不注入 `spawn`、使其走 defaultSpawn 路径触发 ENOENT。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b08",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [
      "132bf2f91590c10f843c9aa5ea97dfcdc1acb604",
      "7bf4a6d4a5c4b75181f6cf9e6b87d93775833b1d",
      "572836a93a1fdcfa20cce29bb5c00fd081f5e597"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 1, "summary": "Prettier formatting issue in src/follow.ts (2 locations)" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "57 files, 1119 tests passed" },
      { "cmd": "npm test -- test/follow.test.ts", "exit_code": 0, "summary": "1 file, 30 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/follow.test.ts | grep -qE \"^(2[8-9]|[3-9][0-9])$\"", "exit_code": 0, "summary": "30 tests found" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d \"$d\"/collie-r2-* >/dev/null 2>&1", "exit_code": 0, "summary": "no leftover dirs" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"rebase\" && grep -qE \"rebase\" test/follow.test.ts", "exit_code": 0, "summary": "rebase found in both" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"pendingReport\" && grep -qE \"pendingReport\" test/follow.test.ts", "exit_code": 0, "summary": "pendingReport found in both" },
      { "cmd": "! grep -vE \"^\\s*(//|\\*|/\\*)\" src/follow.ts | grep -qE \"pendingPush\"", "exit_code": 0, "summary": "no pendingPush in non-comment code" },
      { "cmd": "grep -qE \"pendingPush\" test/invariants.test.ts", "exit_code": 0, "summary": "pendingPush invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [
    "test #29 claims to test 'default spawn with nonexistent program returns exit code 127' but actually creates a manual fake that returns 127 and verifies it — does not call the real defaultSpawn"
  ],
  "gaps": [
    "验收命令 #1 (npm run lint) 退出码 1：src/follow.ts 有 2 处 Prettier 格式不一致（第 35 行 SpawnFn 类型签名、第 646 行链式调用）。运行 npx prettier --write src/follow.ts 即可修复。",
    "test #29 未测试真正的 defaultSpawn：条目 3 要求「用一个不存在的程序名调缺省的子进程实现得到退出码 127」，当前测试创建 fake 返回 127 然后验证返回 127，同义反复。需重写为调用实际 defaultSpawn（export 后直接调用，或不注入 spawn 走 follow 路径触发 ENOENT）。"
  ],
  "reason": "验收命令 #1 (lint) 失败，src/follow.ts 有 Prettier 格式问题；test #29 未实际调用 defaultSpawn 而用 fake 自证 127，不满足条目 3 对行为要求的测试覆盖。CI 以 R2 取证为准。"
}
```
