Only 3 files changed, all within scope:
1. `src/run.ts` — the implementation
2. `test/blocked-cleanup.test.ts` — the new tests
3. `test/invariants.test.ts` — the new invariants

Now I have all evidence needed. Let me compile the verdict.

# 批次 v046-b25 审核

## 取证过程

### 1. 提交事实

```
$ git log d352068..80b28b1 --format='%H %s' -- . ':(exclude).collie/batches'
80b28b1120c9ff774fe62de38c06430884767206 cleanup: selective staging, revert-only conflict handling, and tests (SPEC 16.19)
```

提交存在。`git branch -r --contains 80b28b1120c9ff774fe62de38c06430884767206` 确认已推送至 `origin/main`。

### 2. 受保护文件

```
$ git diff d352068..80b28b1 --stat -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml 'test/acceptance'
（无输出）
```

```
$ git diff d352068..80b28b1 --stat -- .github/ eslint.config.js vitest.config.ts package.json templates/collie.toml
（无输出）
```

无受保护文件被修改。额外禁止列表中的文件也未被修改。

### 3. 依赖变化

```
$ git diff d352068..80b28b1 --stat -- package.json package-lock.json pnpm-lock.yaml yarn.lock
（无输出）
```

无依赖变化。

### 4. 验收命令实跑

#### 4.1 `npm run lint` → 退出码 0 ✅
输出：`All matched files use Prettier code style!`

#### 4.2 `npm run typecheck` → 退出码 0 ✅
输出无错误。

#### 4.3 `npm test` → 退出码 0 ✅
```
Test Files  70 passed (70)
     Tests  1453 passed (1453)
```

#### 4.4 `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` → 退出码 0 ✅
```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

#### 4.5 `grep -qF "blocked cleanup: only its own paths" test/blocked-cleanup.test.ts` → 退出码 0 ✅

#### 4.6 `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "'reset'"` → 退出码 0 ✅

#### 4.7 `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cF "['add', '-A']" | grep -qx 1` → 退出码 0 ✅

#### 4.8 `grep -qF "'reset'" test/invariants.test.ts` → 退出码 0 ✅

### 5. 变更范围

修改的文件仅 3 个：
- `src/run.ts` — 实现 `batchCleanup` 的选择性暂存与仅用 revert --abort
- `test/blocked-cleanup.test.ts` — 新增 3 个测试场景
- `test/invariants.test.ts` — 新增 2 个不变量测试

均在 task.md 条目 1–3 的范围内，无范围蔓延。未修改 `src/` 下除 `src/run.ts` 以外的文件。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, 无错误 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, 无错误 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 70 files, 1453 tests | ✅ |
| 无 git 全局身份时收尾测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | exit 0, 9 tests passed | ✅ |
| 新的一组用例在 | `grep -qF "blocked cleanup: only its own paths" test/blocked-cleanup.test.ts` | exit 0 | ✅ |
| 不再 reset（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'reset'"` | exit 0 | ✅ |
| `add -A` 只剩救援那一处 | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cF "['add', '-A']" \| grep -qx 1` | exit 0 | ✅ |
| 不变量同步 | `grep -qF "'reset'" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：只提交自己改的路径

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 去掉 `git add -A` 与提交 `.` | 条目 1 | `src/run.ts:2785` — `await git(root, ['commit', '-m', subject])` 直接提交 index 中已暂存的内容，不再调用 `git add -A`；旧代码的 `['add', '-A']` 和 `r2Commit(root, ..., ['.'], ...)` 已删除 | ✅ |
| `['add', '-A']` 只剩救援那一处 | 条目 1 | `src/run.ts:406` — 唯一的 `await git(root, ['add', '-A'])` 在 `rescueCommit` 函数中 | ✅ |
| 经 `r2Commit` 传路径 → 改为直接 `git commit` | 条目 1 | `src/run.ts:2784-2787` — 不再调用 `r2Commit`，改用 `git commit -m` + `revParse` + `rec.record('r2.commit', ...)` | ✅ |
| 没有撤销任何救援提交、也没有本批次验收测试时，不提交不推送不记 `batch.cleanup` | 条目 1 | `src/run.ts:2769-2772` — `if (!hasRevertedChanges && !removedAcceptance) { return; }` | ✅ |
| 场景1：tester_touched_main_tree + rogue.txt → 无 cleanup 提交、rogue.txt 还在 | 条目 1 加粗 | `test/blocked-cleanup.test.ts:749-834`，`npx vitest run test/blocked-cleanup.test.ts` → Tests 9 passed | ✅ |
| 场景2：idle workers + note.txt → cleanup 只含救援文件、note.txt 还在 | 条目 1 加粗 | `test/blocked-cleanup.test.ts:837-934`，`npx vitest run test/blocked-cleanup.test.ts` → Tests 9 passed | ✅ |

### 条目 2：冲突处理只用 revert --abort

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 只执行 `git revert --abort`，不执行 `git reset`、`git checkout .` | 条目 2 | `src/run.ts:2740` — 仅 `await git(root, ['revert', '--abort'])`；旧代码的 `['reset', 'HEAD']` 和 `['checkout', '.']` 已删除；`grep` 确认非注释行无 `'reset'` | ✅ |
| abort 后有 tracked 改动 → `batch.cleanup_failed` reason `abort_left_changes`，不提交 | 条目 2 | `src/run.ts:2744-2749` — 检查 `trackedAfterAbort.length > 0` 后 `rec.record('batch.cleanup_failed', { reason: 'abort_left_changes' })` 然后 `return` | ✅ |
| abort 干净 → `batch.cleanup_failed` reason 以 `revert_conflict` 开头 | 条目 2 | `src/run.ts:2751` — `rec.record('batch.cleanup_failed', { reason: \`revert_conflict: ${sha}\` })` | ✅ |
| abort 干净 + 有验收测试 → 只提交删那个目录 | 条目 2 | `src/run.ts:2757-2766` — `revertFailed = true` 时 `hasRevertedChanges = false`，仍检查并删除 acceptance 路径；已有测试（line 411）验证此场景 | ✅ |
| 场景3：内容冲突 → 无 `<<<<<<<`、tracked clean、journal 有 revert_conflict | 条目 2 加粗 | `test/blocked-cleanup.test.ts:936-1032`，`npx vitest run test/blocked-cleanup.test.ts` → Tests 9 passed | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `test/blocked-cleanup.test.ts` 新加 `describe('blocked cleanup: only its own paths', …)` | 条目 3 | `test/blocked-cleanup.test.ts:703` — `describe('blocked cleanup: only its own paths', () => {` | ✅ |
| 三种加粗情形各一个用例 | 条目 3 | `test/blocked-cleanup.test.ts:749,837,936` — 三个 `it(...)` 分别覆盖 rogue.txt、note.txt、content conflict | ✅ |
| 现有 6 条不改 | 条目 3 | diff 中 `test/blocked-cleanup.test.ts` 无删除 expect 行；仅添加 import、常量和新 describe 块 | ✅ |
| `test/invariants.test.ts` 加两条 | 条目 3 | `test/invariants.test.ts:712,726` — no 'reset' 和 exactly one ['add', '-A'] | ✅ |
| 不许删断言、不许改松 | 条目 3 | diff 中无删除的 `expect()` 行 | ✅ |

### 额外禁止逐条核对

| 禁止事项 | 证据 | 满足 |
|---|---|---|
| 不改受保护路径 | `git diff --stat` 无输出 | ✅ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml` | `git diff --stat` 无输出 | ✅ |
| 不改 `batchCleanup` 被调用的位置与条件 | `src/run.ts:3241,3311` — 两处调用不变 | ✅ |
| 不改 `src/` 下 `src/run.ts` 以外的文件 | `git diff --name-only` — 仅 src/run.ts | ✅ |
| 不执行 `git reset`、`git clean`、`rebase`、强推 | 非注释行无 `'reset'`；grep 确认无 `checkout .`、`clean`、`rebase`、`force` | ✅ |
| 不提交未跟踪文件 | `src/run.ts:2785` — 直接 commit index，无 `git add -A` | ✅ |
| 不删除或跳过测试 | diff 无删除的 expect/it 行 | ✅ |
| 不改写已有断言 | diff 中 blocked-cleanup.test.ts 仅有一处删除行（import 行）；无 expect 变更 | ✅ |
| 测试不用真实 runner/网络/全局 git 配置 | 新测试使用 FakeRunner、Sandbox；acceptance 命令 4 专门验证无全局 git | ✅ |
| 不新增依赖 | package.json 无变更 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增两个测试用例，未修改任何已有数值上下限。

### 被改写或删去的断言

无。diff 中无已有测试文件的 `expect(...)` 被删除或修改。`test/blocked-cleanup.test.ts` 唯一的删除行是 import 行（`-import { existsSync, mkdirSync, writeFileSync } from 'node:fs';`，被扩展的 import 替代）。

## 结论与理由

全部 8 条验收命令实跑通过。3 个条目的所有具体实现要求均已满足：
- 条目 1：`batchCleanup` 不再使用 `git add -A`，而是直接提交 revert 和 `git rm` 已经暂存的内容；无救援且无验收测试时直接返回不提交。
- 条目 2：冲突时只用 `revert --abort`，不用 `reset` 或 `checkout .`；abort 后有 tracked 改动记 `abort_left_changes`，干净则记 `revert_conflict`。
- 条目 3：新增 3 个测试场景覆盖加粗的三种情形，2 个不变量测试，现有 6 条测试未改动。
  
无受保护文件修改、无依赖变更、无范围蔓延、无断言删改。提交已推送至 origin/main。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b25",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["80b28b1120c9ff774fe62de38c06430884767206"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "lint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "70 files, 1453 tests passed" },
      { "cmd": "e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts", "exit_code": 0, "summary": "9 tests passed without git global identity" },
      { "cmd": "grep -qF \"blocked cleanup: only its own paths\" test/blocked-cleanup.test.ts", "exit_code": 0, "summary": "new describe group exists" },
      { "cmd": "! grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qF \"'reset'\"", "exit_code": 0, "summary": "no 'reset' in non-comment lines" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -cF \"['add', '-A']\" | grep -qx 1", "exit_code": 0, "summary": "exactly one ['add', '-A'] (rescue)" },
      { "cmd": "grep -qF \"'reset'\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant synced" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 8 acceptance commands pass. Implementation correctly removes git add -A and git reset from batchCleanup, replaces with selective staging via revert --no-commit + git rm. Conflict handling uses only revert --abort with proper abort_left_changes / revert_conflict distinction. Three new test scenarios cover all bold task requirements. Two new invariant tests added. No existing tests or assertions modified. CI verification deferred to R2."
}
```
