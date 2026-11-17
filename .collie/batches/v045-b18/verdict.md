No forbidden paths modified. Let me compile the final verdict. All checks pass:

1. ✅ `npm run lint` — exit 0
2. ✅ `npm run typecheck` — exit 0
3. ✅ `npm test` — 60 files, 1196 tests passed
4. ✅ `npm test -- test/runner-claude.test.ts` — 79 tests passed
5. ✅ `grep -qF "failed runs always carry a stop reason"` — exit 0
6. ✅ No protected files modified
7. ✅ No dependency changes
8. ✅ No existing assertions removed or changed
9. ✅ No forbidden paths modified
10. ✅ Commit pushed to remote
11. ✅ All EXIT_FAILED paths carry a stopReason
12. ✅ Code change is minimal and correct (`stopReason: rest.stopReason ?? 'error'`)
13. ✅ All 4 required test cases present in the new describe block

---

# 批次 v045-b18 审核

## 取证过程

### 1. 受保护文件检查
```
git diff --stat 438a5d5..ced58c7 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护文件未被修改。

### 2. 额外禁止路径检查
```
git diff --stat 438a5d5..ced58c7 -- .github/ eslint.config.js vitest.config.ts package.json src/run.ts src/arbiter.ts src/gate.ts src/evidence.ts src/view.ts src/follow.ts
```
结果：无输出。任务额外禁止的路径均未被修改。

### 3. 依赖变化检查
```
git diff 438a5d5..ced58c7 -- package.json package-lock.json
```
结果：无输出。无依赖变化。

### 4. Diff 范围确认
```
git diff --stat 438a5d5..ced58c7 -- . ':(exclude).collie/batches'
 src/runner/claude.ts       |  4 +-
 test/runner-claude.test.ts | 99 ++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 102 insertions(+), 1 deletion(-)
```
仅修改了 `src/runner/claude.ts`（代码改动）和 `test/runner-claude.test.ts`（新增测试），完全在 task 条目范围内。

### 5. 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | `All matched files use Prettier code style!` |
| 2 | `npm run typecheck` | 0 | 无错误 |
| 3 | `npm test` | 0 | 60 files, 1196 tests passed |
| 4 | `npm test -- test/runner-claude.test.ts` | 0 | 1 file, 79 tests passed |
| 5 | `grep -qF "failed runs always carry a stop reason" test/runner-claude.test.ts` | 0 | 匹配到 |

### 6. 提交与推送确认
```
git log --format='%H %s' 438a5d5..ced58c7 -- . ':(exclude).collie/batches'
ced58c76e3ca4e8ddeefeca8e42e4b15c0d0cabc runner: failed runs always carry a stop reason (SPEC 14.22)
```

```
git merge-base --is-ancestor ced58c7 origin/main → YES
```
提交已推送到远端 `origin/main`。

### 7. 已有断言检查
```
git diff 438a5d5..ced58c7 -- test/runner-claude.test.ts | grep '^-' | grep -v '^---'
```
结果：无输出。测试文件无删除行，所有已有断言完整保留。

### 8. 不变量数值变化
```
git diff 438a5d5..ced58c7 -- test/invariants.test.ts
```
结果：无输出。无不变量数值改动。

### 9. 被改写或删去的断言
无。diff 中 `test/runner-claude.test.ts` 只有新增行（99 行插入，0 行删除），无任何已有 `expect(...)` 被修改或删除。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, 通过 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, 通过 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 60 files 1196 tests passed | ✅ |
| 运行器的测试通过 | `npm test -- test/runner-claude.test.ts` | exit 0, 79 tests passed | ✅ |
| 新的一组测试在 | `grep -qF "failed runs always carry a stop reason" test/runner-claude.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目要求核对

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| SDK 抛错分支里，汇总没有结束原因的记 `error` | task 条目 1 | `src/runner/claude.ts:555` — `return { ...rest, exitCode: EXIT_FAILED, stopReason: rest.stopReason ?? 'error' };` | ✅ |
| 被软停的仍是 `stopped` | task 条目 1 | `src/runner/claude.ts:272` — `if (interrupted) return 'stopped';` ，`aggregateResults` 中优先级最高，`?? 'error'` 不会覆盖 | ✅ |
| 有 `error_max_turns` 的仍是 `turns_exhausted` | task 条目 1 | `src/runner/claude.ts:273` — `if (results.some((r) => r.subtype === 'error_max_turns')) return 'turns_exhausted';` | ✅ |
| `is_error: true` → 结束原因 `error`（只补测试不改代码） | task 条目 1 | `src/runner/claude.ts:268,274` — `allSucceeded` 因 `is_error === true` 为 false，`stopReason` 返回 `'error'`；测试在 `test/runner-claude.test.ts:1300-1314` | ✅ |
| 成功但文本为空 → 不带 `finalText`（只补测试不改代码） | task 条目 1 | `src/runner/claude.ts:301-306` — `results.map(r => r.result).filter(...).join('\n\n') \|\| undefined`，空串 `'' \|\| undefined = undefined`；测试在 `test/runner-claude.test.ts:1316-1330` | ✅ |
| **做完之后：`run` 的任何返回值，只要退出码不是 0，就带结束原因** | task 条目 1 | 全部 `EXIT_FAILED` 路径：L555 (`stopReason: rest.stopReason ?? 'error'`), L560-562 (`stopReason: 'error'`), L574-577 (`stopReason: 'stopped'`), L309+274 (aggregateResults 中 `!allSucceeded` → `'error'`) — 全部带 stopReason | ✅ |
| 新 describe 组名为 `failed runs always carry a stop reason` | task 条目 2 | `test/runner-claude.test.ts:1234` — `describe('runner-claude: failed runs always carry a stop reason', () => {` | ✅ |
| 一条成功结果后抛错 → 退出码非 0、结束原因 error、花费与轮数照常带回、没有 finalText | task 条目 2 | `test/runner-claude.test.ts:1235-1260`；实跑 `npx vitest run test/runner-claude.test.ts` → 79 tests passed | ✅ |
| 两条成功结果后抛错 → 同上，轮数是合计 | task 条目 2 | `test/runner-claude.test.ts:1262-1298`；`expect(result.numTurns).toBe(7)` (3+4=7)；实跑通过 | ✅ |
| `success` 但 `is_error: true` → 退出码非 0、结束原因 error、没有 finalText | task 条目 2 | `test/runner-claude.test.ts:1300-1314`；实跑通过 | ✅ |
| 成功、文本空串 → 退出码 0、返回值里没有 finalText 这个键 | task 条目 2 | `test/runner-claude.test.ts:1316-1330`；`expect(result.exitCode).toBe(0)` + `expect(result).not.toHaveProperty('finalText')`；实跑通过 | ✅ |
| 已有用例一条都不改 | task 条目 2 | diff 中 test 文件 0 行删除，只有 99 行新增 | ✅ |
| 用文件里已有的假 SDK 写法 | task 条目 2 | 使用了 `scripted()` helper（`test/runner-claude.test.ts:48`）和 `async function*` + `throw` 模式（同文件已有用例如 L1463-1467） | ✅ |

### 行为要求实跑证据

所有 4 条新增测试用例的行为通过实跑验证：
```
npx vitest run test/runner-claude.test.ts
Tests  79 passed (79)
```

### 额外禁止核对

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动任何受保护路径 | task | `git diff --stat` 对受保护路径无输出 | ✅ |
| 不改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | task | `git diff --stat` 对这些路径无输出 | ✅ |
| 不改动 `src/run.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts` | task | `git diff --stat` 对这些路径无输出 | ✅ |
| 不改动传给 SDK 的参数 | task | diff 中仅修改 catch 块的 return 语句（L555），未触及 `queryOptions` 或 `query` 调用 | ✅ |
| 不删除或跳过任何测试 | task | diff 无删除行，无 `.skip` 或 `.todo` 添加 | ✅ |
| 不改写任何已有断言 | task | diff 中 test 文件 0 行删除，所有已有 `expect` 语句完整 | ✅ |
| 不为验收命令通过而改注释或字面 | task | diff 中 `src/runner/claude.ts` 新增注释是 SPEC 参考说明，不是为通过 grep 验收 | ✅ |
| 测试里不拉起真实 runner 或网络请求 | task | 新测试使用 `scripted()` 和 `async function*` 假 query，无真实 runner 或网络 | ✅ |
| 不新增依赖 | task | `package.json`/`package-lock.json` 无变化 | ✅ |

### 不变量数值变化

无。

### 被改写或删去的断言

无。

## 结论与理由

本批次修改精确且最小化：
1. `src/runner/claude.ts` L555 仅添加 `stopReason: rest.stopReason ?? 'error'`，确保 SDK 抛错但已有成功结果消息时，返回值始终携带结束原因。对已有的 `stopped` 和 `turns_exhausted` 语义无影响（`aggregateResults` 中有优先级处理）。
2. 新增 4 条测试完全覆盖 task 条目 2 的要求：SDK 抛错（1 条 / 2 条结果）、`is_error: true`、空文本。
3. 全部 5 条验收命令实跑通过，1196 条测试全部通过，lint 和 typecheck 零错误。
4. 无受保护文件修改，无依赖变更，无已有断言改动，提交已推送远端。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b18",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["ced58c76e3ca4e8ddeefeca8e42e4b15c0d0cabc"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "60 files, 1196 tests passed" },
      { "cmd": "npm test -- test/runner-claude.test.ts", "exit_code": 0, "summary": "1 file, 79 tests passed" },
      { "cmd": "grep -qF \"failed runs always carry a stop reason\" test/runner-claude.test.ts", "exit_code": 0, "summary": "pattern found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "全部 5 条验收命令实跑通过；代码改动仅 1 行（stopReason ?? 'error'），确保所有 EXIT_FAILED 路径带结束原因；新增 4 条测试覆盖 task 要求的全部场景；无受保护文件/依赖/已有断言改动；CI 以 R2 取证为准。"
}
```
