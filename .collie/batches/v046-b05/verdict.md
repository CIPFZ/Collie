Here is the complete verdict:

---

# 批次 v046-b05 审核

## 取证过程

### 1. 受保护文件检查

```
git diff --stat a25947e..eb0a34b -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空，无受保护路径被修改。

额外禁止路径检查：
```
git diff a25947e..eb0a34b -- .github/ eslint.config.js vitest.config.ts package.json src/run.ts 'src/roles/' 'src/runner/' src/backlog.ts src/arbiter.ts src/gate.ts src/evidence.ts src/view.ts src/follow.ts
```
输出为空，无禁止路径被修改。

### 2. 依赖变化

```
git diff a25947e..eb0a34b -- package.json package-lock.json
```
输出为空，无依赖变化。

### 3. Diff 范围

```
git diff --stat a25947e..eb0a34b -- . ':(exclude).collie/batches'
```
```
 src/redcheck.ts         |  92 ++++++++++++++++-
 test/invariants.test.ts |   6 ++
 test/redcheck.test.ts   | 266 ++++++++++++++++++++++++++++++++++++++++++++++++
 3 files changed, 360 insertions(+), 4 deletions(-)
```
只有 3 个文件被修改，全部在 task 条目范围内。

### 4. 提交事实

一个提交：`eb0a34be73d170cb246f96a8e3025eaf0625194c`（verify: add static commands and missing-report check to red check (SPEC 16.11)）

远端推送：`git merge-base --is-ancestor eb0a34be ef2f2cda` → true。提交是 `origin/main` 的祖先（`ef2f2cda` 是其上的 report 信封提交），已推送。

### 5. 验收命令实跑

**命令 1：`npm run lint`**
```
> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✅

**命令 2：`npm run typecheck`**
```
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```
退出码：0 ✅

**命令 3：`npm test`**
```
 Test Files  62 passed (62)
      Tests  1267 passed (1267)
   Duration  22.61s
```
退出码：0 ✅

**命令 4：`npm test -- test/redcheck.test.ts && ! test -e .vitest`**
```
 Test Files  1 passed (1)
      Tests  23 passed (23)
   Duration  9.42s
```
退出码：0 ✅

**命令 5：`grep -qF "runRedCheck: static commands and missing reports" test/redcheck.test.ts`**
退出码：0 ✅

**命令 6：`grep -qF "staticCommands" src/redcheck.ts && grep -qF "staticCommands" test/redcheck.test.ts && grep -qF "no report produced" src/redcheck.ts && grep -qF "no report produced" test/redcheck.test.ts`**
退出码：0 ✅

**命令 7：`d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1`**
```
 Test Files  1 passed (1)
      Tests  23 passed (23)
   Duration  9.51s
```
退出码：0 ✅

**命令 8：`grep -qF "staticCommands" test/invariants.test.ts`**
退出码：0 ✅

### 6. 行为测试实跑

```
npx vitest run test/redcheck.test.ts
```
```
 Test Files  1 passed (1)
      Tests  23 passed (23)
```

```
npx vitest run test/invariants.test.ts
```
```
 Test Files  1 passed (1)
      Tests  74 passed (74)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，全部通过 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0，62 文件 1267 用例全过 | ✅ |
| 红检查测试通过无残留 | `npm test -- test/redcheck.test.ts && ! test -e .vitest` | exit 0，23 用例 | ✅ |
| 新 describe 组存在 | `grep -qF "runRedCheck: static commands and missing reports" test/redcheck.test.ts` | exit 0 | ✅ |
| 静态检查与缺报告进代码与测试 | 组合 grep | exit 0 | ✅ |
| 临时目录无残留 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ...` | exit 0 | ✅ |
| 不变量同步 | `grep -qF "staticCommands" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `RunRedCheckOpts` 加可选 `staticCommands`（字符串数组） | 条目 1 | `src/redcheck.ts:148-151`：`staticCommands?: string[]` | ✅ |
| 经注入的 `spawn` 以 `sh -c <命令>` 执行 | 条目 1 | `src/redcheck.ts:237-240`：`opts.spawn('sh', ['-c', cmd], { cwd: tree, timeout: opts.timeoutMs, stdio: 'pipe' } ...)` | ✅ |
| 超时用同一个 `timeoutMs` | 条目 1 | `src/redcheck.ts:240`：`timeout: opts.timeoutMs` | ✅ |
| 退出码 ≠ 0 → 问题 `file` 为 `'static'` | 条目 1 | `src/redcheck.ts:261`：`file: 'static'` | ✅ |
| `testName` 是命令原文 | 条目 1 | `src/redcheck.ts:262`：`testName: cmd` | ✅ |
| `reason` 含退出码与输出末 20 行 | 条目 1 | `src/redcheck.ts:224-225`：`STATIC_OUTPUT_TAIL_LINES = 20`；`src/redcheck.ts:263`：`` reason: `exit code ${String(exitCode)}\n${tail}` `` | ✅ |
| 超时也记一条，写明超时 | 条目 1 | `src/redcheck.ts:249-253`：`reason: 'timeout'` | ✅ |
| `ok` 两边都没问题才 true | 条目 1 | `src/redcheck.ts:358`：`ok: problems.length === 0` — `problems` 合并了 test 判定和 static 结果 | ✅ |
| 不传 `staticCommands` 时行为和现在一样 | 条目 1 | `src/redcheck.ts:349`：`const cmds = opts.staticCommands ?? [];` — 空数组，不执行任何命令 | ✅ |
| 测试文件超时 → 直接返回，不跑静态命令 | 条目 1 | `src/redcheck.ts:305-312`（new 超时 return）、`src/redcheck.ts:319-326`（keep 超时 return）— 都在 static 循环 (349) 之前 | ✅ |
| `keep.test.ts` 存在无报告 → 问题 `file: 'keep'`，`reason: 'no report produced'` | 条目 2 | `src/redcheck.ts:330-337`：`if (keepExists && keepResult?.report === null)` → `file: 'keep'`, `reason: 'no report produced'` | ✅ |
| `judgeRedCheck` 不改 | 条目 2 | diff 中 `judgeRedCheck` 函数体（60-128 行）不在改动范围内，仅 `RedCheckProblem.file` 类型扩展了 `'static'` | ✅ |
| 判断在 `runRedCheck` 里做 | 条目 2 | `src/redcheck.ts:329-337`：在 `runRedCheck` 函数内，调用 `judgeRedCheck` 之前 | ✅ |
| 新 describe 组名称 | 条目 3 | `test/redcheck.test.ts:434`：`describe('runRedCheck: static commands and missing reports', …)` | ✅ |
| `test/invariants.test.ts` 加 staticCommands | 条目 3 | `test/invariants.test.ts:580-585`：新用例 `'src/redcheck.ts has staticCommands (v046-b05)'` | ✅ |
| 已有用例一条都不改 | 条目 3 | `test/redcheck.test.ts` 的 diff 仅在原文件末尾追加（无 `-` 行），`test/invariants.test.ts` 仅新增用例 | ✅ |

### 行为要求

| 要求 | 出处 | 实跑证据 | 满足 |
|---|---|---|---|
| new 两条都失败 + exit 3 boom 命令 → 不过，问题里有命令原文、3、boom | 条目 1（加粗） | `npx vitest run test/redcheck.test.ts` → Tests 23 passed。覆盖该行为的用例："static command with non-zero exit fails, records exit code and output"（line 460） | ✅ |
| 换成 exit 0 命令 → 过 | 条目 1（加粗） | 同上。覆盖用例："static command with exit 0 passes alongside failing new tests"（line 435） | ✅ |
| 两条静态命令，第一过第二不过 → 只有第二条问题 | 条目 3 | 覆盖用例："two static commands, first passes second fails — only second problem recorded"（line 490） | ✅ |
| test 问题与 static 问题同时存在 | 条目 3 | 覆盖用例："test problems and static problems coexist in the result"（line 516） | ✅ |
| 静态命令超时（注入的假子进程） | 条目 3 | 覆盖用例："static command timeout records timeout problem"（line 544） | ✅ |
| 不传 staticCommands → 一条也没执行 | 条目 3 | 覆盖用例："no staticCommands means no static commands are executed"（line 597），用计数 spawn 验证只有 1 次调用 | ✅ |
| keep 存在、假子进程不写报告 → 不过，原因 no report produced | 条目 3 | 覆盖用例："keep.test.ts exists but no report produced — not ok with reason"（line 634） | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径 | 额外禁止 | `git diff --stat` 输出为空 | ✅ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff` 输出为空 | ✅ |
| 不改 `judgeRedCheck` 判据 | 额外禁止 | 函数体 (60-128) 不在 diff 中 | ✅ |
| 不改 `src/run.ts`、`src/roles/`、`src/runner/`、`src/backlog.ts` 等 | 额外禁止 | `git diff` 输出为空 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | `test/redcheck.test.ts` diff 无 `-` 行；`test/invariants.test.ts` 仅新增 | ✅ |
| 不改写已有断言 | 额外禁止 | 同上 | ✅ |
| 不拉起真实 runner 或网络请求 | 额外禁止 | 新用例仅用真实 vitest 子进程与真实 `sh`（task 允许） | ✅ |
| 不新增依赖 | 额外禁止 | `package.json` 无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增一个 `toContain('staticCommands')` 用例，无数值上下限变动。

### 被改写或删去的断言

无。`test/redcheck.test.ts` 和 `test/invariants.test.ts` 的 diff 均为纯追加，无任何已有 `expect(...)` 被删除或修改。

## 结论与理由

全部 8 条验收命令实跑通过。条目 1（静态命令）、条目 2（缺报告检测）、条目 3（测试用例覆盖）的所有结构和行为要求逐条核对满足。已有用例零修改。受保护路径与禁止路径均无改动。无新增依赖。提交已推送至远端（是 `origin/main` 的祖先）。diff 范围严格在 task 条目之内（3 个文件、360 行净增加、4 行结构性替换）。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b05",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["eb0a34be73d170cb246f96a8e3025eaf0625194c"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier all pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "62 files, 1267 tests passed" },
      { "cmd": "npm test -- test/redcheck.test.ts && ! test -e .vitest", "exit_code": 0, "summary": "23 tests passed, no .vitest leftover" },
      { "cmd": "grep -qF \"runRedCheck: static commands and missing reports\" test/redcheck.test.ts", "exit_code": 0, "summary": "describe group found" },
      { "cmd": "grep -qF \"staticCommands\" src/redcheck.ts && grep -qF \"staticCommands\" test/redcheck.test.ts && grep -qF \"no report produced\" src/redcheck.ts && grep -qF \"no report produced\" test/redcheck.test.ts", "exit_code": 0, "summary": "all four strings present" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d \"$d\"/collie-redcheck-* >/dev/null 2>&1", "exit_code": 0, "summary": "23 tests passed, no temp leftovers" },
      { "cmd": "grep -qF \"staticCommands\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 8 acceptance commands pass. Static command execution (SPEC 16.11) correctly implemented via injected spawn with sh -c, same timeoutMs, exit code + tail-20 in reason, timeout recorded. Missing keep report detected and recorded. judgeRedCheck unchanged. 7 new test cases cover both bold scenarios, mixed problems, timeout, no-staticCommands, and missing report. No protected or prohibited files modified, no dependency changes, no existing assertions altered. CI status unknown — deferred to R2."
}
```
