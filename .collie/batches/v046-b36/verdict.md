Now I have all the evidence I need. Let me compile the verdict.

# 批次 v046-b36 审核

## 取证过程

### 1. 验收命令实跑

**命令 1: `npm run lint`**
```
> collie@0.1.0 lint
> eslint . && prettier --check .

Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✅

**命令 2: `npm run typecheck`**
```
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```
退出码：0 ✅

**命令 3: `npm test`**
```
 Test Files  79 passed (79)
      Tests  1541 passed (1541)
   Duration  33.02s
```
退出码：0 ✅

**命令 4: `npm test -- test/acceptance/v046-b36`**
```
 Test Files  2 passed (2)
      Tests  9 passed (9)
   Duration  1.82s
```
退出码：0 ✅

### 2. 提交事实

worker 产出（排除 `.collie/batches/`）的提交：
- `d466d1cc5bd85138ae52e4a56621b86849aa471b` — `schema: add disputed_tests to ReportSchema; run.ts escalation path (SPEC 16.23)`
- `08aa93eb7637560e3a56d8185046e4336859212d` — `docs: issue v046-b36 task envelope`（R2 信封提交，非 worker 产出）

远端 HEAD `5b5a6f0dc0911d5ca5a2f33902d63ce9e81902a8` 是 `d466d1c` 的后代（`git merge-base --is-ancestor` 返回 true），确认已推送。

### 3. 受保护路径

```
git diff --stat 64da7d1..d466d1c -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```
结果：只有 `test/acceptance/v046-b36/` 下 3 个文件（MAP.md, keep.test.ts, new.test.ts），全来自信封提交 `08aa93e`（`docs: issue` 开头）。

`git log --format='%h %s' 64da7d1..d466d1c -- test/acceptance` 只有 `08aa93e docs: issue v046-b36 task envelope`，worker 没有碰 test/acceptance。✓

### 4. 禁止文件检查

`git diff 64da7d1..d466d1c -- src/arbiter.ts src/gate.ts src/evidence.ts src/acceptance.ts src/roles/ src/runner/ src/view.ts test/support/` → 空输出。✓

### 5. 依赖变化

`git diff 64da7d1..d466d1c -- package.json package-lock.json` → 空输出。无新增依赖。✓

### 6. 变异检查清单

`git diff 64da7d1..d466d1c -- scripts/mutation.ts` → 空输出。无变异检查项被删改。✓

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 79 files, 1541 tests passed, exit 0 | ✅ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b36` | 2 files, 9 tests passed, exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `ReportSchema` 加可选 `disputed_tests` 数组 | 条目 1 | `src/schema/index.ts:408` — `disputed_tests: z.array(DisputedTestItemSchema).optional()` | ✅ |
| 每项是只有 `test`、`why` 两个非空字符串的严格对象 | 条目 1 | `src/schema/index.ts:393-396` — `z.strictObject({ test: NonEmptyString, why: NonEmptyString })` | ✅ |
| `disputed_tests` 非空时上报（不拉 reviewer、不取证） | 条目 2 | `src/run.ts:1985` — `if (disputed.length > 0) {` 后直接走上报，无 reviewer 调用；`return finish('BLOCK', ...)` 在 2062 行提前返回 | ✅ |
| `escalated` 的 `reason` 与 `disputed` | 条目 2 | `src/run.ts:1987` — `rec.record('escalated', { reason: bareReason, disputed })` | ✅ |
| `reason` 以 `acceptance_disputed:` 开头 | 条目 2 | `src/run.ts:1986` — `` `acceptance_disputed: ${disputed.map((d) => d.test).join('；')}` `` | ✅ |
| progress 文字「上报：worker 认为验收测试有错 — …」 | 条目 2 | `src/run.ts:1988` — `` `上报：worker 认为验收测试有错 — ${bareReason}` `` | ✅ |
| `--continue` 下记 `blocked` | 条目 2 | `src/run.ts:2024-2042` — `if (ctx.updateBacklogStatus === true)` → `setBatchStatus(backlogText, batchId, 'blocked')` | ✅ |
| 裁定提交经 `r2Commit` | 条目 2 | `src/run.ts:2044` — `await r2Commit(root, ...)` | ✅ |
| 按 12.1 推送 | 条目 2 | `src/run.ts:2048` — `await push(root, ctx.remote, config.ci.expected_branch)` | ✅ |
| BLOCK、退出码 20 | 条目 2 | `src/run.ts:2062` — `return finish('BLOCK', ...)` + `src/run.ts:79` — `BLOCK: 20` | ✅ |
| 复用 `escalationDecision` | 条目 2 | `src/run.ts:1989` — `const decision = escalationDecision(escalationDesc)` （函数定义在 426 行） | ✅ |
| 复用 `emptyEvidence` | 条目 2 | `src/run.ts:1991` — `let evidence = emptyEvidence()` （函数定义在 439 行） | ✅ |
| invariant push 上限 8→9（因新加推送） | 条目 2 | `test/invariants.test.ts:183` — `expect(pushLines.length).toBeLessThanOrEqual(9)` | ✅ |
| 新 push 行上方 5 行有 `verdict` | invariant | `src/run.ts:2046` 注释含 "verdict"，在 push (2048) 上方 2 行 | ✅ |
| 空数组或无此字段时行为不变 | 条目 3 | `src/run.ts:1984` — `const disputed = report.disputed_tests ?? []` + `1985` — `if (disputed.length > 0)` → 空或 undefined 时跳过整段新代码 | ✅ |
| 其他上报路径的 `escalated` 字段不变 | 条目 3 | grep 确认：line 1352、1551、2280 的 `escalated` 事件均无 `disputed`，只有 1987 行（新路径）有 | ✅ |
| 事件类型个数不变（复用 `escalated`） | 条目 3 | grep `EVENT_TYPES` 中 `escalated` 在 268 行已存在，diff 无新增类型 | ✅ |
| `test/support/` 不改 | 条目 3 | `git diff -- test/support/` 空输出 | ✅ |
| 不改 `src/arbiter.ts` 等禁止文件 | 额外禁止 | `git diff -- src/arbiter.ts src/gate.ts ...` 空输出 | ✅ |
| 不在此路上拉 reviewer 或自动重跑 | 额外禁止 | `src/run.ts:2062` — `return finish('BLOCK', ...)` 在 reviewer 调用之前返回 | ✅ |
| 不删/跳过测试 | 额外禁止 | diff 无测试删除；invariant 仅上限+1 | ✅ |
| 不改注释/字面以通过验收 | 额外禁止 | 验收命令均为 lint/typecheck/test，无 grep 类命令 | ✅ |
| 不新增依赖 | 额外禁止 | `package.json` diff 空 | ✅ |

### 行为要求实测

条目 2 的核心行为（disputed_tests 触发 BLOCK + exit 20、不拉 reviewer、`--continue` 记 blocked）通过验收测试 S2/K3/K4 验证。上面实跑 `npm test -- test/acceptance/v046-b36` 结果：9 tests passed。涵盖所有 7 个情形。

### 不变量数值变化

`test/invariants.test.ts` 第 183 行：`pushLines.length` 上限从 8 → 9。原因：新增了 1 处 `await push(` 调用（`src/run.ts:2048`，disputed acceptance 路径）。条目 2 点名允许此改写（"你新加了一处推送时上限 8 改成 9"）。

### 被改写或删去的断言

无。diff 中 `test/invariants.test.ts` 仅改了上限数值（8→9）和注释，无 `expect(...)` 被删除或逻辑改写。

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 [新] | `new.test.ts`: S1: parsing succeeds and preserves data | 是：断言 `safeParse` 成功、`test` 和 `why` 值原样保留 | 是：无此字段 strict object 会拒绝 |
| S2 [新] | `new.test.ts`: S2: escalated reason + disputed + progress | 是：断言 reason 以 `acceptance_disputed: ` 开头、含 `S1: x`、`disputed` 等于输入数组、progress 含「worker 认为验收测试有错」 | 是：无上报路径则无 `escalated` 事件 |
| S3 [新] | `new.test.ts`: S3: worker then reviewer, exit 0 | 是：断言 2 次调用（worker+reviewer）、exit 0 | 是：无 schema 字段则 `disputed_tests: []` 被 strictObject 拒绝，parse 失败触发旧 escalation |
| K1 [保持] | `keep.test.ts`: K1: worker+reviewer, exit 0, no escalated | 是：断言正常流、无 escalated 事件 | 否（保持测试，不依赖新行为） |
| K2 [保持] | `keep.test.ts`: K2 × 3 (empty test/why/extra key) | 是：断言 `safeParse` 失败 | 是：若 strictObject 或 NonEmptyString 被改松则通过 |
| K3 [保持] | `keep.test.ts`: K3: exit 20, 1 call, no reviewer/evidence | 是：断言 exit 20、runner 1 次（worker）、无 reviewer.started/evidence.collected | 是：无上报路径则进 reviewer |
| K4 [保持] | `keep.test.ts`: K4: exit 20, blocked, batch_started 1, finished blocked | 是：断言 exit 20、backlog 含 blocked、batch_started 1 条、finished reason blocked | 是：同 K3 |

测试缺口：无。所有 7 个情形均有对应用例，断言内容与情形描述一致，行为移除后会失败。

## 结论与理由

全部 4 条验收命令实跑通过。schema 改动（`DisputedTestItemSchema` + `ReportSchema` 可选字段）正确实现了 strict、NonEmptyString 约束。`src/run.ts` 的上报路径在读到有效汇报后、reviewer 之前检查 `disputed_tests`，非空时走 BLOCK 路径（exit 20），复用了现有 `escalationDecision` 和 `emptyEvidence` 函数，使用 `r2Commit` 提交并按 12.1 推送，`--continue` 下记 `blocked`。空数组和缺失字段不触发新路径（`?? []` + `length > 0`）。无受保护文件被 worker 修改、无新依赖、无禁止文件改动、无断言删除或改松（invariant 上限 +1 为条目点名授权）。9 个场景验收测试全部通过。

注：条目 2 建议"能合成一个带说明文字参数的函数就合"——worker 选择内联约 70 行代码而非重构 `testerEscalate` 为共享函数。由于 `disputed` 字段和不同的描述文字使纯参数化略有复杂度，且行为正确、测试全过，这不构成功能缺口。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b36",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["d466d1cc5bd85138ae52e4a56621b86849aa471b"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "79 files, 1541 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b36", "exit_code": 0, "summary": "2 files, 9 tests passed" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "全部验收命令通过；schema 正确添加可选 disputed_tests（strict、NonEmptyString）；run.ts 上报路径正确实现（不拉 reviewer、BLOCK exit 20、r2Commit + push、--continue 记 blocked）；复用 escalationDecision 和 emptyEvidence；invariant 上限 8→9 为条目授权；无受保护文件/禁止文件/依赖变动。CI 以 R2 取证为准。"
}
```
