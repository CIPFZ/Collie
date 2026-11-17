Now I have all the evidence I need. Let me compile the full verdict.

---

# 批次 v045-b16 审核

## 取证过程

### 1. 受保护路径检查

```
git diff --stat a8cb50dc..c59f919f -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护路径无变更。

### 2. 明确禁止的文件检查

```
git diff a8cb50dc..c59f919f -- src/roles/reviewer.ts src/arbiter.ts src/gate.ts src/evidence.ts src/view.ts src/follow.ts .github/ eslint.config.js vitest.config.ts package.json
```
结果：无输出。禁止文件无变更。

### 3. 变更范围

```
git diff --name-only a8cb50dc..c59f919f -- . ':(exclude).collie/batches'
```
结果：
- `src/run.ts`
- `test/reviewer-rerun.test.ts`

仅两个文件，落在条目 1 和条目 2 的范围内。

### 4. 依赖变化

```
git diff a8cb50dc..c59f919f -- package.json package-lock.json
```
结果：无输出。无依赖变更。

### 5. 验收命令实跑

#### 命令 1：`npm run lint`
- 退出码：0
- 输出：`All matched files use Prettier code style!`

#### 命令 2：`npm run typecheck`
- 退出码：0
- 输出：无错误

#### 命令 3：`npm test`
- 退出码：0
- 输出：`Test Files 60 passed (60), Tests 1184 passed (1184)`

#### 命令 4：`npm test -- test/reviewer-rerun.test.ts`
- 退出码：0
- 输出：`Test Files 1 passed (1), Tests 10 passed (10)`

#### 命令 5：`npm test -- test/reviewer-isolation.test.ts`
- 退出码：0
- 输出：`Test Files 1 passed (1), Tests 19 passed (19)`

#### 命令 6：`grep -cE "^\s+it\(" test/reviewer-rerun.test.ts | grep -qE "^([7-9]|[1-9][0-9])$"`
- 退出码：0
- 实际 `it(` 数量：10

#### 命令 7：`grep -qF "v99-other" test/reviewer-rerun.test.ts`
- 退出码：0

### 6. 提交与推送

```
git rev-parse c59f919f5d7601c48e0b569156879c3426ecd01a
```
→ `c59f919f5d7601c48e0b569156879c3426ecd01a`（存在）

```
git branch -a --contains c59f919f5d7601c48e0b569156879c3426ecd01a
```
→ `main`, `remotes/origin/main` 均包含此提交。

```
git log --oneline remotes/origin/main -3
```
→ `0748d67 report(collie): v045-b16` > `c59f919 verify: ...` > `5069fe8 docs: issue ...`

head_sha 在 origin/main 的历史中，已推送。

### 7. CI 检查

无 GitHub 凭据，无法查询 CI。`ci_conclusion` 填 `unknown`，`ci_branch_matched` 填 `null`。CI 以 R2 取证为准。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, 无错误 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, 无错误 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 60 文件 / 1184 测试全通过 | ✅ |
| 重跑专项测试通过 | `npm test -- test/reviewer-rerun.test.ts` | exit 0, 10 passed | ✅ |
| 原有隔离测试通过 | `npm test -- test/reviewer-isolation.test.ts` | exit 0, 19 passed | ✅ |
| 专项测试不少于 7 个 | `grep -cE ...` | 10 个 `it(` 调用, exit 0 | ✅ |
| 别的批次目录不动 | `grep -qF "v99-other" ...` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 改为把本批次目录下除 task.md 外的文件都拿掉 | task.md 条目 1 | `src/run.ts:229-236`：`for (const entry of readdirSync(batchDir)) { if (entry !== 'task.md') { rmSync(join(batchDir, entry), { recursive: true, force: true }); } }` | ✅ |
| 别的批次目录不动 | task.md 条目 1 | `src/run.ts:228`：注释 `Other batches' directories are not touched`；代码仅操作 `join(dir, '.collie', 'batches', batchId)` 即本批次目录 | ✅ |
| 注释小节号从 14.17 改成 14.18 与 14.20 | task.md 条目 1 | `src/run.ts:211`：`stripped to task.md only (SPEC 14.18 & 14.20)`；`src/run.ts:226`：`// SPEC 14.18 & 14.20:` | ✅ |
| 第 2 次运行 head_sha 树里有 verdict.md，工作目录里只有 task.md | task.md 条目 1（行为要求） | `npx vitest run test/reviewer-rerun.test.ts` → `Tests 10 passed`（含 `head_sha tree for attempt 2 contains verdict.md via ls-tree (contrast)` 和 `batch dir in reviewer cwd contains only task.md on both attempts`） | ✅ |

### 条目 2 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 记录 batchFiles 清单 | task.md 条目 2 | `test/reviewer-rerun.test.ts:58-59`：`batchFiles: string[]` 在 `ReviewerCapture` 接口中；`test/reviewer-rerun.test.ts:147`：`batchFiles: existsSync(batchDir) ? readdirSync(batchDir).sort() : []` | ✅ |
| 断言第 2 次树里有 verdict.md | task.md 条目 2 | `test/reviewer-rerun.test.ts:265-280`：`it('head_sha tree for attempt 2 contains verdict.md via ls-tree (contrast)', ...)` 含 `expect(lsTree).toContain('verdict.md')` | ✅ |
| 两次 reviewer 工作目录文件清单恰好是 ['task.md'] | task.md 条目 2 | `test/reviewer-rerun.test.ts:282-286`：`expect(reviewerCaptures[0]?.batchFiles).toEqual(['task.md']); expect(reviewerCaptures[1]?.batchFiles).toEqual(['task.md'])` | ✅ |
| 另一个批次目录文件没被拿掉（v99-other） | task.md 条目 2 | `test/reviewer-rerun.test.ts:223-225`：`box.write('.collie/batches/v99-other/report.md', ...)` 添加文件；`test/reviewer-rerun.test.ts:288-291`：`expect(reviewerCaptures[0]?.otherBatchReportExists).toBe(true); expect(reviewerCaptures[1]?.otherBatchReportExists).toBe(true)` | ✅ |
| 第一次 PASS 场景同样断言 | task.md 条目 2 | `test/reviewer-rerun.test.ts:344-346`：`expect(reviewerCaptures[0]?.batchFiles).toEqual(['task.md'])`；`test/reviewer-rerun.test.ts:349-351`：`expect(reviewerCaptures[0]?.otherBatchReportExists).toBe(true)` | ✅ |
| 已有的断言不改 | task.md 条目 2 | 原有测试用例 (`report.md is absent from reviewer cwd on both attempts`, `head_sha tree for attempt 2 contains report.md via ls-tree (contrast)`, `task.md is present in reviewer cwd on both attempts`, `reviewer prompt contains path exclusion on both attempts`, `report.md absent, task.md present, prompt excludes .collie/batches`) 均保留且 `expect()` 表达式不变；数据采集从 `join(cwd, '.collie', 'batches', BATCH_ID, ...)` 重构为 `join(batchDir, ...)` 语义完全等价 | ✅ |
| 行为验证 | task.md 条目 2 | `npx vitest run test/reviewer-rerun.test.ts` → `Tests 10 passed` | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 遵守 |
|---|---|---|---|
| 改受保护路径 | task.md | `git diff --stat` 对受保护路径无输出 | ✅ |
| 改 .github/, eslint.config.js, vitest.config.ts, package.json | task.md | `git diff` 对这些路径无输出 | ✅ |
| 改 reviewer.ts/arbiter.ts/gate.ts/evidence.ts/view.ts/follow.ts | task.md | `git diff` 对这些文件无输出 | ✅ |
| 动别的批次的信封目录 | task.md | 代码只操作 `batchId` 对应的目录，测试断言 v99-other 不受影响 | ✅ |
| 让 reviewer 看到汇报或上一轮裁定 | task.md | 代码删除了 task.md 以外的一切（包括 report.md 和 verdict.md） | ✅ |
| 删除或跳过测试 | task.md | diff 中无 `it.skip` 或删除的 `it(` 块 | ✅ |
| 改写已有断言 | task.md | 所有原有 `expect()` 保持不变；数据采集的路径重构为等价表达 | ✅ |
| 改注释或字面来通过验收 | task.md | 无此类操作 | ✅ |
| 真实 runner 或网络请求 | task.md | 测试使用 `FakeRunner`，无网络调用 | ✅ |
| 新增依赖 | task.md | package.json 无变更 | ✅ |

### 不变量数值变化

`git diff` 中无 `test/invariants.test.ts` 的变更。**无**。

### 被改写或删去的断言

diff 中无已有的 `expect()` 被删除或改写。数据采集代码（`reviewerFixScene` 和 `reviewerPassScene` 中的 captures.push）从内联路径拼接重构为使用 `batchDir` 变量，但 `join(batchDir, 'report.md')` 与 `join(cwd, '.collie', 'batches', BATCH_ID, 'report.md')` 语义完全相同，不影响任何断言的值。**无**。

## 结论与理由

全部 7 条验收命令实跑通过。条目 1 的代码修改正确：将原来只删除 `report.md` 的逻辑扩展为遍历删除除 `task.md` 外的所有文件，注释小节号已更新。条目 2 的测试新增完整：覆盖了 verdict.md 对比、batchFiles 清单断言、v99-other 不受影响三个场景，已有断言全部保留。提交已推送。无受保护文件变更，无依赖变更，范围无蔓延。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b16",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["c59f919f5d7601c48e0b569156879c3426ecd01a"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "60 files, 1184 tests passed" },
      { "cmd": "npm test -- test/reviewer-rerun.test.ts", "exit_code": 0, "summary": "1 file, 10 tests passed" },
      { "cmd": "npm test -- test/reviewer-isolation.test.ts", "exit_code": 0, "summary": "1 file, 19 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/reviewer-rerun.test.ts | grep -qE \"^([7-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "10 it() calls found, >= 7" },
      { "cmd": "grep -qF \"v99-other\" test/reviewer-rerun.test.ts", "exit_code": 0, "summary": "v99-other reference present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 7 acceptance commands pass. Code correctly strips all files except task.md from this batch's envelope directory in the reviewer worktree. Tests cover verdict.md contrast, batchFiles equality, and v99-other preservation. No protected files touched, no dependencies changed, no existing assertions modified. CI status unknown — deferred to R2."
}
```
