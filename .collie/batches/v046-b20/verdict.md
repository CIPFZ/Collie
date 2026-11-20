Good. Only additions, no existing invariant assertions modified. The two new invariants match the task requirements exactly.

Now I have all the evidence. Let me compile the verdict.

# 批次 v046-b20 审核

## 取证过程

### 1. 受保护路径检查

```
git diff --stat 33775301..ccb05f99 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml 'test/acceptance'
```
结果：无输出。受保护路径无改动。

额外禁止的路径：
```
git diff --stat 33775301..ccb05f99 -- .github/ eslint.config.js vitest.config.ts package.json
git diff --stat 33775301..ccb05f99 -- src/acceptance.ts src/redcheck.ts 'src/roles/' 'src/runner/' src/arbiter.ts src/gate.ts src/evidence.ts src/ladder.ts src/backlog.ts
```
结果：均无输出。禁止路径无改动。

### 2. 提交事实

```
git log --format='%H %s' 33775301..ccb05f99 -- . ':(exclude).collie/batches'
```
输出：`ccb05f99a8a26703f5dde8d4cd585754c4b4fdae runner: restore tracked files, leave untracked in tester_touched_main_tree; add tests (v046-b20)`

一个提交，已推送到 `origin/main`（`git branch -r --contains ccb05f99` 确认）。

### 3. 依赖变化

```
git diff 33775301..ccb05f99 -- package.json package-lock.json pnpm-lock.yaml
```
结果：无输出。无依赖变化。

### 4. 变动范围

6 个文件：`src/run.ts`、`test/config.test.ts`、`test/follow.test.ts`、`test/invariants.test.ts`、`test/queue-limit.test.ts`、`test/tester-step.test.ts`。全部在条目范围内，无范围蔓延。

### 5. 验收命令实跑

验收命令 1（`npm run lint`）：退出码 0
验收命令 2（`npm run typecheck`）：退出码 0
验收命令 3（`npm test`）：退出码 0，67 文件全部通过，1400 测试通过
验收命令 4（`e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test`）：退出码 0，67 文件全部通过，1400 测试通过
验收命令 5（`npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts`）：退出码 0，3 文件通过，126 测试通过
验收命令 6（grep 两组新用例）：退出码 0
验收命令 7（不在主仓库执行 git clean）：退出码 0
验收命令 8（模板有配置项，本仓库配置没动）：退出码 0
验收命令 9（不变量同步）：退出码 0

### 6. 行为测试实跑

```
npx vitest run test/tester-step.test.ts
```
输出：Tests 12 passed (12)。包含新加的 3 条用例 + 原有的 9 条全部通过。

```
npx vitest run test/config.test.ts
```
输出：Tests 34 passed (34)。包含新加的 2 条 `config: worktree_secs` 用例。

```
npx vitest run test/invariants.test.ts
```
输出：Tests 87 passed (87)。包含新加的 2 条不变量。

现有用例 `tester writes to main workspace → escalated with tester_touched_main_tree` 单独跑：
```
npx vitest run test/tester-step.test.ts -t "tester writes to main workspace"
```
输出：Tests 1 passed | 11 skipped (12)。确认此用例一个字未改地通过。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 1. 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 2. 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 3. 全部测试通过 | `npm test` | exit 0, 1400 passed | ✅ |
| 4. 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0, 1400 passed | ✅ |
| 5. 接线那一步与配置的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts` | exit 0, 126 passed | ✅ |
| 6. 两组新用例在 | `grep -qF "tester step: heartbeat and tracked-file safety" test/tester-step.test.ts && grep -qF "config: worktree_secs" test/config.test.ts` | exit 0 | ✅ |
| 7. 不在主仓库里执行 git clean | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | exit 0 | ✅ |
| 8. 模板有新配置项，本仓库的配置没动 | `grep -qE "^worktree_secs = 1800" templates/collie.toml && ! grep -qE "worktree_secs" .collie/collie.toml` | exit 0 | ✅ |
| 9. 不变量同步 | `grep -qF "worktree_secs" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 去掉 `git checkout -- .` 与 `git clean -fd` | 条目 1 | `src/run.ts` diff: 移除了 `await git(root, ['checkout', '--', '.'])` 和 `await git(root, ['clean', '-fd'])` | ✅ |
| 被跟踪文件恢复成 HEAD 的样子 | 条目 1 | `src/run.ts:1611-1612`: `if (trackedFiles.length > 0) { await git(root, ['checkout', 'HEAD', '--', ...trackedFiles]); }` | ✅ |
| 未跟踪的文件一个都不动，不执行 git clean | 条目 1 | `src/run.ts` 整个 `tester_touched_main_tree` 块：无 `clean` 命令，`untrackedFiles` 只用于写入 tester.md，不做删除 | ✅ |
| tester.md 分两节：恢复了的被跟踪文件 / 留在工作区的未跟踪文件 | 条目 1 | `src/run.ts:1616`: `'## 恢复了的被跟踪文件'`；`src/run.ts:1625`: `'## 留在工作区的未跟踪文件'` | ✅ |
| 没有的节写「无」| 条目 1 | `src/run.ts:1622`: `testerMdLines.push('无')` (tracked 空时)；`src/run.ts:1631`: `testerMdLines.push('无')` (untracked 空时) | ✅ |
| 假测试 agent 修改跟踪文件 + 新建未跟踪文件场景（行为要求）| 条目 1 加粗 | `npx vitest run test/tester-step.test.ts` → Tests 12 passed，含用例 `tracked file modified + untracked file → restore tracked, leave untracked, tester.md lists both` | ✅ |
| rogue.txt 还在工作区（行为要求）| 条目 1 加粗 | 同上测试断言：`expect(existsSync(join(box.root, 'rogue.txt'))).toBe(true)` — Tests 12 passed | ✅ |
| git log -p 里没有 tester 加的那一行（行为要求）| 条目 1 加粗 | 同上测试断言：`expect(logP).not.toContain('tester was here')` — Tests 12 passed | ✅ |
| tester.md 两节各列出对应文件（行为要求）| 条目 1 加粗 | 同上测试断言：`expect(testerMd).toContain('docs/progress.md')` 和 `expect(testerMd).toContain('rogue.txt')` — Tests 12 passed | ✅ |
| 现有用例一个字都不改，重新通过 | 条目 1 加粗 | `npx vitest run test/tester-step.test.ts -t "tester writes to main workspace"` → Tests 1 passed；diff 确认该用例 (行 571-585) 无任何变化 | ✅ |

### 条目 2 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `limits.worktree_secs` 在 schema 中 | 条目 2 | `src/schema/index.ts:152`: `worktree_secs: z.number().int().positive().optional().default(DEFAULT_WORKTREE_SECS)` | ✅ |
| `templates/collie.toml` 有 `worktree_secs = 1800` | 条目 2 | `templates/collie.toml:47`: `worktree_secs = 1800` | ✅ |
| 测试 agent 这一步的墙钟用 `worktree_secs` | 条目 2 | `src/run.ts:1486`: `ctx.testerSignal ?? AbortSignal.timeout(config.limits.worktree_secs * MS_PER_SECOND)` | ✅ |
| 测试 agent 步结束后 heartbeat phase 改回 worker | 条目 2 | `src/run.ts:1691`: `updateHeartbeat(root, { phase: 'worker', updated_at: ctx.now().toISOString() })` | ✅ |
| heartbeat phase 是 worker（行为要求）| 条目 2 加粗 | `npx vitest run test/tester-step.test.ts` → Tests 12 passed，含用例 `after tester step, heartbeat phase is worker`，测试在 worker 场景执行时读取 heartbeat.json 验证 `phase === 'worker'` | ✅ |
| `worktree_secs = 0` 被拒绝（行为要求）| 条目 2 加粗 | `npx vitest run test/config.test.ts` → Tests 34 passed，含用例 `worktree_secs = 0 is rejected, error names limits.worktree_secs`，断言 `expect(err.issues.map((i) => i.path)).toEqual(['limits.worktree_secs'])` | ✅ |
| 不写 worktree_secs 的配置能加载，值是 1800（行为要求）| 条目 2 加粗 | 同上，含用例 `config without worktree_secs loads, defaults to 1800`，断言 `expect(parsed.limits.worktree_secs).toBe(1800)` — Tests 34 passed | ✅ |
| 本仓库 `.collie/collie.toml` 不许动 | 条目 2 | `git diff 33775301..ccb05f99 -- .collie/collie.toml` 无输出 | ✅ |

### 条目 3 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新 describe `tester step: heartbeat and tracked-file safety` | 条目 3 | `test/tester-step.test.ts:691`: `describe('tester step: heartbeat and tracked-file safety', () => {` | ✅ |
| 新 describe `config: worktree_secs` | 条目 3 | `test/config.test.ts:321`: `describe('config: worktree_secs', () => {` | ✅ |
| 删掉的被跟踪文件恢复场景 | 条目 3 | `test/tester-step.test.ts:756`: `it('tester only deletes a tracked file → that file is restored, listed in tester.md'` — `npx vitest run test/tester-step.test.ts` Tests 12 passed | ✅ |
| `test/queue-limit.test.ts` 第 188 行超时改 300_000 | 条目 3 | diff 确认：`-describe(..., { timeout: 120_000 },` → `+describe(..., { timeout: 300_000 },`；原 188 行确认 | ✅ |
| `test/follow.test.ts` 第 121 行超时改 300_000 | 条目 3 | diff 确认：`-describe(..., { timeout: 120_000 },` → `+describe(..., { timeout: 300_000 },`；原 121 行确认 | ✅ |
| invariants 加 `worktree_secs` | 条目 3 | `test/invariants.test.ts:688`: `it('src/run.ts has worktree_secs (v046-b20)'` | ✅ |
| invariants 加 `'clean'` 检查 | 条目 3 | `test/invariants.test.ts:693`: `it("src/run.ts non-comment lines do not contain 'clean' (v046-b20)"` | ✅ |
| 已有断言除条目 2 点名处外一条都不改 | 条目 3 | diff 确认：测试文件中仅有的 `-` 行是两个 timeout 值 `120_000` → `300_000` | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径 | 额外禁止 | `git diff --stat` 对所有受保护路径无输出 | ✅ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 不改 `src/acceptance.ts` 等列出的源文件 | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 不在主仓库执行 git clean | 额外禁止 | `src/run.ts` 中 `'clean'` 在非注释行中不出现（验收 7 通过） | ✅ |
| 不删除/移动未跟踪文件 | 额外禁止 | `src/run.ts:1607-1608` 过滤 `??` 文件只用于写 tester.md，无删除操作 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | diff 中无删除测试用例 | ✅ |
| 不改写条目 2 点名之外的已有断言 | 额外禁止 | diff 中测试文件唯一的 `-` 行是两个 timeout 值 | ✅ |
| 不新增依赖 | 额外禁止 | `package.json` 无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 只有新增的两条测试，没有修改任何现有数值上下限。

### 被改写或删去的断言

无。diff 中测试文件只有两行 `-`（两个 timeout 值 `120_000` → `300_000`），这不是断言而是 `describe` 的超时参数，且是条目 3 明确要求的修改。所有 `expect(...)` 断言均未被删除或修改。

## 结论与理由

全部 9 条验收命令实跑通过。3 个条目的结构要求和行为要求均已验证满足。受保护路径和禁止路径无改动，无新增依赖，无范围蔓延。提交已推送到 origin/main。唯一的实现变更在 `src/run.ts` 的 `tester_touched_main_tree` 块，逻辑清晰正确：分离被跟踪文件和未跟踪文件，只恢复前者，留下后者，tester.md 分两节报告。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b20",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["ccb05f99a8a26703f5dde8d4cd585754c4b4fdae"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "67 files, 1400 tests passed" },
      { "cmd": "e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test", "exit_code": 0, "summary": "67 files, 1400 tests passed" },
      { "cmd": "npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts", "exit_code": 0, "summary": "3 files, 126 tests passed" },
      { "cmd": "grep -qF \"tester step: heartbeat and tracked-file safety\" test/tester-step.test.ts && grep -qF \"config: worktree_secs\" test/config.test.ts", "exit_code": 0, "summary": "both describe groups found" },
      { "cmd": "! grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qF \"'clean'\"", "exit_code": 0, "summary": "no 'clean' in non-comment lines" },
      { "cmd": "grep -qE \"^worktree_secs = 1800\" templates/collie.toml && ! grep -qE \"worktree_secs\" .collie/collie.toml", "exit_code": 0, "summary": "template has config, local does not" },
      { "cmd": "grep -qF \"worktree_secs\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 9 acceptance commands pass. Implementation correctly replaces blanket checkout+clean with selective tracked-file restoration, leaves untracked files alone, writes two-section tester.md. All new test cases (3 in tester-step, 2 in config, 2 in invariants) pass. Existing test 'tester writes to main workspace' passes unmodified. Timeout changes at specified lines confirmed. No protected/forbidden files modified, no dependency changes, no scope creep. CI conclusion unknown — CI 以 R2 取证为准."
}
```
