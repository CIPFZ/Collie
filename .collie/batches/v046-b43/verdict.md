Now I have all the evidence needed. Let me compile the verdict.

# 批次 v046-b43 审核

## 取证过程

### 1. 验收命令逐条实跑

**命令 1: `npm run lint`**
```
> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码: 0 ✓

**命令 2: `npm run typecheck`**
```
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```
退出码: 0 ✓

**命令 3: `npm test`**
```
 Test Files  88 passed (88)
      Tests  1599 passed (1599)
   Duration  29.24s
```
退出码: 0 ✓

**命令 4: `npm test -- test/acceptance/v046-b43`**
```
 Test Files  2 passed (2)
      Tests  8 passed (8)
   Duration  2.77s
```
退出码: 0 ✓

**命令 5: `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "reviewer.skipped" && grep -qF "reviewer.skipped" src/schema/index.ts`**
退出码: 0 ✓
实证: `src/run.ts:2232` 有 `rec.record('reviewer.skipped', {`；`src/schema/index.ts:339` 有 `'reviewer.skipped'`。

**命令 6: `grep -qF "records reviewer.skipped (v046-b43)" test/invariants.test.ts`**
退出码: 0 ✓

### 2. 提交事实

三个 worker 代码提交:
- `9381223ae46097841ee7007db71edbb05773817e` wip(collie): v046-b43 rescue（主要的 src/run.ts 重构）
- `90e25a69c809ef5dce3453d5953436b4b9ef7d75` test: add reviewer.skipped invariant for v046-b43
- `ffada9a247ee3e047b69d9ea7f6d15b48f302713` test: fix reviewer redact test to commit config before worker

`git ls-remote` 确认 head_sha `ffada9a247ee3e047b69d9ea7f6d15b48f302713` 是远端 `main` (`71056321`) 的祖先，已推送。

### 3. 受保护路径检查

```
git diff --stat 920a919..ffada9a -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```
结果: 只有 `docs/progress.md`（+32 行，R2 信封）和 `test/acceptance/v046-b43/`（3 个新文件，来自 `docs: issue` 信封提交 `ed433b8`）。

`git log --format='%h %s' 920a919..ffada9a -- test/acceptance` 确认只有 `ed433b8 docs: issue v046-b43 task envelope`，worker 没有动验收测试。

Worker 的 spec_diff_lines = 0。

### 4. 禁止文件检查

`git diff --stat 920a919..ffada9a -- src/arbiter.ts src/gate.ts src/evidence.ts src/roles/ src/runner/ src/view.ts src/follow.ts` → 无输出，没有改动。✓

### 5. 依赖变化

`git diff 920a919..ffada9a -- package.json package-lock.json` → 无输出。✓

### 6. 变异检查

`npm run test:mutation` → `mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0`，退出码 0。scripts/mutation.ts 无需改动。✓

### 7. 条目 2 守卫测试

```
npx vitest run test/rule9-same-head.test.ts → 4 passed ✓
npx vitest run test/scenario-l.test.ts → 10 passed ✓
npx vitest run test/queue-limit.test.ts → 4 passed ✓
```

### 8. 行为要求实跑

```
npx vitest run test/exit-codes.test.ts → Tests 29 passed ✓
npx vitest run test/scenario-a.test.ts → Tests 6 passed ✓
npx vitest run test/scenario-d.test.ts test/scenario-m.test.ts test/queue-journal.test.ts test/schema.test.ts → Tests 103 passed ✓
npx vitest run test/invariants.test.ts → Tests 97 passed ✓
npx vitest run test/acceptance/v046-b43 → Tests 8 passed ✓
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✓ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✓ |
| 全部测试通过 | `npm test` | exit 0, 88 files, 1599 tests passed | ✓ |
| 本批次验收测试 | `npm test -- test/acceptance/v046-b43` | exit 0, 2 files, 8 tests passed | ✓ |
| R2 认得新事件 | `grep -vE... reviewer.skipped` | exit 0 | ✓ |
| 不变量同步 | `grep -qF "records reviewer.skipped (v046-b43)" test/invariants.test.ts` | exit 0 | ✓ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 先取证再拉起 reviewer | 条目 1 / SPEC 16.29 | `src/run.ts:2109-2197`: evidence 收集在 `withHeadWorktree` 内部首先执行；`src/run.ts:2244-2253`: reviewer.started 在 pre-arbitration PASS 之后 | ✓ |
| 假定 reviewer 判 PASS 调 `arbitrate` | 条目 1 / SPEC 16.29 | `src/run.ts:2210-2228`: 构建 `syntheticVerdict` verdict='PASS'、`arbitrate(...)` 调用 | ✓ |
| 结果不是 PASS 不拉 reviewer | 条目 1 / SPEC 16.29 | `src/run.ts:2231-2242`: `if (preDecision.final !== 'PASS') { rec.record('reviewer.skipped'...) return { skipped: true... } }` | ✓ |
| 记 `reviewer.skipped` 带 `rule` 和 `reason` | 条目 1 / SPEC 16.29 | `src/run.ts:2232-2235`: `rec.record('reviewer.skipped', { rule: preDecision.rule, reason: preDecision.reason })` | ✓ |
| `verdict.downgraded` 多带 `assumed: true` | 条目 1 / SPEC 16.29 | `src/run.ts:2478-2479`, `src/run.ts:2487-2488`, `src/run.ts:2497-2498`: 三处均有 `...(reviewerSkipped ? { assumed: true } : {})` | ✓ |
| 不写 verdict.md | 条目 1 / SPEC 16.29 | `src/run.ts:2513-2514`: `if (!reviewerSkipped && existsSync(verdictPath(...)))` | ✓ |
| 不做 audit | 条目 1 / SPEC 16.29 | `src/run.ts:2343`: `auditResult = undefined;` when skipped | ✓ |
| 结果是 PASS 拉 reviewer 照常 | 条目 1 / SPEC 16.29 | `src/run.ts:2244-2324`: PASS 分支完整保留了 reviewer 的调用、finished、verdict 记录 | ✓ |
| `src/schema/index.ts` 加 `reviewer.skipped` | 条目 1 | `src/schema/index.ts:339`: `'reviewer.skipped'` 在 EVENT_TYPES 数组中 | ✓ |
| `src/arbiter.ts` 不许改 | 条目 1 | `git diff` 确认无变化 | ✓ |
| 条目 2(c) event 顺序 | 条目 2 | `test/exit-codes.test.ts:144-145`: `ci.resolved`、`evidence.collected` 移到 `reviewer.started` 之前 | ✓ |
| 条目 2(c) schema count 44→45 | 条目 2 | `test/schema.test.ts:257`: `expect(EVENT_TYPES).toHaveLength(45)` | ✓ |
| 条目 2(a) 去掉不再调的 reviewer 场景 | 条目 2 | `test/queue-journal.test.ts`: 删除 `unpushedReviewerPassScene` 函数及 3 处引用；`test/rule9-same-head.test.ts`: 删除 7 处 `reviewerPass` 引用；`test/scenario-l.test.ts`: 删除 3 处 `reviewerClean` 引用；`test/scenario-m.test.ts`: 删除 3 处 `reviewerPass` 引用 | ✓ |
| 条目 2(b) reviewer 断言改成 skipped | 条目 2 | `test/scenario-a.test.ts:74-82`: 原 `reviewerSawReport`/`reviewerCwd` → 断言 `reviewer.started` 长度 0、`reviewer.skipped` 存在 rule=7；`test/scenario-a.test.ts:94`: 原 `verdict: "PASS"` → `reviewer.skipped rule=7`；`test/scenario-d.test.ts:71`: 原 `verdict: "PASS"` → `reviewer.skipped rule=8` | ✓ |
| 条目 2 guard 测试 rule9/scenario-l/queue-limit | 条目 2 | `npx vitest run test/rule9-same-head.test.ts` → 4 passed；`npx vitest run test/scenario-l.test.ts` → 10 passed；`npx vitest run test/queue-limit.test.ts` → 4 passed | ✓ |
| 条目 3 invariant 加新用例 | 条目 3 | `test/invariants.test.ts:775`: `it('src/run.ts records reviewer.skipped (v046-b43)')` | ✓ |
| 条目 3 mutation 无 stale | 条目 3 | `npm run test:mutation` → `stale 0` | ✓ |
| 额外禁止: 不改受保护路径 | 额外禁止 | `git diff --stat` 确认 worker 未触碰任何受保护路径 | ✓ |
| 额外禁止: 不改 arbiter/gate/evidence/roles/runner/view/follow | 额外禁止 | `git diff --stat` 确认无变化 | ✓ |
| 额外禁止: 不删或跳过测试 | 额外禁止 | diff 中未 `.skip` 或删除任何 `it(` 块；`unpushedReviewerPassScene` 函数被删但不是测试用例 | ✓ |
| 额外禁止: 不改注释凑验收 | 额外禁止 | 验收命令均通过自身逻辑，无注释/字面改动 | ✓ |
| 额外禁止: 不新增依赖 | 额外禁止 | package.json 无变化 | ✓ |

### 不变量数值变化

- `test/schema.test.ts`: `EVENT_TYPES` 长度从 44 改为 45（新增 `reviewer.skipped` 事件类型直接要求的最小改动，属条目 2(c)）

无其他不变量数值变化。

### 被改写或删去的断言

| 文件 | 用例名 | 原断言 | 现断言 | 原要求在 SPEC 中是否仍有效 |
|---|---|---|---|---|
| test/scenario-a.test.ts | (原) `ran the reviewer in a head_sha worktree that holds no report.md (SPEC 3.5)` → (现) `reviewer skipped because rule 7 detected in pre-arbitration (SPEC 16.29)` | `expect(box.reviewerSawReport).toBe(false)` + `expect(box.reviewerCwd).not.toBe(box.root)` | `expect(events.filter(…'reviewer.started')).toHaveLength(0)` + `expect(skipped).toBeDefined()` + `expect(rule).toBe(7)` | 原要求（reviewer 在 worktree 里不看 report.md）仍有效但仅在 reviewer 被调用时成立；场景 A 里 CI 分支不匹配导致 rule 7，新行为下 reviewer 不被拉起，改断言属条目 2(b) |
| test/scenario-a.test.ts | `collie show reconstructs the decision and its evidence chain` | `expect(shown).toContain('"verdict": "PASS"')` | `expect(shown).toMatch(/reviewer\.skipped rule=7/)` | 原要求检查 verdict.md 里的 PASS，新行为下没有 verdict.md，改成检查 journal 中 reviewer.skipped，属条目 2(b) |
| test/scenario-d.test.ts | `collie show reconstructs the decision and its evidence chain` | `expect(shown).toContain('"verdict": "PASS"')` | `expect(shown).toMatch(/reviewer\.skipped rule=8/)` | 同上，场景 D 验收失败 rule 8，reviewer 不再被拉起 |
| test/schema.test.ts | `defines the v0.1 event types plus v0.2 and v0.3 types added so far` | `expect(EVENT_TYPES).toHaveLength(44)` | `expect(EVENT_TYPES).toHaveLength(45)` | 新增事件类型直接要求的改动，属条目 2(c) |

无删除的断言（`unpushedReviewerPassScene` 是辅助函数不是断言）。

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 | `S1: runner called once as worker, reviewer.skipped rule 8, no reviewer.started` | 是：断言 runner.calls 长度 1 且 role 是 worker；reviewer.skipped 存在且 rule=8；reviewer.started 长度 0 | 是：不跳过 reviewer 则 calls 为 2，reviewer.skipped 不存在 |
| S2 | `S2: verdict.downgraded has assumed true` | 是：断言 verdict.downgraded 存在且 assumed===true | 是：不加 assumed 则 undefined !== true |
| S3 | `S3: runner called once, reviewer.skipped rule 2` | 是：断言 runner.calls 长度 1；reviewer.skipped 存在且 rule=2 | 是：不跳过 reviewer 则 calls 为 2，reviewer.skipped 不存在 |
| S4 | `S4: evidence.collected index is less than reviewer.started index` | 是：断言 evidenceIdx < reviewerIdx | 是：恢复旧顺序则 evidenceIdx > reviewerIdx |
| K1 | `K1: exit 10, verdict.downgraded PASS to FIX rule 8, acceptance.failed sh fail.sh, run.finished FIX` | 是：断言 exitCode=10，downgraded from=PASS to=FIX rule=8，acceptance.failed cmd='sh fail.sh'，run.finished verdict=FIX | 是：这些是保持行为，改核心逻辑会失败 |
| K2 | `K2: exit 20, evidence.collected spec_diff_lines > 0, run.finished BLOCK rule 2` | 是：断言 exitCode=20，spec_diff_lines > 0，run.finished verdict=BLOCK rule=2 | 是：同上 |
| K3 | `K3: exit 0, runner calls worker then reviewer, no reviewer.skipped, no verdict.downgraded` | 是：断言 exitCode=0，calls 为 [worker, reviewer]，无 reviewer.skipped，无 verdict.downgraded | 是：如果 PASS 路径也跳过 reviewer 则 calls 为 1 |
| K4 | `K4: exit 10, run.finished rule 10` | 是：断言 exitCode=10，run.finished rule=10 | 是：改规则判定会失败 |

测试缺口：无。所有 8 个情形的核心断言都覆盖了情形描述的结果，且拿掉对应行为后测试会失败。

## 结论与理由

**PASS。** 所有 6 条验收命令实跑通过。实现完全符合 SPEC 16.29 的要求：先取证再审核，取证没过（规则 2/3/5-9）不拉起 reviewer 并记 `reviewer.skipped`，PASS 路径照常拉起 reviewer。`src/arbiter.ts` 未被改动。测试修改全部落在允许的三类 (a)(b)(c) 之内，条目 2 的三个守卫测试 (rule9-same-head, scenario-l, queue-limit) 均通过。新增的不变量用例和事件类型计数增加都是条目 3 要求的最小改动。变异检查 47 项全部捕获、0 项 stale。无受保护文件被 worker 修改，无新增依赖，无禁止文件被改动。8 个验收测试用例覆盖全部情形且断言实质正确。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b43",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "9381223ae46097841ee7007db71edbb05773817e",
      "90e25a69c809ef5dce3453d5953436b4b9ef7d75",
      "ffada9a247ee3e047b69d9ea7f6d15b48f302713"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "88 files, 1599 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b43", "exit_code": 0, "summary": "2 files, 8 tests passed" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qF \"reviewer.skipped\" && grep -qF \"reviewer.skipped\" src/schema/index.ts", "exit_code": 0, "summary": "reviewer.skipped found in non-comment code and schema" },
      { "cmd": "grep -qF \"records reviewer.skipped (v046-b43)\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant test found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 6 acceptance commands pass. Implementation matches SPEC 16.29: evidence collection moved before reviewer, pre-arbitration with synthetic PASS verdict, reviewer.skipped event recorded when non-PASS, assumed:true on verdict.downgraded. src/arbiter.ts unchanged. All test changes within allowed categories (a)(b)(c). Guard tests (rule9-same-head, scenario-l, queue-limit) pass. Mutation check: 47 caught, 0 stale. No protected files modified, no new dependencies. CI 以 R2 取证为准。"
}
```
