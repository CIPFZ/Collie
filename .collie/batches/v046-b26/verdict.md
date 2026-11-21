I now have all the evidence I need. Let me compile the verdict.

# 批次 v046-b26 审核

## 取证过程

### 1. 验收命令逐条实跑

**命令 1: `npm run lint`**
```
> collie@0.1.0 lint
> eslint . && prettier --check .

Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✅

**命令 2: `npm run typecheck`**
```
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```
退出码：0 ✅

**命令 3: `npm test`**
```
 Test Files  71 passed (71)
      Tests  1470 passed (1470)
   Duration  25.71s
```
退出码：0 ✅

**命令 4: `npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts`**
```
 Test Files  5 passed (5)
      Tests  212 passed (212)
   Duration  3.86s
```
退出码：0 ✅

**命令 5: 两组新用例 describe 块存在**
```
grep -qF "runner: api_error stop reason" test/runner-claude.test.ts && grep -qF "queue: api_error counts as a resumable interruption" test/api-error-retry.test.ts
```
退出码：0 ✅

**命令 6: 模板有新配置项，本仓库配置没动**
```
grep -qE "^api_retry_wait_secs = 300" templates/collie.toml && ! grep -qF "api_retry_wait_secs" .collie/collie.toml
```
退出码：0 ✅

**命令 7: 运行器与队列都认得 api_error（非注释行）**
```
grep -vE "^\s*(//|\*|/\*)" src/runner/claude.ts | grep -qF "api_error" && grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "api_error"
```
退出码：0 ✅

**命令 8: 不变量同步**
```
grep -qF "api_error" test/invariants.test.ts
```
退出码：0 ✅

### 2. 提交事实

- 单一代码提交：`4d17147d4f2856474e8bb052878793c07dd38cf7`（`runner: add api_error stop reason and queue retry with wait`）
- 该提交是 `5be0009`（`report(collie): v046-b26`）的祖先，后者为 `origin/main` 的 HEAD，因此代码已推送到远端

### 3. 受保护文件

```
git diff --stat a6e2f42..4d17147 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml 'test/acceptance'
```
输出为空——无受保护文件被修改。

额外禁止文件：
```
git diff --stat a6e2f42..4d17147 -- .github/ eslint.config.js vitest.config.ts package.json src/arbiter.ts src/gate.ts src/evidence.ts src/acceptance.ts src/redcheck.ts src/roles/ src/ladder.ts src/view.ts
```
输出为空——无额外禁止文件被修改。

### 4. 依赖变化

```
git diff a6e2f42..4d17147 -- package.json package-lock.json
```
输出为空——无依赖变化。

### 5. CI

无 GitHub 凭据，无法查询 CI。`ci_conclusion: unknown`，`ci_branch_matched: null`。CI 以 R2 取证为准。

### 6. 行为测试实跑

**`npx vitest run test/runner-claude.test.ts`** → Tests 87 passed (87)

**`npx vitest run test/api-error-retry.test.ts`** → Tests 3 passed (3)

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 71 files, 1470 tests passed | ✅ |
| 运行器、队列、配置的测试通过 | `npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts` | exit 0, 5 files, 212 tests passed | ✅ |
| 两组新用例在 | `grep -qF …` | exit 0 | ✅ |
| 模板有新配置项，本仓库的配置没动 | `grep -qE …` | exit 0 | ✅ |
| 运行器与队列都认得 api_error | `grep -vE … \| grep -qF …` | exit 0 | ✅ |
| 不变量同步 | `grep -qF "api_error" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：运行器读 `terminal_reason`，`stopReason` 加 `api_error`

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `ResultMessage` 接口加 `terminal_reason?: string` | task 条目 1 | `src/runner/claude.ts:196` → `terminal_reason?: string;` | ✅ |
| `RunResult.stopReason` 加 `'api_error'` | task 条目 1 | `src/runner/index.ts:75` → `stopReason?: 'turns_exhausted' \| 'stopped' \| 'api_error' \| 'error';` | ✅ |
| 优先级 `stopped > turns_exhausted > api_error > error` | task 条目 1 | `src/runner/claude.ts:273-286`：先检 `interrupted` → `stopped`；再检 `error_max_turns` → `turns_exhausted`；再检 `terminal_reason === 'api_error'` → `api_error`；最后 `!allSucceeded` → `error` | ✅ |
| 结果消息 `subtype: success`、`is_error: true`、`terminal_reason: api_error` → `exitCode` 非零、`stopReason` 是 `api_error` | task 条目 1 加粗 | `src/runner/claude.ts:270` `allSucceeded` 因 `is_error: true` 为 false → `exitCode = EXIT_FAILED`；行 278-283 匹配 → `'api_error'`。行为测试实跑：`npx vitest run test/runner-claude.test.ts` → Tests 87 passed | ✅ |
| 同样的消息、会话被中止 → `stopped` | task 条目 1 加粗 | `src/runner/claude.ts:274` `if (interrupted) return 'stopped'` 先于 api_error 检查。行为测试实跑：`npx vitest run test/runner-claude.test.ts` → Tests 87 passed（含 "same message but session was interrupted → stopReason is stopped"） | ✅ |
| 出错而没有 `terminal_reason` → 仍是 `error` | task 条目 1 加粗 | `src/runner/claude.ts:280` 要求 `r.terminal_reason === 'api_error'`，没有 `terminal_reason` 则不匹配，falls to 284 `!allSucceeded` → `'error'`。行为测试实跑：`npx vitest run test/runner-claude.test.ts` → Tests 87 passed（含 "error result without terminal_reason → stopReason is error"） | ✅ |

### 条目 2：`api_retry_wait_secs` 配置、队列自动续跑等待

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `[limits]` 加 `api_retry_wait_secs`，非负整数，缺省 300 | task 条目 2 | `src/schema/index.ts:160-166` → `z.number().int().nonnegative().optional().default(DEFAULT_API_RETRY_WAIT_SECS)` 且 `DEFAULT_API_RETRY_WAIT_SECS = 300`（行 55） | ✅ |
| 模板写 `api_retry_wait_secs = 300` 带一行注释 | task 条目 2 | `templates/collie.toml:48-49` → 注释 + `api_retry_wait_secs = 300` | ✅ |
| `.collie/collie.toml` 不许动 | task 条目 2 | `diff` 为空，`grep -qF "api_retry_wait_secs" .collie/collie.toml` 返回非零 | ✅ |
| `api_error` 加入中断自动续跑集合 | task 条目 2 | `src/run.ts:3205-3210` → `INTERRUPT_STOP_REASONS` 包含 `'api_error'` | ✅ |
| 只有 `api_error` 在续跑前等 `api_retry_wait_secs` | task 条目 2 | `src/run.ts:3220-3224` → `if (outcome.workerStopReason === 'api_error')` 才等待 | ✅ |
| `batch.retried` 多带 `waited_secs` | task 条目 2 | `src/run.ts:3230` → `...(waitedSecs > 0 ? { waited_secs: waitedSecs } : {})` | ✅ |
| `QueueContext` 加可选 `retryDelay(ms)` | task 条目 2 | `src/run.ts:2834` → `retryDelay?: (ms: number) => Promise<void>;` | ✅ |
| 缺省真实等待 | task 条目 2 | `src/run.ts:3222` → `const delayFn = ctx.retryDelay ?? realDelay;`，`realDelay` 在行 445 用 `setTimeout` | ✅ |
| `src/cli.ts` 只做转发 | task 条目 2 | `src/cli.ts:87-88` 声明字段，`src/cli.ts:278` 转发 | ✅ |
| v046-b22 收尾在所有自动重跑判断之后 | task 条目 2 | `src/run.ts:3253` `batchCleanup` 在 BLOCK 路径上，位于自动续跑 `continue`（行 3247）之后 | ✅ |
| 第 1 次 `api_error`→ 等 300000ms → 自动重跑 → PASS → exit 0 | task 条目 2 加粗 | 行为测试实跑：`npx vitest run test/api-error-retry.test.ts` → Tests 3 passed（含 "api_error first time…waits 300s…exit 0"） | ✅ |
| 重跑又 `api_error` → 不再重跑 → blocked → exit 20 | task 条目 2 加粗 | 行为测试实跑：同上，含 "api_error retry also fails…no second retry…exit 20" | ✅ |
| `idling` 重跑不等，等待函数没有被调用 | task 条目 2 加粗 | 行为测试实跑：同上，含 "idling first → retry does NOT wait, retryDelay never called" | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `test/runner-claude.test.ts` 新加 `describe('runner: api_error stop reason', …)` 含 3 种情形 | task 条目 3 | `test/runner-claude.test.ts:1586` 有该 describe，3 个 `it()` 覆盖 api_error→api_error、interrupted+api_error→stopped、no terminal_reason→error | ✅ |
| 新文件 `test/api-error-retry.test.ts` 含对应 describe | task 条目 3 | 文件存在，行 1 有 `describe('queue: api_error counts as a resumable interruption', …)`，3 个 `it()` 覆盖 task 加粗情形 | ✅ |
| 假 worker 直接给 `stopReason: 'api_error'` | task 条目 3 | `test/api-error-retry.test.ts:62` → `result: { exitCode: 1, stopReason: 'api_error' }` | ✅ |
| 允许改写的旧用例只有 config.test.ts 的期望对象加 `api_retry_wait_secs: 300`、VALID_TOML 加一行；schema.test.ts 夹具加一项 | task 条目 3 | diff 确认 `test/config.test.ts` 两处各加了一行 `api_retry_wait_secs: 300`；`test/schema.test.ts` 加了一行 `api_retry_wait_secs: 300` | ✅ |
| `test/invariants.test.ts` 加 `api_error` | task 条目 3 | `test/invariants.test.ts` diff 添加了 `it('src/run.ts has api_error (v046-b26)', …)` | ✅ |
| `test/scenario-n.test.ts` 未被修改 | task 条目 3 | `git diff` 为空 | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径（含 `.collie/collie.toml`） | 额外禁止 | `git diff --stat` 为空 | ✅ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --stat` 为空 | ✅ |
| 不改 `src/arbiter.ts` 等禁止文件 | 额外禁止 | `git diff --stat` 为空 | ✅ |
| 不让一个批次在一次队列里被自动续跑超过一次 | 额外禁止 | `src/run.ts:3215` `interruptRetried.has(currentBatchId)` 确保每批次只续跑一次 | ✅ |
| 不在测试里真的等待 | 额外禁止 | 测试注入 `retryDelay` 立即返回，不用 `realDelay` | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | diff 无删除断言 | ✅ |
| 不改写条目 3 点名之外的已有断言 | 额外禁止 | diff 仅添加内容，未删改 runner-claude 或 scenario-n 的已有断言 | ✅ |
| 不新增依赖 | 额外禁止 | package.json 和 lock 文件无变化 | ✅ |
| 不拉起真实 runner 或网络请求 | 额外禁止 | 新测试用 FakeRunner | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增了一个测试用例，未修改任何已有数值上下限。

### 被改写或删去的断言

无。diff 中所有测试文件的修改都是纯添加（`+` 行），没有删除或修改任何已有的 `expect(...)` 断言。

## 结论与理由

全部 8 条验收命令实跑通过。条目 1 的三种情形在 `test/runner-claude.test.ts` 的新 describe 块中有对应测试且全部通过（87 passed）。条目 2 的三种加粗情形在 `test/api-error-retry.test.ts` 中有对应测试且全部通过（3 passed）。配置、模式、模板的改动正确且范围严格限定。受保护文件无变动，无新增依赖，无禁止文件被改动。代码提交已推送到远端（作为 `origin/main` 的 HEAD `5be0009` 的祖先）。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b26",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["4d17147d4f2856474e8bb052878793c07dd38cf7"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "71 files, 1470 tests passed" },
      { "cmd": "npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts", "exit_code": 0, "summary": "5 files, 212 tests passed" },
      { "cmd": "grep -qF 'runner: api_error stop reason' test/runner-claude.test.ts && grep -qF 'queue: api_error counts as a resumable interruption' test/api-error-retry.test.ts", "exit_code": 0, "summary": "both describe blocks found" },
      { "cmd": "grep -qE '^api_retry_wait_secs = 300' templates/collie.toml && ! grep -qF 'api_retry_wait_secs' .collie/collie.toml", "exit_code": 0, "summary": "template has config, repo config unchanged" },
      { "cmd": "grep -vE '^\\s*(//|\\*|/\\*)' src/runner/claude.ts | grep -qF 'api_error' && grep -vE '^\\s*(//|\\*|/\\*)' src/run.ts | grep -qF 'api_error'", "exit_code": 0, "summary": "api_error in non-comment lines of both files" },
      { "cmd": "grep -qF 'api_error' test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 8 acceptance commands pass. Three runner scenarios (api_error, interrupted+api_error, error without terminal_reason) tested and passing. Three queue scenarios (api_error→wait→retry→PASS, double api_error→blocked, idling→no wait) tested and passing. Schema, template, CLI forwarding, and invariant all correct. No protected files modified, no forbidden files touched, no new dependencies, no existing assertions deleted or loosened."
}
```
