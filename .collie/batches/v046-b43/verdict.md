Now I have everything I need. Let me compile the full verdict.

# 批次 v046-b43 审核

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
 Test Files  1 failed | 87 passed (88)
      Tests  1 failed | 1598 passed (1599)
```
退出码：1 ❌

失败的测试：
```
FAIL  test/exit-codes.test.ts > exit-codes: reviewer event stream falls to reviewer.stream.ndjson (SPEC 12.1) > reviewer.stream.ndjson masks secrets with redact (SPEC 12.1)
Error: ENOENT: no such file or directory, open '/data/tmp/collie-sandbox-eKQXZN/project/.collie/runs/r-20261019120000/reviewer.stream.ndjson'
```

**命令 4: `npm test -- test/acceptance/v046-b43`**
```
 Test Files  2 passed (2)
      Tests  8 passed (8)
```
退出码：0 ✅

**命令 5: `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "reviewer.skipped" && grep -qF "reviewer.skipped" src/schema/index.ts`**
退出码：0 ✅

**命令 6: `grep -qF "records reviewer.skipped (v046-b43)" test/invariants.test.ts`**
退出码：0 ✅

### 2. 提交事实
- 提交范围：`920a9194..90e25a69`，共 5 个提交（含 R2 信封）
- `git branch -r --contains 90e25a69` → `origin/main`，已推送到远端 ✅

### 3. 受保护路径检查
`git diff --stat base..head -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions .collie/collie.toml .github eslint.config.js vitest.config.ts` → 无输出。
`docs/progress.md` 和 `test/acceptance/v046-b43/` 仅在 R2 信封提交中出现（`progress:` 和 `docs: issue`），worker 未触碰。
受保护文件 diff 行数：0 ✅

### 4. 禁止文件检查
`git diff --stat base..head -- src/arbiter.ts src/gate.ts src/evidence.ts src/roles/ src/runner/ src/view.ts src/follow.ts` → 无输出 ✅

### 5. 依赖变化
`git diff base..head -- package.json package-lock.json` → 无输出 ✅

### 6. 变异检查
`npm run test:mutation` → 46 项全部 `caught`，退出码 0 ✅

### 7. 必须单独通过的测试
- `test/rule9-same-head.test.ts` → 4 passed ✅
- `test/scenario-l.test.ts` → 10 passed ✅
- `test/queue-limit.test.ts` → 4 passed ✅

### 8. 测试失败根因分析

通过创建调试测试复现并dump journal事件，确认失败原因：

`test/exit-codes.test.ts` 第 413 行的测试 `reviewer.stream.ndjson masks secrets with redact` 通过 `writeFileSync` 在磁盘上修改 `.collie/collie.toml`（添加 `token_file`），但**未提交此变更**。当 workerScene 执行 `git add -A` 时，collie.toml 的修改被一并暂存并提交。由于 `.collie/collie.toml` 在 `PROTECTED_PATHS` 清单中（`src/evidence.ts:40`），证据收集看到 `spec_diff_lines: 2`，仲裁触发规则 2 → BLOCK。在新代码流（SPEC 16.29）下，pre-arbitration 判定非 PASS，reviewer 被跳过，`reviewer.stream.ndjson` 不会被创建，测试读取该文件时报 ENOENT。

调试测试的 journal 事件证实：
```
EVENT: evidence.collected ... spec_diff_lines:2 ...
EVENT: reviewer.skipped rule:2 reason:"protected files changed by 2 lines"
EVENT: verdict.downgraded from:PASS to:BLOCK rule:2 assumed:true
```

在旧代码中，reviewer 总是被调用（不管证据如何），所以该测试能通过。新代码将证据收集移到 reviewer 之前并做 pre-arbitration，暴露了测试 setup 中的隐含问题。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 1, 1 failed / 1598 passed | ❌ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b43` | exit 0, 8 passed | ✅ |
| R2 认得新事件 | `grep ... src/run.ts && grep ... src/schema/index.ts` | exit 0 | ✅ |
| 不变量同步 | `grep ... test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 先取证再审核 | 条目 1 | `src/run.ts:2109-2143` — evidence collection moved before reviewer | ✅ |
| 假定 reviewer PASS，pre-arbitrate | 条目 1 | `src/run.ts:2199-2228` — synthetic PASS verdict + arbitrate() | ✅ |
| 非 PASS 不拉 reviewer | 条目 1 | `src/run.ts:2230-2242` — `if (preDecision.final !== 'PASS')` skip reviewer | ✅ |
| 记 `reviewer.skipped`(rule, reason) | 条目 1 | `src/run.ts:2232` — `rec.record('reviewer.skipped', { rule, reason })` | ✅ |
| PASS 时拉 reviewer，同现在 | 条目 1 | `src/run.ts:2244-2324` — normal reviewer flow after pre-arbitration PASS | ✅ |
| `verdict.downgraded` 带 `assumed: true` | 条目 1 | `src/run.ts:2478-2479`, `2487-2488`, `2497-2498` — `...(reviewerSkipped ? { assumed: true } : {})` | ✅ |
| 不写 verdict.md | 条目 1 | `src/run.ts:2513-2514` — `if (!reviewerSkipped && existsSync(...))` | ✅ |
| 不做 audit | 条目 1 | `src/run.ts:2343` — `auditResult = undefined` when skipped | ✅ |
| EVENT_TYPES 加 `reviewer.skipped` | 条目 1 | `src/schema/index.ts:339` — `'reviewer.skipped'` in EVENT_TYPES array | ✅ |
| `src/arbiter.ts` 不许改 | 条目 1 | `git diff base..head -- src/arbiter.ts` → empty | ✅ |
| 旧测试 (a): 移除不再调用的 reviewer scene | 条目 2 | `test/queue-journal.test.ts`, `test/rule9-same-head.test.ts`, `test/scenario-l.test.ts`, `test/scenario-m.test.ts` diff 均移除多余 reviewer scene | ✅ |
| 旧测试 (b): 断言 reviewer.skipped | 条目 2 | `test/scenario-a.test.ts:978-989`, `test/scenario-d.test.ts:71-72` — 改成断言 reviewer.skipped | ✅ |
| 旧测试 (c): 事件顺序调整 | 条目 2 | `test/exit-codes.test.ts:140-148` — ci.resolved/evidence.collected before reviewer.started | ✅ |
| 旧测试 (c): 事件类型个数 44→45 | 条目 2 | `test/schema.test.ts:254` — `expect(EVENT_TYPES).toHaveLength(45)` | ✅ |
| rule9/scenario-l/queue-limit 照常通过 | 条目 2 | 实跑 vitest run → 全部通过 (4+10+4 passed) | ✅ |
| invariants 加新用例 | 条目 3 | `test/invariants.test.ts:775` — `it('src/run.ts records reviewer.skipped (v046-b43)')` | ✅ |
| mutation 无 stale | 条目 3 | `npm run test:mutation` → 46 caught, exit 0 | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` → 0 protected | ✅ |
| 不改禁止文件 | 额外禁止 | arbiter/gate/evidence/roles/runner/view/follow → 0 diff | ✅ |
| 不删/跳过测试 | 额外禁止 | diff 检查：无 `it.skip` 或测试删除 | ✅ |
| 不新增依赖 | 额外禁止 | package.json/lock → 0 diff | ✅ |
| 旧测试别的断言不动 | 条目 2 | 除类型 (a)(b)(c) 外，exit-codes.test.ts 删了 1 行注释（非断言，但不在允许类型内）| ⚠️ |

**不变量数值变化**：`test/schema.test.ts:254` — EVENT_TYPES 长度从 44 改为 45（新增 `reviewer.skipped` 事件类型直接要求）。无其他数值变化。

**被改写或删去的断言**：
1. `test/scenario-a.test.ts:77-78`：原断言 `expect(box.reviewerSawReport).toBe(false)` 和 `expect(box.reviewerCwd).not.toBe(box.root)`，改为断言 reviewer.skipped rule=7 和 no reviewer.started — SPEC 16.29 要求的直接变更，scenario A 中 CI 分支不匹配(rule 7)导致 reviewer 被跳过
2. `test/scenario-a.test.ts:91`：原断言 `expect(shown).toContain('"verdict": "PASS"')`，改为 `expect(shown).toMatch(/reviewer\.skipped rule=7/)` — 同上，reviewer 被跳过时无 verdict.md
3. `test/scenario-d.test.ts:71`：原断言 `expect(shown).toContain('"verdict": "PASS"')`，改为 `expect(shown).toMatch(/reviewer\.skipped rule=8/)` — 同上，acceptance failure(rule 8)导致 reviewer 被跳过
4. `test/schema.test.ts:254`：`44` → `45` — 新增事件类型直接要求

以上所有原断言守的要求在 SPEC 中仍然有效，但行为因 SPEC 16.29 的变更而改变（reviewer 不再被拉起），断言改写是新行为直接要求的。

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 | `S1: runner called once as worker, reviewer.skipped rule 8, no reviewer.started` | 是：检查 runner.calls=1 role=worker, reviewer.skipped rule=8, no reviewer.started | 是：不跳过 reviewer 则 runner.calls=2，reviewer.skipped 不存在 |
| S2 | `S2: verdict.downgraded has assumed true` | 是：检查 verdict.downgraded 有 assumed=true | 是：不带 assumed:true 则断言失败 |
| S3 | `S3: runner called once, reviewer.skipped rule 2` | 是：检查 runner.calls=1, reviewer.skipped rule=2 | 是：不跳过 reviewer 则 runner.calls=2，reviewer.skipped 不存在 |
| S4 | `S4: evidence.collected index is less than reviewer.started index` | 是：检查 evidence 在 reviewer 之前 | 是：旧顺序下 evidence 在 reviewer 之后 |
| K1 | `K1: exit 10, verdict.downgraded PASS to FIX rule 8, acceptance.failed sh fail.sh, run.finished FIX` | 是：检查 exit=10, downgraded PASS→FIX rule 8, acceptance.failed cmd='sh fail.sh', finished verdict=FIX | 保持行为：这些都是既有逻辑 |
| K2 | `K2: exit 20, evidence.collected spec_diff_lines > 0, run.finished BLOCK rule 2` | 是：检查 exit=20, spec_diff_lines>0, finished BLOCK rule=2 | 保持行为 |
| K3 | `K3: exit 0, runner calls worker then reviewer, no reviewer.skipped, no verdict.downgraded` | 是：检查 exit=0, calls=[worker,reviewer], no skipped, no downgraded | 保持行为 |
| K4 | `K4: exit 10, run.finished rule 10` | 是：检查 exit=10, finished rule=10 | 保持行为 |

无测试缺口发现。

## 结论与理由

**FIX**。

实现逻辑正确，SPEC 16.29 的核心要求（先取证后审核、取证没过不拉 reviewer、reviewer.skipped 事件、assumed:true、不写 verdict.md）全部到位。本批次 8 条验收测试全部通过。

但 `npm test` 有 1 条旧测试失败：`test/exit-codes.test.ts` 的 `reviewer.stream.ndjson masks secrets with redact (SPEC 12.1)`。原因是该测试用 `writeFileSync` 修改了 `.collie/collie.toml`（加 `token_file`）但未提交；worker scene 的 `git add -A` 把这个改动一并提交；证据收集发现 `.collie/collie.toml`（受保护路径）被改了 2 行 → rule 2 → BLOCK → pre-arbitration 判非 PASS → reviewer 被跳过 → 没有 `reviewer.stream.ndjson` → ENOENT。

旧代码中 reviewer 总是被调用（不论证据），所以该测试能通过。新代码暴露了测试 setup 的隐含问题。worker 只在此测试中删了一行注释，未修复根因。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b43",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [
      "90e25a69c809ef5dce3453d5953436b4b9ef7d75",
      "16256ad82a6e15e875f874331ae724d8f7b0c8c6",
      "75f390c5b84a8cd2be0613394aca87b42b52af56",
      "9381223ae46097841ee7007db71edbb05773817e",
      "ed433b86eb23eb4ff9ea8e187acfda4f3f10ba61"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "lint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 1, "summary": "1 failed | 1598 passed (1599)" },
      { "cmd": "npm test -- test/acceptance/v046-b43", "exit_code": 0, "summary": "8 passed (8)" },
      { "cmd": "grep ... reviewer.skipped", "exit_code": 0, "summary": "found in both files" },
      { "cmd": "grep ... invariants", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [
    "test/exit-codes.test.ts 第 413 行 `reviewer.stream.ndjson masks secrets with redact` 失败：测试 setup 用 writeFileSync 改了 .collie/collie.toml（受保护路径）但未提交；workerScene 的 git add -A 把它带进了提交；新代码 pre-arbitration 检测到 spec_diff_lines > 0 → rule 2 → BLOCK → reviewer 被跳过 → 没有 reviewer.stream.ndjson。修法：在 workerScene 之前将 collie.toml 和 token 文件的变更提交到 base（如 addFailScript 所做），或将测试拆成 reviewer 确实被调用的场景。这属于条目 2 的 (b) 类改动：测试里有一个因新行为而不再被调用的 reviewer 场景，setup 需要调整使 pre-arbitration 仍给 PASS",
    "test/exit-codes.test.ts 第 474 行删了注释 `// The secret should be masked by the redact mechanism.`，不属于条目 2 的三类允许改动 (a)(b)(c)。影响不大但需在偏离中说明"
  ],
  "reason": "npm test 有 1 条旧测试失败（reviewer.stream.ndjson masks secrets with redact），根因是测试 setup 在磁盘上改了 .collie/collie.toml 而未提交，新代码的 pre-arbitration 把它检测为受保护路径变更（rule 2），跳过了 reviewer。CI 以 R2 取证为准。"
}
```
