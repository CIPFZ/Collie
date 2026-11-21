I have all the evidence I need. Let me compile the verdict.

# 批次 v046-b27 审核

## 取证过程

### 1. 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | `All matched files use Prettier code style!` |
| 2 | `npm run typecheck` | 0 | 无错误 |
| 3 | `npm test` | 0 | `Test Files 70 passed (70)`, `Tests 1459 passed (1459)` |
| 4 | `npm test -- test/preflight.test.ts test/cli.test.ts test/scenario-m.test.ts test/follow.test.ts` | 0 | `Test Files 4 passed (4)`, `Tests 76 passed (76)` |
| 5 | `grep -qF "preflight: runner check judges the exit code" test/preflight.test.ts && grep -qF "smoke exits 1 when the runner returns a non-zero exit code" test/cli.test.ts` | 0 | 静默成功 |
| 6 | `grep -vE "^\s*(//\|\*\|/\*)" src/cli.ts \| grep -qF "smoke failed" && grep -vE "^\s*(//\|\*\|/\*)" src/preflight.ts \| grep -qF "stopReason"` | 0 | 静默成功 |

### 2. 提交事实

- 单一提交：`00e6cec188ff9c228976ffc82bff271d6ed6b2c4` — `cli: preflight runner check judges exit code, smoke fails on non-zero (SPEC 14.33)`
- `git merge-base --is-ancestor 00e6cec1... 078a6d69...` 确认该提交是远端 main 的祖先，已推送。

### 3. CI 结论

无 GitHub 凭据，无法查询。`ci_conclusion` 填 `unknown`，`ci_branch_matched` 填 `null`。CI 以 R2 取证为准。

### 4. 受保护文件

`git diff --stat <base>..<head> -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance` — 无输出，无受保护文件被修改。

### 5. 额外禁止路径

`git diff --stat <base>..<head> -- .github/ eslint.config.js vitest.config.ts package.json templates/collie.toml src/run.ts src/follow.ts src/runner/ src/schema/index.ts` — 无输出，均未被修改。

### 6. 依赖变化

`git diff --stat <base>..<head> -- package.json package-lock.json` — 无输出，无依赖变化。

### 7. 修改范围

仅 4 个文件：`src/cli.ts`、`src/preflight.ts`、`test/cli.test.ts`、`test/preflight.test.ts`。全部在 task.md 条目范围内。

### 8. 行为要求实跑

`npx vitest run test/preflight.test.ts` — `Test Files 1 passed (1)`, `Tests 15 passed (15)`
`npx vitest run test/cli.test.ts` — `Test Files 1 passed (1)`, `Tests 22 passed (22)`

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 70 files, 1459 tests | ✅ |
| 两条命令与用到它们的测试通过 | `npm test -- test/preflight.test.ts test/cli.test.ts test/scenario-m.test.ts test/follow.test.ts` | exit 0, 4 files, 76 tests | ✅ |
| 新的一组与新的一条在 | `grep -qF …` | exit 0 | ✅ |
| 两条命令都有了不过的说法 | `grep -vE … \| grep -qF …` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1（preflight.ts runner 检查）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 退出码非零 → `ok` 为 false | task 条目 1 | `src/preflight.ts:167` — `const ok = result.exitCode === 0;` | ✅ |
| `detail` 是 `exitCode=<N>` | task 条目 1 | `src/preflight.ts:168` — `` const parts = [`exitCode=${String(result.exitCode)}`]; `` | ✅ |
| 有 `stopReason` 时加 ` stopReason=<原因>` | task 条目 1 | `src/preflight.ts:169` — `if (result.stopReason !== undefined) parts.push(\`stopReason=${result.stopReason}\`);` | ✅ |
| detail 末尾加 `secs=<用时秒数，取整>` | task 条目 1 | `src/preflight.ts:170` — `` parts.push(`secs=${String(secs)}`); `` 其中 secs 为 `Math.round((now() - t0) / MS_PER_SEC)` (line 166) | ✅ |
| 通过与不过的 detail 都加 `secs=` | task 条目 1 | `src/preflight.ts:166-171` — `secs` 计算和 `parts.push` 在 `ok` 判断之后、return 之前，对 exitCode=0 和 exitCode≠0 都执行 | ✅ |
| 用时经可注入的时钟算（缺省真实时钟） | task 条目 1 | `src/preflight.ts:44` — `now?: () => number;`，`src/preflight.ts:217` — `const nowFn = opts.now ?? Date.now;`，传入 `checkRunner` at line 225 | ✅ |
| 运行器抛错时照旧不过，detail 是错误信息 | task 条目 1 | `src/preflight.ts:172-174` — catch 块 `return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };` 未改动 | ✅ |
| 假运行器 exitCode:1 stopReason:'error' → FAIL runner 行开头 | task 条目 1（行为） | `npx vitest run test/preflight.test.ts` — `Tests 15 passed`；test at line 202-221 断言 `expect(out).toContain('FAIL runner: exitCode=1 stopReason=error')` | ✅ |
| exitCode:0 → 行以 `ok   runner: exitCode=0` 开头带 `secs=` | task 条目 1（行为） | `npx vitest run test/preflight.test.ts` — `Tests 15 passed`；test at line 223-238 断言 `expect(out).toContain('ok   runner: exitCode=0 secs=5')` | ✅ |
| --json 中该项 ok 是 false | task 条目 1（行为） | `npx vitest run test/preflight.test.ts` — `Tests 15 passed`；test at line 267-284 断言 `expect(runnerCheck?.ok).toBe(false)` | ✅ |
| 末行是 `preflight: failed (runner)` | task 条目 1（行为） | 同上；test at line 220 `expect(out).toMatch(/preflight: failed.*runner/)` | ✅ |
| 命令退出码非零 | task 条目 1（行为） | 同上；test at line 216 `expect(code).toBe(1)` | ✅ |

### 条目 2（cli.ts collie smoke）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 退出码非零 → stderr 写 `smoke failed: exitCode=<N>` | task 条目 2 | `src/cli.ts:487` — `` deps.err(`smoke failed: ${parts.join(' ')}\n`); `` | ✅ |
| 有 stopReason 时带上 | task 条目 2 | `src/cli.ts:486` — `if (result.stopReason !== undefined) parts.push(\`stopReason=${result.stopReason}\`);` | ✅ |
| 退出码 1 | task 条目 2 | `src/cli.ts:488` — `return EXIT_CODES.ERROR;` (early return before smoke ok) | ✅ |
| 不再去查 CI | task 条目 2 | `src/cli.ts:488` returns before CI query block at line 499+ | ✅ |
| 标准输出里没有 `smoke ok` | task 条目 2 | `src/cli.ts:488` early return before line 490 `smoke ok` output | ✅ |
| 假运行器 exitCode:1 → 行为验证 | task 条目 2（行为） | `npx vitest run test/cli.test.ts` — `Tests 22 passed`；test at line 209-226 断言 `expect(code).toBe(1)`, `expect(output).toContain('smoke failed: exitCode=1')`, `expect(output).not.toContain('smoke ok')`, `expect(ciQueried).toBe(false)` | ✅ |

### 条目 3（测试）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新 describe 'preflight: runner check judges the exit code' | task 条目 3 | `test/preflight.test.ts:191` — `describe('preflight: runner check judges the exit code', () => {` | ✅ |
| 新 it 'smoke exits 1 when the runner returns a non-zero exit code' | task 条目 3 | `test/cli.test.ts:209` — `it('smoke exits 1 when the runner returns a non-zero exit code', async () => {` | ✅ |
| secs= 用注入的时钟让它是确定的数 | task 条目 3 | `test/preflight.test.ts:207-211` clock returns 0 then 3000; `test/preflight.test.ts:225-230` clock returns 0 then 5000; `test/preflight.test.ts:242-247` clock returns 0 then 1000。测试里无真实等待。 | ✅ |
| 已有断言一条都不改 | task 条目 3 | `git diff <base>..<head> -- test/` 中无 `^-.*expect` 行，无已有断言被删除或修改 | ✅ |

### 额外禁止

| 禁止 | 出处 | 证据 | 遵守 |
|---|---|---|---|
| 改动任何受保护路径 | task 额外禁止 | diff --stat 确认无变动 | ✅ |
| 改动 .github/、eslint.config.js 等 | task 额外禁止 | diff --stat 确认无变动 | ✅ |
| 改动 src/run.ts、src/follow.ts、src/runner/、src/schema/index.ts | task 额外禁止 | diff --stat 确认无变动 | ✅ |
| 改动 preflight 别的检查项 | task 额外禁止 | diff 仅改动 `checkRunner` 函数和 `runPreflight` 中 `nowFn` 注入，其余检查项不变 | ✅ |
| 给用时加阈值或新配置项 | task 额外禁止 | 无新阈值或配置项 | ✅ |
| 在 detail 里写出模型回复全文、token 或绝对路径 | task 额外禁止 | detail 只含 exitCode、stopReason、secs | ✅ |
| 为让测试过而删除或跳过测试 | task 额外禁止 | 无删除或跳过 | ✅ |
| 改写任何已有断言 | task 额外禁止 | diff 中无已有断言变动 | ✅ |
| 为让验收命令通过而改注释或字面 | task 额外禁止 | 无注释改动用于凑验收 | ✅ |
| 测试里拉起真实 runner 或网络请求 | task 额外禁止 | 测试用 FakeRunner 和 fetchSpy | ✅ |
| 测试里真的等待 | task 额外禁止 | 测试用注入时钟，无 setTimeout/sleep | ✅ |
| 新增依赖 | task 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 未被修改。

### 被改写或删去的断言

无。diff 中所有 test 文件的变化均为纯新增（+153 行），无任何 `-` 行涉及 `expect`。

## 结论与理由

全部 6 条验收命令实跑通过。条目 1-3 的结构要求和行为要求逐条核对均满足。无受保护文件被修改，无依赖变化，无范围蔓延（仅改动 4 个在条目范围内的文件），无额外禁止被违反。实现干净、精准，测试覆盖了 exitCode 非零+有 stopReason、exitCode 零、exitCode 非零无 stopReason、runner 抛错、--json 格式 5 种情形，且 secs 均使用注入时钟保证确定性。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b27",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["00e6cec188ff9c228976ffc82bff271d6ed6b2c4"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "70 files, 1459 tests passed" },
      { "cmd": "npm test -- test/preflight.test.ts test/cli.test.ts test/scenario-m.test.ts test/follow.test.ts", "exit_code": 0, "summary": "4 files, 76 tests passed" },
      { "cmd": "grep -qF \"preflight: runner check judges the exit code\" test/preflight.test.ts && grep -qF \"smoke exits 1 when the runner returns a non-zero exit code\" test/cli.test.ts", "exit_code": 0, "summary": "both names found" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/cli.ts | grep -qF \"smoke failed\" && grep -vE \"^\\s*(//|\\*|/\\*)\" src/preflight.ts | grep -qF \"stopReason\"", "exit_code": 0, "summary": "both strings in non-comment code" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 6 acceptance commands pass. Implementation correctly adds exit-code judgement and secs= timing to preflight runner check, and smoke-failed early-exit to cli smoke. Tests use injected clocks, no real waiting, no existing assertions modified. No protected files or forbidden paths touched. CI status unknown — deferred to R2."
}
```
