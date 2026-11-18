Good — zero lines changed. Now I have all the evidence needed for my verdict.

---

# 批次 v046-b08 审核

## 取证过程

### 1. 受保护文件

```
git diff --stat c475eaa..777ce2a -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护文件未被修改。`spec_diff_lines = 0`。

### 2. 额外禁止的文件

```
git diff c475eaa..777ce2a -- src/run.ts src/redcheck.ts src/backlog.ts src/schema/index.ts src/evidence.ts src/roles/worker.ts src/roles/reviewer.ts src/runner/ src/arbiter.ts src/gate.ts test/support/sandbox.ts templates/collie.toml .github/ eslint.config.js vitest.config.ts package.json
```
结果：无输出。所有额外禁止的文件都未被修改。

### 3. 依赖变化

```
git diff c475eaa..777ce2a -- package.json package-lock.json
```
结果：无输出。无依赖变动。

### 4. 变更范围

5 个文件被修改/新增，全部在 task.md 范围内：
- `src/acceptance.ts`（新文件，238 行）
- `src/roles/tester.ts`（+14 行）
- `test/invariants.test.ts`（+20 行）
- `test/prepare-acceptance.test.ts`（新文件，627 行）
- `test/tester.test.ts`（+30 行）

### 5. 提交确认

```
git rev-parse 777ce2a6316797555c64728e39b15900df953ab5
→ 777ce2a6316797555c64728e39b15900df953ab5
git branch -r --contains 777ce2a6316797555c64728e39b15900df953ab5
→ origin/HEAD -> origin/main
  origin/main
```
提交存在且已推送到 `origin/main`。

### 6. CI

无 `gh` 访问权限（bash_deny 拦截），`ci_conclusion: unknown`，`ci_branch_matched: null`。CI 以 R2 取证为准。CI 配置监听 `main` 分支（`.github/workflows/ci.yml` 第 6 行），与实际使用分支一致。

### 7. 验收命令逐条实跑

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 全通过 |
| 2 | `npm run typecheck` | 0 | tsc 零错误 |
| 3 | `npm test` | 0 | 63 个测试文件、1308 个用例全通过 |
| 4 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` | 0 | 2 文件 38 用例全通过，无 `.vitest` 残留 |
| 5 | `grep -qF "prepareAcceptance: retry loop" ... && grep -qF ... && grep -qF ...` | 0 | 三个 describe 组名均找到 |
| 6 | `grep -qF "tester: previous problems in the prompt" test/tester.test.ts` | 0 | 组名存在 |
| 7 | `grep -qE "export (async )?function prepareAcceptance" src/acceptance.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | 0 | 函数已导出、`src/run.ts` 非注释行未引用 |
| 8 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-* >/dev/null 2>&1` | 0 | 10 用例通过、临时目录无 `collie-accept-*` 残留 |
| 9 | `grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts` | 0 | 两个不变量都存在 |

### 8. 测试真实数字

- `npm test`：63 文件、1308 用例全通过（21.60s）
- `test/prepare-acceptance.test.ts`：10 用例全通过
- `test/tester.test.ts`：28 用例全通过
- `test/invariants.test.ts`：77 用例全通过

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1308 passed | ✅ |
| 模块与提示词测试通过，无残留 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` | exit 0 | ✅ |
| 模块三组用例在 | grep 三组名 | exit 0 | ✅ |
| 提示词新用例组在 | grep 组名 | exit 0 | ✅ |
| 函数导出了，队列没有用 | grep export + grep 排除 | exit 0 | ✅ |
| 测试不留下 worktree | TMPDIR 隔离后 ls 无残留 | exit 0 | ✅ |
| 不变量同步 | grep removeWorktree + src/acceptance.ts | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新文件 `src/acceptance.ts` 导出 `prepareAcceptance(opts)` | 条目 1 | `src/acceptance.ts:78` — `export async function prepareAcceptance(opts: PrepareAcceptanceOpts)` | ✅ |
| `opts` 有 `root`、`headSha`、`batch`、`config`、`runner`、`testerMax`、`redCheckOpts`，可选 `record` 和 `redCheck` | 条目 1 | `src/acceptance.ts:54-64` — `PrepareAcceptanceOpts` 接口定义包含所有字段，`record` 和 `redCheck` 均为可选 | ✅ |
| `redCheck` 缺省是 `runRedCheck` | 条目 1 | `src/acceptance.ts:80` — `const doRedCheck: RedCheckFn = opts.redCheck ?? runRedCheck;` | ✅ |
| 在系统临时目录下建 worktree（目录名以 `collie-accept-` 开头） | 条目 1 | `src/acceptance.ts:70,83` — `const WORKTREE_PREFIX = 'collie-accept-';` / `mkdtempSync(join(tmpdir(), WORKTREE_PREFIX))` | ✅ |
| 主仓库有 `node_modules` 就链进去 | 条目 1 | `src/acceptance.ts:91-95` — `symlinkSync(mainNodeModules, worktreeNodeModules)` | ✅ |
| 最多拉起测试 agent `testerMax` 次 | 条目 1 | `src/acceptance.ts:103` — `for (let i = 0; i < testerMax; i++)` | ✅ |
| 过了之后只取走 `new.test.ts`、`MAP.md`、（有保持时）`keep.test.ts` | 条目 1 | `src/acceptance.ts:218-235` — `collectFiles` 只收集这三个命名文件 | ✅ |
| 返回 `{ ok: true, attempts, files }` 或 `{ ok: false, attempts, problems }` | 条目 1 | `src/acceptance.ts:29-41` — 类型定义；`src/acceptance.ts:149,157` — 返回语句 | ✅ |
| 不往 `root` 写任何东西、不提交 | 条目 1 | `src/acceptance.ts` 整个文件无对 `root` 的写操作，无 `git commit`、`git push` | ✅ |
| 不论成败、是否抛错，worktree 都要拿掉 | 条目 1 | `src/acceptance.ts:158-170` — `finally` 块调用 `removeWorktree`，失败时 `rmSync` 兜底 | ✅ |
| `src/acceptance.ts` 里有 `removeWorktree` | 条目 1/3 | `src/acceptance.ts:9` — import 和 `src/acceptance.ts:161` — 调用 | ✅ |
| `TesterInputSchema` 加可选的 `previous_problems`（非空字符串的数组） | 条目 2 | `src/roles/tester.ts:30` — `previous_problems: z.array(z.string().min(1)).optional()` | ✅ |
| 非空时提示词在「情形」之前多一节 | 条目 2 | `src/roles/tester.ts:112-120,124` — 在 `sections` 数组中 `scenarioLines` 之前插入 `previousProblemsLines` | ✅ |
| 写一句「只改有问题的地方，改完重新自检」 | 条目 2 | `src/roles/tester.ts:119` — `previousProblemsLines.push('', '只改有问题的地方，改完重新自检');` | ✅ |
| 不给或空数组时，提示词与现在逐字相同 | 条目 2 | `src/roles/tester.ts:114` — `if (prevProblems.length > 0)`，不满足条件则 `previousProblemsLines` 为空，sections 不变 | ✅ |
| 三组 describe 名称正确 | 条目 3 | `test/prepare-acceptance.test.ts:454,663,869` — 三组 describe 名称与 task.md 完全一致 | ✅ |
| 新 tester 组名正确 | 条目 3 | `test/tester.test.ts:271（+30 行 diff 起始处）` — `describe('tester: previous problems in the prompt', …)` | ✅ |
| 不改 `test/support/sandbox.ts` | 条目 3 | `git diff` 确认零变动 | ✅ |
| 已有用例一条都不改 | 条目 3 | `test/tester.test.ts` diff 仅在末尾追加（从第 270 行后起），无任何删除或修改 | ✅ |
| `test/invariants.test.ts` 加两条不变量 | 条目 3 | `test/invariants.test.ts` diff：+20 行，两个新 `it` 块 | ✅ |
| 不变量：`src/run.ts` 非注释行没有 `acceptance.js` | 条目 3 | `test/invariants.test.ts` diff 中第二个 `it` 块 | ✅ |
| 额外禁止：不改受保护路径 | 额外禁止 | `git diff --stat` 对受保护文件为空 | ✅ |
| 额外禁止：不改 `src/run.ts` 等指定文件 | 额外禁止 | `git diff` 对所有指定文件为空 | ✅ |
| 额外禁止：不接进队列或加子命令 | 额外禁止 | `src/run.ts` 未被修改 | ✅ |
| 额外禁止：不删除或跳过任何测试 | 额外禁止 | diff 无测试删除 | ✅ |
| 额外禁止：不改写已有断言 | 额外禁止 | diff 中 `expect` 均为新增 | ✅ |
| 额外禁止：不新增依赖 | 额外禁止 | `package.json` 无变动 | ✅ |
| 额外禁止：测试不拉真实 runner 或网络（除 real red check） | 额外禁止 | 所有测试使用 `FakeRunner`；real red check 只起 vitest 子进程 | ✅ |

### 行为要求

| 要求 | 出处 | 证据（命令 + 输出） | 满足 |
|---|---|---|---|
| 第 1 次红检查不过、第 2 次过：ok=true, attempts=2 | 条目 1（加粗 1） | `npx vitest run test/prepare-acceptance.test.ts --reporter=verbose` → `✓ first red check fails, second passes: tester called twice, ok=true, attempts=2 (52ms)` | ✅ |
| testerMax=2 两次都不过：ok=false, attempts=2 | 条目 1（加粗 2） | 同上 → `✓ testerMax=2, both fail: tester called twice, ok=false, attempts=2 (44ms)` | ✅ |
| sneaky 文件不在 files 里、worktree 清理、git status 干净 | 条目 1（加粗 3） | 同上 → `✓ sneaky files are excluded, worktree and tmpdir cleaned, git status clean (55ms)` | ✅ |
| 非零退出不做红检查 | 条目 1 | 同上 → `✓ tester exits non-zero: no red check for that attempt (45ms)` | ✅ |
| record 收到正确事件顺序 | 条目 1 | 同上 → `✓ record receives events in the right order for two attempts (45ms)` | ✅ |
| [保持] 无 keep.test.ts → 没过 | 条目 3 | 同上 → `✓ batch has [保持] but no keep.test.ts → not ok (43ms)` | ✅ |
| 无 [保持] 但写了 keep.test.ts → files 不含 | 条目 3 | 同上 → `✓ no [保持] scenarios but tester writes keep.test.ts → files do not include it (42ms)` | ✅ |
| 无 MAP.md → 没过 | 条目 3 | 同上 → `✓ no MAP.md → not ok (42ms)` | ✅ |
| redCheck 抛错 → 传播、worktree 仍被拿掉 | 条目 3 | 同上 → `✓ injected redCheck throws → error propagates, worktree still removed (50ms)` | ✅ |
| 真实 red check 集成 | 条目 3 | 同上 → `✓ FakeRunner writes failing tests, real runRedCheck judges them → ok=true (814ms)` | ✅ |
| 给两条 previous_problems → 都在、在情形之前 | 条目 2/3 | `npx vitest run test/tester.test.ts --reporter=verbose` → `✓ given two problems: both appear verbatim, before 情形 section` | ✅ |
| 不给 → 提示词相同 | 条目 2/3 | 同上 → `✓ not given: prompt is identical to no previous_problems field` | ✅ |
| 给空数组 → 提示词相同 | 条目 2/3 | 同上 → `✓ given empty array: prompt is identical to no previous_problems field` | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 的 diff 仅新增两个 `it` 块，未修改任何已有数值上下限。

### 被改写或删去的断言

无。`test/tester.test.ts` 和 `test/invariants.test.ts` 的 diff 均为纯追加，无已有 `expect()` 被删除或修改。

## 结论与理由

全部 9 条验收命令实跑通过。5 个变更文件均在 task.md 条目范围内。受保护文件与额外禁止文件均未修改。无新增依赖。提交已推送到 `origin/main`。

三组测试覆盖了条目 1 的三处加粗情形、非零退出、事件记录、保持情形缺文件、sneaky 文件排除、真实红检查集成。条目 2 的 previous_problems 在 tester 提示词测试中得到逐字验证。两个不变量已添加。已有用例无任何改动。

所有结构要求和行为要求均有文件位置或实跑证据支撑。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b08",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "eacde6dc99b158ffd3b2ed3663b459636681ef19",
      "777ce2a6316797555c64728e39b15900df953ab5"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "63 files, 1308 tests passed" },
      { "cmd": "npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest", "exit_code": 0, "summary": "2 files, 38 tests passed, no .vitest" },
      { "cmd": "grep -qF ... test/prepare-acceptance.test.ts (3 groups)", "exit_code": 0, "summary": "all three describe groups found" },
      { "cmd": "grep -qF 'tester: previous problems in the prompt' test/tester.test.ts", "exit_code": 0, "summary": "group found" },
      { "cmd": "grep export + grep exclusion for acceptance.js in src/run.ts", "exit_code": 0, "summary": "exported, not in run.ts" },
      { "cmd": "TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls collie-accept-*", "exit_code": 0, "summary": "10 tests passed, no leftover worktrees" },
      { "cmd": "grep removeWorktree + src/acceptance.ts in test/invariants.test.ts", "exit_code": 0, "summary": "both invariants present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 9 acceptance commands pass. 1308 tests green. 5 files changed, all within task scope. No protected or forbidden files modified. No dependency changes. Commit pushed to origin/main. CI status unknown (no gh access); CI verification deferred to R2."
}
```
