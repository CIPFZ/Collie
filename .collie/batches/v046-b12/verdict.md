Good. The `createTestTree()` now uses `collie-rc-tree-` prefix instead of `collie-redcheck-`. Each test case checks for `collie-redcheck-*` leftovers in the private tmpdir — this is the correct check since it asserts that the redcheck function (which uses `collie-redcheck-` prefix internally) cleans up after itself. The `collie-accept-*` leftover check was restored in `test/prepare-acceptance.test.ts` at line 691.

Let me now compile all findings and write the verdict.

# 批次 v046-b12 审核

## 取证过程

### 1. 受保护文件

```
git diff --stat d0df1a1..dbc2f96 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护文件无任何修改。

### 2. 额外禁止路径

```
git diff d0df1a1..dbc2f96 -- src/run.ts src/redcheck.ts src/ladder.ts src/evidence.ts 'src/runner/' 'src/schema/index.ts' 'test/support/sandbox.ts' .github/ eslint.config.js vitest.config.ts package.json AGENT-tester.md
```
结果：无输出。禁止修改的文件全部未动。

### 3. 依赖变化

```
git diff d0df1a1..dbc2f96 -- package.json package-lock.json
```
结果：无输出。无新增依赖。

### 4. 提交事实

```
git rev-parse dbc2f9636f7da1f8fc9742077297bf39715d9147 → dbc2f9636f7da1f8fc9742077297bf39715d9147
git rev-parse bf740641b1be92cac4ace2fb6f78dfe74e1e36f6 → bf740641b1be92cac4ace2fb6f78dfe74e1e36f6
```
两个提交均存在。
`git ls-remote origin` 未找到这两个 sha（CI 以 R2 取证为准）。

### 5. 验收命令实跑

#### 命令 1: `npm run lint`
退出码：0。输出 "All matched files use Prettier code style!"

#### 命令 2: `npm run typecheck`
退出码：0。

#### 命令 3: `npm test`
退出码：0。Test Files 64 passed (64), Tests 1351 passed (1351)。

#### 命令 4: `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts test/redcheck.test.ts`
退出码：0。Test Files 3 passed (3), Tests 78 passed (78)。

#### 命令 5: 全局 git 配置开了签名的测试
```
e=$(mktemp) && printf '[commit]\n\tgpgsign = true\n[user]\n\tsigningkey = 0000000000000000\n' > "$e" && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts
```
退出码：0。Test Files 1 passed (1), Tests 24 passed (24)。

#### 命令 6: 三组新用例在
```
grep -qF "prepareAcceptance: tester events, signal and misclassified list" test/prepare-acceptance.test.ts && grep -qF "tester: run options are forwarded" test/tester.test.ts && grep -qF "runRedCheck: leaves nothing behind" test/redcheck.test.ts
```
退出码：0。

#### 命令 7: 事件字段改了名
```
grep -vE "^\s*(//|\*|/\*)" src/acceptance.ts | grep -qF "exit_code" && ! grep -vE "^\s*(//|\*|/\*)" src/acceptance.ts | grep -qF "exitCode: result.exitCode"
```
退出码：0。

#### 命令 8: 队列还没有用它
```
! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"
```
退出码：0。

#### 命令 9: 不变量同步
```
grep -qF "onTesterEvent" test/invariants.test.ts
```
退出码：0。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 64 files, 1351 tests | ✅ |
| 三个文件的测试通过 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts test/redcheck.test.ts` | exit 0, 3 files, 78 tests | ✅ |
| 全局 git 配置开了签名 | `e=$(mktemp) && ... npm test -- test/prepare-acceptance.test.ts` | exit 0, 24 tests | ✅ |
| 三组新用例在 | grep 三次 | exit 0 | ✅ |
| 事件字段改了名 | grep exit_code + !grep exitCode: result.exitCode | exit 0 | ✅ |
| 队列还没有用它 | !grep acceptance.js in run.ts | exit 0 | ✅ |
| 不变量同步 | grep onTesterEvent | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：runTester 加 opts、tester.started/finished 字段、signal/onTesterEvent/redact

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `runTester` 加第五个可选参数 `opts`：`signal`、`onEvent`、`redact` | 条目 1 | `src/roles/tester.ts:166-170`：`opts: { signal?: AbortSignal; onEvent?: (event: unknown) => void; redact?: readonly string[]; } = {}` | ✅ |
| opts 原样交给运行器，写法照 `runReviewer` | 条目 1 | `src/roles/tester.ts:187-189`：与 `src/roles/reviewer.ts:163-165` 写法一致（spread 条件同构） | ✅ |
| `prepareAcceptance` opts 加 `signal`、`onTesterEvent`、`redact` | 条目 1 | `src/acceptance.ts:76-80`：三个可选字段声明 | ✅ |
| signal/onTesterEvent/redact 交给 `runTester` | 条目 1 | `src/acceptance.ts:208-218`：runTester 调用传入 signal、onEvent wrapper、redact | ✅ |
| signal 已中止时不再拉起下一次，按 `tester_failed` 结束 | 条目 1 | `src/acceptance.ts:179-184`：`if (opts.signal?.aborted === true) { lastFailReason = 'tester_failed'; ... break; }`；测试 `npx vitest run test/prepare-acceptance.test.ts`：Tests 24 passed | ✅ |
| `tester.started` 字段：`attempt`、`model`、`max_turns` | 条目 1 | `src/acceptance.ts:199-203`：`record?.('tester.started', { attempt: attempts, ...(testerCfg !== undefined ? { model: testerCfg.model } : {}), ...(testerCfg !== undefined ? { max_turns: testerCfg.max_turns } : {}) })` | ✅ |
| `tester.finished` 字段：`attempt`、`exit_code`、`num_turns`、`cost_usd`、`duration_ms`、`usage`，写法照 `src/run.ts` 的 `reviewer.finished` | 条目 1 | `src/acceptance.ts:220-240`：结构与 `src/run.ts:1835-1854` 完全同构 | ✅ |
| `exitCode` 改名为 `exit_code` | 条目 1 | `src/acceptance.ts:222`：`exit_code: result.exitCode`；grep 验证非注释行无 `exitCode: result.exitCode` | ✅ |
| **行为：假测试 agent 返回 numTurns:7, costUsd:0.5 → tester.finished 有 exit_code:0, num_turns:7, cost_usd:0.5，无 exitCode 键** | 条目 1 加粗 | `npx vitest run test/prepare-acceptance.test.ts`：Tests 24 passed。测试用例 "tester.finished has exit_code, num_turns, cost_usd and no exitCode key; events go through onTesterEvent" 通过 | ✅ |
| **行为：每次拉起的事件都经 onTesterEvent 送出，第一个参数是第几次** | 条目 1 加粗 | 同上测试通过，断言 `testerEvents[0]?.attempt).toBe(1)` 和 `testerEvents).toHaveLength(1)` | ✅ |

### 条目 2：misclassified 的 {id,why} 格式化

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 数组项可以是字符串或 `{id,why}`；字符串原样，对象转成 `<id>：<why>` | 条目 2 | `src/acceptance.ts:110-119`：`if (typeof item === 'string') return item; ... return \`${o.id}：${o.why}\`` | ✅ |
| 失败返回值加 `misclassified`（字符串数组） | 条目 2 | `src/acceptance.ts:49-50`：`misclassified: string[]`；`src/acceptance.ts:290`：早返时带上；`src/acceptance.ts:306`：最终返回时带上 | ✅ |
| 没有声明时是空数组 | 条目 2 | `src/acceptance.ts:174`：`const lastMisclassified: string[] = []`；`src/acceptance.ts:306`：`misclassified: lastMisclassified` | ✅ |
| **行为：JSON 里 `{id:"S1",why:"已有行为"}` → 返回 `['S1：已有行为']`，无 `[object Object]`** | 条目 2 加粗 | `npx vitest run test/prepare-acceptance.test.ts`：Tests 24 passed。用例 "misclassified as {id,why} objects → misclassified array formatted with ：, no [object Object]" 通过 | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `describe('prepareAcceptance: tester events, signal and misclassified list', …)` | 条目 3 | `test/prepare-acceptance.test.ts:1069`：`describe('prepareAcceptance: tester events, signal and misclassified list', () => {` | ✅ |
| `describe('tester: run options are forwarded', …)` | 条目 3 | `test/tester.test.ts:306`（diff +行）：`describe('tester: run options are forwarded', () => {` | ✅ |
| 甲：`test/redcheck.test.ts` 目录名不以 `collie-redcheck-` 开头 | 条目 3 甲 | `test/redcheck.test.ts:266`：`const dir = mkdtempSync(join(privateTmpDir, 'collie-rc-tree-'));` | ✅ |
| 甲：每条用例删除前断言无 `collie-redcheck-*` | 条目 3 甲 | 每个真实 spawn 用例 rmSync 前均有 `readdirSync(privateTmpDir).filter((n) => n.startsWith('collie-redcheck-'))` + `expect(leftover).toHaveLength(0)`（见 diff 中 12+ 处添加） | ✅ |
| 甲：`describe('runRedCheck: leaves nothing behind', …)` 至少一条 | 条目 3 甲 | `test/redcheck.test.ts:762`：`describe('runRedCheck: leaves nothing behind', () => {`；1 条用例 "real run leaves no collie-redcheck-*"；`npx vitest run test/redcheck.test.ts`：Tests 24 passed | ✅ |
| 甲：`test/prepare-acceptance.test.ts` v046-b09 删掉的残留检查补回（只看私有目录） | 条目 3 甲 | `test/prepare-acceptance.test.ts:691-692`：`readdirSync(privateTmpDir).filter((n) => n.startsWith('collie-accept-'))` + `expect(leftover).toHaveLength(0)` | ✅ |
| 乙：GIT_CONFIG_GLOBAL / GIT_CONFIG_NOSYSTEM 隔离 | 条目 3 乙 | `test/prepare-acceptance.test.ts:77-91`：`beforeEach` 里写 gitconfig 文件、设置 env；`test/prepare-acceptance.test.ts:105-112`：`afterEach` 还原 | ✅ |
| 丙：`test/redcheck.test.ts` timeoutMs 改为 240 秒 | 条目 3 丙 | diff 中所有 `60_000` → `240_000`（真实 spawn 用例） | ✅ |
| 丙：`test/prepare-acceptance.test.ts` timeoutMs 改为 240 秒 | 条目 3 丙 | `test/prepare-acceptance.test.ts:678`（diff）：`30_000` → `240_000` | ✅ |
| 丙：用例超时设为 300 秒 | 条目 3 丙 | 所有真实 spawn 用例末尾 `}, 300_000)` | ✅ |
| `test/invariants.test.ts` 加 onTesterEvent | 条目 3 | `test/invariants.test.ts` diff：新增 `it('src/acceptance.ts has onTesterEvent (v046-b12)', ...)` | ✅ |
| 已有断言不改不删 | 条目 3 | diff 中无删除 `expect(...)` 行（已确认删除的行仅有 record 调用、return 语句、import 行、timeout 数值、前缀名） | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径（含 AGENT-tester.md） | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 不改 .github/、eslint.config.js、vitest.config.ts、package.json | 额外禁止 | `git diff` 无输出 | ✅ |
| 不改 src/run.ts、src/redcheck.ts、src/ladder.ts、src/evidence.ts、src/runner/、src/schema/index.ts、test/support/sandbox.ts | 额外禁止 | `git diff` 无输出 | ✅ |
| 不把模块接进队列 | 额外禁止 | 验收命令 8 通过：run.ts 非注释行无 `acceptance.js` | ✅ |
| 不删除或跳过测试 | 额外禁止 | diff 无删除 expect / it.skip | ✅ |
| 不改机器 git 全局配置 | 额外禁止 | 测试只写 privateTmpDir 下的文件，beforeEach/afterEach 操作 process.env | ✅ |
| 不改注释凑验收 | 额外禁止 | 无此类改动 | ✅ |
| 不拉起真实 runner / 网络请求 | 额外禁止 | 新用例全部使用 FakeRunner | ✅ |
| 无新增依赖 | 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增一条 `toContain('onTesterEvent')` 检查，无上下限数值改动。

### 被改写或删去的断言

无。diff 中所有删除行无 `expect(...)`；仅有实现代码中的 record 调用变更和测试中 timeout 数值变更。

## 结论与理由

全部 9 条验收命令实跑通过。条目 1-3 的全部结构要求与行为要求均已满足（测试实跑验证）。
无受保护文件修改，无新增依赖，无禁止文件修改，无已有断言删改。
范围严格在 6 个文件内（`src/acceptance.ts`、`src/roles/tester.ts`、`test/invariants.test.ts`、`test/prepare-acceptance.test.ts`、`test/redcheck.test.ts`、`test/tester.test.ts`），与 task.md 条目一致。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b12",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "bf740641b1be92cac4ace2fb6f78dfe74e1e36f6",
      "dbc2f9636f7da1f8fc9742077297bf39715d9147"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "64 files, 1351 tests passed" },
      { "cmd": "npm test -- test/prepare-acceptance.test.ts test/tester.test.ts test/redcheck.test.ts", "exit_code": 0, "summary": "3 files, 78 tests passed" },
      { "cmd": "GIT_CONFIG_GLOBAL=... GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts", "exit_code": 0, "summary": "24 tests passed with gpgsign config" },
      { "cmd": "grep -qF ... (3 new describe groups)", "exit_code": 0, "summary": "all 3 groups found" },
      { "cmd": "grep exit_code / !grep exitCode: result.exitCode", "exit_code": 0, "summary": "exit_code present, old exitCode: result.exitCode absent in non-comment lines" },
      { "cmd": "!grep acceptance.js in src/run.ts", "exit_code": 0, "summary": "acceptance.js not in run.ts" },
      { "cmd": "grep -qF onTesterEvent test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 9 acceptance commands pass. Structural and behavioral requirements for all 3 items verified via diff review and test execution. No protected files modified, no forbidden files changed, no new dependencies, no existing assertions deleted or rewritten. CI以R2取证为准。"
}
```
