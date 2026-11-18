No lines removed — only additions. Now I have all the evidence needed. Let me compile the verdict.

# 批次 v046-b08 审核

## 取证过程

### 1. 提交事实

```
git log --format='%H %s' c475eaa..777ce2a -- . ':(exclude).collie/batches'
→ 777ce2a6316797555c64728e39b15900df953ab5 roles: add prepareAcceptance module, tester previous_problems, and tests (SPEC 16.12)
```

```
git branch -r --contains 777ce2a6316797555c64728e39b15900df953ab5
→ origin/HEAD -> origin/main
  origin/main
```

提交存在且已推送到远端 main。

### 2. 受保护文件

```
git diff --stat c475eaa..777ce2a -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
→ （空）
```

```
git diff --stat c475eaa..777ce2a -- templates/collie.toml .github/ eslint.config.js vitest.config.ts package.json src/run.ts src/redcheck.ts src/backlog.ts src/schema/index.ts src/evidence.ts src/roles/worker.ts src/roles/reviewer.ts 'src/runner/' src/arbiter.ts src/gate.ts test/support/sandbox.ts
→ （空）
```

受保护文件与额外禁止列表中的文件均未被修改。spec_diff_lines = 0。

### 3. 依赖变化

```
git diff c475eaa..777ce2a -- package.json package-lock.json
→ （空）
```

无新增依赖。

### 4. 变更范围

5 个文件变更，全部在范围内：
- `src/acceptance.ts` — 新文件（条目 1）
- `src/roles/tester.ts` — +14 行，纯追加（条目 2）
- `test/invariants.test.ts` — +20 行，纯追加（条目 3）
- `test/prepare-acceptance.test.ts` — 新文件（条目 3）
- `test/tester.test.ts` — +30 行，纯追加（条目 3）

## 逐条验收

| # | 说明 | 命令 | 实测退出码 | 实测摘要 | 通过 |
|---|---|---|---|---|---|
| 1 | 代码规范零错误 | `npm run lint` | 0 | eslint + prettier 均通过 | ✅ |
| 2 | 类型检查零错误 | `npm run typecheck` | 0 | tsc 无输出 | ✅ |
| 3 | 全部测试通过 | `npm test` | 0 | 63 files, 1308 tests passed, 21.94s | ✅ |
| 4 | 模块与提示词测试通过 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` | 0 | 2 files, 38 tests passed | ✅ |
| 5 | 三组用例在 | `grep -qF "prepareAcceptance: retry loop" ... && grep -qF ... && grep -qF ...` | 0 | 三个 describe 名字都存在 | ✅ |
| 6 | 提示词新用例组在 | `grep -qF "tester: previous problems in the prompt" test/tester.test.ts` | 0 | 存在 | ✅ |
| 7 | 函数导出且队列未用 | `grep -qE "export (async )?function prepareAcceptance" ... && ! grep ... acceptance.js` | 0 | `export async function prepareAcceptance` 在 src/acceptance.ts，src/run.ts 非注释行里无 acceptance.js | ✅ |
| 8 | 不留 worktree | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-*` | 0 | 10 tests passed，无残留 | ✅ |
| 9 | 不变量同步 | `grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts` | 0 | 两者都存在 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新文件 `src/acceptance.ts`，导出 `prepareAcceptance(opts)` | 条目1 | `src/acceptance.ts:78` — `export async function prepareAcceptance(opts: PrepareAcceptanceOpts)` | ✅ |
| `opts` 有 `root`、`headSha`、`batch`、`config`、`runner`、`testerMax`、`redCheckOpts`，可选 `record` 与 `redCheck` | 条目1 | `src/acceptance.ts:54-64` — `PrepareAcceptanceOpts` 接口包含所有字段，`record?` 和 `redCheck?` 可选 | ✅ |
| `redCheck` 缺省是 `runRedCheck` | 条目1 | `src/acceptance.ts:80` — `const doRedCheck: RedCheckFn = opts.redCheck ?? runRedCheck;` | ✅ |
| 在系统临时目录下建 worktree（目录名以 `collie-accept-` 开头） | 条目1 | `src/acceptance.ts:70,83` — `const WORKTREE_PREFIX = 'collie-accept-';` / `mkdtempSync(join(tmpdir(), WORKTREE_PREFIX))` | ✅ |
| 主仓库有 `node_modules` 就链进去 | 条目1 | `src/acceptance.ts:93-95` — `symlinkSync(mainNodeModules, worktreeNodeModules)` | ✅ |
| 最多拉起测试 agent `testerMax` 次 | 条目1 | `src/acceptance.ts:103` — `for (let i = 0; i < testerMax; i++)` | ✅ |
| 非零退出不做红检查，原因写明退出码 | 条目1 | `src/acceptance.ts:124-128` — `if (result.exitCode !== 0) { lastProblems = [\`tester exited with code ...\`]; continue; }` | ✅ |
| 只取走 `new.test.ts`、`MAP.md`，有 `[保持]` 时取 `keep.test.ts` | 条目1 | `src/acceptance.ts:220-234` — `collectFiles` 只收集这三个文件 | ✅ |
| 有 `[保持]` 而没有 `keep.test.ts` → 没过 | 条目1 | `src/acceptance.ts:209-211` — `if (hasKeep && !existsSync(keepTestPath)) problems.push(...)` | ✅ |
| 没有 `MAP.md` → 没过 | 条目1 | `src/acceptance.ts:197-199` — `if (!existsSync(mapPath)) problems.push(...)` | ✅ |
| 返回 `{ ok: true, attempts, files }` 或 `{ ok: false, attempts, problems }` | 条目1 | `src/acceptance.ts:149,157` — 两种返回路径 | ✅ |
| 不往 `root` 写任何东西、不提交 | 条目1 | `src/acceptance.ts` — 全文无 `writeFileSync(join(root, ...))` 或 git commit 操作；worktree 是独立目录 | ✅ |
| 不论成败、是否抛错，worktree 都拿掉 | 条目1 | `src/acceptance.ts:158-170` — `finally { removeWorktree(...) }` 加 fallback `rmSync` | ✅ |
| `record` 记录 `tester.started`、`tester.finished`、`redcheck.result` | 条目1 | `src/acceptance.ts:117,121,133-139` — 三个 record 调用 | ✅ |
| 事件字段：attempt, exitCode, ok, problems, new_tests, keep_tests | 条目1/SPEC 16.12 | `src/acceptance.ts:117` — `{attempt}`；`121` — `{attempt, exitCode}`；`133-139` — `{attempt, ok, problems, new_tests, keep_tests}` | ✅ |
| `TesterInputSchema` 加 `previous_problems`（非空字符串的可选数组） | 条目2 | `src/roles/tester.ts:30` — `previous_problems: z.array(z.string().min(1)).optional()` | ✅ |
| 非空时提示词在「情形」前多一节「上一次没过的原因」 | 条目2 | `src/roles/tester.ts:112-120,124` — 拼接 `## 上一次没过的原因`，逐条 `- ${problem}`，尾句「只改有问题的地方，改完重新自检」；插在 `scenarioLines` 之前 | ✅ |
| 不给或空数组时提示词逐字相同 | 条目2 | `src/roles/tester.ts:113-114` — `const prevProblems = data.previous_problems ?? []; if (prevProblems.length > 0)` — 空/缺省不进入分支 | ✅ |
| 三组 describe 名称正确 | 条目3 | `test/prepare-acceptance.test.ts:454,663,869` — 三个 describe 名称完全匹配 | ✅ |
| `test/tester.test.ts` 新加 `describe('tester: previous problems in the prompt', …)` | 条目3 | `test/tester.test.ts:271` — 存在 | ✅ |
| 不改 `test/support/sandbox.ts` | 条目3 | `git diff -- test/support/sandbox.ts` → 空 | ✅ |
| 已有用例一条都不改 | 条目3 | `git diff -- test/tester.test.ts test/invariants.test.ts` — 仅有纯追加行 (`+`)，无删除行 (`-`) | ✅ |
| 不变量加 `removeWorktree` 在 `src/acceptance.ts` | 条目3 | `test/invariants.test.ts:288-291` — 检查 `src/acceptance.ts` 包含 `removeWorktree` | ✅ |
| 不变量加 `src/run.ts` 非注释行没有 `acceptance.js` | 条目3 | `test/invariants.test.ts:293-306` — 过滤注释行后检查无 `acceptance.js` | ✅ |
| 用 `FakeRunner` 而非真实 runner | 条目3 | `test/prepare-acceptance.test.ts:338` — `import { FakeRunner }` | ✅ |
| 配置用 `templateConfig()` | 条目3 | `test/prepare-acceptance.test.ts:345` — `const config = templateConfig();` | ✅ |
| 不改 `src/run.ts` 或其他禁止文件 | 额外禁止 | diff --stat 确认无改动 | ✅ |
| 不新增依赖 | 额外禁止 | `git diff -- package.json` → 空 | ✅ |
| 不把模块接进队列或加子命令 | 额外禁止 | 验收命令 7 确认 src/run.ts 无 acceptance.js | ✅ |

### 行为要求

| 要求 | 出处 | 实跑命令与结果 | 满足 |
|---|---|---|---|
| 第 1 次红检查不过、第 2 次过 → ok=true, attempts=2 | 条目1 粗体1 | `npx vitest run test/prepare-acceptance.test.ts` → 10 passed。测试 `first red check fails, second passes` 在第 454 组 | ✅ |
| testerMax=2 两次都不过 → ok=false, attempts=2 | 条目1 粗体2 | 同上，测试 `testerMax=2, both fail` | ✅ |
| sneaky files 被排除，worktree 和 tmpdir 清理干净，git status 干净 | 条目1 粗体3 | 同上，测试 `sneaky files are excluded, worktree and tmpdir cleaned, git status clean` | ✅ |
| 非零退出不做红检查 | 条目1 | 同上，测试 `tester exits non-zero: no red check for that attempt` | ✅ |
| record 收到正确事件顺序 | 条目3 | 同上，测试 `record receives events in the right order for two attempts` — 断言 6 个事件名顺序为 started/finished/result ×2 | ✅ |
| 有 [保持] 无 keep.test.ts → 没过 | 条目3 | 同上，测试 `batch has [保持] but no keep.test.ts → not ok` | ✅ |
| 无 [保持] 但写了 keep.test.ts → files 里没有它 | 条目3 | 同上，测试 `no [保持] scenarios but tester writes keep.test.ts → files do not include it` | ✅ |
| 无 MAP.md → 没过 | 条目3 | 同上，测试 `no MAP.md → not ok` | ✅ |
| 注入红检查抛错 → 错误传播，worktree 仍被拿掉 | 条目3 | 同上，测试 `injected redCheck throws → error propagates, worktree still removed` | ✅ |
| 真实红检查：写失败测试 → ok=true | 条目3 | 同上，测试 `FakeRunner writes failing tests, real runRedCheck judges them → ok=true` | ✅ |
| 给两条 problems → 都在提示词里、在情形之前 | 条目3 | `npx vitest run test/tester.test.ts` → 28 passed。测试 `given two problems: both appear verbatim, before 情形 section` | ✅ |
| 不给 → 提示词无「上一次没过的原因」 | 条目3 | 同上，测试 `not given: prompt is identical to no previous_problems field` | ✅ |
| 空数组 → 提示词与基准相同 | 条目3 | 同上，测试 `given empty array: prompt is identical to no previous_problems field` | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增两个测试用例，未修改任何现有数值上下限。

### 被改写或删去的断言

无。`test/tester.test.ts` 和 `test/invariants.test.ts` 仅有纯追加行，未删除或修改任何已有 `expect(...)` 断言。

## 结论与理由

全部 9 条验收命令实跑通过。提交存在且已推送到 `origin/main`。无受保护文件变动，无新增依赖。diff 范围严格在 task.md 条目范围内，无范围蔓延。

代码实现正确：
- `prepareAcceptance` 在 tmpdir 建 worktree、循环拉起 tester、做红检查、收集文件、finally 清理，完整实现了 SPEC 16.12 的前四条。
- `previous_problems` 在重试路径中正确传递（acceptance.ts:114 → tester.ts:114-120）。
- 事件记录字段与 SPEC 16.12 一致。
- 文件收集只取点名的三个文件，sneaky 文件被排除。

测试覆盖全面：三组共 10 个用例覆盖了重试循环、文件过滤、真实红检查三方面，外加 tester 提示词 3 个用例和不变量 2 个用例。

CI 结论因无凭据无法查到，以 R2 取证为准。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b08",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["777ce2a6316797555c64728e39b15900df953ab5"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "63 files, 1308 tests passed" },
      { "cmd": "npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest", "exit_code": 0, "summary": "2 files, 38 tests passed, no .vitest leftover" },
      { "cmd": "grep -qF ... test/prepare-acceptance.test.ts (3 groups)", "exit_code": 0, "summary": "all three describe names found" },
      { "cmd": "grep -qF 'tester: previous problems in the prompt' test/tester.test.ts", "exit_code": 0, "summary": "describe name found" },
      { "cmd": "grep -qE 'export (async )?function prepareAcceptance' src/acceptance.ts && ! grep ... src/run.ts", "exit_code": 0, "summary": "exported, not imported in run.ts" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d ...", "exit_code": 0, "summary": "10 tests passed, no collie-accept-* leftover" },
      { "cmd": "grep -qF 'removeWorktree' test/invariants.test.ts && grep -qF 'src/acceptance.ts' test/invariants.test.ts", "exit_code": 0, "summary": "both invariants present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 9 acceptance commands pass. Commit pushed to origin/main. No protected files touched, no new dependencies. Code correctly implements SPEC 16.12 prepareAcceptance with retry loop, file collection, event recording, and worktree cleanup. Tests cover all required scenarios across 3 groups plus tester prompt and invariant checks. CI status unknown — to be verified by R2."
}
```
