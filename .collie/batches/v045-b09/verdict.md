I now have all the evidence I need. Let me compile the verdict.

---

# 批次 v045-b09 审核

## 取证过程

### 1. 受保护文件

```
git diff --stat 998319a9..fa89a597 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护文件无改动。`spec_diff_lines = 0`。

### 2. 额外禁止路径

```
git diff --stat 998319a9..fa89a597 -- .github/ eslint.config.js vitest.config.ts package.json src/
```
结果：无输出。这些路径均无改动。

### 3. 依赖变化

```
git diff 998319a9..fa89a597 -- package.json package-lock.json
```
结果：无输出。无依赖变化。

### 4. 提交事实

```
git log --format="%H" 998319a9..fa89a597
```
结果：
- `fa89a597d0b619f65daba0726449cddf72262cb1` — 实现提交
- `f062e0abd62619d0b958bbf2363379682fd5e578` — task envelope

```
git branch -r --contains fa89a597
```
结果：`origin/main`。已推送。

### 5. 验收命令逐条实跑

| # | 命令 | 退出码 | 通过 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | ✓ |
| 2 | `npm run typecheck` | 0 | ✓ |
| 3 | `npm test` | 0 (57 files, 1135 tests) | ✓ |
| 4 | `npm test -- test/mutation.test.ts` | 0 (22 tests) | ✓ |
| 5 | `grep -cE "^\s+it\(" test/mutation.test.ts \| grep -qE "^(1[8-9]\|[2-9][0-9])$"` | 0 (22 tests) | ✓ |
| 6 | `grep -vE "^\s*(//\|\*\|/\*)" scripts/mutation.ts \| grep -qE "numFailedTests" && grep -qE "numFailedTests" test/mutation.test.ts` | 0 | ✓ |
| **7** | **`out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught [0-9]+ survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest`** | **1** | **✗** |
| 8 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts && ! ls -d "$d"/collie-clone-* >/dev/null 2>&1` | 0 | ✓ |
| 9 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qE "^(4[4-9]\|[5-9][0-9]\|[1-9][0-9][0-9])$"` | 0 | ✓ |
| 10 | `grep -qE "numFailedTests" test/invariants.test.ts` | 0 | ✓ |

**验收 #7 失败详情：**

实跑输出的末行：`mutation: caught 35 survived 0 invalid 9 timeout 0 stale 0`，退出码 1。
期望末行匹配 `^mutation: caught [0-9]+ survived 0 invalid 0 timeout 0 stale 0$`，不匹配。

9 个 `invalid` 项全部是 `protected:*` 变异（修改 `src/evidence.ts`）。

**根因取证：**

我手工复制了 `runMutation` 的做法——把项目复制到临时目录，仅复制 `toCopy` 里列出的目录/文件（`src`, `test`, `scripts`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `package.json`），`node_modules` 用 symlink，然后在临时目录里跑 `npx vitest run test/evidence.test.ts`。

实际报错：
```
ConfigError: Invalid config /tmp/collie-mut-test-x8sH2A/.collie/collie.toml:
  - (root): cannot read file: ENOENT: no such file or directory, open '/tmp/collie-mut-test-x8sH2A/.collie/collie.toml'
 ❯ loadConfig src/config.ts:75:11
 ❯ test/evidence.test.ts:10:16
```

`test/evidence.test.ts` 第 10 行在模块顶层调用 `loadConfig(join(import.meta.dirname, '..'))`，会读 `.collie/collie.toml`。但 `toCopy` 列表不包含 `.collie/`，所以这个文件在临时目录里不存在。vitest 的测试加载阶段就崩溃了：
- JSON 报告：`numTotalTests: 0, numFailedTests: 0`
- 退出码：1
- `judgeExecResult(report, 1)` → `report.numTotalTests === 0` → `invalid`

旧代码的 `judgeExecResult` 只看退出码（非零即 `caught`），所以这个问题一直被掩盖。新的判定逻辑正确地识别出"没有测试执行"的情况，但 temp 目录缺少配置文件导致 evidence 测试根本跑不了。

## 逐条验收

见上表。

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 基线先跑整项目类型检查再跑相关测试 | 条目 1 | `scripts/mutation.ts:518-528`（tsc）→ `scripts/mutation.ts:531-545`（vitest） | ✓ |
| 基线任何一步不过、或一个测试都没执行，立刻退出码 1 并写 `mutation: baseline failed (<原因>)` | 条目 1 | `scripts/mutation.ts:390-401`（`judgeBaseline`）+ `scripts/mutation.ts:593-597`（CLI 输出） | ✓ |
| 每一项用 vitest JSON 报告判定 | 条目 1 | `scripts/mutation.ts:470-504`（`--reporter=json --outputFile=`，`readJsonReport`，`judgeExecResult`） | ✓ |
| 执行了测试且至少一个用例失败才是 `caught` | 条目 1 | `scripts/mutation.ts:372`：`if (report.numFailedTests > 0) return 'caught'` | ✓ |
| 非零退出却没有用例失败算 `invalid` | 条目 1 | `scripts/mutation.ts:376`：`return 'invalid'` | ✓ |
| 判定写成不起子进程的纯函数 | 条目 1 | `scripts/mutation.ts:368-377`：`judgeExecResult` 仅接受 `report` 和 `exitCode`，无 I/O、无 subprocess | ✓ |
| JSON 报告用 `--outputFile` 写到系统临时目录、读完删掉 | 条目 1 | `scripts/mutation.ts:472`（`tmpdir()`）、`scripts/mutation.ts:488-493`（`readJsonReport` + `rmSync`） | ✓ |
| 类型检查超时记 `timeout` | 条目 2 | `scripts/mutation.ts:465-466`：`if (tcVerdict === 'timeout') return 'timeout'` | ✓ |
| 类型检查限 120 秒 | 条目 2 | `scripts/mutation.ts:417`：`const TYPECHECK_TIMEOUT_MS = 120_000` | ✓ |
| 测试进程限 180 秒 | 条目 2 | `scripts/mutation.ts:418`：`const TEST_TIMEOUT_MS = 180_000` | ✓ |
| 末行固定格式 | 条目 2 | `scripts/mutation.ts:621-623`：`mutation: caught ${...} survived ${...} invalid ${...} timeout ${...} stale ${...}` | ✓ |
| 全部 `caught` 才退出码 0 | 条目 2 | `scripts/mutation.ts:618,624`：`counts.caught === selected.length` → `process.exit(allCaught ? 0 : 1)` | ✓ |
| 清单的 44 项不动 | 条目 2 | `npx tsx scripts/mutation.ts --list \| grep -c .` → 44 | ✓ |
| `test/invariants.test.ts` 加 `numFailedTests` | 条目 3 | `test/invariants.test.ts:502-505` | ✓ |
| preflight 的 `collie-clone-*` 目录用完删掉 | 条目 3 | `test/preflight.test.ts:70,80-82`：`try { ... } finally { rmSync(cloneDir, ...) }` | ✓ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 确认 | ✓ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --stat` 确认 | ✓ |
| 不改 `src/` 下文件 | 额外禁止 | `git diff --stat` 确认 | ✓ |
| 不删除或跳过测试 | 额外禁止 | 旧 `judgeExecResult` 的 4 条测试被替换为对新 API 的 6 条测试，不是删除——函数签名从 `(error)` 完全改为 `(report, exitCode)` | ✓ |
| 不从清单去项目 | 额外禁止 | 仍 44 项 | ✓ |
| 不把变异检查并进 `npm test` | 额外禁止 | `npm test` 只跑 vitest，不含 mutation | ✓ |
| 不新增依赖 | 额外禁止 | package.json 无改动 | ✓ |

### 行为要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 有用例失败 → `caught` | 条目 3 | `npx vitest run test/mutation.test.ts` → `Tests 22 passed`；`judgeExecResult (SPEC 15.5) > returns caught when at least one test failed` passed | ✓ |
| 全过 → `survived` | 条目 3 | 同上；`returns survived when all tests pass` passed | ✓ |
| 非零退出但失败用例数为 0 → `invalid` | 条目 3 | 同上；`returns invalid when non-zero exit but no test failures` passed | ✓ |
| 执行的用例数为 0 → `invalid` | 条目 3 | 同上；`returns invalid when no tests were executed` passed | ✓ |
| 类型检查超时 → `timeout` | 条目 3 | 同上；`judgeTypecheckResult > returns timeout when process was killed` passed | ✓ |
| 基线三种不过各一条 | 条目 3 | 同上；`judgeBaseline` 组有 typecheck、tests failed、no tests executed 三条 + typecheck timeout、passes | ✓ |
| 末行格式 | 条目 3 | 同上；`last line format > matches the fixed format regex` passed | ✓ |

## 不变量数值变化

无。`test/invariants.test.ts` 仅新增一条检查（`numFailedTests`），未改动任何已有数值上下限。

## 被改写或删去的断言

`test/mutation.test.ts` 中旧 `judgeExecResult` 的 4 条用例被完全替换：

| 原用例名 | 原断言 | 新用例 | 原因 |
|---|---|---|---|
| `returns survived when process exits cleanly` | `judgeExecResult(null)` → `survived` | 新 `returns survived when all tests pass` | 函数签名从 `(error)` 改为 `(report, exitCode)`，旧 API 不再存在 |
| `returns caught when process exits with non-zero and was not killed` | `judgeExecResult({ killed: false, status: 1 })` → `caught` | 新 `returns caught when at least one test failed` | 同上；新逻辑区分「有失败用例」和「退出码非零但无失败用例」 |
| `returns timeout when process was killed` | `judgeExecResult({ killed: true, status: null })` → `timeout` | 新 `judgeTypecheckResult > returns timeout` | timeout 判定移至 `judgeTypecheckResult` 和 `runMutation` 调用层 |
| `returns caught when killed is undefined and status is non-zero` | `judgeExecResult({ status: 1 })` → `caught` | 新 `returns invalid when non-zero exit but no test failures` | 同上；旧行为「非零退出即 caught」是 SPEC 15.5 要修正的 |

这些改动合理——旧函数签名不再存在，旧断言无法编译。旧函数守的"非零退出即 caught"正是 SPEC 15.5 明确要修正的行为。新用例覆盖了新 API 的全部分支。SPEC 中这些要求仍然有效，只是判定逻辑更精确了。

## 声称与实测的差异

验收 #7 实测失败：9 个 `protected:*` 变异返回 `invalid` 而非 `caught`。

## 结论与理由

**FIX。**

验收命令 #7 未通过。9 个 `protected:*` 变异（均针对 `src/evidence.ts`）在临时目录里跑 `test/evidence.test.ts` 时，测试套件在模块加载阶段崩溃（`ConfigError: .collie/collie.toml` 不存在），导致 `numTotalTests=0` → `invalid`。

根因：`runMutation()` 的 `toCopy` 列表（`scripts/mutation.ts:432-439`）仅包含 `src`, `test`, `scripts` 和若干配置文件，不包含 `.collie/`。而 `test/evidence.test.ts:10` 在模块顶层调用 `loadConfig(join(import.meta.dirname, '..'))` 读取 `.collie/collie.toml`，该文件在临时目录中不存在。

修复方案：在 `toCopy` 数组中加入 `'.collie'`（或至少 `.collie/collie.toml`），使 evidence 测试在临时目录中能正常加载配置。

其余 9 条验收命令均通过。实现的纯函数（`judgeExecResult`、`judgeTypecheckResult`、`judgeBaseline`）逻辑正确，测试 22 条全部通过，preflight 清理正确，invariants 已同步，无受保护文件改动，无依赖变化，无范围蔓延。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b09",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [
      "f062e0abd62619d0b958bbf2363379682fd5e578",
      "fa89a597d0b619f65daba0726449cddf72262cb1"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "lint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "57 files, 1135 tests passed" },
      { "cmd": "npm test -- test/mutation.test.ts", "exit_code": 0, "summary": "22 tests passed" },
      { "cmd": "grep -cE '\\s+it\\(' test/mutation.test.ts | grep -qE ...", "exit_code": 0, "summary": "22 >= 18" },
      { "cmd": "grep ... numFailedTests ...", "exit_code": 0, "summary": "numFailedTests in code and tests" },
      { "cmd": "out=$(npx tsx scripts/mutation.ts 2>&1) && ...", "exit_code": 1, "summary": "caught 35 survived 0 invalid 9 timeout 0 stale 0; expected invalid 0" },
      { "cmd": "TMPDIR=$d npm test -- test/preflight.test.ts && ...", "exit_code": 0, "summary": "10 tests passed, no collie-clone dirs left" },
      { "cmd": "npx tsx scripts/mutation.ts --list | grep -c . | ...", "exit_code": 0, "summary": "44 items" },
      { "cmd": "grep -qE 'numFailedTests' test/invariants.test.ts", "exit_code": 0, "summary": "found" }
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
    "验收 #7 失败：9 个 protected:* 变异返回 invalid（expected invalid 0）。runMutation() 的 toCopy 列表（scripts/mutation.ts:432-439）不包含 .collie/，导致 test/evidence.test.ts 在临时目录加载 .collie/collie.toml 时崩溃、0 个测试执行。需在 toCopy 中加入 '.collie'。"
  ],
  "reason": "验收命令 #7 未通过。9 个 protected path 变异因临时目录缺少 .collie/collie.toml 而无法运行 evidence 测试，被判为 invalid 而非 caught。CI 以 R2 取证为准。"
}
```
