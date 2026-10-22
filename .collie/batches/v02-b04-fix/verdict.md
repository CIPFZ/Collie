Now I have all the evidence I need. Let me compile the complete verdict.

# 批次 v02-b04-fix 审核

## 取证过程

### 1. 验收命令实跑

**命令 1: `npm run lint`**
- 退出码: 0
- 输出: `eslint . && prettier --check . → Checking formatting... All matched files use Prettier code style!`

**命令 2: `npm run typecheck`**
- 退出码: 0
- 输出: `tsc -p tsconfig.json`（无错误）

**命令 3: `npm test`**
- 退出码: 0
- 输出: `Test Files 30 passed (30), Tests 583 passed (583), Duration 8.41s`

**命令 4: 场景 G 连跑 5 次**
- 退出码: 0（全部 5 次）
- 输出: 每次 `Test Files 1 passed (1), Tests 3 passed (3)`，约 1.15-1.16s

**命令 5: `! grep -qE "= *(resolvedIterable|queryIterable)\??\.interrupt;" src/runner/claude.ts`**
- 退出码: 0
- 含义: interrupt 不再被解构赋值

**命令 6: `grep -qE "binds this" test/runner-claude.test.ts`**
- 退出码: 0
- 含义: this 绑定回归测试存在

**命令 7: `grep -qE "unhandledRejection" src/run.ts src/cli.ts`**
- 退出码: 0
- 含义: 未处理拒绝有兜底

**命令 8: `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts`**
- 退出码: 0
- 含义: fingerprint 可注入且使用 diff

**命令 9: `! grep -rlE "@anthropic-ai" src --include='*.ts' | grep -v '^src/runner/'`**
- 退出码: 0
- 含义: SDK 概念不泄漏到 runner 外

### 2. 提交事实

```
dbe276b60b3a915fcf3fe5cc0185d6d49fd681da ladder: content-sensitive fingerprint and injectable liveness (SPEC 11.5)
857e378662ebb48774e869861db6dd167bd11ef6 runner: R2 exception fallback and ladder fault tolerance (SPEC 11.3, 11.6)
ad7ad753d7aed0eb062771640e62c095583e7039 runner: fix interrupt() this binding, add regression test (SPEC 11.2, v02-b04-fix)
```

三个提交存在。`git fetch origin main` + `git log --oneline origin/main -3` 确认 head_sha `dbe276b` 在 `origin/main` 上。`remote_has_head = true`。

### 3. CI

`gh auth` 不可用（无 GITHUB_TOKEN），无法查询 CI 运行结论。ci_conclusion=unknown，ci_branch_matched=null。

### 4. 受保护路径

`git diff --stat e43f828..dbe276b -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml` 无输出。spec_diff_lines=0。

### 5. 依赖变化

`git diff e43f828..dbe276b -- package.json package-lock.json` 无输出。无依赖变更。

### 6. 变更范围

变更文件 8 个：
- `src/cli.ts`（+5 行）：传递 livenessFingerprint
- `src/ladder.ts`（+62/-）：fingerprint 算法改造 + 可注入 + onSignaled error 参数
- `src/run.ts`（+341/-265）：outermost try/catch + unhandledRejection + fingerprint 传递
- `src/runner/claude.ts`（+18/-）：interrupt this 绑定修复
- `test/ladder.test.ts`（+50）：soft 抛错升级 hard 用例
- `test/run-fallback.test.ts`（+64 新文件）：worker 抛异常兜底测试
- `test/runner-claude.test.ts`（+51）：this 绑定回归测试
- `test/scenario-g.test.ts`（+21）：fingerprint 单测

全部在批次条目范围内，无范围蔓延。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 30 files, 583 tests | ✅ |
| 场景 G 连跑 5 次 | `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts \|\| exit 1; done` | exit 0, 5/5 通过 | ✅ |
| interrupt 不再拆出调用 | `! grep -qE "= *(resolvedIterable\|queryIterable)\??\.interrupt;" src/runner/claude.ts` | exit 0 | ✅ |
| this 绑定有回归测试 | `grep -qE "binds this" test/runner-claude.test.ts` | exit 0 | ✅ |
| 未处理拒绝有兜底 | `grep -qE "unhandledRejection" src/run.ts src/cli.ts` | exit 0 | ✅ |
| 指纹已注入且看内容 | `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts` | exit 0 | ✅ |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 条目 1：lazySdkQuery interrupt 直接在对象上调用并 await | 任务描述 11.2 | `src/runner/claude.ts:120-121`：`if (resolvedIterable?.interrupt !== undefined) { await resolvedIterable.interrupt(); }` | ✅ |
| 条目 1：ClaudeRunner.stop('soft') 直接在对象上调用并 await | 任务描述 11.2 | `src/runner/claude.ts:227-229`：`if (queryIterable.interrupt === undefined) { throw ... } await queryIterable.interrupt();` | ✅ |
| 条目 1：不再 void，改为 await | 任务描述 11.2 | `src/runner/claude.ts:116` 函数签名 `async interrupt(): Promise<void>`，120-121 `await`；229 `await` | ✅ |
| 条目 1：测试替身 interrupt 读 this 字段，this 为 undefined 时抛错 | 任务描述 11.2 | `test/runner-claude.test.ts:958-963`：`if ((this as any).state !== 'running') { throw new TypeError('interrupt() lost this — state is unreachable'); }` | ✅ |
| 条目 1：测试名含 binds this | 任务描述 11.2 | `test/runner-claude.test.ts:933`：`'soft stop binds this: interrupt() that reads this.state works (v02-b04-fix regression)'` | ✅ |
| 条目 2：run.ts 最外层 try/finally | 任务描述 11.3 | `src/run.ts:356` `try {` ... `src/run.ts:676` `} finally {` ... `src/run.ts:678` `}` | ✅ |
| 条目 2：catch 中记 run.finished(result=error) | 任务描述 11.3 | `src/run.ts:637-641`：`rec.record('run.finished', { result: 'error', error: errorMsg, ... })` | ✅ |
| 条目 2：catch 中救援 + progress + 删心跳 | 任务描述 11.3 | `src/run.ts:644-674`：rescueDirtyWorkspace → writeProgress → commit → removeHeartbeat → return | ✅ |
| 条目 2：catch 以退出码 1 退出 | 任务描述 11.3 | `src/run.ts:675`：`return { final: 'BLOCK', exitCode: EXIT_CODES.ERROR, ...}` 其中 EXIT_CODES.ERROR=1 | ✅ |
| 条目 2：注册 unhandledRejection | 任务描述 11.3 | `src/run.ts:352`：`process.on('unhandledRejection', onUnhandledRejection);` | ✅ |
| 条目 2：finally 移除 listener | 任务描述 11.3 | `src/run.ts:677`：`process.removeListener('unhandledRejection', onUnhandledRejection);` | ✅ |
| 条目 2：阶梯 stop() 抛出时记 worker.signaled 带 error 字段 | 任务描述 11.6 | `src/ladder.ts:51-54`：`catch (error) { const msg = ...; opts.callbacks.onSignaled(level, opts.reason, msg);` | ✅ |
| 条目 2：stop() 抛出进入下一级 | 任务描述 11.6 | `src/ladder.ts:57`：`continue;` | ✅ |
| 条目 2：ladder test: soft 抛错→记 error→升级 hard | 任务描述 | `test/ladder.test.ts:168`：`'soft throws → records error field → escalates to hard (SPEC 11.6)'` | ✅ |
| 条目 2：run-fallback test: worker 抛出→run.finished 存在、心跳已删、进程未直接退出 | 任务描述 | `test/run-fallback.test.ts:35,55`：两个测试验证 run.finished 存在、heartbeat.json 不存在、返回 exit code 20 | ✅ |
| 条目 3：指纹改为 HEAD + git diff HEAD 哈希 + 未跟踪文件 (路径,大小,mtime) 哈希 | 任务描述 11.5 | `src/ladder.ts:76-95`：revParse HEAD → `git diff HEAD` hash → untracked `lstatSync(path).size/mtimeMs` hash | ✅ |
| 条目 3：指纹做成可注入 LivenessConfig.fingerprint? | 任务描述 11.5 | `src/ladder.ts:123`：`fingerprint?: (root: string) => Promise<string>;`；`src/ladder.ts:152`：`this.fingerprintFn = config.fingerprint ?? computeFingerprint;` | ✅ |
| 条目 3：单测—同一文件内容改两次，两次指纹不同 | 任务描述 11.5 | `test/scenario-g.test.ts:201-219`：`'same file modified twice produces different fingerprints'`，write v2 → fp1，write v3 → fp2，`expect(fp1).not.toBe(fp2)` | ✅ |
| 条目 3：scenario-g.test.ts 注入假指纹，三者全部由测试代码顺序控制 | 任务描述 11.5 | `test/scenario-g.test.ts:146-151`：传入 `livenessNow`、`livenessSetTimer`，**未传入 `livenessFingerprint`** | ❌ |

## 声称与实测的差异

无 report.md 声称可比对（本审核不读 report 正文）。

## 结论与理由

**FIX。**

全部 9 条验收命令实跑通过，3 个提交存在且已推送到远端，无受保护文件修改，无依赖变更，范围在批次条目内。

但有一个明确的条目级要求未满足：

**`test/scenario-g.test.ts` 未注入假指纹函数。**

任务描述明确要求："test/scenario-g.test.ts 注入假指纹，fake worker 发事件、推进假时钟、改变假指纹三者全部由测试代码顺序控制"。SPEC 11.5 也明确要求："计时器、时钟、产出指纹函数三者都必须注入...v02-b04-tests 证明只注入前两者不够：取指纹的 git 子进程仍是真实时序，单核加压下场景 G 3 次挂 2 次"。

实测证据：`test/scenario-g.test.ts:146-151` 传入了 `livenessNow`（假时钟）和 `livenessSetTimer`（假定时器），但未传入 `livenessFingerprint`。`LivenessConfig.fingerprint?` 字段已存在（`src/ladder.ts:123`），`LivenessMonitor` 已使用 `this.fingerprintFn`（`src/ladder.ts:198`），`RunContext` 和 `CliDeps` 已经有 `livenessFingerprint?`（`src/run.ts:109`，`src/cli.ts:48`）。代码层面注入能力完备，但测试未使用。

虽然场景 G 在当前环境下连跑 5 次全通过，但指纹函数仍使用真实 git 子进程（`computeFingerprint` 调用 `revParse`、`git diff HEAD`、`status`），这正是 v02-b04-tests 失败的原因——整个批次的核心修复目标是消除此时序依赖，而测试没有完成这一步。

**修复方式**：在 `scenario-g.test.ts` 的 `box.run()` 调用中注入 `livenessFingerprint`，使假指纹由测试代码控制（例如初始返回固定值模拟 idle，发事件/推进时钟/改变指纹的顺序完全由测试代码决定）。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b04-fix",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [
      "ad7ad753d7aed0eb062771640e62c095583e7039",
      "857e378662ebb48774e869861db6dd167bd11ef6",
      "dbe276b60b3a915fcf3fe5cc0185d6d49fd681da"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "30 files, 583 tests passed" },
      { "cmd": "for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts || exit 1; done", "exit_code": 0, "summary": "5/5 passes, 3 tests each" },
      { "cmd": "! grep -qE \"= *(resolvedIterable|queryIterable)\\??\\.interrupt;\" src/runner/claude.ts", "exit_code": 0, "summary": "no destructured interrupt" },
      { "cmd": "grep -qE \"binds this\" test/runner-claude.test.ts", "exit_code": 0, "summary": "this-binding test found" },
      { "cmd": "grep -qE \"unhandledRejection\" src/run.ts src/cli.ts", "exit_code": 0, "summary": "handler registered" },
      { "cmd": "grep -qE \"fingerprint\\?:\" src/ladder.ts && grep -qE \"diff\" src/ladder.ts", "exit_code": 0, "summary": "injectable fingerprint using diff" },
      { "cmd": "! grep -rlE \"@anthropic-ai\" src --include='*.ts' | grep -v '^src/runner/'", "exit_code": 0, "summary": "SDK stays in runner" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [
    "test/scenario-g.test.ts does not inject livenessFingerprint: the test passes livenessNow and livenessSetTimer but not livenessFingerprint. Task requires all three injected (SPEC 11.5: 'v02-b04-tests 证明只注入前两者不够'). The injectable field exists in LivenessConfig (src/ladder.ts:123) and is threaded through RunContext (src/run.ts:109) and CliDeps (src/cli.ts:48), but scenario-g.test.ts:146-151 does not use it. Fix: inject a fake fingerprint function in the test's box.run() call."
  ],
  "reason": "All 9 acceptance commands pass, commits pushed, no protected file changes, no dependency changes. FIX because scenario-g.test.ts does not inject fake fingerprint — an explicit item requirement (task description item 3 + SPEC 11.5) that is the core fix target of this batch."
}
```
