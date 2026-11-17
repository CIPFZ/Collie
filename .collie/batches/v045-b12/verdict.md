All 5 tests passed.

Now let me compile the evidence. Let me verify the full scope of the diff is within the task's scope:

The diff touches exactly 3 files:
1. `src/run.ts` — 5 lines added (report.md removal) — matches condition 1
2. `src/roles/reviewer.ts` — 7 lines changed (prompt path exclusion) — matches condition 2
3. `test/reviewer-rerun.test.ts` — 295 lines (new file) — matches condition 3

No other files modified. No existing test files changed. No protected or forbidden files touched.

# 批次 v045-b12 审核

## 取证过程

### 1. 受保护路径检查

```
git diff --stat 0b20c6b..f9557ed -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出，零行变动。`spec_diff_lines = 0`。

### 2. 额外禁止文件检查

```
git diff --stat 0b20c6b..f9557ed -- .github/ eslint.config.js vitest.config.ts package.json src/arbiter.ts src/gate.ts src/evidence.ts src/follow.ts src/view.ts
```
结果：无输出，未触碰任何额外禁止文件。

### 3. 依赖变化检查

```
git diff 0b20c6b..f9557ed -- package.json package-lock.json
```
结果：无输出，无依赖变化。

### 4. 提交事实

```
git log --format='%H' 0b20c6b..f9557ed
```
输出：
- `f9557edc414376bda50b6e07d8338e76bd62c910`
- `d22758929ab52d38e3cbf7db7603736f98fb8335`

```
git ls-remote origin | grep f9557ed
```
结果：NOT FOUND on remote（head 未推送到远端）

### 5. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 均通过 |
| 2 | `npm run typecheck` | 0 | tsc 零错误 |
| 3 | `npm test` | 0 | 59 files passed, 1155 tests passed |
| 4 | `npm test -- test/reviewer-rerun.test.ts` | 0 | 1 file passed, 5 tests passed |
| 5 | `npm test -- test/reviewer-isolation.test.ts` | 0 | 1 file passed, 19 tests passed |
| 6 | `grep -cE "^\s+it\(" test/reviewer-rerun.test.ts \| grep -qE "^([3-9]\|[1-9][0-9])$"` | 0 | 5 个 it() 块 |
| 7 | `grep -qE "FakeRunner" test/reviewer-rerun.test.ts && grep -qE "ls-tree" test/reviewer-rerun.test.ts` | 0 | 两者均存在 |
| 8 | `grep -qF ":(exclude).collie/batches" test/reviewer-rerun.test.ts` | 0 | 路径排除断言存在 |

### 6. reviewer.ts 中 report.md 字样检查

```
grep -n 'report\.md' src/roles/reviewer.ts
```
结果：无匹配。条目 1 要求满足。

### 7. ReviewerInputSchema 字段检查

Schema 定义在 `src/roles/reviewer.ts:32-40`，字段为 `batch_id, base_sha, head_sha, items, acceptance, spec_paths`，与 base 一致，未添加新字段。

### 8. 已有断言改写检查

```
git diff 0b20c6b..f9557ed -- 'test/*.test.ts' ':(exclude)test/reviewer-rerun.test.ts'
```
结果：无输出。没有修改任何已有测试文件。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 59 files 1155 tests | ✅ |
| 重跑隔离的专项测试通过 | `npm test -- test/reviewer-rerun.test.ts` | exit 0, 5 passed | ✅ |
| 原有的隔离测试仍然通过 | `npm test -- test/reviewer-isolation.test.ts` | exit 0, 19 passed | ✅ |
| 专项测试不少于 3 个 | `grep -cE ...` | exit 0 (5 个) | ✅ |
| 专项测试跑的是真实队列，且带对照 | `grep -qE "FakeRunner" && grep -qE "ls-tree"` | exit 0 | ✅ |
| 提示词的路径排除有断言 | `grep -qF ":(exclude).collie/batches"` | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `src/run.ts` 准备 worktree 时移除 report.md | 条目 1 | `src/run.ts:229-230` — `const batchReportFile = join(dir, '.collie', 'batches', batchId, 'report.md'); if (existsSync(batchReportFile)) rmSync(batchReportFile);` | ✅ |
| task.md 保留 | 条目 1 | `test/reviewer-rerun.test.ts:248-250` 断言 taskExists==true；`npx vitest run test/reviewer-rerun.test.ts` → 5 passed | ✅ |
| 只放在 src/run.ts | 条目 1 | `grep -n 'report\.md' src/roles/reviewer.ts` → 无匹配 | ✅ |
| reviewer.ts 不含 report.md 字样 | 条目 1 | 同上 | ✅ |
| 第 2 次 head_sha 的树里有 report.md 而 reviewer cwd 里没有 | 条目 1 | `test/reviewer-rerun.test.ts:230-246` ls-tree 对照断言；`test/reviewer-rerun.test.ts:224-228` 两次 reportExists==false；`npx vitest run test/reviewer-rerun.test.ts` → Tests 5 passed | ✅ |
| 提示词改为带 `':(exclude).collie/batches'` 的 git log 和 git diff | 条目 2 | `src/roles/reviewer.ts:99-100` — `` `\`git log ${range} -- . ':(exclude).collie/batches'\`` `` 和 `` `\`git diff ${range} -- . ':(exclude).collie/batches'\`` `` | ✅ |
| 加一句关于 `.collie/batches/` 的说明 | 条目 2 | `src/roles/reviewer.ts:102` — `'.collie/batches/ 下是信封文件，不是 worker 的产出；只读本批次的 task.md。'` | ✅ |
| ReviewerInputSchema 不加字段 | 条目 2 | `src/roles/reviewer.ts:32-40` 与 base 一致 | ✅ |
| 新文件 test/reviewer-rerun.test.ts 用 FakeRunner | 条目 3 | `test/reviewer-rerun.test.ts:9` — `import { FakeRunner } from '../src/runner/fake.js';` | ✅ |
| 断言：report.md 两次都不在 | 条目 3 | `test/reviewer-rerun.test.ts:224-228`；`npx vitest run test/reviewer-rerun.test.ts` → Tests 5 passed | ✅ |
| 断言：第 2 次 head_sha 的树里有 report.md（对照） | 条目 3 | `test/reviewer-rerun.test.ts:230-246` ls-tree 断言；`npx vitest run test/reviewer-rerun.test.ts` → Tests 5 passed | ✅ |
| 断言：task.md 两次都在 | 条目 3 | `test/reviewer-rerun.test.ts:248-250`；`npx vitest run test/reviewer-rerun.test.ts` → Tests 5 passed | ✅ |
| 断言：两次提示词都含 `':(exclude).collie/batches'` | 条目 3 | `test/reviewer-rerun.test.ts:253-257`；`npx vitest run test/reviewer-rerun.test.ts` → Tests 5 passed | ✅ |
| 再加一条「第 1 次就 PASS」的 | 条目 3 | `test/reviewer-rerun.test.ts:265-295` describe block `reviewer-rerun: first PASS`；`npx vitest run test/reviewer-rerun.test.ts` → Tests 5 passed | ✅ |
| 旧用例只改 reviewer-isolation 的 diff-pointer 断言（如改了） | 条目 3 | `git diff 0b20c6b..f9557ed -- test/reviewer-isolation.test.ts` → 无输出，未修改 | ✅（未改） |
| `never reads a report` 不许改 | 条目 3 | `test/reviewer-isolation.test.ts:160-163` 完整存在且未修改 | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 检查 → 零行 | ✅ |
| 不改 .github/, eslint.config.js, vitest.config.ts, package.json | 额外禁止 | 同上检查 → 零行 | ✅ |
| 不改 src/arbiter.ts, src/gate.ts, src/evidence.ts, src/follow.ts, src/view.ts | 额外禁止 | 同上检查 → 零行 | ✅ |
| 不给 ReviewerInputSchema 加字段 | 额外禁止 | 已验证 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | 无现有测试文件被修改；1155 tests 全通过 | ✅ |
| 不改写条目 3 点名之外的断言 | 额外禁止 | `git diff` 确认无现有测试文件变动 | ✅ |
| 不引入真实 runner 或网络请求 | 额外禁止 | 新测试使用 FakeRunner，无 fetch/http 调用 | ✅ |
| 不新增依赖 | 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 未被修改。

### 被改写或删去的断言

无。diff 中没有修改任何已有测试文件。

## 结论与理由

全部 8 项验收命令实跑通过。3 个条目的所有具体要求逐条核对满足。无受保护文件、无禁止文件被修改。无依赖变化。diff 范围精确落在 task.md 的 3 个条目之内（`src/run.ts`、`src/roles/reviewer.ts`、`test/reviewer-rerun.test.ts`），无范围蔓延。测试用 FakeRunner 跑真实队列，行为断言均实跑通过。

head commit 未在远端找到（`git ls-remote` 未匹配），remote_has_head 记为 false。CI 无法查证。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b12",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "f9557edc414376bda50b6e07d8338e76bd62c910",
      "d22758929ab52d38e3cbf7db7603736f98fb8335"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier passed" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "59 files, 1155 tests passed" },
      { "cmd": "npm test -- test/reviewer-rerun.test.ts", "exit_code": 0, "summary": "1 file, 5 tests passed" },
      { "cmd": "npm test -- test/reviewer-isolation.test.ts", "exit_code": 0, "summary": "1 file, 19 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/reviewer-rerun.test.ts | grep -qE \"^([3-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "5 it() blocks" },
      { "cmd": "grep -qE \"FakeRunner\" test/reviewer-rerun.test.ts && grep -qE \"ls-tree\" test/reviewer-rerun.test.ts", "exit_code": 0, "summary": "both present" },
      { "cmd": "grep -qF \":(exclude).collie/batches\" test/reviewer-rerun.test.ts", "exit_code": 0, "summary": "path exclusion found" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "全部 8 项验收命令实跑通过。3 个条目的具体要求逐条核对均满足：src/run.ts 在 withHeadWorktree 中移除 report.md 且保留 task.md；reviewer.ts 提示词改为路径排除写法且未添加 Schema 字段；新测试文件 5 个用例全部通过，FakeRunner 真实队列驱动，含 ls-tree 对照断言。无受保护/禁止文件变动，无依赖变化，无范围蔓延。CI 以 R2 取证为准。"
}
```
