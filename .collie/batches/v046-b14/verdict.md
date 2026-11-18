Now I have everything needed. Let me write the verdict.

---

# 批次 v046-b14 审核

## 取证过程

### 1. 受保护路径检查

```
git diff --stat fc004bd856dd1b2e6341595aeda1b5baacb3d276..ee15654 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护路径无改动。`spec_diff_lines` = 0。

### 2. 额外禁止路径检查

```
git diff --stat fc004bd856dd1b2e6341595aeda1b5baacb3d276..ee15654 -- .github/ eslint.config.js vitest.config.ts package.json scripts/mutation.ts
```
结果：无输出。

```
git diff --stat fc004bd856dd1b2e6341595aeda1b5baacb3d276..ee15654 -- src/arbiter.ts src/gate.ts src/acceptance.ts src/ladder.ts 'src/roles/' 'src/runner/' src/view.ts src/follow.ts
```
结果：无输出。

### 3. 依赖变化

```
git diff fc004bd856dd1b2e6341595aeda1b5baacb3d276..ee15654 -- package.json package-lock.json
```
结果：无输出。无新增依赖。

### 4. 提交事实

单一提交：`ee156545c47f1a095ecfd5b7f8f53efee7e786b8`，提交说明 `runner: r2.commit event, sha-based R2 commit identification for protected-path diff (SPEC 16.14)`。

```
git ls-remote origin
```
远端 HEAD 为 `d8dac8bcaedc7e52aca8a46951a4d7274f8a1c20`，`ee156545` 不在远端（`remote_has_head` = false）。

### 5. 验收命令实跑

#### 5.1 `npm run lint` → 退出码 0 ✅
#### 5.2 `npm run typecheck` → 退出码 0 ✅
#### 5.3 `npm test` → **退出码 1 ❌**

失败用例：`test/exit-codes.test.ts > exit-codes: the journal of a full run (SPEC 3.6) > records the v0.1 event sequence in order`

```
Expected: ["run.started","batch.selected","batch.task_written","worker.started","worker.finished",
           "reviewer.started","reviewer.finished","reviewer.verdict","ci.resolved",
           "evidence.collected","verdict.pushed","run.finished"]

Received: ["run.started","batch.selected","r2.commit","batch.task_written","worker.started",
           "worker.finished","reviewer.started","reviewer.finished","reviewer.verdict",
           "ci.resolved","evidence.collected","r2.commit","verdict.pushed","run.finished"]
```

原因：`r2Commit()` 在 task commit 之前和 verdict commit 之前各记录一条 `r2.commit` 事件，改变了事件序列，但 `test/exit-codes.test.ts:134` 的 `toEqual` 断言期望的是旧序列。worker 未修改此测试（也不被允许——task 只允许修改 `test/schema.test.ts` 的一处），也未在偏离报告中标记它。

#### 5.4 `npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts` → 退出码 0 ✅
（3 文件 117 用例全部通过）

#### 5.5 两组用例 grep → 退出码 0 ✅
#### 5.6 `commit(root` 恰好一处 → 退出码 0 ✅（确认 1 处）
#### 5.7 `r2.commit` 在 schema → 退出码 0 ✅
#### 5.8 变异检查 → 退出码 0 ✅（`mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0`）
#### 5.9 不变量同步 → 退出码 0 ✅

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 1, 1 failed / 1367 passed | ❌ |
| 新测试与取证、事件类型的测试通过 | `npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts` | exit 0, 117 passed | ✅ |
| 两组用例在 | grep | exit 0 | ✅ |
| R2 的提交都走同一处 | grep | exit 0 (1 处) | ✅ |
| 新事件进了类型清单 | grep | exit 0 | ✅ |
| 变异检查 | mutation.ts | exit 0, caught 43 survived 0 | ✅ |
| 不变量同步 | grep | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新文件 test/r2-commits.test.ts 第一组 describe | 条目 1 | `test/r2-commits.test.ts:555`: `describe('rule 2 counts every commit that R2 did not make'` | ✅ |
| 假 worker 的一个提交改了 SPEC.md，四种开头各一条 → BLOCK 规则 2 | 条目 1 | `test/r2-commits.test.ts:569-587`: `it.each` 四种 prefix + `expect(code).toBe(20)` + `expect(downgraded?.rule).toBe(2)`；`npx vitest run test/r2-commits.test.ts` → Tests 10 passed | ✅ |
| "docs: issue v99-b01 task envelope" → BLOCK 规则 2 | 条目 1 | `test/r2-commits.test.ts:589-601`: acceptanceWorkerScene + `expect(code).toBe(20)` + `expect(downgraded?.rule).toBe(2)`；`npx vitest run test/r2-commits.test.ts` → Tests 10 passed | ✅ |
| 事件类型加 `r2.commit`（sha, subject） | 条目 2 | `src/schema/index.ts:288`: `'r2.commit',` | ✅ |
| r2Commit 辅助函数记 `r2.commit` 事件 | 条目 2 | `src/run.ts:1076-1084`: `async function r2Commit(...)` 调 `commit(root,...)` 再 `rec.record('r2.commit', { sha, subject })` | ✅ |
| 整个文件里直接调 `commit(root` 的只剩辅助函数里的一处 | 条目 2 | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cE "\bcommit\(root"` → 1 | ✅ |
| 救援提交不经过 r2Commit、不记事件 | 条目 2 | `src/run.ts:387`: 用 raw `git commit -m "wip(collie):..."` ，不调 `r2Commit` | ✅ |
| r2Shas 由 run.ts 从本机全部 journal 收集：r2.commit sha, batch.task_written commit, verdict.pushed sha, verdict.push_failed sha | 条目 2 | `src/run.ts:1098-1121`: collectR2Shas 遍历 runsDir，收集全部四种事件 | ✅ |
| 提交说明的开头不再影响 protected-path 计数 | 条目 2 | `src/evidence.ts:203-207`: 当 r2Shas 提供时用 sha 匹配，不看 subject | ✅ |
| commits_actual 的列法不变 | 条目 2 | `src/evidence.ts:305`: `commits_actual: workerCommits.map((c) => c.sha)` 仍用 workerCommits（prefix-based） | ✅ |
| 第二组 describe: FIX→PASS 路径 | 条目 3 | `test/r2-commits.test.ts:625-653`: `it('FIX then PASS: R2 ruling commit changes docs/progress.md, second run still PASS')`；`npx vitest run test/r2-commits.test.ts` → Tests 10 passed | ✅ |
| 规则 1 自动重跑路径 | 条目 3 | `test/r2-commits.test.ts:655-691`: `it('rule 1 auto-retry: second run is not blocked by R2 retry commit')`；Tests 10 passed | ✅ |
| 中断后自动重跑路径 | 条目 3 | `test/r2-commits.test.ts:693-733`: `it('interrupt auto-retry: second run is not blocked by R2 retry commit')`；Tests 10 passed | ✅ |
| R2 提交个数 == journal r2.commit 条数 | 条目 3 | `test/r2-commits.test.ts:735-754`: `it('R2 commit count in git log equals r2.commit count in journal')`；Tests 10 passed | ✅ |
| 删 .collie/runs/ → 第 2 次被规则 2 拦下（已知保守行为） | 条目 3 | `test/r2-commits.test.ts:756-830`: `it('deleting .collie/runs/ causes rule 2 to block...')`；Tests 10 passed | ✅ |
| 允许改写的旧用例只一处: schema.test.ts 个数 41→42 加 toContain | 条目 3 | diff 确认只改 `test/schema.test.ts:252`: `toHaveLength(42)` + `:255` `toContain('r2.commit')`  | ✅ |
| invariants 加 commit(root 恰好一处 | 条目 3 | `test/invariants.test.ts:659`: `it('src/run.ts non-comment lines have exactly one direct commit(root call (v046-b14)')` | ✅ |
| invariants 加 r2.commit 在 schema | 条目 3 | `test/invariants.test.ts:673`: `it('src/schema/index.ts has r2.commit event type (v046-b14)')` | ✅ |
| **额外禁止：不改受保护路径** | 禁止列表 | `git diff --stat` 无输出 | ✅ |
| **额外禁止：不改 .github/ eslint vitest package.json mutation.ts** | 禁止列表 | 无输出 | ✅ |
| **额外禁止：不改 arbiter gate acceptance ladder roles runner view follow** | 禁止列表 | 无输出 | ✅ |
| **额外禁止：不把救援提交记成 R2 的提交** | 禁止列表 | `src/run.ts:387` 用 raw git commit，不经过 r2Commit | ✅ |
| **额外禁止：不让提交说明开头继续影响受保护路径计数** | 禁止列表 | `src/evidence.ts:203-207` 当 r2Shas 存在时完全用 sha 匹配 | ✅ |
| **额外禁止：不删除或跳过任何测试** | 禁止列表 | diff 中无删除的 test 或 `it.skip` | ✅ |
| **额外禁止：不改写条目 3 点名之外的已有断言** | 禁止列表 | 只改 schema.test.ts 一处 `toHaveLength` | ✅ |
| **额外禁止：不新增依赖** | 禁止列表 | package.json 无变化 | ✅ |
| **额外禁止：不用真实 runner 或网络** | 禁止列表 | 新测试用 FakeRunner + Sandbox | ✅ |

### 不变量数值变化

- `test/schema.test.ts:252`: `toHaveLength(41)` → `toHaveLength(42)` — task 明确允许的变更
- `test/invariants.test.ts`: 新增两个不变量断言，无已有数值改动
- 无其他数值变化

### 被改写或删去的断言

- `test/schema.test.ts:252`: `expect(EVENT_TYPES).toHaveLength(41)` → `expect(EVENT_TYPES).toHaveLength(42)` — SPEC 中新增了 `r2.commit` 事件类型，从 41 增到 42，要求仍有效，只是数量正确增长
- 无其他被改写或删去的断言

## 结论与理由

**FIX**。

实现在逻辑上是正确的：`r2Commit` 辅助函数、`collectR2Shas`、`evidence.ts` 的 sha-based 过滤以及新测试文件全部符合条目要求。但 `npm test`（验收命令 #3）失败，原因是 `test/exit-codes.test.ts:134` 的 `records the v0.1 event sequence in order` 用例期望旧的事件序列，新增的 `r2.commit` 事件使实际序列多出两个条目。

task 明确说：「你发现有别的现有用例因此失败，停下，在『偏离或疑问』里写明是哪一条，不要自己改。」worker 需要在 report 中标记此用例并请求 R1 决定如何处理（是否允许修改此用例，或是否有其他方案）。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b14",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": ["ee156545c47f1a095ecfd5b7f8f53efee7e786b8"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "lint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 1, "summary": "1 failed (exit-codes.test.ts: records the v0.1 event sequence in order), 1367 passed" },
      { "cmd": "npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts", "exit_code": 0, "summary": "117 passed" },
      { "cmd": "grep -qF ... test/r2-commits.test.ts", "exit_code": 0, "summary": "both describe blocks found" },
      { "cmd": "grep -vE ... src/run.ts | grep -cE commit(root | grep -qx 1", "exit_code": 0, "summary": "exactly 1 direct commit(root call" },
      { "cmd": "grep -qF r2.commit src/schema/index.ts", "exit_code": 0, "summary": "r2.commit in schema" },
      { "cmd": "npx tsx scripts/mutation.ts ...", "exit_code": 0, "summary": "caught 43 survived 0 invalid 0 timeout 0 stale 0" },
      { "cmd": "grep -qF r2.commit test/invariants.test.ts", "exit_code": 0, "summary": "r2.commit in invariants" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [
    "test/exit-codes.test.ts:134 'records the v0.1 event sequence in order' fails: the new r2.commit events (task commit + verdict commit) change the event sequence from 12 to 14 entries. Worker must flag this in '偏离或疑问' per task instructions ('你发现有别的现有用例因此失败，停下'), then request R1 guidance on whether to update this test (since only test/schema.test.ts was explicitly allowed to be changed). npm test must pass for the batch to be accepted."
  ],
  "reason": "npm test (verification #3) exits 1. test/exit-codes.test.ts 'records the v0.1 event sequence in order' fails because two r2.commit events are now emitted in the journal but the expected sequence was not updated. All other verifications pass. CI status unknown — CI 以 R2 取证为准."
}
```
