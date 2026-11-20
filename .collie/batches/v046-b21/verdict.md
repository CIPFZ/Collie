# 批次 v046-b21 审核

## 取证过程

### 1. 验收命令实跑

**命令 1:** `npm run lint`
- 退出码：0
- 输出：ESLint 和 Prettier 均通过，零错误。

**命令 2:** `npm run typecheck`
- 退出码：0
- 输出：`tsc -p tsconfig.json` 通过，零错误。

**命令 3:** `npm test`
- 退出码：0
- 输出：69 test files passed, 1428 tests passed (23.98s)。

**命令 4:** `npm test -- test/acceptance/v046-b21`
- 退出码：0
- 输出：2 test files passed, 12 tests passed (211ms)。

### 2. 提交事实

- worker 提交：`e529ba3814ab9876844d519671b7dfd9d376e984` — `cli: omit tester/testerCost keys when no tester events exist (SPEC 16.18)`
- 信封提交：`c7f4ff2258ac771bdae0a14b33cbe2534967b661` — `docs: issue v046-b21 task envelope`
- 远端 main 位于 `5d5a6b1ffcb1bd310a3d804281cd75c0fd5921d6`（含 report 提交），head sha 是其祖先，已推送。

### 3. CI

- 本 reviewer 没有 GitHub 凭据，无法查询 CI。`ci_conclusion` = `unknown`, `ci_branch_matched` = `null`。CI 以 R2 取证为准。

### 4. 受保护路径

```
git diff --stat <base>..<head> -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml .github/ eslint.config.js vitest.config.ts package.json
```
结果：无输出，零行变动。

`test/acceptance` 下的变动仅来自 `c7f4ff2 docs: issue v046-b21 task envelope`（R2 信封），worker 未触碰。

### 5. 依赖变化

`git diff --stat <base>..<head> -- package.json package-lock.json`：无输出，依赖无变动。

### 6. 范围检查

worker 修改的文件：
- `src/view.ts` — 条目 1 要求的文件
- `test/why.test.ts` — 条目 2 点名允许的测试修改
- `test/report.test.ts` — 条目 2 点名允许的测试修改

无其他 `src/` 文件被改动。无范围蔓延。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, 零错误 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, 零错误 | ✅ |
| 全部测试通过（含验收测试） | `npm test` | exit 0, 69 files / 1428 tests passed | ✅ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b21` | exit 0, 2 files / 12 tests passed | ✅ |

## 条目要求与额外禁止

### 条目 1：没有 tester.finished 时 JSON 键缺失

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `projectWhy` attempt 对象不带 `tester` 键（无 tester 事件时） | 条目 1 | `src/view.ts:1206-1233`：构建 `result` 对象时不含 `tester` 字段，仅 `if (tester !== undefined)` 才赋值；验收测试 `S1: attempt object has no "tester" key` 通过 | ✅ |
| cost 不带 `tester` 键（无 tester 事件时） | 条目 1 | `src/view.ts:1191-1194`：`cost` 对象默认无 `tester`，仅 `if (tester !== undefined)` 才赋值；验收测试 `S1: cost object has no "tester" key` 通过 | ✅ |
| `projectReport` 行不带 `testerCost` 键（无 tester 事件时） | 条目 1 | `src/view.ts:1772-1791`：`row` 对象默认无 `testerCost`，仅 `if (testerFinishedEvts.length > 0)` 才赋值；验收测试 `S2: batchRows entries have no "testerCost" key` 通过 | ✅ |
| 类型上改成可选 | 条目 1 | `src/view.ts:908` `tester?:` (原 `tester:`), `src/view.ts:919` `tester?: number \| null` (原 `tester: number \| null`), `src/view.ts:1573` `testerCost?: number \| null` (原 `testerCost: number \| null`) | ✅ |
| 不要输出 null 或 undefined 的占位 | 条目 1 | `src/view.ts:1149`：`let tester: WhyAttempt['tester'];` — 未赋值即为 `undefined`（不是 `null`），且返回对象只在条件成立时赋 key；`JSON.stringify` 不输出 `undefined` 属性。验收测试 `S1: JSON.stringify contains no "tester:" substring` 和 `S2: JSON.stringify contains no "testerCost:" substring` 通过 | ✅ |
| 有 tester.finished 时三处与现在相同 | 条目 1 | 验收测试 K1（attempt.tester 有 turns 21, costUsd 0.29, durationMs 123000, invocations 1）和 K2（testerCost 0.29）通过；`npx vitest run test/acceptance/v046-b21` 输出：Tests 12 passed | ✅ |
| `formatWhy`、`formatReport` 文字输出不变 | 条目 1 | `src/view.ts:1385` 和 `1507`：`!== null` 改为 `!= null`（处理 undefined + null），行为等价；K3 验收测试确认无 tester 时无 `tester:` 行和 `tester 花费`；K1/K2 确认有 tester 时正常显示；`npx vitest run test/why.test.ts` 28 passed, `npx vitest run test/report.test.ts` 21 passed | ✅ |

**行为要求实跑验证：**

| 行为要求 | 测试文件 | 实跑命令与结果 | 满足 |
|---|---|---|---|
| S1：无 tester 事件 → attempt 无 tester 键，cost 无 tester 键，JSON 无 "tester:" | `test/acceptance/v046-b21/new.test.ts` | `npx vitest run test/acceptance/v046-b21/new.test.ts` → Tests 5 passed | ✅ |
| S2：无 tester 事件 → batchRows 无 testerCost 键，JSON 无 "testerCost:" | `test/acceptance/v046-b21/new.test.ts` | 同上 | ✅ |
| K1：有 tester.finished → tester 数据正确 | `test/acceptance/v046-b21/keep.test.ts` | `npx vitest run test/acceptance/v046-b21/keep.test.ts` → Tests 7 passed | ✅ |
| K2：有 tester.finished → testerCost 和列正确 | `test/acceptance/v046-b21/keep.test.ts` | 同上 | ✅ |
| K3：无 tester 事件 → 格式化文字无 tester 显示 | `test/acceptance/v046-b21/keep.test.ts` | 同上 | ✅ |

### 条目 2：测试断言改写

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `test/why.test.ts` 的 `tester field null` 用例：`a.tester` 和 `a.cost.tester` 两行改成断言键不存在 | 条目 2 | `test/why.test.ts:1486-1487`：`expect(Object.prototype.hasOwnProperty.call(a, 'tester')).toBe(false)` / `expect(Object.prototype.hasOwnProperty.call(a.cost, 'tester')).toBe(false)`；原为 `expect(a.tester).toBeNull()` / `expect(a.cost.tester).toBeNull()` | ✅ |
| 用例名改掉 `tester field null` | 条目 2 | `test/why.test.ts:1438`：`'no tester events: output identical to run without tester (tester key absent)'`（原 `tester field null`） | ✅ |
| `test/report.test.ts` 的 `no tester column` 用例：`row.testerCost` 一行改成断言键不存在 | 条目 2 | `test/report.test.ts:838`：`expect(Object.prototype.hasOwnProperty.call(row, 'testerCost')).toBe(false)`；原为 `expect(row.testerCost).toBeNull()` | ✅ |
| 无其他现有断言被删/被改松 | 条目 2 | diff 中 `test/why.test.ts` 和 `test/report.test.ts` 的全部改动仅限上述 3 处断言和 1 处用例名，无删除/改松 | ✅ |

### 额外禁止核对

| 禁止事项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径 | 额外禁止 | `git diff --stat` 对 SPEC.md, CONSTRAINTS.md, ROADMAP.md, ROLES.md, AGENT-*.md, .collie/collie.toml, test/acceptance, .github/, eslint.config.js, vitest.config.ts, package.json：均无变动 | ✅ |
| 不改 src/view.ts 之外的 src/ 文件 | 额外禁止 | `git diff --name-only <base>..<head> -- src/` 只有 `src/view.ts` | ✅ |
| 不改 formatWhy/formatReport 文字输出 | 额外禁止 | `!== null` → `!= null` 在语义上等价（undefined 和 null 都被排除），28 条 why 测试和 21 条 report 测试全部通过 | ✅ |
| 不改有 tester 时的 JSON | 额外禁止 | K1/K2 验收测试确认 tester 存在时数据结构与值完全正确 | ✅ |
| 不删除/跳过测试 | 额外禁止 | diff 仅改写了条目 2 点名的 3 处断言和 1 处用例名，无删除/跳过 | ✅ |
| 不改注释/字面以通过验收（铁律 26） | 额外禁止 | 注释变更仅为描述新行为（如 `null → absent`），未用于绕过验收命令 | ✅ |
| 测试不拉起真实 runner/网络请求 | 额外禁止 | 验收测试使用手工构建的事件数据，直接调用导出函数 | ✅ |
| 不新增依赖 | 额外禁止 | package.json 无变动 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 在 diff 中无变动。

### 被改写或删去的断言

| 文件 | 用例名 | 原断言 | 现断言 | SPEC 要求是否仍有效 |
|---|---|---|---|---|
| test/why.test.ts | `no tester events: output identical to run without tester (tester field null)` → `(...tester key absent)` | `expect(a.tester).toBeNull()` | `expect(Object.prototype.hasOwnProperty.call(a, 'tester')).toBe(false)` | SPEC 16.18 要求键缺失而非 null，这是正确的更新 |
| test/why.test.ts | 同上 | `expect(a.cost.tester).toBeNull()` | `expect(Object.prototype.hasOwnProperty.call(a.cost, 'tester')).toBe(false)` | 同上 |
| test/report.test.ts | `no tester events: output byte-identical (no tester column)` | `expect(row.testerCost).toBeNull()` | `expect(Object.prototype.hasOwnProperty.call(row, 'testerCost')).toBe(false)` | 同上 |

以上 3 处改写均是条目 2 点名允许的改写，原守的「无 tester 时值为 null」在 SPEC 16.18 下已变为「键缺失」。

## 结论与理由

**PASS**。

全部 4 条验收命令实跑通过。条目 1 的类型改为可选、JSON 键条件赋值逻辑正确。条目 2 的 3 处断言改写和 1 处用例名改写完全符合 task.md 点名允许的范围。`formatWhy`/`formatReport` 文字输出不变（`!= null` 等价处理 `undefined`/`null`）。受保护路径无变动、无依赖变化、无范围蔓延。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b21",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["e529ba3814ab9876844d519671b7dfd9d376e984"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "ESLint + Prettier pass, zero errors" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass, zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "69 test files, 1428 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b21", "exit_code": 0, "summary": "2 test files, 12 tests passed" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 4 acceptance commands pass. Item 1: tester/testerCost keys correctly omitted when no tester.finished events (type made optional, conditional assignment). Item 2: 3 assertions changed from toBeNull to hasOwnProperty false, test name updated — all within the named-permitted scope. formatWhy/formatReport text output unchanged (!=null handles undefined equivalently). No protected path changes, no dependency changes, no scope creep. CI conclusion unknown — deferred to R2."
}
```
