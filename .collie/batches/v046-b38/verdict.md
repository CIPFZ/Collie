Good. 7 push calls, line 1442 is the shared one inside `escalateAndCommit`. Everything is accounted for. I have all the evidence I need.

# 批次 v046-b38 审核

## 取证过程

### 1. 提交检查
```
git log --oneline 40bab59..57866f6 -- . ':(exclude).collie/batches'
→ 57866f6 cli: merge three escalation paths into escalateAndCommit (SPEC 16.25)
```
单一提交，仅涉及 `src/run.ts` 和 `test/invariants.test.ts`。

提交 SHA 确认：
```
git rev-parse 57866f65e95ec64576afbafad6e47b987f827483
→ 57866f65e95ec64576afbafad6e47b987f827483
```

远端推送确认：
```
git branch -r --contains 57866f65e95ec64576afbafad6e47b987f827483
→ origin/main
git merge-base --is-ancestor 57866f6 30c43f6 → true
git log --oneline 57866f6..30c43f6 → 30c43f6 report(collie): v046-b38
```
head_sha 已在 origin/main，之后仅有 report 信封提交。

### 2. 受保护文件检查
```
git diff --stat 40bab59..57866f6 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
→ (无输出)
```
无受保护文件被修改。

### 3. 依赖变化检查
```
git diff --stat 40bab59..57866f6 -- package.json package-lock.json
→ (无输出)
```
无依赖变化。

### 4. 变异检查清单
```
git diff 40bab59..57866f6 -- scripts/mutation.ts
→ (无输出)
```
无变异检查项被改动。

### 5. 其他文件检查
```
git diff --stat 40bab59..57866f6 -- 'src/' ':(exclude)src/run.ts'
→ (无输出)
git diff --stat 40bab59..57866f6 -- 'test/' ':(exclude)test/invariants.test.ts'
→ (无输出)
git log --format='%h %s' 40bab59..57866f6 -- test/acceptance
→ (无输出)
```
仅修改了 `src/run.ts` 和 `test/invariants.test.ts`，无范围蔓延。

### 6. 验收命令实跑

**命令 1：`npm run lint`**
```
→ exit 0, Checking formatting... All matched files use Prettier code style!
```

**命令 2：`npm run typecheck`**
```
→ exit 0
```

**命令 3：`npm test`**
```
→ exit 0, Test Files 80 passed (80), Tests 1556 passed (1556)
```

**命令 4：`npm test -- test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36`**
```
→ exit 0, Test Files 6 passed (6), Tests 77 passed (77)
```

**命令 5：`grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cF "await push(" | grep -qx 7`**
```
→ exit 0
```

**命令 6：`grep -qF "toBeLessThanOrEqual(7)" test/invariants.test.ts`**
```
→ exit 0
```

### 7. 不变量 invariants 测试单独实跑
```
npx vitest run test/invariants.test.ts
→ Test Files 1 passed (1), Tests 95 passed (95)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 80 files, 1556 tests passed | ✅ |
| 三条上报路径的测试通过 | `npm test -- test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36` | exit 0, 6 files, 77 tests passed | ✅ |
| 推送恰好 7 处 | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cF "await push(" \| grep -qx 7` | exit 0 | ✅ |
| 不变量上限同步成 7 | `grep -qF "toBeLessThanOrEqual(7)" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 三条上报路径共用一个函数 | 条目 1 | `src/run.ts:1368` — `const escalateAndCommit = async (opts: {` 定义共享函数; `src/run.ts:1460` — `escalate` 委托调用; `src/run.ts:1583` — `testerEscalate` 委托调用; `src/run.ts:1948` — disputed 路径直接调用 | ✅ |
| 参数化 reason 与附加字段 | 条目 1 | `src/run.ts:1370` — `reason: string`; `src/run.ts:1372` — `escalatedExtra?: Record<string, Event[string]>`; disputed 路径 `src/run.ts:1950` — `escalatedExtra: { disputed }` | ✅ |
| 参数化 progress 前缀 | 条目 1 | `src/run.ts:1374` — `progressPrefix: string`; `src/run.ts:1462` — `'上报：无 report — '`; `src/run.ts:1585` — `'上报：验收测试没有准备好 — '`; `src/run.ts:1951` — `'上报：worker 认为验收测试有错 — '` | ✅ |
| 参数化附加提交文件 | 条目 1 | `src/run.ts:1376` — `extraCommitFiles?: readonly string[]`; `src/run.ts:1420` — `...(opts.extraCommitFiles ?? [])` | ✅ |
| 参数化 evidence 基准 SHA | 条目 1 | `src/run.ts:1378` — `evidenceBaseSha?: string`; `src/run.ts:1387` — `if (opts.evidenceBaseSha !== undefined)` | ✅ |
| 各路径事件与现在相同 | 条目 1 | `src/run.ts:1380` — `rec.record('escalated', { reason: opts.reason, ...opts.escalatedExtra })`: 无附加字段时仅有 `{reason}` (原 escalate/testerEscalate 行为); 有 `disputed` 时 `{reason, disputed}` (原 disputed 行为) | ✅ |
| 各路径 progress 文字相同 | 条目 1 | `src/run.ts:1381` — `` `${opts.progressPrefix}${opts.reason}` `` 拼接与原始三处 `` `上报：X — ${reason}` `` 完全一致 | ✅ |
| 各路径提交文件相同 | 条目 1 | `src/run.ts:1420` — `commitFiles` 组合 progress 路径和可选附加文件，与原始三处行为一致 | ✅ |
| 各路径退出码相同 | 条目 1 | `src/run.ts:1456` — `return finish('BLOCK', { escalation: opts.reason, decision })` 与原始三处均返回 BLOCK | ✅ |
| 不变量上限 9→7 | 条目 2 | `test/invariants.test.ts:181` — `expect(pushLines.length).toBeLessThanOrEqual(7)` (原 9) | ✅ |
| 不变量注释对应更新 | 条目 2 | `test/invariants.test.ts:180` — 注释已更新为 `expect exactly 7 push calls after v046-b38 (3 escalation paths merged...)` | ✅ |
| `await push(` 恰好 7 处 | 条目 2 | `grep -vE` 实跑结果 exit 0；`grep -n "await push(" src/run.ts` 列出 7 行（1214, 1442, 2051, 2463, 2844, 3421, 3474） | ✅ |
| 不加新测试 | 条目 3 | `git diff --stat` 无新测试文件 | ✅ |
| 不改别的测试 | 条目 3 | `git diff --stat -- 'test/' ':(exclude)test/invariants.test.ts'` 无输出 | ✅ |
| 三条路径现有测试照常通过 | 条目 3 | 实跑 `npm test -- test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36` → 6 files, 77 tests passed | ✅ |
| 行为要求：三条路径测试通过 | 条目 3 | `npx vitest run test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36` → `Test Files 6 passed (6), Tests 77 passed (77)` | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 对全部受保护路径均无输出 | ✅ |
| 不改 src/run.ts 之外的 src/ | 额外禁止 | `git diff --stat -- 'src/' ':(exclude)src/run.ts'` 无输出 | ✅ |
| 不改变规则判定 / 队列逻辑 | 额外禁止 | diff 仅涉及三处 escalation 路径的合并为共享函数，逻辑未变 | ✅ |
| 不做别的重构或改名 | 额外禁止 | diff 范围严格限于三处 escalation 合并，无其它改动 | ✅ |
| 不删除或跳过测试 | 额外禁止 | 仅改动 `toBeLessThanOrEqual(9→7)`（条目 2 点名允许） | ✅ |
| 无新增依赖 | 额外禁止 | package.json / lock 无变化 | ✅ |

### 不变量数值变化

| 文件 | 原值 | 新值 | 说明 |
|---|---|---|---|
| `test/invariants.test.ts:181` | `toBeLessThanOrEqual(9)` | `toBeLessThanOrEqual(7)` | 条目 2 明确要求改严 |

### 被改写或删去的断言

| 文件 | 用例名 | 原断言 | 现断言 | SPEC 仍有效 |
|---|---|---|---|---|
| `test/invariants.test.ts` | `every await push( in run.ts has push_failed or verdict within 5 lines above` | `expect(pushLines.length).toBeLessThanOrEqual(9)` | `expect(pushLines.length).toBeLessThanOrEqual(7)` | 是（改严，从 9→7，条目 2 点名允许） |

无其他断言被删去或改写。

## 结论与理由

所有六条验收命令均实跑通过。重构将三条 escalation 路径（`escalate`、`testerEscalate`、disputed acceptance）正确合并到 `escalateAndCommit` 共享函数中，参数化了 reason/附加字段、progress 前缀、附加提交文件、evidence 基准 SHA。各路径的事件、字段、文字、提交文件、退出码均与重构前完全一致。不变量上限从 9 改为 7（条目 2 明确要求）。推送数量从 9 减少到 7（三处独立 push 合并为一处）。无受保护文件被修改，无依赖变化，无范围蔓延。全部 1556 条测试通过，包括三条 escalation 路径守卫的 77 条测试。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b38",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["57866f65e95ec64576afbafad6e47b987f827483"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "80 files, 1556 tests passed" },
      { "cmd": "npm test -- test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36", "exit_code": 0, "summary": "6 files, 77 tests passed" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -cF \"await push(\" | grep -qx 7", "exit_code": 0, "summary": "exactly 7 non-comment push calls" },
      { "cmd": "grep -qF \"toBeLessThanOrEqual(7)\" test/invariants.test.ts", "exit_code": 0, "summary": "upper limit is 7" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "CI 以 R2 取证为准。全部验收命令通过，重构正确保持了三条 escalation 路径的行为不变。不变量上限 9→7 是条目 2 明确要求的改严。"
}
```
