No numeric upper/lower limit changes in invariants test. The only change is adding a new invariant check.

I've completed all evidence gathering. Let me compile the verdict.

---

# 批次 v046-b10 审核

## 取证过程

### 1. 受保护文件检查

```
git diff --stat 8ca27ad..41dd2bd -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护文件无改动。

### 2. 额外禁止的文件检查

```
git diff --stat 8ca27ad..41dd2bd -- src/run.ts src/redcheck.ts 'src/roles/' 'src/runner/' src/backlog.ts 'src/schema/index.ts' src/evidence.ts 'test/support/sandbox.ts' '.github/' eslint.config.js vitest.config.ts package.json 'AGENT-*.md'
```
结果：无输出。禁止文件无改动。

### 3. 依赖变化

```
git diff 8ca27ad..41dd2bd -- package.json package-lock.json
```
结果：无输出。无依赖变化。

### 4. 提交事实

- 一个工作提交：`41dd2bdb0183a5e044818961a35c6fca2a968324`
- 一个信封提交：`25dcef6473d5b9d8695745495faa26ca2f0ffe26`（排除范围）
- `git merge-base --is-ancestor 41dd2bd 341743f` → 是，已推送至 `origin/main`

### 5. 验收命令实跑

全部 8 条验收命令逐条实跑。

### 6. CI

无法查到 CI（无凭据），`ci_conclusion` 填 `unknown`，`ci_branch_matched` 填 `null`。CI 以 R2 取证为准。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，"All matched files use Prettier code style!" | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0，64 files passed, 1327 tests passed | ✅ |
| 没有 git 全局身份时模块的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` | exit 0，1 file passed, 19 tests passed | ✅ |
| 新的一组用例在 | `grep -qF "prepareAcceptance: reports and early stop" test/prepare-acceptance.test.ts` | exit 0 | ✅ |
| 两份要读的文件都给了（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "CONSTRAINTS.md"` | exit 0 | ✅ |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 | ✅ |
| 不变量同步 | `grep -qF "misclassified" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 成功与失败两种返回值都加 `reports`（字符串数组） | 条目1 | `src/acceptance.ts:37` (`AcceptanceOk.reports: string[]`)、`src/acceptance.ts:48` (`AcceptanceFail.reports: string[]`) | ✅ |
| 失败的返回值加 `reason`：三种枚举值 | 条目1 | `src/acceptance.ts:29` (`type AcceptanceFailReason = 'red_check' \| 'tester_failed' \| 'misclassified'`)、`src/acceptance.ts:46` (`reason: AcceptanceFailReason`) | ✅ |
| `extractMisclassified` 只看最后一个 JSON 围栏块 | 条目1 | `src/acceptance.ts:88-93` — while 循环遍历所有 fence 块，`lastJsonBlock` 只保留最后一个 | ✅ |
| JSON 解析不了、没有这个字段或空数组 → 按没有声明处理 | 条目1 | `src/acceptance.ts:95-103` — catch 返回 undefined；`src/acceptance.ts:100` — 空数组返回 undefined | ✅ |
| 红检查过了的不看 misclassified | 条目1 | `src/acceptance.ts:200-209` — redResult.ok 时直接 return ok；misclassified 检查在 212 行之后，只在红检查未过时 | ✅ |
| 交给测试 agent 的文件是 `SPEC.md` 与 `CONSTRAINTS.md` | 条目2 | `src/acceptance.ts:165` — `spec_paths: ['SPEC.md', 'CONSTRAINTS.md']` | ✅ |
| 建工作目录失败时清理目录与 git worktree 登记 | 条目2 | `src/acceptance.ts:122-136` — try/catch 包裹 addWorktree，catch 中先 removeWorktree（处理 git 登记+目录），失败再 rmSync | ✅ |
| 非零退出时下一次拉起的原因里写明退出码 | 条目2 | `src/acceptance.ts:181-185` — exitMsg 含退出码，追加到 previousProblems | ✅ |
| 不按红检查原因文字猜类别标错 | 额外禁止 | `src/acceptance.ts:213-214` — 只看 `result.finalText` 里的 JSON 声明，不用 `redResult.problems` | ✅ |
| 不往主仓库写文件、提交或推送 | 额外禁止 | 整个函数只操作 worktreeDir（tmpdir 下），无对 root 的写操作 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | diff 中 test 文件无删除行（唯一删除行是 import 重排） | ✅ |
| 不改写任何已有断言 | 额外禁止 | diff 验证：唯一被删的行是旧 import，所有现有 `expect()` 断言不变 | ✅ |
| 测试里不拉起真实 runner / 不发真实网络请求 | 额外禁止 | 新测试全部使用 FakeRunner | ✅ |
| 不新增依赖 | 额外禁止 | package.json 和 lock 文件无变化 | ✅ |
| `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `misclassified`」| 条目3 | `test/invariants.test.ts:629-631` — 新增 `expect(content).toContain('misclassified')` | ✅ |

### 行为要求

| 要求 | 出处 | 实跑命令与结果 | 满足 |
|---|---|---|---|
| testerMax=2, 第 1 次红检查没过且回复 JSON 里 misclassified 列了一条 → 测试 agent 只被拉起 1 次，返回 ok=false, attempts=1, reason=misclassified, reports 有 1 条 | 条目1 加粗 | `npx vitest run test/prepare-acceptance.test.ts` → Tests 19 passed，含 "misclassified in reply JSON → tester called once, reason=misclassified, reports has 1 entry" | ✅ |
| 同样的红检查结果但回复没有 JSON 块 → 照常拉起第 2 次 | 条目1 加粗 | 同上，含 "red check fails, reply has no JSON block → retries normally" | ✅ |
| reports 在成功时也有、条数等于拉起次数 | 条目3 | 同上，含 "reports present on success, length equals attempts" | ✅ |
| reason=red_check | 条目3 | 同上，含 "reason=red_check when both red checks fail" | ✅ |
| reason=tester_failed | 条目3 | 同上，含 "reason=tester_failed when tester exits non-zero" | ✅ |
| JSON 里 misclassified 是空数组 → 照常重拉 | 条目3 | 同上，含 "misclassified as empty array → retries normally" | ✅ |
| 非零退出之后第 2 次提示词里有退出码 | 条目3 | 同上，含 "non-zero exit → next prompt has the exit code" | ✅ |
| 交给测试 agent 的提示词里两份文件都在 | 条目3 | 同上，含 "tester prompt includes both SPEC.md and CONSTRAINTS.md" | ✅ |
| 建工作目录失败 → 抛错, worktree list 只有 1 行, 私有临时目录里没有 collie-accept-* | 条目3 | 同上，含 "addWorktree fails (bad headSha) → error thrown, worktree list has 1 line, no collie-accept-* leftover" | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增一条检查项，无数值上下限变动。

### 被改写或删去的断言

无。diff 中 test 文件唯一的删除行是 import 语句的重排（单行变多行），无 `expect()` 断言被删或改。

## 结论与理由

全部 8 条验收命令实跑通过。3 个条目的结构要求和行为要求逐条核对全部满足。额外禁止事项无违反。受保护文件无改动。无依赖变化。提交已推送至远端。diff 范围严格在 task.md 条目之内（仅 `src/acceptance.ts`、`test/prepare-acceptance.test.ts`、`test/invariants.test.ts`），无范围蔓延。已有测试无任何修改。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b10",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["41dd2bdb0183a5e044818961a35c6fca2a968324"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "64 files, 1327 tests passed" },
      { "cmd": "e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts", "exit_code": 0, "summary": "1 file, 19 tests passed" },
      { "cmd": "grep -qF \"prepareAcceptance: reports and early stop\" test/prepare-acceptance.test.ts", "exit_code": 0, "summary": "found" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/acceptance.ts | grep -qF \"CONSTRAINTS.md\"", "exit_code": 0, "summary": "found in non-comment lines" },
      { "cmd": "! grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qE \"acceptance\\.js\"", "exit_code": 0, "summary": "not found in non-comment lines" },
      { "cmd": "grep -qF \"misclassified\" test/invariants.test.ts", "exit_code": 0, "summary": "found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 8 acceptance commands pass. All 3 task items fully implemented: reports field on both ok/fail paths, reason enum with 3 values, misclassified early-stop from tester JSON declaration, CONSTRAINTS.md added to spec_paths, worktree cleanup on addWorktree failure, exit code propagated to next prompt. 9 new tests in the required describe group cover all specified scenarios and pass. No existing tests modified. No protected files or forbidden files changed. No new dependencies. CI status unknown (no credentials), deferred to R2."
}
```
