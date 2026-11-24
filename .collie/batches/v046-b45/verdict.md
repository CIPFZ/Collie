Good. Now let me compile the full analysis.

**Summary of findings:**

1. **Lint**: exit 0 ✓
2. **Typecheck**: exit 0 ✓
3. **All tests**: 92 passed, 1616 tests ✓
4. **Batch acceptance tests**: 2 files, 6 tests passed ✓
5. **Commits**: Worker commit `4e1cf805...` only touches `src/run.ts` and `src/view.ts` ✓
6. **Protected paths**: Only changes in `test/acceptance/v046-b45/` from `docs: issue` envelope commit ✓
7. **Dependencies**: No changes ✓
8. **Mutation script**: No changes ✓
9. **Existing tests**: No modifications to any existing test files ✓
10. **Invariants**: No changes ✓
11. **Remote push**: Commit is on `origin/main` ✓

Now let me verify the scenario/acceptance test coverage:

**S1**: Test checks `formatWhy` has line exactly `reviewer: skipped (rule 8)` and no line `reviewer: —`. Implementation at `src/view.ts:1462-1464`. Test passes. ✓
**S2**: Test checks `verdict.downgraded:` line contains `PASS (assumed) → FIX`. Implementation at `src/view.ts:1500-1504`. Test passes. ✓
**S3**: Test checks first run exits 10, second run's task.md contains `{"passed":47,"failed":0}` and `"failed":3`. Implementation at `src/run.ts:877-878` (`JSON.stringify`). Test passes. ✓
**K1**: Test checks normal PASS run has `reviewer: PASS`, no `skipped`, no `(assumed)`, JSON has no `reviewerSkipped` nor `assumed`. Test passes. ✓
**K2**: Test checks `renderFixSection` with string claimed/actual formats correctly. Test passes. ✓
**K3**: Test checks worker lying about test counts produces exit 10 and `claim.mismatch` with rule 6, field `tests`. Test passes. ✓

---

# 批次 v046-b45 审核

## 取证过程

### 1. 验收命令实跑

```
$ npm run lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
→ 退出码 0 ✓
```

```
$ npm run typecheck
> tsc -p tsconfig.json
→ 退出码 0 ✓
```

```
$ npm test
 Test Files  92 passed (92)
      Tests  1616 passed (1616)
→ 退出码 0 ✓
```

```
$ npm test -- test/acceptance/v046-b45
 Test Files  2 passed (2)
      Tests  6 passed (6)
→ 退出码 0 ✓
```

### 2. 提交事实

```
$ git log --format='%H %s' 3e683ab..4e1cf80
4e1cf805cad433f58a978ae371acb03fb09ffed6 cli: why shows skipped reviewer and renders non-string claim mismatches
03249a48ba88a2764a9ca372e239e9909d6db2da docs: issue v046-b45 task envelope
```

Worker 的产出提交为 `4e1cf805cad433f58a978ae371acb03fb09ffed6`，仅改动 `src/run.ts` 和 `src/view.ts`。

```
$ git branch -r --contains 4e1cf805
  origin/HEAD -> origin/main
  origin/main
```

已推送到远端。

### 3. CI 检查

```
$ git ls-remote origin
79a67d2b097d38ed4a3eee4fbd1826547c139a01  HEAD
79a67d2b097d38ed4a3eee4fbd1826547c139a01  refs/heads/main
```

远端 HEAD 指向 `79a67d2b`，不是本批次的 `4e1cf805`——说明远端在本批次之后有更多提交（report 信封等），不影响提交已推送的事实。CI 以 R2 取证为准。

### 4. 受保护路径

```
$ git diff --stat 3e683ab..4e1cf80 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
test/acceptance/v046-b45/MAP.md       |  23 +++
test/acceptance/v046-b45/keep.test.ts | 126 +++
test/acceptance/v046-b45/new.test.ts  | 135 +++
3 files changed, 284 insertions(+)
```

这三个文件全部来自 `docs: issue` 信封提交（`03249a4`），不是 worker 的改动。worker 的 commit `4e1cf80` 只改了 `src/run.ts` 和 `src/view.ts`。

```
$ git log --format='%h %s' 3e683ab..4e1cf80 -- test/acceptance
03249a4 docs: issue v046-b45 task envelope
```

只有信封提交，无 worker 改动。受保护文件改动行数为 **0**。

### 5. 依赖变化

```
$ git diff 3e683ab..4e1cf80 -- package.json package-lock.json
（无输出）
```

无依赖变化。

### 6. 变异检查

```
$ git diff 3e683ab..4e1cf80 -- scripts/mutation.ts
（无输出）
```

无变更。

### 7. 已有测试文件改动

```
$ git diff 3e683ab..4e1cf80 -- 'test/**/*.test.ts' ':(exclude)test/acceptance'
（无输出）
```

没有任何已有测试被改动。

### 8. 不变量数值变化

```
$ git diff 3e683ab..4e1cf80 -- test/invariants.test.ts
（无输出）
```

无。

### 9. 被改写或删去的断言

无。没有任何已有测试文件被改动。

### 10. 行为测试实跑

```
$ npx vitest run test/acceptance/v046-b45/new.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
→ S1、S2、S3 全部通过
```

```
$ npx vitest run test/acceptance/v046-b45/keep.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
→ K1、K2、K3 全部通过
```

```
$ npx vitest run test/why.test.ts
 Test Files  1 passed (1)
      Tests  28 passed (28)
→ 现有 why 测试无回归
```

```
$ npx vitest run test/report.test.ts
 Test Files  1 passed (1)
      Tests  21 passed (21)
→ 现有 report 测试无回归
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，无错误 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0，无错误 | ✅ |
| 全部测试通过 | `npm test` | 92 files, 1616 tests passed | ✅ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b45` | 2 files, 6 tests passed | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `reviewer.skipped` 时 attempt 带 `reviewerSkipped`（rule, reason） | 条目 1 | `src/view.ts:894-898`（类型定义）、`src/view.ts:1126-1134`（投影逻辑）、`src/view.ts:1254-1257`（条件赋值）；S1 测试 `npx vitest run test/acceptance/v046-b45/new.test.ts` → `Tests 3 passed` | ✅ |
| `formatWhy` reviewer 一行 `reviewer: skipped (rule <N>)` | 条目 1 | `src/view.ts:1462-1464`：`lines.push(\`reviewer: skipped (rule ${String(a.reviewerSkipped.rule)})\`)`；S1 测试通过 | ✅ |
| `verdict.downgraded` 带 `assumed: true` 时 `downgraded` 带 `assumed` | 条目 1 | `src/view.ts:889-890`（类型）、`src/view.ts:1112-1113`（投影逻辑：`...(downgradeEvent.assumed === true ? { assumed: true as const } : {})`） | ✅ |
| downgraded 行写成 `verdict.downgraded: PASS (assumed) → <结论>, rule <N>: …` | 条目 1 | `src/view.ts:1500-1504`：`const fromDisplay = d.assumed === true ? \`\${d.from} (assumed)\` : d.from;`；S2 测试 `npx vitest run test/acceptance/v046-b45/new.test.ts` → `Tests 3 passed` | ✅ |
| 没有这两样的运行一个字节都不变（键不出现、不输出 null/false 占位） | 条目 1 | `src/view.ts:1113`：空 spread `{}`；`src/view.ts:1254-1256`：`if (reviewerSkipped !== undefined)` 才赋值；`src/view.ts:1462`：`else if` 分支仅当 `reviewerSkipped != null`。K1 测试验证 JSON 中不含 `reviewerSkipped` 和 `assumed`：`npx vitest run test/acceptance/v046-b45/keep.test.ts` → `Tests 3 passed` | ✅ |
| 非字符串 claimed/actual 用 `JSON.stringify` 渲染 | 条目 2 | `src/run.ts:877-878`：`typeof e.claimed === 'string' ? e.claimed : JSON.stringify(e.claimed)`（actual 同理）；S3 测试验证 task.md 包含 `{"passed":47,"failed":0}` 和 `"failed":3`：`npx vitest run test/acceptance/v046-b45/new.test.ts` → `Tests 3 passed` | ✅ |
| 字符串时与现在相同 | 条目 2 | `src/run.ts:877`：`typeof e.claimed === 'string' ? e.claimed : ...`，字符串分支不变；K2 测试通过 | ✅ |
| 已有断言一条都不改 | 条目 2 | `git diff` 显示 `test/**/*.test.ts`（除 acceptance）无任何改动 | ✅ |
| 不改动受保护路径 | 额外禁止 | worker commit `4e1cf80` 仅改 `src/run.ts` 和 `src/view.ts` | ✅ |
| 不改动 `src/view.ts`、`src/run.ts` 之外的 `src/` 文件 | 额外禁止 | `git diff-tree --name-only 4e1cf80` 只列出 `src/run.ts` 和 `src/view.ts` | ✅ |
| 不改任何判定、事件与它们的字段 | 额外禁止 | diff 仅在 `src/view.ts`（视图/格式化层）和 `src/run.ts`（渲染层）做只读投影的改动，未触碰判定逻辑或事件记录 | ✅ |
| 不改变没有跳过 reviewer 的运行的输出 | 额外禁止 | K1 测试验证正常运行输出不含 skipped/assumed；`test/why.test.ts`（28 tests）和 `test/report.test.ts`（21 tests）均无回归 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | 无任何已有测试改动 | ✅ |
| 不改写任何已有断言 | 额外禁止 | 无任何已有测试改动 | ✅ |
| 不改注释或字面以通过验收 | 额外禁止（铁律 26） | diff 中新增的注释仅为 SPEC 引用说明，不影响验收命令 | ✅ |
| 不新增依赖 | 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化

无。

### 被改写或删去的断言

无。

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 | `S1: formatWhy has a line "reviewer: skipped (rule 8)" and no line "reviewer: —"` | 是：精确匹配 `reviewer: skipped (rule 8)` 和不存在 `reviewer: —` | 是：拿掉 `src/view.ts:1462-1464` 的 `else if` 分支后会输出 `reviewer: —` 而非 `reviewer: skipped (rule 8)` |
| S2 | `S2: verdict.downgraded line contains "PASS (assumed) → FIX"` | 是：检查 downgraded 行含 `PASS (assumed) → FIX` | 是：拿掉 `src/view.ts:1500-1501` 的 assumed 逻辑后会输出 `PASS → FIX`，不含 `(assumed)` |
| S3 | `S3: first run exits 10; second run task.md has {"passed":47,"failed":0} and "failed":3` | 是：检查退出码 10、task.md 含 `{"passed":47,"failed":0}` 和 `"failed":3` | 是：拿掉 `src/run.ts:877-878` 的 `JSON.stringify` 后非字符串的 claimed 会渲染为空字符串，task.md 不会含 `{"passed":47,"failed":0}` |
| K1 | `K1: formatWhy has reviewer: PASS line, no skipped, no (assumed); JSON has no reviewerSkipped nor assumed` | 是：验证正常运行不受影响 | 不适用（保持场景，测的是不引入多余键） |
| K2 | `K2: output has line exactly "- head_sha：claimed \`abc1234\`，actual \`unresolvable\`"` | 是：精确匹配渲染格式 | 不适用（保持场景，字符串路径不变） |
| K3 | `K3: first run exits 10, journal has claim.mismatch with rule 6 and field tests` | 是：验证退出码和事件 | 不适用（保持场景，行为不变） |

## 结论与理由

全部 4 条验收命令实跑通过。worker 仅改动 `src/view.ts` 和 `src/run.ts` 两个允许的文件。改动范围精确：

1. **条目 1**（reviewer.skipped / assumed）：在 `WhyAttempt` 类型加了 `reviewerSkipped?` 和 `assumed?`；`projectWhyAttempt` 读取 `reviewer.skipped` 和 `downgradeEvent.assumed`，仅在事件存在时设置键；`formatWhy` 在 reviewer 被跳过时输出 `reviewer: skipped (rule N)`，在 assumed 时输出 `PASS (assumed)`。没有跳过 reviewer 的运行完全不受影响（K1 验证、28 条 why 测试 + 21 条 report 测试无回归）。

2. **条目 2**（非字符串 claimed/actual）：`src/run.ts` 的 `batchHistory` 中将非字符串的 `claimed`/`actual` 用 `JSON.stringify` 渲染而非空字符串。字符串路径不变（K2 验证）。

无受保护文件改动、无依赖变化、无已有断言改动、无不变量变化。diff 范围严格在 task.md 条目之内，无范围蔓延。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b45",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["4e1cf805cad433f58a978ae371acb03fb09ffed6"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "92 files, 1616 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b45", "exit_code": 0, "summary": "2 files, 6 tests passed" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "CI 以 R2 取证为准。全部验收命令通过，条目要求与额外禁止逐条核对均满足，6 条情形的验收测试全部通过且对照情形描述覆盖正确，无已有测试改动，无受保护路径改动，无依赖变化。"
}
```
