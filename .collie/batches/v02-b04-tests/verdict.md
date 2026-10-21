I now have all the evidence. Let me compile the full verdict.

---

# 批次 v02-b04-tests 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline b70da47..2661d0e
2661d0e test: replace real timers with injected fakes, ESLint beforeAll (v02-b04-tests)
```

仅一个提交，在取证范围内。

```
$ git branch --contains 2661d0ee0927f4da664bb197074c371fd9a75868 -a
* (no branch)
+ main
  remotes/origin/HEAD -> origin/main
  remotes/origin/main
```

```
$ git ls-remote origin refs/heads/main
5dba8ce8db8792687c39d6ba4348033f9b4e58dc  refs/heads/main
```

提交 `2661d0e` 在 `main` 上，`origin/main` 指向其后续的 report 提交 `5dba8ce`，说明已推送。

### 2. diff 范围

```
$ git diff --stat b70da47..2661d0e
 test/reviewer-isolation.test.ts | 10 +++++++---
 test/scenario-g.test.ts         | 38 +++++++++++++++++++---
 2 files changed, 32 insertions(+), 16 deletions(-)
```

仅修改两个测试文件，与 task.md 条目范围一致。未触碰 `src/` 或任何其他目录。

### 3. 受保护路径检查

```
$ git diff --stat b70da47..2661d0e -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(空输出)
```

受保护文件未被修改。diff 行数 = 0。

### 4. 依赖变化

```
$ git diff b70da47..2661d0e -- package.json package-lock.json
(空输出)
```

无依赖变化。

### 5. src/ 变化

```
$ git diff b70da47..2661d0e -- src/
(空输出)
```

确认未改动 `src/`。

### 6. CI 分支配置核对

`.github/workflows/ci.yml` 第 6 行：`branches: [main]`。提交在 `main` 分支上且已推送。分支匹配。
（注：本环境无 GH 认证令牌，无法查询实际 CI run URL 与 conclusion。但配置监听分支正确。）

### 7. 跳过测试检查

```
$ grep -nE "skip|\.todo" test/scenario-g.test.ts test/ladder.test.ts test/reviewer-isolation.test.ts
(无匹配，EXIT_CODE=1)
```

无测试被 skip 或标记 todo。

### 8. 验收命令逐条实跑

见下方「逐条验收」表。

### 9. 源码注入链路验证

v02-b04 的教训是"只注入了 `now`，定时器仍是真实的"。本批次的关键在于 `livenessSetTimer` 是否真正替代了 `setTimeout`。实跑 grep 确认：

- `src/ladder.ts:110`: `this.setTimerFn = config.setTimer ?? ((cb, ms) => setTimeout(cb, ms));` — 有注入点，带 `setTimeout` 默认回退
- `src/ladder.ts:137`: `this.timer = this.setTimerFn(...)` — 实际调度用的是注入函数，不是直接 `setTimeout`
- `src/run.ts:412`: `...(ctx.livenessSetTimer === undefined ? {} : { setTimer: ctx.livenessSetTimer })` — run 层传递
- `test/scenario-g.test.ts:150,182`: `livenessSetTimer: fakeSetTimer` — 测试注入

注入链完整：`fakeSetTimer` → `Sandbox.run(extra)` → `CliDeps.livenessSetTimer` → `RunContext.livenessSetTimer` → `LivenessConfig.setTimer` → `LivenessMonitor.setTimerFn` → `scheduleCheck()` 中使用。

`fakeSetTimer`（scenario-g.test.ts:70-75）通过 `Promise.resolve().then(cb)` 在微任务队列中触发回调，无真实定时器。

### 10. ladder.test.ts 合规性验证

ladder.test.ts **未被修改**。原因是它已经合规：
- 测试 `runLadder()` 函数，该函数接受 `delay` 参数（而非 `livenessNow` / `livenessSetTimer`）
- 已使用 `instantDelay()` 注入假延迟（line 44-56）
- 文件中无 `setInterval` 或 `setTimeout(` 调用（仅 line 168 测试名字符串中出现 `setTimeout` 无括号，不匹配验收 grep 模式）
- 断言仅检查 `stops`/`signals` 数组（事件序列），不检查耗时

Base 版本 grep 确认：`grep -nE "setInterval|setTimeout" test/ladder.test.ts` → 仅 line 168 测试名字符串。无可执行的真实定时器。

---

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0；eslint + prettier 均通过 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0；tsc 无错误 | ✅ |
| 全部测试通过 | `npm test` | exit 0；29 test files, 574 tests passed, 6.77s | ✅ |
| 场景 G 无真实定时器 | `! grep -qE "setInterval\|setTimeout\(" test/scenario-g.test.ts` | exit 0（仅类型注释中出现 `ReturnType<typeof setTimeout>`，无括号不匹配） | ✅ |
| ladder 无真实定时器 | `! grep -qE "setInterval\|setTimeout\(" test/ladder.test.ts` | exit 0（仅测试名字符串中出现 `setTimeout`，无括号不匹配） | ✅ |
| 场景 G 注入了定时器 | `grep -qE "livenessSetTimer" test/scenario-g.test.ts` | exit 0；lines 150, 182 注入 `livenessSetTimer: fakeSetTimer` | ✅ |
| ESLint 只建一次 | `grep -qE "beforeAll" test/reviewer-isolation.test.ts` | exit 0；line 156 `beforeAll` | ✅ |
| 未改动 src | `test -z "$(git log ...)" \|\| git diff --quiet ...` | exit 0 | ✅ |

---

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| scenario-g 注入 `livenessNow` | task.md 条目 1 | `test/scenario-g.test.ts:149` `livenessNow: clock.now,` 和 `:181` 同 | ✅ |
| scenario-g 注入 `livenessSetTimer` | task.md 条目 1 | `test/scenario-g.test.ts:150` `livenessSetTimer: fakeSetTimer,` 和 `:182` 同 | ✅ |
| fake worker 发事件改为由假时钟驱动（非 setInterval） | task.md 条目 1 | `test/scenario-g.test.ts:129-131` `for (let i = 0; i < 10; i++) { ctx.opts.onEvent?.(...)` 替代了旧的 `setInterval`；diff 确认 `setInterval` 和 `clearInterval` 已删除 | ✅ |
| 不再有 `setTimeout(r, 0)` | task.md 条目 1 | `test/scenario-g.test.ts:55` `await Promise.resolve();` 替代旧的 `new Promise<void>(r => { setTimeout(r, 0) })`；diff 确认 | ✅ |
| ladder.test.ts 无真实定时器 | task.md 条目 1 | `ladder.test.ts` 全文 grep 无 `setInterval` 或 `setTimeout(`；line 44-56 使用 `instantDelay()` 注入假延迟 | ✅ |
| 断言只看事件序列不看耗时 | task.md 条目 1 | `test/scenario-g.test.ts:154` `expect(exitCode).toBe(20)`; `:157-172` 检查 `events.map(e=>e.event)` 和 `worker.signaled` 匹配对象；无 wall-clock 断言 | ✅ |
| ESLint 实例移到 `beforeAll` 只建一次 | task.md 条目 2 | `test/reviewer-isolation.test.ts:154` `let eslint: ESLint;` 和 `:156-158` `beforeAll(() => { eslint = new ESLint({ cwd: repoRoot }); });` | ✅ |
| 给 ESLint 用例显式 `timeout`（60 秒） | task.md 条目 2 | `test/reviewer-isolation.test.ts:171` `}, 60_000);` | ✅ |
| 不改测试的断言内容 | task.md 条目 2 | `test/reviewer-isolation.test.ts:170` 断言仍为 `expect((result?.messages ?? []).map((m) => m.ruleId)).toContain('no-restricted-imports');` 与 base 版本一致 | ✅ |
| 禁止改动 `src/` | task.md 额外禁止 | `git diff b70da47..2661d0e -- src/` 为空 | ✅ |
| 禁止改动受保护路径 | task.md 额外禁止 | `git diff --stat` 对全部受保护路径为空 | ✅ |
| 禁止删除或跳过测试 | task.md 额外禁止 | grep `skip\|.todo` 无匹配；29 test files / 574 tests 全部通过 | ✅ |
| `livenessSetTimer` 实际替代了真实 `setTimeout` | reviewer manual v02-b04 教训 | `src/ladder.ts:137` 使用 `this.setTimerFn()`；`:110` 默认 `setTimeout` 被测试注入覆盖；`fakeSetTimer`（scenario-g:70-75）通过 `Promise.resolve().then(cb)` 触发 | ✅ |

---

## 声称与实测的差异

无。diff 范围、文件变更、验收命令结果均与预期一致。

---

## 结论与理由

**PASS。**

全部 8 条验收命令实跑通过。条目 1 的两个文件均已去除真实定时器：scenario-g.test.ts 注入了 `livenessNow` 和 `livenessSetTimer`，`setTimeout(r,0)` 改为 `await Promise.resolve()`，`setInterval` 事件循环改为 `for` 循环；ladder.test.ts 在本批次前已合规（直接测试 `runLadder` 函数，已使用 `instantDelay()` 注入假延迟）。条目 2 的 `ESLint` 实例移至 `beforeAll` 只建一次，用例显式 timeout 60s，断言内容未变。未修改 `src/`、受保护文件、或依赖。未跳过或删除任何测试。提交已推送至 origin/main。CI 配置监听 `main` 分支与实际分支一致。

特别验证了 v02-b04 审核手册提到的教训——确认 `livenessSetTimer` 在源码中完整替代了真实 `setTimeout`（`src/ladder.ts:137` 使用 `setTimerFn` 而非直接调用 `setTimeout`），测试注入的 `fakeSetTimer` 通过微任务队列触发回调，无真实定时器泄漏。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b04-tests",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["2661d0ee0927f4da664bb197074c371fd9a75868"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier 零错误" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc 零错误" },
      { "cmd": "npm test", "exit_code": 0, "summary": "29 files, 574 tests passed, 6.77s" },
      { "cmd": "! grep -qE \"setInterval|setTimeout\\(\" test/scenario-g.test.ts", "exit_code": 0, "summary": "无真实定时器调用（仅类型注释中 ReturnType<typeof setTimeout>）" },
      { "cmd": "! grep -qE \"setInterval|setTimeout\\(\" test/ladder.test.ts", "exit_code": 0, "summary": "无真实定时器调用（仅测试名字符串中 setTimeout 无括号）" },
      { "cmd": "grep -qE \"livenessSetTimer\" test/scenario-g.test.ts", "exit_code": 0, "summary": "lines 150, 182 注入 fakeSetTimer" },
      { "cmd": "grep -qE \"beforeAll\" test/reviewer-isolation.test.ts", "exit_code": 0, "summary": "line 156 beforeAll 中建 ESLint 实例" },
      { "cmd": "test -z \"$(git log ...)\" || git diff --quiet ... -- src/", "exit_code": 0, "summary": "src/ 无变化" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "cannot_verify_no_gh_auth",
    "ci_run_url": "",
    "ci_branch_matched": true,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "全部验收命令通过；livenessSetTimer 注入链完整验证；ladder.test.ts 已在本批次前合规；ESLint beforeAll + 60s timeout 符合要求；无 src/ 或受保护文件变更；无跳过的测试；提交已推送"
}
```
