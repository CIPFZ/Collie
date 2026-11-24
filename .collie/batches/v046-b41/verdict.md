I have all the evidence I need. Let me now write the complete verdict.

# 批次 v046-b41 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline 662459a..052d680 -- . ':(exclude).collie/batches'
052d680 cli: status/why/report report backlog errors instead of swallowing them (SPEC 16.28)
6afa8a0 docs: issue v046-b41 task envelope
```

worker 提交：`052d6800a55d134910430d6f364bc75077283941`
test-agent 提交：`6afa8a0ea8076e4497df8298587561c0260eb8a6`

`git rev-parse` 确认 `052d680` 存在。`git branch -a --contains 052d680` 显示它在 `main` 和 detached HEAD 上。`git ls-remote origin` 显示 `main` 在 `3dc24f56abed401fdac5f1ba091b6634d5c00212`，说明 head_sha 未推送到远端（此 worktree 是隔离环境，推送由 R2 处理）。

### 2. 受保护路径

```
$ git diff --stat 662459a..052d680 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts

test/acceptance/v046-b41/MAP.md       |  21 ++++
test/acceptance/v046-b41/keep.test.ts | 209 +++++
test/acceptance/v046-b41/new.test.ts  | 118 +++
3 files changed, 348 insertions(+)
```

这些改动全部来自 `6afa8a0`（`docs: issue` 开头），是 test agent 的产出。worker 没有动 `test/acceptance/`。受保护路径改动行数 = 0（worker 层面）。

### 3. 依赖变化

```
$ git diff 662459a..052d680 -- package.json package-lock.json
（无输出）
```

无新增依赖。

### 4. 变异检查清单

```
$ git diff 662459a..052d680 -- scripts/mutation.ts
```

唯一改动：注释 `Protected paths (11)` → `Protected paths (14)`。没有删除或改写任何变异项的 `name`/`original`/`replacement`。✅

### 5. 验收命令实跑

#### V1: `npm run lint`
```
exit 0
输出：All matched files use Prettier code style!
```

#### V2: `npm run typecheck`
```
exit 0
输出：（无错误输出）
```

#### V3: `npm test`
```
exit 0
Test Files  84 passed (84)
     Tests  1581 passed (1581)
```

#### V4: `npm test -- test/acceptance/v046-b41`
```
exit 0
Test Files  2 passed (2)
     Tests  8 passed (8)
```

#### V5: `grep -qF "Protected paths (14)" scripts/mutation.ts`
```
exit 0
```

全部 5 条验收命令通过。

### 6. 不变量数值变化

```
$ git diff 662459a..052d680 -- test/invariants.test.ts
（无输出）
```

无。

### 7. 被改写或删去的断言

```
$ git diff 662459a..052d680 -- test/ ':(exclude)test/acceptance/v046-b41'
（无输出）
```

无。worker 没有修改任何现有测试文件。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 84 files, 1581 tests | ✅ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b41` | exit 0, 2 files, 8 tests | ✅ |
| 变异脚本注释项数 | `grep -qF "Protected paths (14)" scripts/mutation.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `status`、`why`、`report` 共用同一个读法（一个函数） | 条目 1 | `src/cli.ts:585` 定义 `function tryLoadBacklog`；`src/cli.ts:604`（status）、`src/cli.ts:687`（why）、`src/cli.ts:724`（report）三处调用同一函数 | ✅ |
| backlog 存在但加载失败 → stderr `collie: ...`，exit 1 | 条目 1 | `src/cli.ts:606`: `deps.err(\`collie: ${backlogResult.error}\n\`); return EXIT_CODES.ERROR;`；`src/cli.ts:689` 和 `src/cli.ts:726` 同理 | ✅ |
| backlog 不存在 → 当成没有批次（空数组） | 条目 1 | `src/cli.ts:588-589`: `if (!existsSync(join(cwd, BACKLOG_RELATIVE_PATH))) { return { ok: true, batches: [] }; }` | ✅ |
| `--json` 时也一样（exit 1，不输出） | 条目 1 | `tryLoadBacklog` 在 `status` 函数开头调用（`src/cli.ts:604`），在 json 分支之前；若 `!ok` 直接 return 1，不走 JSON 输出。**行为验证**：`npx vitest run test/acceptance/v046-b41/new.test.ts` → `Tests 4 passed`，其中 S2 测 `status --json` 时 exit 1 且输出含 `v00-x99` | ✅ |
| 与 `show` 报错的写法相同（`collie: ` 开头） | 条目 1 | `src/cli.ts:467`（show 的 catch 格式）: `deps.err(\`collie: ${error instanceof Error ? error.message : String(error)}\n\`)`；`src/cli.ts:606/689/726` 使用 `deps.err(\`collie: ${backlogResult.error}\n\`)` 格式一致 | ✅ |
| mutation.ts 只改数字 11→14 | 条目 2 | `scripts/mutation.ts:279`: `// ── Protected paths (14) ──`；diff 仅 1 行变化（`(11)` → `(14)`） | ✅ |
| 批次清单合法时三条命令的输出与退出码不变 | 条目 2 | `tryLoadBacklog` 返回 `{ ok: true, batches: [...] }` 时走原逻辑路径（`src/cli.ts:618-626`、`694-714`、`774-777`）；**行为验证**：K1（status exit 0）和 K2（why exit 1 for missing batch）两个保持场景测试通过 | ✅ |
| `show`、`run`、`timeline`、`preflight` 行为不变 | 条目 2 | `git diff` 的 hunk headers 确认：`show`（388行）、`run`（177行）、`timeline`（633行）均未被修改；K3 场景测试 show 行为不变通过 | ✅ |
| 已有断言一条都不改 | 条目 2 | `git diff 662459a..052d680 -- test/ ':(exclude)test/acceptance/v046-b41'`：无输出 | ✅ |
| 不改受保护路径 | 额外禁止 | 受保护路径改动仅来自 test agent 的 `docs: issue` 提交 | ✅ |
| 不改 `src/cli.ts` 之外的 `src/` 文件 | 额外禁止 | `git diff 662459a..052d680 -- src/ ':(exclude)src/cli.ts'`：无输出 | ✅ |
| mutation.ts 只改那一个数 | 额外禁止 | diff 仅 1 行：`(11)` → `(14)` | ✅ |
| 不删除/跳过测试 | 额外禁止 | 无测试文件被改动 | ✅ |
| 不改注释或字面以凑过验收 | 额外禁止 | diff 中除 mutation.ts 的指定注释外无注释改动 | ✅ |
| 无新增依赖 | 额外禁止 | package.json/lock 无改动 | ✅ |

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1：status with broken dep → exit 1, output has v00-x99 | `new.test.ts`: `S1: exits 1 and output contains v00-x99` | 是。`expect(exitCode).toBe(1)` + `expect(allOutput(box)).toContain('v00-x99')` | 是。拿掉 `tryLoadBacklog` 的 error 分支，`loadBacklog` 抛错会被旧 `catch` 吞掉（返回空数组，exit 0），断言 exitCode=1 会失败 |
| S2：status --json with broken dep → exit 1, output has v00-x99 | `new.test.ts`: `S2: exits 1 and output contains v00-x99` | 是。同 S1 格式，额外传 `--json` | 是。同理旧代码 catch 吞错，exit 0 |
| S3：why v99-b01 with broken dep → output has v00-x99, no "is not in docs/backlog.md" | `new.test.ts`: `S3: output contains v00-x99 and does not contain "is not in docs/backlog.md"` | 是。`expect(output).toContain('v00-x99')` + `expect(output).not.toContain('is not in docs/backlog.md')` | 是。旧代码 catch 吞错返回空 batches → `inBacklog` 为 false → 输出 "is not in docs/backlog.md"，`not.toContain` 断言会失败 |
| S4：report with broken dep → exit 1, output has v00-x99 | `new.test.ts`: `S4: exits 1 and output contains v00-x99` | 是。`expect(exitCode).toBe(1)` + `expect(allOutput(box)).toContain('v00-x99')` | 是。旧代码 catch 吞错，report 继续执行找不到 queue runs → exit 2 而非 1 |
| K1：status no runs → exit 0, "no runs recorded" | `keep.test.ts`: `K1: exits 0 and output contains "no runs recorded"` | 是。`expect(exitCode).toBe(0)` + `expect(allOutput(box)).toContain('no runs recorded')` | N/A（保持场景，行为没变） |
| K2：why v99-b99 → exit 1, "batch v99-b99 is not in docs/backlog.md" | `keep.test.ts`: `K2: exits 1 and output contains "batch v99-b99 is not in docs/backlog.md"` | 是。精确匹配错误信息 | N/A（保持场景） |
| K3：show with broken dep → exit 1, output has v00-x99 | `keep.test.ts`: `K3: exits 1 and output contains v00-x99` | 是。`expect(exitCode).toBe(1)` + `expect(allOutput(box)).toContain('v00-x99')` | N/A（保持场景，show 行为未变） |
| K4：loadBacklog merges archive + backlog → 3 batches, correct statuses | `keep.test.ts`: `K4: returns 3 batches, first two statuses are blocked and passed` | 是。`expect(batches).toHaveLength(3)` + 检查前两个 status | N/A（保持场景，loadBacklog 未改） |

测试缺口：无。所有 8 个情形都有对应的断言，且断言内容与情形描述匹配。

## 结论与理由

全部 5 条验收命令实跑通过。代码变更范围严格限制在 `src/cli.ts`（新增 `tryLoadBacklog` 共用函数，`status`/`why`/`report` 三处调用）和 `scripts/mutation.ts`（注释数字 11→14）。无受保护路径被 worker 修改，无依赖变化，无现有断言改动，无测试删除。8 个场景（4 新 + 4 保持）全部通过验收测试，且每个断言都与情形描述匹配。`show`/`run`/`timeline`/`preflight` 行为未受影响。

判定 **PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b41",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "052d6800a55d134910430d6f364bc75077283941",
      "6afa8a0ea8076e4497df8298587561c0260eb8a6"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "84 files, 1581 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b41", "exit_code": 0, "summary": "2 files, 8 tests passed" },
      { "cmd": "grep -qF \"Protected paths (14)\" scripts/mutation.ts", "exit_code": 0, "summary": "pattern found" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 5 acceptance commands pass. Worker changes are strictly scoped to src/cli.ts (shared tryLoadBacklog function used by status/why/report) and scripts/mutation.ts (comment number 11→14). No protected paths modified by worker, no dependency changes, no existing assertions altered. All 8 scenarios (S1-S4 new, K1-K4 keep) verified via acceptance tests. CI status unknown — deferred to R2."
}
```
