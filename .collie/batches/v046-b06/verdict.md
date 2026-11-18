Exactly 4 files, all within scope. I now have all evidence needed to write the verdict.

---

# 批次 v046-b06 审核

## 取证过程

### 1. 受保护文件

```
git diff --stat 18cb25cf..32044c9d -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```

输出为空 — 无受保护文件被修改。

### 2. 额外禁止路径

```
git diff --stat 18cb25cf..32044c9d -- templates/collie.toml .github/ eslint.config.js vitest.config.ts package.json docs/backlog.md AGENT-tester.md
```

输出为空。

```
git diff --stat 18cb25cf..32044c9d -- src/run.ts src/redcheck.ts src/roles/worker.ts src/roles/reviewer.ts 'src/runner/' src/arbiter.ts src/gate.ts src/evidence.ts
```

输出为空。

### 3. 依赖变化

```
git diff 18cb25cf..32044c9d -- package.json package-lock.json
```

输出为空 — 无依赖变化。

### 4. 变更范围

```
git diff --name-only 18cb25cf..32044c9d -- . ':(exclude).collie/batches'
```

```
src/backlog.ts
src/roles/tester.ts
test/backlog.test.ts
test/tester.test.ts
```

4 个文件，全部落在条目范围内。

### 5. 提交确认

```
git rev-parse 32044c9dac106fc605bd7d1600d31885c681c900
→ 32044c9dac106fc605bd7d1600d31885c681c900
```

```
git merge-base --is-ancestor 32044c9d cb39797d && echo "YES ancestor"
→ YES ancestor
```

提交存在且已推送至 remote main。

### 6. 验收命令实跑

#### 6.1 `npm run lint` → exit 0
```
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

#### 6.2 `npm run typecheck` → exit 0
```
> tsc -p tsconfig.json
(无输出)
```

#### 6.3 `npm test` → exit 0
```
Test Files  62 passed (62)
     Tests  1281 passed (1281)
```

#### 6.4 `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/tester.test.ts` → exit 0
```
Test Files  3 passed (3)
     Tests  78 passed (78)
```

#### 6.5 `grep -qF "backlog: blank lines inside scenario and interface lists" test/backlog.test.ts && grep -qF "tester: prompt wording (v046-b06)" test/tester.test.ts` → exit 0

#### 6.6 `! grep -vE "^\s*(//|\*|/\*)" src/roles/tester.ts | grep -qF "需要自行阅读的 SPEC 章节"` → exit 0

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, 无错误 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, 无输出 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 62 files / 1281 tests passed | ✅ |
| 解析与提示词测试 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/tester.test.ts` | exit 0, 3 files / 78 tests passed | ✅ |
| 两组新用例在 | `grep -qF …` | exit 0 | ✅ |
| 旧小标题不在了 | `! grep … "需要自行阅读的 SPEC 章节"` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：情形与接口列表允许空行

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 情形列表空行跳过 | task §1 | `src/backlog.ts:471-472`：`if (text === '') continue;` 在 `parseScenarios` 中 | ✅ |
| 接口列表空行跳过 | task §1 | `src/backlog.ts:311`：`if (trimmed === '') continue;` 在 `parseListWithBlanks` 中；接口调用处 `src/backlog.ts:441` 改用 `parseListWithBlanks` | ✅ |
| 续行仍合并（不变） | task §1 | `src/backlog.ts:484`（情形）/ `src/backlog.ts:315`（接口）：CONTINUATION 逻辑未改 | ✅ |
| 非空非格式行结束列表 | task §1 | `src/backlog.ts:490-498`（情形 bad bullet 报错）/ `src/backlog.ts:317` 接口 `break` | ✅ |
| 条目/额外禁止列表规则不动 | task §1 | `src/backlog.ts:421`（条目用 `parseList`）/ `src/backlog.ts:431`（额外禁止用 `parseList`）；`parseList` 函数体未修改 | ✅ |
| 空行后不合格式的 bullet 报错带行号 | task §1 | `src/backlog.ts:490-497`：`throw new BacklogError(source, line.no, ...)` | ✅ |
| **行为：三条情形空行分隔解析出 3 条** | task §1 加粗 | `npx vitest run test/backlog.test.ts` → Tests 24 passed；测试 `'three scenarios with blank lines between each pair: parses all 3'` 验证 3 条情形的 id/kind/text | ✅ |
| **行为：bad bullet 报错带行号** | task §1 加粗 | 同上测试文件；`'two scenarios then blank line then bad bullet: errors with the bad line number'` 断言 `err.line === badLineNo` 且 message 含 `does not match expected format` | ✅ |
| **行为：接口空行解析 2 条** | task §1 加粗 | 同上；`'interfaces with blank line between two items: parses both'` 断言 `['src/foo.ts fooFn', 'src/bar.ts barFn']` | ✅ |
| skipScenarioList 也处理空行 | task §1（隐含一致性） | `src/backlog.ts:529`：`if (text === '') continue;` 及 `src/backlog.ts:532-535`：bad bullet `continue` | ✅ |

### 条目 2：tester 提示词两处修改

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 小标题改为「可查阅的文件」 | task §2 | `src/roles/tester.ts:114`：`'## 可查阅的文件'` | ✅ |
| 旧标题「需要自行阅读的 SPEC 章节」已删 | task §2 | 验收命令 6 通过（非注释行不含旧标题） | ✅ |
| 加「不要通读」指引 | task §2 | `src/roles/tester.ts:116`：`'情形里点名了小节号的，只读那一节；不要通读'` | ✅ |
| 路径逐条列出（不变） | task §2 | `src/roles/tester.ts:118`：`...data.spec_paths.map((p) => ...)` 未改 | ✅ |
| 输出节加 batch_id 说明 | task §2 | `src/roles/tester.ts:128`：`` `汇报末尾 JSON 块里的 \`batch_id\` 填 \`${data.batch_id}\`。` `` — 把批次号原样写出 | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| backlog.test.ts 新 describe 组名正确 | task §3 | `test/backlog.test.ts:241`：`describe('backlog: blank lines inside scenario and interface lists', ...)` | ✅ |
| 覆盖三种加粗情形 + 情形后接接口 | task §3 | `test/backlog.test.ts:275`（3 条情形）、`:286`（bad bullet）、`:303`（接口空行）、`:312`（情形→空行→接口标签）— 4 个 it | ✅ |
| 拒绝用例断言行号 | task §3 | `test/backlog.test.ts:296-297`：`err.line === badLineNo` | ✅ |
| tester.test.ts 新 describe 组名正确 | task §3 | `test/tester.test.ts:249`：`describe('tester: prompt wording (v046-b06)', ...)` | ✅ |
| 新标题在/旧标题不在/batch_id 有批次号 | task §3 | `test/tester.test.ts:250-271`：4 个 it 验证 | ✅ |
| 已有用例一条都不改 | task §3 | `git diff` 无删除任何 `expect` 行；仅新增 `BacklogError` 到 import | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 受保护路径（含 backlog.md, AGENT-tester.md） | task 额外禁止 | diff --stat 为空 | ✅ |
| templates/collie.toml, .github/, eslint.config.js, vitest.config.ts, package.json | task 额外禁止 | diff --stat 为空 | ✅ |
| 条目/额外禁止/验收标准解析不变 | task 额外禁止 | `parseList` 函数体未改；`parseTable`/`parseAcceptance` 未改 | ✅ |
| 不带情形接口的批次解析结果不变 | task 额外禁止 | 新逻辑只在 `parseScenarios`/`parseListWithBlanks` 中；无情形接口时不会调用 | ✅ |
| src/run.ts 等 8 个文件不改 | task 额外禁止 | diff --name-only 仅 4 文件 | ✅ |
| 不删/跳过测试，不改写已有断言 | task 额外禁止 | diff 中无删除的 expect 行 | ✅ |
| 不改注释凑验收（铁律 26） | task 额外禁止 | 不适用（验收全过） | ✅ |
| 测试无真实 runner/网络/新依赖 | task 额外禁止 | 新测试只调用 `parseBacklog()` 和 `buildTesterPrompt()`，纯函数 | ✅ |

### 不变量数值变化

无 — `test/invariants.test.ts` 在此 diff 中无任何改动。

### 被改写或删去的断言

无 — diff 中没有删除或修改任何已有的 `expect(...)` 行。唯一的 diff 行变更是在 `test/backlog.test.ts` 的 import 中新增了 `BacklogError`。

## 结论与理由

全部 6 条验收命令实跑通过。3 个条目的结构要求逐条核对全部满足，行为要求通过实跑测试确认。无受保护文件修改，无新增依赖，无范围蔓延（仅改 4 个文件），无已有断言被修改或删除，提交已推送至远端。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b06",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["32044c9dac106fc605bd7d1600d31885c681c900"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "62 files, 1281 tests passed" },
      { "cmd": "npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/tester.test.ts", "exit_code": 0, "summary": "3 files, 78 tests passed" },
      { "cmd": "grep -qF 'backlog: blank lines inside scenario and interface lists' test/backlog.test.ts && grep -qF 'tester: prompt wording (v046-b06)' test/tester.test.ts", "exit_code": 0, "summary": "both describe groups found" },
      { "cmd": "! grep -vE '^\\s*(//|\\*|/\\*)' src/roles/tester.ts | grep -qF '需要自行阅读的 SPEC 章节'", "exit_code": 0, "summary": "old heading absent from non-comment lines" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 6 acceptance commands pass. Scenario and interface blank-line handling implemented correctly in src/backlog.ts; tester prompt wording updated in src/roles/tester.ts; new test groups cover all required cases. No protected files modified, no dependencies added, no existing assertions changed. CI conclusion unknown — to be verified by R2."
}
```
