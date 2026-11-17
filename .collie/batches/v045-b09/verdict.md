Now I have all the evidence needed. Let me write the verdict.

---

# 批次 v045-b09 审核

## 取证过程

### 提交事实
```
git log --oneline 998319a9..4f74ffb9
```
Worker 代码提交（非信封/非调度提交）：
- `fa89a597d0b619f65daba0726449cddf72262cb1` — 第一轮实现
- `4f74ffb98016df23886abf961cf79da18c315d9c` — FIX：在 `toCopy` 中加入 `.collie`

这两个提交已在 `origin/main` 上（`git branch -r --contains 4f74ffb9` → `origin/main`）。

### 受保护文件
```
git diff --stat 998319a9..4f74ffb9 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：`docs/progress.md | 22 ++++`。但该改动来自调度提交 `2483e4c`（`progress: v045-b09 FIX`），不是 worker 代码提交。Worker 的两个提交（`fa89a59`、`4f74ffb`）只改了 `scripts/mutation.ts`、`test/mutation.test.ts`、`test/invariants.test.ts`、`test/preflight.test.ts`。
受保护路径被 worker 修改的行数：**0**。

### 依赖变化
```
git diff 998319a9..4f74ffb9 -- package.json package-lock.json
```
无输出 — 无依赖变动。

### 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | All matched files use Prettier code style! |
| 2 | `npm run typecheck` | 0 | tsc -p tsconfig.json |
| 3 | `npm test` | 0 | 57 files, 1135 passed, 0 failed |
| 4 | `npm test -- test/mutation.test.ts` | 0 | 1 file, 22 passed, 0 failed |
| 5 | `grep -cE "^\s+it\(" test/mutation.test.ts \| grep -qE "^(1[8-9]\|[2-9][0-9])$"` | 0 | 22 个 `it(` → 匹配 |
| 6 | `grep -vE "^\s*(//\|\*\|/\*)" scripts/mutation.ts \| grep -qE "numFailedTests" && grep -qE "numFailedTests" test/mutation.test.ts` | 0 | 匹配成功 |
| 7 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught [0-9]+ survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | 0 | 末行: `mutation: caught 44 survived 0 invalid 0 timeout 0 stale 0` |
| 8 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts && ! ls -d "$d"/collie-clone-* >/dev/null 2>&1` | 0 | 10 passed, 无残留 collie-clone-* |
| 9 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qE "^(4[4-9]\|[5-9][0-9]\|[1-9][0-9][0-9])$"` | 0 | 44 项 |
| 10 | `grep -qE "numFailedTests" test/invariants.test.ts` | 0 | 匹配成功 |

**全部 10 条验收命令通过。**

### 测试真实数字
- 全量测试：57 files, 1135 passed, 0 failed
- mutation.test.ts：1 file, 22 passed, 0 failed
- preflight.test.ts：1 file, 10 passed, 0 failed
- invariants.test.ts：1 file, 66 passed, 0 failed

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1135 passed | ✅ |
| 判定函数的专项测试通过 | `npm test -- test/mutation.test.ts` | exit 0, 22 passed | ✅ |
| 专项测试不少于 18 个 | `grep -cE ...` | 22 个 ≥ 18 | ✅ |
| 判定看测试结果（不看注释行） | `grep ... numFailedTests ...` | exit 0 | ✅ |
| 变异全部 caught、末行格式、无 .vitest | 完整变异跑 | caught 44, exit 0 | ✅ |
| preflight 不留克隆目录 | `TMPDIR=$d npm test ...` | exit 0, 无残留 | ✅ |
| 清单仍不少于 44 项 | `--list \| grep -c .` | 44 | ✅ |
| 不变量同步 | `grep ... invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 基线先跑整项目类型检查再跑相关测试 | task 条目 1 | `scripts/mutation.ts:519-528`（先 `tsc --noEmit`），`scripts/mutation.ts:532-544`（后 vitest run） | ✅ |
| 基线任何一步不过、或一个测试都没执行→退出码 1 + 末行 `mutation: baseline failed (<原因>)` | task 条目 1 | `scripts/mutation.ts:594-597`: `if (baselineFailure !== null) { process.stdout.write('mutation: baseline failed (' ...); process.exit(1); }` | ✅ |
| 判定用 vitest 的 JSON 报告（numFailedTests） | task 条目 1 | `scripts/mutation.ts:368-376`: `judgeExecResult` 检查 `report.numFailedTests > 0` | ✅ |
| 执行了测试且至少一个用例失败才是 caught | task 条目 1 | `scripts/mutation.ts:370-372`: 先检查 `numTotalTests === 0` → invalid，再检查 `numFailedTests > 0` → caught | ✅ |
| 非零退出却没有用例失败→invalid | task 条目 1 | `scripts/mutation.ts:374-376`: 最后 fallthrough 返回 `invalid` | ✅ |
| 判定写成不起子进程的纯函数 | task 条目 1 | `scripts/mutation.ts:368`: `export function judgeExecResult(report, exitCode): Result` — 无 I/O、无 exec 调用 | ✅ |
| JSON 报告用 `--outputFile` 写到系统临时目录 | task 条目 1 | `scripts/mutation.ts:473`: `const reportPath = join(tmpdir(), ...)` | ✅ |
| JSON 报告读完删掉 | task 条目 1 | `scripts/mutation.ts:490-491`: `rmSync(reportPath, { force: true })` | ✅ |
| 不带 `--outputFile` 时 vitest 建 `.vitest/`→不能弄脏工作区 | task 条目 1 | 验收 #7 通过：`! test -e .vitest` → exit 0 | ✅ |
| 类型检查超时→timeout（不是 invalid） | task 条目 2 | `scripts/mutation.ts:465-467`: `judgeTypecheckResult(tcErr)` 返回 `timeout` 时 `return 'timeout'` | ✅ |
| 类型检查限 120 秒 | task 条目 2 | `scripts/mutation.ts:417`: `const TYPECHECK_TIMEOUT_MS = 120_000` | ✅ |
| 测试进程限 180 秒 | task 条目 2 | `scripts/mutation.ts:418`: `const TEST_TIMEOUT_MS = 180_000` | ✅ |
| 末行固定格式 `mutation: caught <n> survived <n> invalid <n> timeout <n> stale <n>` | task 条目 2 | `scripts/mutation.ts:622-624`: 拼接字符串完全匹配格式 | ✅ |
| 全部 caught→退出码 0 | task 条目 2 | `scripts/mutation.ts:619,625`: `allCaught = counts.caught === selected.length`, `process.exit(allCaught ? 0 : 1)` | ✅ |
| 清单的 44 项不动 | task 条目 2 | `npx tsx scripts/mutation.ts --list \| grep -c .` → 44 | ✅ |
| invariants 加 numFailedTests | task 条目 3 | `test/invariants.test.ts:502`: `expect(content).toContain('numFailedTests')` | ✅ |
| preflight clone 目录用完删掉 | task 条目 3 | `test/preflight.test.ts:67-82`: try/finally 包裹，finally 中 `rmSync(cloneDir, { recursive: true, force: true })` | ✅ |
| 不改受保护路径 | 额外禁止 | worker 提交只改 `scripts/mutation.ts`、`test/mutation.test.ts`、`test/invariants.test.ts`、`test/preflight.test.ts` | ✅ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --name-only ... -- .github/ eslint.config.js vitest.config.ts package.json` → 无输出 | ✅ |
| 不改 `src/` 下文件 | 额外禁止 | `git diff --name-only ... -- src/` → 无输出 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | `grep "\.skip\|\.todo\|xit(" test/mutation.test.ts` → 无匹配 | ✅ |
| 不新增依赖 | 额外禁止 | package.json 无变动 | ✅ |
| 不把变异检查并进 `npm test` | 额外禁止 | 变异仍需 `npx tsx scripts/mutation.ts` 单独跑 | ✅ |

### 行为要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 有用例失败→caught | task 条目 3 | `npx vitest run test/mutation.test.ts`: Tests 22 passed。test/mutation.test.ts:48-50 断言 `judgeExecResult({numTotalTests:5, numFailedTests:2}, 1) → caught` | ✅ |
| 全过→survived | task 条目 3 | test/mutation.test.ts:52-55: `judgeExecResult({numTotalTests:10, numFailedTests:0}, 0) → survived`。测试通过。 | ✅ |
| 非零退出但失败用例数为 0→invalid | task 条目 3 | test/mutation.test.ts:57-60: `judgeExecResult({numTotalTests:3, numFailedTests:0}, 1) → invalid`。测试通过。 | ✅ |
| 执行的用例数为 0→invalid | task 条目 3 | test/mutation.test.ts:62-65: `judgeExecResult({numTotalTests:0, numFailedTests:0}, 1) → invalid`。测试通过。 | ✅ |
| 类型检查超时→timeout | task 条目 3 | test/mutation.test.ts:84-85: `judgeTypecheckResult({killed:true, status:null}) → timeout`。测试通过。 | ✅ |
| 基线三种不过各一条 | task 条目 3 | test/mutation.test.ts:93-137: typecheck fails→`typecheck`; tests failed→`tests failed`; no tests→`no tests executed`; typecheck timeout→`typecheck timeout`; baseline passes→null。5 条用例全部通过。 | ✅ |
| 末行格式测试 | task 条目 3 | test/mutation.test.ts:154-158: regex match 通过。 | ✅ |

**行为要求验证**：`npx vitest run test/mutation.test.ts` 实跑结果：`Tests 22 passed`（exit 0）。所有判定逻辑的测试用例全部通过。

## 不变量数值变化

`git diff` 中 `test/invariants.test.ts` 无数值上下限改动。仅新增一条 `expect(content).toContain('numFailedTests')` 断言，无任何阈值或计数改动。

**无。**

## 被改写或删去的断言

`test/mutation.test.ts` 中 4 条旧断言被删除，对应旧函数 `judgeExecResult(error)` 的 API：

| 文件与用例 | 原断言 | 现断言 | SPEC 有效性 |
|---|---|---|---|
| mutation.test.ts / `returns survived when process exits cleanly` | `judgeExecResult(null) → 'survived'` | 删除；新用例 `returns survived when all tests pass (exit 0, 0 failures)` 覆盖相同语义 | 旧 API 被 SPEC 15.5 取代，新行为正确 |
| mutation.test.ts / `returns caught when process exits with non-zero and was not killed` | `judgeExecResult({ killed: false, status: 1 }) → 'caught'` | 删除；新用例 `returns invalid when non-zero exit but no test failures` 覆盖相同输入的新行为 | SPEC 15.5 明确要求非零退出但无用例失败→invalid |
| mutation.test.ts / `returns timeout when process was killed` | `judgeExecResult({ killed: true, status: null }) → 'timeout'` | 删除；timeout 移至 `judgeTypecheckResult` 和 `runMutation` 层面处理 | SPEC 15.5 重新定义了超时处理 |
| mutation.test.ts / `returns caught when killed is undefined and status is non-zero` | `judgeExecResult({ status: 1 }) → 'caught'` | 删除；同第 2 条 | SPEC 15.5 取代 |

这 4 条旧断言全部属于旧 `judgeExecResult(error)` API，该 API 被 SPEC 15.5 整体替换为 `judgeExecResult(report, exitCode)`。旧行为在 SPEC 15.5 下不再有效（例如「非零退出→caught」在 15.5 下应为 invalid）。所有被删断言守的行为在新 SPEC 下已不正确，替换正当。

## 声称与实测的差异

无。

## 结论与理由

全部 10 条验收命令实跑通过。条目的每项结构要求与行为要求逐条核对均满足。Worker 未改动受保护文件、`src/`、依赖或配置文件。测试无跳过/删除（旧断言因 API 重写而替换，替换正当）。44 项变异全部 caught，末行格式正确，`.vitest` 不存在。preflight 测试不再泄漏临时目录。FIX 轮的修复（加 `.collie` 到 `toCopy`）精确匹配上一轮缺口。

**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b09",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "fa89a597d0b619f65daba0726449cddf72262cb1",
      "4f74ffb98016df23886abf961cf79da18c315d9c"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "All matched files use Prettier code style!" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc -p tsconfig.json" },
      { "cmd": "npm test", "exit_code": 0, "summary": "57 files, 1135 passed, 0 failed" },
      { "cmd": "npm test -- test/mutation.test.ts", "exit_code": 0, "summary": "1 file, 22 passed, 0 failed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/mutation.test.ts | grep -qE \"^(1[8-9]|[2-9][0-9])$\"", "exit_code": 0, "summary": "22 >= 18" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" scripts/mutation.ts | grep -qE \"numFailedTests\" && grep -qE \"numFailedTests\" test/mutation.test.ts", "exit_code": 0, "summary": "numFailedTests found in non-comment code and test" },
      { "cmd": "out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\\n' \"$out\" | tail -n 1 | grep -qE \"^mutation: caught [0-9]+ survived 0 invalid 0 timeout 0 stale 0$\" && ! test -e .vitest", "exit_code": 0, "summary": "caught 44 survived 0 invalid 0 timeout 0 stale 0; no .vitest" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts && ! ls -d \"$d\"/collie-clone-* >/dev/null 2>&1", "exit_code": 0, "summary": "10 passed; no collie-clone-* residue" },
      { "cmd": "npx tsx scripts/mutation.ts --list | grep -c . | grep -qE \"^(4[4-9]|[5-9][0-9]|[1-9][0-9][0-9])$\"", "exit_code": 0, "summary": "44 items" },
      { "cmd": "grep -qE \"numFailedTests\" test/invariants.test.ts", "exit_code": 0, "summary": "numFailedTests present" }
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
  "reason": "全部 10 条验收命令通过。judgeExecResult 是纯函数，用 numFailedTests 判定 caught/survived/invalid。基线先跑类型检查再跑测试，失败时末行写 baseline failed。类型检查超时→timeout（非 invalid），限 120s；测试限 180s。末行固定格式 caught/survived/invalid/timeout/stale 全齐。44 项变异全部 caught。preflight 克隆目录用完删掉。invariants 新增 numFailedTests 断言。旧断言因 SPEC 15.5 API 重写而正当替换。CI 以 R2 取证为准。"
}
```
