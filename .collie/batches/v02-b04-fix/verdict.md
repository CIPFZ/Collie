All evidence gathered. Let me compile the verdict.

# 批次 v02-b04-fix 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline 8467274b..6fe4d740
6fe4d74 test: inject fake fingerprint in scenario-g (SPEC 11.5, v02-b04-fix)
```

唯一一个代码提交，只改 `test/scenario-g.test.ts`（+57 −3）。

```
$ git branch -r --contains 6fe4d740796ebb306be5c5c7a84203103423ab57
  origin/HEAD -> origin/main
  origin/main
```

head_sha 已在 origin/main 上。

### 2. 受保护路径检查

```
$ git diff --stat 8467274b..6fe4d740 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md '.collie/collie.toml'
(无输出)
```

受保护文件零改动。

### 3. 依赖检查

```
$ git diff 8467274b..6fe4d740 -- package.json package-lock.json
(无输出)
```

无依赖变化。

### 4. CI 检查

```
$ gh api repos/CIPFZ/Collie/actions/runs ...
→ gh auth login required (无 GITHUB_TOKEN)
```

无法取证 CI。按规则填 `ci_conclusion: "unknown"`, `ci_branch_matched: null`。

### 5. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 通过 |
| 2 | `npm run typecheck` | 0 | tsc 零错误 |
| 3 | `npm test` | 0 | 30 files, 583 tests passed |
| 4 | `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts \|\| exit 1; done` | 0 | 5 次均 3 tests passed |
| 5 | `! grep -qE "= *(resolvedIterable\|queryIterable)\??\.interrupt;" src/runner/claude.ts` | 0 | 无提取模式 |
| 6 | `grep -qE "binds this" test/runner-claude.test.ts` | 0 | 匹配到 |
| 7 | `grep -qE "unhandledRejection" src/run.ts src/cli.ts` | 0 | src/run.ts 三处匹配 |
| 8 | `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts` | 0 | 两个 grep 均命中 |
| 9 | `test "$(grep -cE "livenessFingerprint" test/scenario-g.test.ts)" -ge 2` | 0 | 计数 4 ≥ 2 |
| 10 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | 0 | SDK 仅在 runner/ 内 |

全部 10 条验收命令退出码为 0。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 30 files, 583 passed, exit 0 | ✅ |
| 场景 G 连跑 5 次 | `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts \|\| exit 1; done` | 5/5 通过, exit 0 | ✅ |
| interrupt 不再拆出调用 | `! grep -qE "= *(resolvedIterable\|queryIterable)\??\.interrupt;" src/runner/claude.ts` | exit 0 (无匹配) | ✅ |
| this 绑定有回归测试 | `grep -qE "binds this" test/runner-claude.test.ts` | exit 0 (匹配到 line 376) | ✅ |
| 未处理拒绝有兜底 | `grep -qE "unhandledRejection" src/run.ts src/cli.ts` | exit 0 (run.ts 有 3 处) | ✅ |
| 指纹已注入且看内容 | `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts` | exit 0 | ✅ |
| 场景 G 两个用例都注入了假指纹 | `test "$(grep -cE "livenessFingerprint" test/scenario-g.test.ts)" -ge 2` | count=4 ≥ 2, exit 0 | ✅ |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：`claude.ts` interrupt() 保持 `this`（SPEC 11.2）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 惰性包装的 interrupt 直接在对象上调用 | task 条目 1 | `src/runner/claude.ts:121` — `await resolvedIterable.interrupt();`（直接方法调用，非提取） | ✅ |
| stop('soft') 直接在对象上调用并 await | task 条目 1 | `src/runner/claude.ts:229` — `await queryIterable.interrupt();`（直接调用，使用 await 非 void） | ✅ |
| 回归测试：替身 interrupt 读 this 上的字段 | task 条目 1 | `test/runner-claude.test.ts:400-406` — `if ((this as any).state !== 'running') throw TypeError` | ✅ |
| 测试名含 "binds this" | task 条目 1 | `test/runner-claude.test.ts:376` — `'soft stop binds this: interrupt() that reads this.state works (v02-b04-fix regression)'` | ✅ |
| 不再有 `= ...interrupt;` 提取模式 | task 条目 1 | `grep -qE "= *(resolvedIterable\|queryIterable)\??\.interrupt;" src/runner/claude.ts` 无匹配 | ✅ |

### 条目 2：R2 异常兜底（SPEC 11.3）与阶梯容错（SPEC 11.6）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `run.ts` 最外层 try/finally | SPEC 11.3 | `src/run.ts:356` — `try {` (outermost); `src/run.ts:632` — `catch (outerError)`; `src/run.ts:676` — `finally { process.removeListener... }` | ✅ |
| 异常先记 run.finished(result=error) | SPEC 11.3 | `src/run.ts:639` — `rec.record('run.finished', { result: 'error', error: errorMsg, ...})` | ✅ |
| 救援 | SPEC 11.3 | `src/run.ts:646-651` — `rescueDirtyWorkspace(root, batchId)` in catch block | ✅ |
| 追加 progress | SPEC 11.3 | `src/run.ts:656-668` — `writeProgress` + `commit` in catch block | ✅ |
| 删心跳 | SPEC 11.3 | `src/run.ts:672` — `removeHeartbeat(root)` in catch block | ✅ |
| 退出码 1 | SPEC 11.3 | `src/run.ts:675` — `exitCode: EXIT_CODES.ERROR` (= 1) | ✅ |
| 注册 unhandledRejection | SPEC 11.3 | `src/run.ts:352` — `process.on('unhandledRejection', onUnhandledRejection)` | ✅ |
| 阶梯某级 stop() 抛出时记 error 并进入下一级 | SPEC 11.6 | `src/ladder.ts:51-52` — `catch (error) { ... opts.callbacks.onSignaled(level, opts.reason, msg);`; `src/ladder.ts:57` — `continue;` (skip grace, next level) | ✅ |
| 测试：soft 抛错 → 记 error → 升级 hard | task 条目 2 | `test/ladder.test.ts:168` — `'soft throws → records error field → escalates to hard (SPEC 11.6)'` | ✅ |
| 测试：worker 抛出 → run.finished(error)、心跳已删、进程未直接退出 | task 条目 2 | `test/run-fallback.test.ts:34-35` — `'records run.finished with result=error and deletes heartbeat'`; `test/run-fallback.test.ts:55` — `'does not let the process exit directly'` | ✅ |

### 条目 3：产出指纹（SPEC 11.5）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 指纹 = HEAD + git diff HEAD 哈希 + 未跟踪文件 (路径, 大小, mtime) 哈希 | SPEC 11.5 | `src/ladder.ts:75-96` — `computeFingerprint`: `revParse(root,'HEAD')`, `git(root,['diff','HEAD'])`, `ws.entries.filter(e=>e.code==='??')` 含 `st.size`/`st.mtimeMs`, 全部 SHA-256 | ✅ |
| 可注入 `LivenessConfig.fingerprint?` | SPEC 11.5 | `src/ladder.ts:123` — `fingerprint?: (root: string) => Promise<string>;` | ✅ |
| 默认实现用真实 git | SPEC 11.5 | `src/ladder.ts:152` — `this.fingerprintFn = config.fingerprint ?? computeFingerprint;` | ✅ |
| 场景 G 注入假指纹 | task 条目 3 | `test/scenario-g.test.ts:203` — `livenessFingerprint: fp.livenessFingerprint` (test 1); `test/scenario-g.test.ts:237` — `livenessFingerprint: fp.livenessFingerprint` (test 2) | ✅ |
| 控制三要素（事件、时钟、指纹）全由测试代码顺序控制 | SPEC 11.5 | `test/scenario-g.test.ts:34-42` — fakeClock; `test/scenario-g.test.ts:69-75` — fakeSetTimer; `test/scenario-g.test.ts:88-115` — controllableFingerprint + freeze(); `test/scenario-g.test.ts:173` — `opts.onEnterIdle?.()` 在 idle 阶段前调用 freeze | ✅ |
| 单测：同一文件改两次 → 两次指纹不同 | task 条目 3 | `test/scenario-g.test.ts:256-273` — `'same file modified twice produces different fingerprints'`: writes 'version 2' → fp1, writes 'version 3' → fp2, `expect(fp1).not.toBe(fp2)` | ✅ |
| RunContext 传 livenessFingerprint 到 monitor | SPEC 11.5 | `src/run.ts:109` — `livenessFingerprint?: (root: string) => Promise<string>;`; `src/run.ts:432` — `...(ctx.livenessFingerprint === undefined ? {} : { fingerprint: ctx.livenessFingerprint })` | ✅ |

## 声称与实测的差异

无。本批次只有一个代码提交，diff 只改 `test/scenario-g.test.ts`，完全在条目 3（指纹注入）的范围内。
条目 1 和条目 2 的代码在 base_sha 之前的提交中已实现并通过全部验收。

## 结论与理由

**PASS。**

1. 全部 10 条验收命令实跑退出码为 0，包括场景 G 连跑 5 次稳定通过。
2. 提交 `6fe4d74` 存在且已在 `origin/main` 上。
3. CI 无法取证（无 GITHUB_TOKEN），`ci_conclusion` 记为 `unknown`，`ci_branch_matched` 记为 `null`。
4. 受保护文件零改动，无依赖变化。
5. diff 只改 `test/scenario-g.test.ts`（+57 −3），在条目 3 范围内，无范围蔓延。
6. 三个条目的每一条具体实现要求逐条核对，全部有代码证据：interrupt 直接在对象上调用、
   unhandledRejection 已注册、阶梯容错已实现、指纹可注入且测试用假指纹。
7. 无声称与实测不符。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b04-fix",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["6fe4d740796ebb306be5c5c7a84203103423ab57"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "30 files, 583 tests passed" },
      { "cmd": "for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts || exit 1; done", "exit_code": 0, "summary": "5/5 runs, 3 tests each, all passed" },
      { "cmd": "! grep -qE \"= *(resolvedIterable|queryIterable)\\??\\.interrupt;\" src/runner/claude.ts", "exit_code": 0, "summary": "no extraction pattern found" },
      { "cmd": "grep -qE \"binds this\" test/runner-claude.test.ts", "exit_code": 0, "summary": "matched line 376" },
      { "cmd": "grep -qE \"unhandledRejection\" src/run.ts src/cli.ts", "exit_code": 0, "summary": "3 occurrences in src/run.ts" },
      { "cmd": "grep -qE \"fingerprint\\?:\" src/ladder.ts && grep -qE \"diff\" src/ladder.ts", "exit_code": 0, "summary": "both patterns found" },
      { "cmd": "test \"$(grep -cE \"livenessFingerprint\" test/scenario-g.test.ts)\" -ge 2", "exit_code": 0, "summary": "count=4 >= 2" },
      { "cmd": "! grep -rlE \"@anthropic-ai\" src --include='*.ts' | grep -v '^src/runner/'", "exit_code": 0, "summary": "SDK only in src/runner/" }
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
  "reason": "全部 10 条验收命令实跑通过，三个条目的具体实现要求逐条核对均有代码证据，head_sha 已在 origin/main，无受保护文件改动，无依赖变化，diff 范围在条目 3 之内"
}
```
