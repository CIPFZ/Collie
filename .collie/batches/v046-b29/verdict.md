I have all the evidence needed. Let me compile the verdict.

# 批次 v046-b29 审核

## 取证过程

### 1. 提交事实

```
$ git log --format='%H %s' f6936747..a11f950d -- . ':(exclude).collie/batches'
a11f950de89876bb60be1873db49a701a6394f7a test: add rule9_same_head tests and update invariants
25e142f368a1c9de66a2b25bc0dce7be9c463169 runner: detect rule 9 same head_sha and escalate instead of retrying (SPEC 16.20)
```

两个提交存在于本地 `main` 分支。

```
$ git ls-remote origin | grep a11f950
(无结果)
```

远端 main 在 `396fc9b`，head_sha 未找到。`remote_has_head: false`。

### 2. 受保护文件

```
$ git diff --stat f6936747..a11f950d -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance
(无输出)
```

**无受保护文件被修改。**

### 3. 禁止修改的文件

```
$ git diff --stat f6936747..a11f950d -- src/schema/index.ts src/arbiter.ts src/gate.ts src/evidence.ts src/acceptance.ts src/roles/ src/runner/ .github/ eslint.config.js vitest.config.ts package.json templates/collie.toml
(无输出)
```

**额外禁止文件全部未动。**

### 4. 依赖变化

```
$ git diff f6936747..a11f950d -- package.json package-lock.json
(无输出)
```

**无依赖变更。**

### 5. 验收命令实跑

#### 5.1 `npm run lint` → exit 0 ✅
```
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

#### 5.2 `npm run typecheck` → exit 0 ✅
```
> tsc -p tsconfig.json
(无输出，退出码 0)
```

#### 5.3 `npm test` → exit 0 ✅
```
Test Files  72 passed (72)
     Tests  1474 passed (1474)
  Duration  26.02s
```

#### 5.4 `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts` → exit 0 ✅
```
Test Files  1 passed (1)
     Tests  3 passed (3)
  Duration  3.25s
```

#### 5.5 `grep -qF "queue: rule 9 twice on the same head_sha escalates" test/rule9-same-head.test.ts` → exit 0 ✅

#### 5.6 `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "rule9_same_head"` → exit 0 ✅

#### 5.7 `grep -qF "rule9_same_head" test/invariants.test.ts` → exit 0 ✅

### 6. Diff 范围检查

共改 3 个文件：
- `src/run.ts` — +90 行（新函数 `findRule9CiHeadShas` + queue 循环中的 rule9_same_head 检测逻辑）
- `test/invariants.test.ts` — +9/-2 行（push 上限 7→8 + 新 invariant）
- `test/rule9-same-head.test.ts` — 415 行新文件

全部在 task.md 的三个条目范围内，无范围蔓延。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 72 files, 1474 tests passed | ✅ |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts` | exit 0, 3 passed | ✅ |
| 新的一组用例在 | `grep -qF "queue: rule 9 twice on the same head_sha escalates" test/rule9-same-head.test.ts` | exit 0 | ✅ |
| 队列认得这条原因 | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "rule9_same_head"` | exit 0 | ✅ |
| 不变量同步 | `grep -qF "rule9_same_head" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1 — 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 检测在 `runQueue`（非单批次模式） | task 条目 1 / 额外禁止 "不在单批次模式里加这条判断" | `src/run.ts:3316-3372` — 在 `runQueue` 函数内（从 2988 行开始）；grep 确认所有 4 处 `rule9_same_head` 均在 3316-3372 行 | ✅ |
| `evidence_unavailable` 判断在其之前 | task 条目 1 "以 evidence_unavailable 停下的判断仍在它之前" | `src/run.ts:3293`（evidence_unavailable 检查） < `src/run.ts:3316`（rule9_same_head 检查）| ✅ |
| 记 `escalated`（reason: rule9_same_head, batch_id, head_sha） | task 条目 1 | `src/run.ts:3327-3331` — `queueRec.record('escalated', { reason: 'rule9_same_head', batch_id: currentBatchId, head_sha: headSha })` | ✅ |
| 批次记 `blocked` | task 条目 1 | `src/run.ts:3332` — `updateBacklogToDisk(root, currentBatchId, 'blocked', queueRec)` | ✅ |
| 照超过 fix_max 那条路提交、推送、收尾 | task 条目 1 | `src/run.ts:3333-3340`（r2Commit）、`src/run.ts:3344-3357`（push + verdict.pushed/push_failed）、`src/run.ts:3359`（batchCleanup） | ✅ |
| `queue.finished` 的 reason 是 `rule9_same_head` | task 条目 1 | `src/run.ts:3360-3364` — `queueRec.record('queue.finished', { reason: 'rule9_same_head', ... })` | ✅ |
| 退出码 20 | task 条目 1 | `src/run.ts:3366` — `exitCode: EXIT_CODES.BLOCK`；`src/run.ts:71` — `BLOCK: 20` | ✅ |
| head_sha 不同时照旧按 fix_max 计数重跑 | task 条目 1 | `src/run.ts:3324` — `duplicateEntry` 为 `undefined` 时（无重复 sha），代码 fall-through 到 `src/run.ts:3374` 的 fix_max 计数 | ✅ |
| `src/schema/index.ts` 不加新事件类型（复用 `escalated`） | task 条目 2 | `git diff` 确认 `src/schema/index.ts` 未修改 | ✅ |
| 不改 `rule9_twice` 判断 | 额外禁止 | `src/run.ts:3172` — `rule9_twice` 逻辑未被 diff 触及 | ✅ |
| 不改 `src/arbiter.ts` 等禁止文件 | 额外禁止 | diff 确认零改动 | ✅ |

### 条目 1 — 行为要求

| 要求 | 出处 | 证据（命令 + 输出） | 满足 |
|---|---|---|---|
| 同一 head_sha 第二次规则 9 → 队列停下 exit 20，backlog blocked，journal 有 escalated | task 条目 1 加粗段落 1 | `npx vitest run test/rule9-same-head.test.ts` → `Tests 3 passed`；测试 "same head_sha: stops with rule9_same_head, exit 20, backlog blocked, escalated event"（test/rule9-same-head.test.ts:311-345）断言：exit=20、2 次 downgrade rule=9、escalated.reason='rule9_same_head'、escalated.head_sha=shaStore[0]、finished.reason='rule9_same_head'、backlog 含 'blocked' | ✅ |
| 不同 head_sha 两次规则 9 → 照常第 3 次重跑 | task 条目 1 加粗段落 2 | 同上；测试 "different head_sha: proceeds to third run (fix_max retry)"（test/rule9-same-head.test.ts:347-389）断言：exit=20、3 次 downgrade rule=9、无 rule9_same_head、有 fix_max escalation、finished.reason='fix_max' | ✅ |
| 第 1 次规则 9 后第 2 次 PASS → 照常放行 | task 条目 3 | 同上；测试 "first run rule 9, second run PASS: queue continues normally"（test/rule9-same-head.test.ts:391-415）断言：exit=0、1 次 downgrade、无 rule9_same_head、finished.reason='limit' | ✅ |

### 条目 3 — 测试文件要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 新文件 `test/rule9-same-head.test.ts` | task 条目 3 | 文件存在，415 行 | ✅ |
| describe 名称正确 | task 条目 3 | `test/rule9-same-head.test.ts:298` — `describe('queue: rule 9 twice on the same head_sha escalates', ...)` | ✅ |
| CI 结论用注入的假 fetch | task 条目 3 | `test/rule9-same-head.test.ts:62-72`（`ciFailureFetch`）、`test/rule9-same-head.test.ts:323`（`{ fetch }`）| ✅ |
| invariants 加 rule9_same_head | task 条目 3 | `test/invariants.test.ts:749-752` — `expect(content).toContain('rule9_same_head')` | ✅ |
| 不用真实 runner 或真实网络 | 额外禁止 | 测试用 `FakeRunner` 和注入的 `fetch` | ✅ |
| 不用机器 git 全局配置 | 额外禁止 | 验收命令 4 以 `GIT_CONFIG_GLOBAL=$(mktemp) GIT_CONFIG_NOSYSTEM=1` 通过 | ✅ |

### 不变量数值变化

- `test/invariants.test.ts` 第 183 行：`expect(pushLines.length).toBeLessThanOrEqual(7)` → `expect(pushLines.length).toBeLessThanOrEqual(8)`
  - 原值：7，新值：8
  - 原因：新增恰好 1 处 `await push(` 在 `src/run.ts:3345`（rule9_same_head 路径），总计从 7 变 8
  - task 条目 2 明确允许：「`every await push( …` 上限 7 改成 8，前提是新加的推送恰好一处」✓

### 被改写或删去的断言

- 仅上述 `toBeLessThanOrEqual(7)` → `toBeLessThanOrEqual(8)` 一处，属 task 明确允许的改写
- 无其他 `expect(...)` 被删除或改写
- 无其他现有测试文件被修改（`git diff -- test/ ':(exclude)test/rule9-same-head.test.ts'` 仅显示 invariants.test.ts 的上述变化）

## 结论与理由

全部 7 条验收命令实跑通过。实现准确对应 task 的 3 个条目：
- 条目 1：`src/run.ts` 在 `runQueue` 中 evidence_unavailable 之后、fix_max 之前正确插入了 rule9_same_head 检测逻辑，记录 escalated 事件（含 reason/batch_id/head_sha）、标记 blocked、提交/推送/清理/退出码 20
- 条目 2：`src/schema/index.ts` 未改；invariants 上限 7→8 对应恰好新增 1 处 push
- 条目 3：新测试文件 3 个场景（同 sha 停止、不同 sha 继续、PASS 放行）均通过，使用假 fetch 注入 CI 结论

无范围蔓延，无禁止文件修改，无新增依赖，无受保护路径变更。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b29",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "25e142f368a1c9de66a2b25bc0dce7be9c463169",
      "a11f950de89876bb60be1873db49a701a6394f7a"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "72 files, 1474 tests passed" },
      { "cmd": "e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts", "exit_code": 0, "summary": "1 file, 3 tests passed" },
      { "cmd": "grep -qF \"queue: rule 9 twice on the same head_sha escalates\" test/rule9-same-head.test.ts", "exit_code": 0, "summary": "describe string found" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qF \"rule9_same_head\"", "exit_code": 0, "summary": "rule9_same_head in non-comment code" },
      { "cmd": "grep -qF \"rule9_same_head\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 7 acceptance commands pass. Implementation correctly adds rule9_same_head detection in runQueue after evidence_unavailable and before fix_max. Three test scenarios cover same-sha escalation, different-sha fallthrough, and PASS-after-rule9. No forbidden files modified, no new dependencies, no protected path changes. CI status unknown (no GitHub credentials); CI verification deferred to R2."
}
```
