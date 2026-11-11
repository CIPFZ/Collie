I now have all evidence gathered. Let me write the verdict.

---

# 批次 v04-b05 审核

## 取证过程

### 1. 提交事实

```
git log f4267bc5b382c388aa7bafda4c4f91b4ff9997d6..9873af79b1270679c9e8a4f61681d206229e0483 --format='%H %s'
```

输出：
```
9873af79b1270679c9e8a4f61681d206229e0483 test: cover collie watch exit paths and stall annotation
4b6febdbadf60add6262c005ff2b077913f1e543 cli: add collie watch for following a run journal
191efafc3de41118536ce384570c9fdecf2d4378 docs: issue v04-b05 task envelope
```

3 个提交，head SHA = `9873af79b1270679c9e8a4f61681d206229e0483`。

远端推送确认：`git merge-base --is-ancestor 9873af79b1270679c9e8a4f61681d206229e0483 origin/main` → yes。head 提交是 `origin/main` 的祖先（report 提交在其上方），已推送。

### 2. 受保护文件

```
git diff --stat f4267bc5b382c388aa7bafda4c4f91b4ff9997d6..9873af79b1270679c9e8a4f61681d206229e0483 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```

输出为空 — 没有受保护文件被改动。spec_diff_lines = 0。

### 3. 依赖变化

```
git diff f4267bc5b382c388aa7bafda4c4f91b4ff9997d6..9873af79b1270679c9e8a4f61681d206229e0483 -- package.json package-lock.json
```

输出为空 — 没有依赖变化。

### 4. 改动范围

改动的文件：
- `.collie/batches/v04-b05/task.md` — 任务信封（正常）
- `src/cli.ts` — 添加 `watch` 子命令接线、`realSleep`、`watchCommand`
- `src/view.ts` — 提取 `formatCurrentSection` 公共函数供 watch 使用
- `src/watch.ts` — 新增文件，轮询循环实现
- `test/invariants.test.ts` — 新增 2 条不变量
- `test/watch.test.ts` — 新增文件，7 个测试用例

未改动禁止文件（run.ts、gate.ts、arbiter.ts）：`git diff` 确认无输出。

### 5. 验收命令实跑

逐条记录如下。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，无错误输出 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0，无错误输出 | ✅ |
| 全部测试通过 | `npm test` | exit 0，43 files passed，875 tests passed | ✅ |
| watch 专项测试通过 | `npm test -- test/watch.test.ts` | exit 0，1 file passed，7 tests passed | ✅ |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/watch.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0（实际 7 个） | ✅ |
| watch --once 可用 | `npx tsx src/cli.ts watch --once` | exit 0，输出 "no runs recorded" | ✅ |
| 测试不用真实定时器 | `test -f test/watch.test.ts && ! grep -qE "setInterval\|setTimeout\(" test/watch.test.ts` | exit 0 | ✅ |
| watch 只读 | `test -f src/watch.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/watch.ts \| grep -qE "writeFileSync\|appendFileSync\|process\.kill"` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "watch\.ts" test/invariants.test.ts` | exit 0 | ✅ |

全部 9 条验收命令实跑通过。

## 条目要求与额外禁止

### 条目 1：`src/watch.ts`

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 轮询循环 | task.md 条目 1 | `src/watch.ts:165` `for (;;)` 无限循环 | ✅ |
| 时钟由参数注入 | task.md 条目 1 | `src/watch.ts:28` `now: () => Date` in WatchDeps | ✅ |
| sleep 由参数注入 | task.md 条目 1 | `src/watch.ts:29` `sleep: (ms: number) => Promise<void>` in WatchDeps | ✅ |
| 取数函数由参数注入 | task.md 条目 1 | `src/watch.ts:31` `load: (root: string) => readonly RunData[]` in WatchDeps | ✅ |
| 每条新事件打印一行 | task.md 条目 1 | `src/watch.ts:189` `deps.out(\`${eventLine(e)}${silent}\n\`)` | ✅ |
| 阶段变化打印 status 当前段 | task.md 条目 1 | `src/watch.ts:224-226` frameKey 比较后调用 `deps.out(frameText(...))` | ✅ |
| 静默超过 stall_secs 时标出秒数 | task.md 条目 1（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "marks the silent seconds when no event arrives past stall_secs" | ✅ |
| run.finished 后结束 | task.md 条目 1（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "follows a batch run and exits on run.finished" | ✅ |
| queue.finished 后结束 | task.md 条目 1（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "follows a queue run and exits on queue.finished" | ✅ |
| 不含 setInterval/setTimeout | 验收+SPEC 13.5 | `grep -qE "setInterval\|setTimeout\(" src/watch.ts` → no matches | ✅ |

### 条目 2：CLI 接线

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `collie watch` 子命令存在 | task.md 条目 2 | `src/cli.ts:725-733` `.command('watch')` | ✅ |
| `--once` 选项 | task.md 条目 2 | `src/cli.ts:729` `.option('--once', ...)` | ✅ |
| `--interval <秒>` 选项 | task.md 条目 2 | `src/cli.ts:730` `.option('--interval <secs>', ...)` | ✅ |
| `--timeout <秒>` 选项 | task.md 条目 2 | `src/cli.ts:731` `.option('--timeout <secs>', ...)` | ✅ |
| cli.ts 只做接线 | task.md 条目 2 | `src/cli.ts:576-608` watchCommand 只做参数解析和调用 `watch()` | ✅ |
| 只读：不写 journal | task.md 条目 2 | `src/watch.ts` 不导入 journal，grep 确认无 writeFileSync/appendFileSync | ✅ |
| 只读：不碰心跳 | task.md 条目 2 | `src/watch.ts` 不导入 heartbeat，不含 heartbeat 字面 | ✅ |
| 只读：不发信号 | task.md 条目 2 | `src/watch.ts` 不含 process.kill | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 用注入的时钟与 sleep | task.md 条目 3 | `test/watch.test.ts:29-41` fakeTime helper；`test/watch.test.ts:77-78` 注入 `time.now` / `time.sleep` | ✅ |
| 覆盖 --once | task.md 条目 3（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "--once prints the current frame and exits without sleeping" 和 "--once on an empty root prints no runs recorded" | ✅ |
| 跟到 run.finished 退出 | task.md 条目 3（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "follows a batch run and exits on run.finished" | ✅ |
| 跟到 queue.finished 退出 | task.md 条目 3（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "follows a queue run and exits on queue.finished" | ✅ |
| 等待新运行 | task.md 条目 3（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "waits for a new run when nothing is in progress" | ✅ |
| 超时退出 | task.md 条目 3（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "exits 0 when --timeout elapses with no run" | ✅ |
| 静默标注 | task.md 条目 3（行为要求） | `npx vitest run test/watch.test.ts` → `Tests 7 passed`，含 "marks the silent seconds when no event arrives past stall_secs" | ✅ |
| invariants: watch.test.ts 不含真实定时器 | task.md 条目 3 | `test/invariants.test.ts:292-296` "watch.test.ts has no real timers" | ✅ |
| invariants: watch.ts 不写文件 | task.md 条目 3 | `test/invariants.test.ts:298-303` "watch.ts writes no files and sends no signals" | ✅ |

### 额外禁止

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动受保护路径 | task.md 额外禁止 | `git diff --stat ... -- SPEC.md CONSTRAINTS.md ...` 输出为空 | ✅ |
| 不删除或跳过测试 | task.md 额外禁止 | diff 无测试删除，全部 875 tests 通过 | ✅ |
| 不改注释或字面凑验收 | task.md 额外禁止 | diff 审查无此类操作 | ✅ |
| 不改 run.ts/gate.ts/arbiter.ts | task.md 额外禁止 | `git diff ... -- src/run.ts src/gate.ts src/arbiter.ts` 输出为空 | ✅ |
| 不绕过 view.ts 直接读 journal | task.md 额外禁止 | `src/watch.ts` imports: 只有 `./schema/index.js` 和 `./view.js`，不导入 journal | ✅ |
| 不新增依赖 | task.md 额外禁止 | package.json / package-lock.json 无变化 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 9 条验收命令实跑通过（exit 0）。3 个条目的所有结构要求和行为要求均已核对——`src/watch.ts` 实现了完整的轮询循环，时钟/sleep/取数函数全部通过 `WatchDeps` 接口注入；`cli.ts` 仅做接线；`test/watch.test.ts` 有 7 个测试用例覆盖了全部 6 个指定场景；`test/invariants.test.ts` 新增 2 条不变量。`view.ts` 的改动仅是提取 `formatCurrentSection` 公共函数，`formatStatus` 仍调用它，行为不变。提交已推送到远端。无受保护文件变更，无依赖变更，无额外禁止违规。

判定：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b05",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "191efafc3de41118536ce384570c9fdecf2d4378",
      "4b6febdbadf60add6262c005ff2b077913f1e543",
      "9873af79b1270679c9e8a4f61681d206229e0483"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "43 files, 875 tests passed" },
      { "cmd": "npm test -- test/watch.test.ts", "exit_code": 0, "summary": "1 file, 7 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/watch.test.ts | grep -qE \"^([6-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "7 test cases (>= 6)" },
      { "cmd": "npx tsx src/cli.ts watch --once", "exit_code": 0, "summary": "prints 'no runs recorded'" },
      { "cmd": "test -f test/watch.test.ts && ! grep -qE \"setInterval|setTimeout\\(\" test/watch.test.ts", "exit_code": 0, "summary": "no real timers in test" },
      { "cmd": "test -f src/watch.ts && ! grep -vE \"^\\s*(//|\\*|/\\*)\" src/watch.ts | grep -qE \"writeFileSync|appendFileSync|process\\.kill\"", "exit_code": 0, "summary": "watch.ts is read-only" },
      { "cmd": "grep -qE \"watch\\.ts\" test/invariants.test.ts", "exit_code": 0, "summary": "invariants reference watch.ts" }
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
  "reason": "All 9 acceptance commands pass. 3 items fully implemented: watch.ts polling loop with fully injected deps, cli.ts wiring only, 7 tests covering all 6 required scenarios. 2 new invariants added. No protected file changes, no dependency changes, no prohibited file modifications. CI 以 R2 取证为准。"
}
```
