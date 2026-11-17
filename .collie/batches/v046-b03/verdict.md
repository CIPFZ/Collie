Confirmed: `judgeRedCheck` (lines 60–129) uses zero I/O calls; all I/O is confined to `readJsonReport`, `runOneFile`, and `runRedCheck`. Now I have all evidence. Let me compile the verdict.

---

# 批次 v046-b03 审核

## 取证过程

### 1. 受保护文件

```
git diff --stat 1e0d70c..adf4d6e -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。0 行变动。✓

### 2. 额外禁止路径

```
git diff --stat 1e0d70c..adf4d6e -- .github/ eslint.config.js vitest.config.ts package.json src/run.ts 'src/roles/' 'src/runner/' src/arbiter.ts src/gate.ts src/evidence.ts src/view.ts src/follow.ts
```
结果：无输出。✓

### 3. 依赖变化

```
git diff 1e0d70c..adf4d6e -- package.json package-lock.json
```
结果：无输出。无新增依赖。✓

### 4. 提交事实

```
git rev-parse adf4d6e45bd47f5303f0d912152a9e2d8d153c58
→ adf4d6e45bd47f5303f0d912152a9e2d8d153c58
```

```
git branch -r --contains adf4d6e45bd47f5303f0d912152a9e2d8d153c58
→ origin/HEAD -> origin/main
  origin/main
```

提交存在且已推送至 `origin/main`。✓

### 5. CI 结论

无 GitHub 凭据，查不到 CI 状态。`ci_conclusion` 填 `unknown`，`ci_branch_matched` 填 `null`。CI 以 R2 取证为准。

### 6. 验收命令实跑

#### 命令 1: `npm run lint`
退出码：0。输出 "Checking formatting... All matched files use Prettier code style!" ✓

#### 命令 2: `npm run typecheck`
退出码：0。无错误输出。✓

#### 命令 3: `npm test`
退出码：0。Test Files 62 passed (62), Tests 1236 passed (1236)。✓

#### 命令 4: `npm test -- test/redcheck.test.ts && ! test -e .vitest`
退出码：0。Test Files 1 passed (1), Tests 16 passed (16)。`.vitest` 不存在。✓

#### 命令 5: `grep -cE "^\s+it(\.each)?\(" test/redcheck.test.ts | grep -qE "^(1[2-9]|[2-9][0-9])$"`
退出码：0。实际 count 为 23（≥12）。✓

#### 命令 6: `grep -qE "export function judgeRedCheck" src/redcheck.ts && grep -qE "export (async )?function runRedCheck" src/redcheck.ts`
退出码：0。两个函数都导出了。✓

#### 命令 7: `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1`
退出码：0。16 tests passed，系统临时目录无残留。✓

#### 命令 8: `grep -qE "redcheck" test/invariants.test.ts`
退出码：0。✓

### 7. 行为要求实跑

```
npx vitest run test/redcheck.test.ts --reporter=verbose
```
输出：
```
 ✓ test/redcheck.test.ts > judgeRedCheck > passes when all new tests fail 3ms
 ✓ test/redcheck.test.ts > judgeRedCheck > fails when new has a passing test, naming it 1ms
 ✓ test/redcheck.test.ts > judgeRedCheck > fails when new has a skipped test 0ms
 ✓ test/redcheck.test.ts > judgeRedCheck > fails when new has a todo test 0ms
 ✓ test/redcheck.test.ts > judgeRedCheck > fails when new report is null (file load error) 0ms
 ✓ test/redcheck.test.ts > judgeRedCheck > fails when new has zero test cases (file load error) 0ms
 ✓ test/redcheck.test.ts > judgeRedCheck > passes when no keep file (keepReport undefined) 0ms
 ✓ test/redcheck.test.ts > judgeRedCheck > passes when keep report is null (no keep file) 0ms
 ✓ test/redcheck.test.ts > judgeRedCheck > passes when new all fail and keep all pass 1ms
 ✓ test/redcheck.test.ts > judgeRedCheck > fails when keep has a failing test, naming it 1ms
 ✓ test/redcheck.test.ts > judgeRedCheck > fails when keep has zero test cases 0ms
 ✓ test/redcheck.test.ts > runRedCheck (real vitest) > passes when new has two failing tests 751ms
 ✓ test/redcheck.test.ts > runRedCheck (real vitest) > fails when new has one pass and one fail, naming the passing test 753ms
 ✓ test/redcheck.test.ts > runRedCheck (real vitest) > fails when new file has an import error (file load failure) 753ms
 ✓ test/redcheck.test.ts > runRedCheck (real vitest) > fails when new all fail but keep has one failing test, naming it 1495ms
 ✓ test/redcheck.test.ts > runRedCheck (real vitest) > fails on timeout with injected fake spawn 12ms
 Tests  16 passed (16)
```

```
npx vitest run test/invariants.test.ts --reporter=verbose
→ Tests 72 passed (72)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1236 passed | ✅ |
| 红检查专项 + 无 .vitest | `npm test -- test/redcheck.test.ts && ! test -e .vitest` | exit 0, 16 passed | ✅ |
| 专项 ≥ 12 个 | `grep -cE ...` | 23（exit 0）| ✅ |
| 两个函数导出 | `grep -qE ...` | exit 0 | ✅ |
| TMPDIR 无残留 | `d=$(mktemp -d) && TMPDIR=$d ...` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "redcheck" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `judgeRedCheck` 是纯函数：不起子进程、不读写文件 | 条目 1 | `src/redcheck.ts:60-129` — 函数体无 I/O 调用；grep 确认所有 readFileSync/existsSync/rmSync/spawn 仅在 readJsonReport/runOneFile/runRedCheck 中使用 | ✅ |
| `judgeRedCheck` 输入 new+keep 报告，输出 `{ok, problems}` | 条目 1 | `src/redcheck.ts:60-63` — 参数 `{newReport, keepReport?}`，返回 `RedCheckJudgment` | ✅ |
| `problems` 每条点名文件、用例、原因 | 条目 1 | `src/redcheck.ts:36-39` — `RedCheckProblem { file, testName, reason }` | ✅ |
| new：passed/skipped/todo/zero-cases 都不过 | 条目 1 | `src/redcheck.ts:68-101` — null→问题, numTotalTests===0→问题, passed/skipped/pending/todo→问题 | ✅ |
| keep：可以没有；有的话须全部通过 | 条目 1 | `src/redcheck.ts:105-126` — undefined/null 时跳过；numTotalTests===0→问题；非 passed→问题 | ✅ |
| `runRedCheck(tree, outDir, opts)` 导出 | 条目 2 | `src/redcheck.ts:222` — `export async function runRedCheck` | ✅ |
| JSON 报告用 `--outputFile` 写到 tree 之外的系统临时目录（collie-redcheck- 前缀） | 条目 2 | `src/redcheck.ts:190` — `--outputFile=${reportPath}`；`src/redcheck.ts:241` — `mkdtempSync(join(tmpdir(), 'collie-redcheck-'))` | ✅ |
| 读完删掉 | 条目 2 | `src/redcheck.ts:200-205` — 读后 rmSync 单个报告；`src/redcheck.ts:279-285` — finally 中 rmSync 整个报告目录 | ✅ |
| new.test.ts 不存在算不过 | 条目 2 | `src/redcheck.ts:231-237` — `!existsSync(join(tree, newFile))` 返回 `ok:false` | ✅ |
| 超时算不过并写明是超时 | 条目 2 | `src/redcheck.ts:245-252` — `timedOut` 判断，reason 为 `'timeout'` | ✅ |
| 超时毫秒数与起子进程的函数由调用方经 opts 传入 | 条目 2 | `src/redcheck.ts:140-146` — `RunRedCheckOpts { timeoutMs, spawn }`；`src/redcheck.ts:191` — `timeout: opts.timeoutMs`；`src/redcheck.ts:188` — `opts.spawn` | ✅ |
| 不在 src/ 里写死数字（超时相关） | 条目 2 | grep 确认 src/redcheck.ts 无 setInterval/setTimeout/硬编码超时数字 | ✅ |
| 返回 judgeRedCheck 结果 + 两文件各执行几条 | 条目 2 | `src/redcheck.ts:148-151` — `RunRedCheckResult extends RedCheckJudgment { newTestCount, keepTestCount }` | ✅ |
| 测试用真实 vitest 跑临时目录里的真实文件 | 条目 3 | `test/redcheck.test.ts:245-258` — createTestTree 建真实临时目录，写真实 .test.ts 文件，传 `execFile` 作为 spawn | ✅ |
| 临时目录在系统临时目录下、collie-redcheck- 前缀 | 条目 3 | `test/redcheck.test.ts:246` — `mkdtempSync(join(tmpdir(), 'collie-redcheck-'))` | ✅ |
| node_modules 链进去 | 条目 3 | `test/redcheck.test.ts:249` — `symlinkSync(join(repoRoot, 'node_modules'), ...)` | ✅ |
| 用完删掉，系统临时目录里不留下 collie-redcheck-* | 条目 3 | `test/redcheck.test.ts:266-277` — afterAll 清理并断言 `leftovers.toHaveLength(0)` | ✅ |
| invariants.test.ts 加 `--outputFile` 检查 | 条目 3 | `test/invariants.test.ts:572-576` — `expect(content).toContain('--outputFile')` | ✅ |
| 超时一条用注入的假子进程 | 条目 3 | `test/redcheck.test.ts:387-427` — fakeSpawn 注入 `{killed:true}` 错误 | ✅ |

### 行为要求（需实跑测试验证）

| 要求 | 出处 | 实跑命令 & 结果 | 满足 |
|---|---|---|---|
| new 两条都失败 → 过 | 条目 2 粗体 | `npx vitest run test/redcheck.test.ts` → `✓ passes when new has two failing tests` (Tests 16 passed) | ✅ |
| new 一条失败一条通过 → 不过, 点名通过的那一条 | 条目 2 粗体 | `npx vitest run test/redcheck.test.ts` → `✓ fails when new has one pass and one fail, naming the passing test` (Tests 16 passed) | ✅ |
| new 一导入就报错 → 不过, 原因写明文件加载失败 | 条目 2 粗体 | `npx vitest run test/redcheck.test.ts` → `✓ fails when new file has an import error (file load failure)` (Tests 16 passed) | ✅ |
| new 全失败而 keep 有一条失败 → 不过, 点名那一条 | 条目 2 粗体 | `npx vitest run test/redcheck.test.ts` → `✓ fails when new all fail but keep has one failing test, naming it` (Tests 16 passed) | ✅ |
| 超时用注入的假子进程 | 条目 3 | `npx vitest run test/redcheck.test.ts` → `✓ fails on timeout with injected fake spawn` (Tests 16 passed) | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 遵守 |
|---|---|---|---|
| 改动受保护路径 | 额外禁止 | `git diff --stat` 受保护路径 → 无输出 | ✅ |
| 改动 .github/、eslint.config.js、vitest.config.ts、package.json | 额外禁止 | `git diff --stat` → 无输出 | ✅ |
| 改动 src/run.ts、src/roles/、src/runner/ 等 | 额外禁止 | `git diff --stat` → 无输出 | ✅ |
| 把红检查接进队列或加 CLI 子命令 | 额外禁止 | diff 仅涉及 src/redcheck.ts（新文件）、test/redcheck.test.ts（新文件）、test/invariants.test.ts（+7行）| ✅ |
| 删除/跳过测试或改写已有断言 | 额外禁止 | invariants.test.ts diff 仅添加 7 行新测试，无删改 | ✅ |
| 测试拉起真实 runner 或网络请求 | 额外禁止 | 测试只起 vitest 子进程（条目允许）和注入假 spawn | ✅ |
| 新增依赖 | 额外禁止 | package.json 无变动 | ✅ |
| 改注释/字面凑验收（铁律 26）| 额外禁止 | 无此类行为 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅添加了一个新的结构检查，未修改任何已有数值上下限。

### 被改写或删去的断言

无。`test/invariants.test.ts` 仅添加 7 行新代码（一个新 `it` 块），未删改任何已有 `expect()`。

## 结论与理由

全部 8 条验收命令实跑通过，16 条专项测试全部通过。`judgeRedCheck` 确为纯函数，`runRedCheck` 正确使用 `--outputFile` 写到 `collie-redcheck-` 前缀临时目录并清理。超时与 spawn 均由 opts 注入，src/ 中无硬编码超时数字。四种加粗场景各有对应的真实 vitest 集成测试。测试临时目录在 afterAll 中断言无残留。不变量同步。无受保护文件修改、无额外禁止文件修改、无新依赖、无已有断言改写。提交已推送至 origin/main。

**PASS**

```json
{
  "schema_version": 1,
  "batch_id": "v046-b03",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["adf4d6e45bd47f5303f0d912152a9e2d8d153c58"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "62 files, 1236 tests passed" },
      { "cmd": "npm test -- test/redcheck.test.ts && ! test -e .vitest", "exit_code": 0, "summary": "16 tests passed, no .vitest" },
      { "cmd": "grep -cE \"^\\s+it(\\.each)?\\(\" test/redcheck.test.ts | grep -qE \"^(1[2-9]|[2-9][0-9])$\"", "exit_code": 0, "summary": "23 test cases (>=12)" },
      { "cmd": "grep -qE \"export function judgeRedCheck\" src/redcheck.ts && grep -qE \"export (async )?function runRedCheck\" src/redcheck.ts", "exit_code": 0, "summary": "both functions exported" },
      { "cmd": "d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d \"$d\"/collie-redcheck-* >/dev/null 2>&1", "exit_code": 0, "summary": "no collie-redcheck-* leftovers in TMPDIR" },
      { "cmd": "grep -qE \"redcheck\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 8 acceptance commands pass. 16 redcheck tests pass (23 it-blocks, ≥12 required). judgeRedCheck is a pure function. runRedCheck uses --outputFile to collie-redcheck- temp dir, injects timeout/spawn via opts. Four bold integration scenarios verified with real vitest. No protected files, no forbidden files, no dependency changes, no assertion rewrites. CI unknown — to be verified by R2."
}
```
