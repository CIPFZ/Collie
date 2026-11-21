The existing `idling` test at line 319 still asserts no `waited_secs`, confirming other interrupt causes don't carry it. This is correct per condition 2.

Now I have all evidence. Let me compile the verdict.

---

# 批次 v046-b30 审核

## 取证过程

### 1. 受保护路径检查

```
git diff --stat c2e4ba56..c6a7e2b8 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
→ (无输出，零行改动)
```

```
git diff --stat c2e4ba56..c6a7e2b8 -- package.json package-lock.json templates/collie.toml
→ (无输出，零行改动)
```

```
git diff c2e4ba56..c6a7e2b8 -- src/ ':(exclude)src/run.ts'
→ (无输出，src/ 下只改了 src/run.ts)
```

```
git diff c2e4ba56..c6a7e2b8 -- test/ ':(exclude)test/rule9-same-head.test.ts' ':(exclude)test/api-error-retry.test.ts'
→ (无输出，test/ 下只改了两个目标文件)
```

```
git log --format='%h %s' c2e4ba56..c6a7e2b8 -- test/acceptance
→ (无输出，acceptance test 目录未被触碰)
```

**结论：受保护路径零改动，依赖零变化，范围精确。**

### 2. 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 均通过 |
| 2 | `npm run typecheck` | 0 | tsc 零错误 |
| 3 | `npm test` | 0 | 72 文件 1482 测试全通过 |
| 4 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts test/api-error-retry.test.ts` | 0 | 2 文件 8 测试全通过 |
| 5 | `grep -qF "second queue with a new head_sha is retried, then escalates on its own repeat" test/rule9-same-head.test.ts && grep -qF "api_error with api_retry_wait_secs = 0 still records waited_secs: 0" test/api-error-retry.test.ts` | 0 | 两个测试名均找到 |

### 3. 提交事实

```
git log --oneline c2e4ba56..c6a7e2b8 -- . ':(exclude).collie/batches'
→ c6a7e2b runner: rule9_same_head checks only this run's head_sha; api_error retry always records waited_secs
```

```
git branch -r --contains c6a7e2b81d7b0469d136ee310b042e63bd06828e
→ origin/HEAD -> origin/main
   origin/main
```

提交已推送到 `origin/main`。

### 4. 不变量数值变化

```
git diff c2e4ba56..c6a7e2b8 -- test/invariants.test.ts
→ (无输出)
```

**无。**

### 5. 被改写或删去的断言

两个测试文件的 diff 均只在文件末尾追加新用例（`@@ -412,4 +412,72` 和 `@@ -318,4 +318,56`），无删除行、无修改行。

**无。**

### 6. 独立实跑行为测试

```
npx vitest run test/rule9-same-head.test.ts
→ Test Files  1 passed (1)
   Tests  4 passed (4)
```

```
npx vitest run test/api-error-retry.test.ts
→ Test Files  1 passed (1)
   Tests  4 passed (4)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 72 files 1482 tests | ✅ |
| 无 git 全局身份时两文件通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts test/api-error-retry.test.ts` | exit 0, 2 files 8 tests | ✅ |
| 两条新用例在 | `grep -qF …` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：rule9_same_head 只看这一次的 head_sha

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `findRule9CiHeadShas` 排除当前 run | task 条目 1 | `src/run.ts:2938` — `excludeRunId?: string` 参数；`src/run.ts:2947` — `if (dir === excludeRunId) continue;` | ✅ |
| 新增 `findRunCiResolvedHeadSha` 只读当前 run 的 ci.resolved head_sha | task 条目 1 | `src/run.ts:2967-2982` — 函数只读 `runId` 对应的 events 文件，返回 `ci.resolved` 的 `head_sha` | ✅ |
| 比较逻辑：这一次 head_sha 在先前 rule9 sha 中 → 才上报 | task 条目 1 | `src/run.ts:3345-3347` — `const currentHeadSha = findRunCiResolvedHeadSha(root, runId, currentBatchId); const priorRule9Shas = findRule9CiHeadShas(root, currentBatchId, runId); if (currentHeadSha !== undefined && priorRule9Shas.includes(currentHeadSha))` | ✅ |
| `escalated` 的 `head_sha` 写这一次的 | task 条目 1 | `src/run.ts:3348-3352` — `const headSha = currentHeadSha;` → `head_sha: headSha` | ✅ |
| 旧的 Map counting 逻辑已移除 | task 条目 1 | `grep counts.set\|counts.get\|duplicateEntry src/run.ts` → 无匹配 | ✅ |
| **行为验证**：第二次队列里新 head_sha B 先重试，再以 B 上报 | task 条目 1（加粗情形） | `npx vitest run test/rule9-same-head.test.ts` → `Tests 4 passed` — 新用例 "second queue with a new head_sha is retried, then escalates on its own repeat" 通过 | ✅ |

### 条目 2：api_error 续跑总带 waited_secs

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `waitedSecs` 类型改为 `number \| undefined` | task 条目 2 | `src/run.ts:3275` — `let waitedSecs: number \| undefined;` | ✅ |
| api_error 分支里 `waitedSecs` 被赋值（包括 0） | task 条目 2 | `src/run.ts:3276-3280` — `if (outcome.workerStopReason === 'api_error') { ... waitedSecs = config.limits.api_retry_wait_secs; }` | ✅ |
| 展开条件改为 `waitedSecs !== undefined` | task 条目 2 | `src/run.ts:3286` — `...(waitedSecs !== undefined ? { waited_secs: waitedSecs } : {})` | ✅ |
| 别的中断原因不带 `waited_secs` | task 条目 2 | 对非 api_error 路径 `waitedSecs` 保持 `undefined`；已有测试 `test/api-error-retry.test.ts:319` — `expect(retried).not.toHaveProperty('waited_secs')` 断言 idling 不带此字段，测试通过 | ✅ |
| **行为验证**：api_retry_wait_secs=0 时 waited_secs=0 | task 条目 2（加粗情形） | `npx vitest run test/api-error-retry.test.ts` → `Tests 4 passed` — 新用例 "api_error with api_retry_wait_secs = 0 still records waited_secs: 0" 通过 | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 新测试名完全匹配 | task 条目 3 | `grep -qF` 验收命令 exit 0 | ✅ |
| 已有断言一条都不改 | task 条目 3 | diff 两个测试文件仅有末尾追加，零删除行、零修改行 | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径 | task | `git diff --stat` 对全部受保护路径无输出 | ✅ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml` | task | `git diff --stat` 无输出 | ✅ |
| 不改 `src/` 下 `src/run.ts` 以外文件 | task | `git diff -- src/ ':(exclude)src/run.ts'` 无输出 | ✅ |
| 不改仲裁规则判定、fix_max 计数、rule9_twice 判断、batchCleanup | task | diff 中无此类改动：仅修改 `findRule9CiHeadShas`（加 excludeRunId）、新增 `findRunCiResolvedHeadSha`、修改调用处比较逻辑、修改 `waitedSecs` 类型与展开条件 | ✅ |
| 不删/跳过测试，不改写已有断言 | task | diff 只有追加 | ✅ |
| 测试无真实 runner/网络/等待/全局 git | task | 验收命令 4 (无全局 git) 通过；新测试使用 FakeRunner、ciFailureFetch()、controllableFingerprint() | ✅ |
| 不新增依赖 | task | `package.json` 未改 | ✅ |

### 不变量数值变化

无。

### 被改写或删去的断言

无。

## 结论与理由

全部 5 条验收命令实跑通过。代码变更精确地落在 task.md 三个条目范围内：
- 条目 1：`findRule9CiHeadShas` 增加 `excludeRunId` 参数排除当前 run，新增 `findRunCiResolvedHeadSha` 读取当前 run 的 ci.resolved head_sha，调用处改为只比较当前 run 的 head_sha 与先前 rule9 降级的 sha，`escalated` 写当前的 head_sha。逻辑正确。
- 条目 2：`waitedSecs` 从 `number` 改为 `number | undefined`，api_error 路径始终赋值（含 0），展开条件从 `> 0` 改为 `!== undefined`。非 api_error 路径不带此字段。正确。
- 条目 3：两条新用例名称完全匹配，行为验证实跑通过，已有断言零改动。

无受保护文件改动，无依赖变更，无范围蔓延。提交已推送到 origin/main。

**PASS。**

```json
{
  "schema_version": 1,
  "batch_id": "v046-b30",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["c6a7e2b81d7b0469d136ee310b042e63bd06828e"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "72 files 1482 tests passed" },
      { "cmd": "e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts test/api-error-retry.test.ts", "exit_code": 0, "summary": "2 files 8 tests passed" },
      { "cmd": "grep -qF ... test/rule9-same-head.test.ts && grep -qF ... test/api-error-retry.test.ts", "exit_code": 0, "summary": "both test names found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 5 acceptance commands pass. Code changes are scoped precisely to the 3 task items: rule9_same_head now compares only this run's ci.resolved head_sha against prior rule9 runs (excluding current), api_error retry always records waited_secs (including 0), and two new correctly-named test cases verify the behavior. No protected files modified, no dependency changes, no existing assertions altered. CI verification deferred to R2."
}
```
