Confirmed: the `evidence_unavailable` path at line 3236 returns immediately without calling `batchCleanup`. ✓

Now I have all the evidence I need to compile the verdict. Let me summarize:

**All 8 acceptance commands pass ✓**
**No protected files modified ✓**
**No dependency changes ✓**
**No prohibited source files modified ✓**
**Two commits exist and are valid ✓**
**All existing related tests pass unmodified ✓**
**All behavioral tests pass ✓**

# 批次 v046-b22 审核

## 取证过程

### 1. 验收命令实跑

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | 通过，lint + prettier 均无错误 |
| 2 | `npm run typecheck` | 0 | 通过，tsc 无错误 |
| 3 | `npm test` | 0 | 70 个测试文件全部通过，1437 个用例 |
| 4 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | 0 | 1 个测试文件通过，6 个用例 |
| 5 | `grep -qF "blocked cleanup: rescue commits are reverted" test/blocked-cleanup.test.ts && ...` | 0 | 三组用例标题均存在 |
| 6 | `grep -qF "batch.cleanup_failed" src/schema/index.ts && grep -qE "'batch\.cleanup'" src/schema/index.ts` | 0 | 两个事件类型均已添加 |
| 7 | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | 0 | 非注释行无 `'clean'` |
| 8 | `grep -qF "batch.cleanup" test/invariants.test.ts` | 0 | 不变量测试已包含 `batch.cleanup` |

### 2. 提交验证

```
git log --format='%H %s' ee938ff..6f7f657 -- . ':(exclude).collie/batches'
```
- `f777664d031e983dd2aa6e7acd7257a14f390c32` schema: add batch.cleanup and batch.cleanup_failed event types; implement batchCleanup in run.ts (SPEC 16.18)
- `6f7f657e663cfdca74c168fa130fa7cb9cc6bce6` test: add blocked-cleanup.test.ts with three groups for SPEC 16.18 batch cleanup

### 3. 受保护路径检查

```
git diff --stat ee938ff..6f7f657 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance
```
无输出（0 行变化）。✓

```
git diff --stat ee938ff..6f7f657 -- .github/ eslint.config.js vitest.config.ts package.json templates/collie.toml
```
无输出。✓

```
git diff --stat ee938ff..6f7f657 -- src/arbiter.ts src/gate.ts src/evidence.ts src/acceptance.ts src/redcheck.ts src/roles/ src/runner/ src/cli.ts
```
无输出。✓

```
git log --format='%h %s' ee938ff..6f7f657 -- test/acceptance
```
无输出（worker 未修改 test/acceptance）。✓

### 4. 依赖变化

```
git diff --stat ee938ff..6f7f657 -- package.json package-lock.json
```
无输出。无新增依赖。✓

### 5. 远端推送

`git ls-remote origin | grep 6f7f657` 无输出。CI 信息不可查。

### 6. 相关现有测试实跑

| 测试文件 | 结果 |
|---|---|
| `test/scenario-n.test.ts` | 6 passed |
| `test/scenario-j.test.ts` | 8 passed |
| `test/scenario-m.test.ts` | 6 passed |
| `test/queue-limit.test.ts` | 4 passed |
| `test/r2-commits.test.ts` | 10 passed |
| `test/scenario-e.test.ts` + `test/scenario-i.test.ts` + `test/show.test.ts` | 28 passed |

所有相关测试文件未被修改，且全部通过。现有测试的 idle worker（`idleWorkerNoReport`）会提交代码后进入空转，workspace 不脏，因此不触发救援提交。`batchCleanup` 在这些场景下正确发现无需清理，不产生额外提交或事件。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 70 files, 1437 tests passed | ✅ |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | exit 0, 6 passed | ✅ |
| 三组用例在 | `grep -qF ... test/blocked-cleanup.test.ts` | exit 0 | ✅ |
| 两个事件进了类型清单 | `grep -qF "batch.cleanup_failed" src/schema/index.ts && grep -qE "'batch\.cleanup'" src/schema/index.ts` | exit 0 | ✅ |
| 不在主仓库里执行 git clean | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | exit 0 | ✅ |
| 不变量同步 | `grep -qF "batch.cleanup" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：batchCleanup 函数实现

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 写成一个函数 | 条目 1 | `src/run.ts:2670` — `async function batchCleanup(` | ✅ |
| 在队列里两处调用：blocked 路径 | 条目 1 | `src/run.ts:3225` — `await batchCleanup(root, currentBatchId, ...)` | ✅ |
| 在队列里两处调用：fix_max 路径 | 条目 1 | `src/run.ts:3295` — `await batchCleanup(root, currentBatchId, ...)` | ✅ |
| 提交经 r2Commit | 条目 1 | `src/run.ts:2772` — `const cleanupSha = await r2Commit(root, \`progress: ${batchId} cleanup\`, ['.'], rec);` | ✅ |
| 事件类型加 batch.cleanup | 条目 1 | `src/schema/index.ts:310` — `'batch.cleanup',` | ✅ |
| 事件类型加 batch.cleanup_failed | 条目 1 | `src/schema/index.ts:311` — `'batch.cleanup_failed',` | ✅ |
| 单批次模式不收尾 | 条目 1 | `batchCleanup` 仅在 `runQueue` 中调用（grep 确认仅3处引用：定义+2处调用），单批次模式函数 `runBatch` 中无调用 | ✅ |
| 队列 blocked 时 git log 最上面是 cleanup 提交 | 条目 1 | `npx vitest run test/blocked-cleanup.test.ts` — Tests 6 passed；测试 "idle twice → exit 20" 断言 `git log -1 --format=%s` === `progress: v99-b01 cleanup` (line 497-498) | ✅ |
| 救援提交改过的文件恢复成开跑前的内容 | 条目 1 | 测试断言 `git diff baseSha HEAD -- feature.txt` 为空 (line 502-503) — `npx vitest run test/blocked-cleanup.test.ts`: Tests 6 passed | ✅ |
| 救援提交仍在历史里 | 条目 1 | 测试断言 `revParse(box.root, sha)` 不为 null (line 509-513) — Tests 6 passed | ✅ |
| journal 有 batch.cleanup，reverted 里是救援 sha | 条目 1 | 测试断言 cleanup event 存在且 reverted 数组长度 ≥ 1 (line 475-481) — Tests 6 passed | ✅ |
| r2.commit 已记录 | 条目 1 | 测试断言 r2Commits 中有 `progress: v99-b01 cleanup` 开头的记录 (line 484-489) — Tests 6 passed | ✅ |
| 已推送 | 条目 1 | 测试断言 verdict.pushed 至少 1 条 (line 492-494) — Tests 6 passed | ✅ |
| 没有救援提交时不多任何提交 | 条目 1 | 测试 "no rescue commit and no acceptance tests → no cleanup commit, no batch.cleanup" 断言无 cleanup/cleanup_failed 事件 (line 800-814) — Tests 6 passed | ✅ |

### 条目 2：其他情形

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| fix_max 超出时删除 test/acceptance/<批次>/ | 条目 2 | 测试 "fix_max exceeded with acceptance tests → cleanup removes test/acceptance/<batch>/" 断言 cleanup.removed_acceptance === true 且目录不存在 (line 605-611) — Tests 6 passed | ✅ |
| worker 自己的代码提交一行不动 | 条目 2 | 测试断言 feat: 开头的提交仍在 git log (line 614-618) — Tests 6 passed | ✅ |
| 撤销有冲突时不留半截的撤销 | 条目 2 | 测试 "revert conflict → batch.cleanup_failed" 断言 git status --porcelain 中无 tracked changes (line 709-715) — Tests 6 passed | ✅ |
| 冲突时记 batch.cleanup_failed | 条目 2 | 测试断言 cleanup_failed 事件存在且 reason 含 "revert_conflict" (line 702-706) — Tests 6 passed | ✅ |
| 冲突时仍拿掉验收测试 | 条目 2 | 测试断言 acceptance 目录不存在 (line 723-724) — Tests 6 passed | ✅ |
| 单批次模式不收尾 | 条目 2 | 测试 "single-batch mode with rescue commit → no cleanup commit" 断言无 batch.cleanup 事件 (line 770-771) — Tests 6 passed | ✅ |

### 条目 3：测试文件与允许的旧用例改写

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新文件 test/blocked-cleanup.test.ts 存在 | 条目 3 | diff 显示新文件，701 行 | ✅ |
| 三组 describe 存在 | 条目 3 | grep 验收命令 #5 通过 | ✅ |
| schema.test.ts 个数 42→44，加两条 toContain | 条目 3 | diff 确认：`toHaveLength(42)`→`toHaveLength(44)`，新增 `toContain('batch.cleanup')` 和 `toContain('batch.cleanup_failed')` | ✅ |
| invariants.test.ts 上限 6→7 | 条目 3 | diff 确认：`toBeLessThanOrEqual(6)`→`toBeLessThanOrEqual(7)` | ✅ |
| invariants 新加「src/run.ts 里有 batch.cleanup」 | 条目 3 | `test/invariants.test.ts:709-712` — 新增 it 块确认 | ✅ |
| evidence_unavailable 时不收尾 | 条目 3 | 测试 "evidence_unavailable stops queue → no cleanup" 断言无 batch.cleanup (line 909-911)，`src/run.ts:3236` 的 evidence_unavailable 路径不调用 batchCleanup — Tests 6 passed | ✅ |

### 额外禁止核查

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径 | 额外禁止 | `git diff --stat` 对全部受保护路径均无输出 | ✅ |
| 不改 .github/, eslint.config.js 等 | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 不改 src/arbiter.ts 等列出的源文件 | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 不撤销 worker 自己的代码 | 额外禁止 | 代码中 revert 仅针对救援提交 sha（`src/run.ts:2724`），不涉及 worker 代码提交 | ✅ |
| 不在主仓库里 git clean | 额外禁止 | 验收命令 #7 通过，grep 确认无 `'clean'` 在非注释行 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | diff 仅修改 2 个旧断言（task 允许的两处）并新增测试文件与断言 | ✅ |
| 不改写条目 3 点名之外的已有断言 | 额外禁止 | diff 确认仅修改 schema.test.ts (42→44 + 2 toContain) 与 invariants.test.ts (6→7 + 新 it)，均在允许范围 | ✅ |
| 不新增依赖 | 额外禁止 | package.json/lock 无变化 | ✅ |
| 测试不用真实 runner/网络/全局 git | 额外禁止 | 新测试使用 Sandbox + FakeRunner；验收命令 #4 在无全局 git 配置下通过 | ✅ |

### 不变量数值变化

- `test/invariants.test.ts` 第 183 行：`toBeLessThanOrEqual(6)` → `toBeLessThanOrEqual(7)`（push 调用上限从 6 放到 7）
  - 原因：新增的 `batchCleanup` 函数中有一处 `await push(root, remote, branch)`，在 `src/run.ts:2774`
  - 实际 push 计数：`grep -c "await push(" src/run.ts` = 7，匹配新上限
  - task 明确允许此改动（"前提是新加的推送恰好一处"），确认恰好一处新增 ✓

### 被改写或删去的断言

1. `test/schema.test.ts` 第 255 行：`expect(EVENT_TYPES).toHaveLength(42)` → `expect(EVENT_TYPES).toHaveLength(44)`
   - 原因：新增 `batch.cleanup` 和 `batch.cleanup_failed` 两个事件类型
   - SPEC 中这两个事件仍然有效（SPEC 16.18）
   - task 明确允许此改动

2. `test/invariants.test.ts` 第 183 行：`toBeLessThanOrEqual(6)` → `toBeLessThanOrEqual(7)`
   - 见上方不变量数值变化分析
   - task 明确允许此改动

无其他断言被删除或修改。

## 结论与理由

全部 8 条验收命令实跑通过。5 个文件的 diff 完全在 task.md 条目范围内：`src/run.ts`（新增 `batchCleanup` 函数 + 两处调用点）、`src/schema/index.ts`（+2 事件类型）、`test/blocked-cleanup.test.ts`（新文件，3 组共 6 个用例）、`test/schema.test.ts`（个数 +2、加两条 toContain）、`test/invariants.test.ts`（上限 +1、加一条不变量）。无受保护路径、无禁止文件被修改、无依赖变化。所有现有相关测试（scenario-n/j/m、queue-limit、r2-commits、scenario-e/i、show）均通过且未被修改。行为要求由 `test/blocked-cleanup.test.ts` 的 6 个用例覆盖，实跑全部通过。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b22",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "f777664d031e983dd2aa6e7acd7257a14f390c32",
      "6f7f657e663cfdca74c168fa130fa7cb9cc6bce6"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "70 files, 1437 tests passed" },
      { "cmd": "e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts", "exit_code": 0, "summary": "1 file, 6 tests passed" },
      { "cmd": "grep -qF ... test/blocked-cleanup.test.ts (3 groups)", "exit_code": 0, "summary": "all three describe groups found" },
      { "cmd": "grep -qF batch.cleanup_failed + grep -qE batch.cleanup in src/schema/index.ts", "exit_code": 0, "summary": "both event types present" },
      { "cmd": "! grep -vE ... src/run.ts | grep -qF 'clean'", "exit_code": 0, "summary": "no 'clean' in non-comment lines" },
      { "cmd": "grep -qF batch.cleanup test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 8 acceptance commands pass. Implementation adds batchCleanup function in src/run.ts called at exactly two queue-mode exit points (blocked, fix_max). Two event types added to schema. New test file covers all required scenarios (rescue revert, acceptance removal, conflict handling, single-batch no-op, no-rescue no-op, evidence_unavailable no-op). Only the two explicitly allowed assertion changes were made. No protected files, no dependency changes, no prohibited files modified. CI conclusion unknown (no credentials); ci_branch_matched null."
}
```
