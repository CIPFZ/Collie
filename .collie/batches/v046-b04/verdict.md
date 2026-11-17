I've completed all my evidence gathering. Let me now compile the full verdict.

# 批次 v046-b04 审核

## 取证过程

### 1. 受保护文件检查

```
git diff --stat b7a901ea..f081e434 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护文件未被修改。`spec_diff_lines = 0`。

### 2. 禁止文件检查

```
git diff --stat b7a901ea..f081e434 -- src/run.ts src/redcheck.ts src/roles/worker.ts src/roles/reviewer.ts src/runner/ src/arbiter.ts src/gate.ts src/evidence.ts src/view.ts src/follow.ts templates/collie.toml .github/ eslint.config.js vitest.config.ts package.json
```
结果：无输出。条目额外禁止中列出的所有文件均未被修改。

### 3. 依赖变化

```
git diff b7a901ea..f081e434 -- package.json package-lock.json
```
结果：无输出。无依赖变化。

### 4. 提交事实

```
git log b7a901ea..f081e434 --format='%H' -- . ':(exclude).collie/batches'
```
结果：1 个提交 `f081e4347c2600b93030a9344cf51e3a6276227c`

```
git merge-base --is-ancestor f081e434 f482876ee200bc823e8c7d33f3298bb6a50be906 (远端 main HEAD)
```
结果：IS_ANCESTOR — 已推送。

### 5. 验收命令实跑

| # | 命令 | 退出码 | 摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | 通过 |
| 2 | `npm run typecheck` | 0 | 通过 |
| 3 | `npm test` | 0 | 62 files, 1259 tests passed |
| 4 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` | 0 | 4 files, 91 tests passed |
| 5 | `grep -qF "backlog: scenarios and interfaces" test/backlog.test.ts && grep -qF "backlog: rejects malformed scenarios" test/backlog-reject.test.ts` | 0 | 通过 |
| 6 | `grep -qF "show prints scenarios and interfaces when the batch has them" test/cli.test.ts && grep -qF "tester: scenarios in the prompt" test/tester.test.ts` | 0 | 通过 |
| 7 | `! grep -vE "^\s*(//\|\*\|/\*)" src/roles/tester.ts \| grep -qE "\bitems\b"` | 0 | 通过 |
| 8 | `grep -qE "roles/tester.*items\|items.*roles/tester" test/invariants.test.ts` | 0 | 通过 |

### 6. 行为测试实跑

| 文件 | 命令 | 结果 |
|---|---|---|
| test/backlog.test.ts | `npx vitest run test/backlog.test.ts` | Tests 20 passed |
| test/backlog-reject.test.ts | `npx vitest run test/backlog-reject.test.ts` | Tests 29 passed |
| test/cli.test.ts | `npx vitest run test/cli.test.ts` | Tests 21 passed |
| test/tester.test.ts | `npx vitest run test/tester.test.ts` | Tests 21 passed |
| test/invariants.test.ts | `npx vitest run test/invariants.test.ts` | Tests 73 passed |

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1259 tests | ✅ |
| 解析、show、测试 agent 的测试通过 | `npm test -- test/backlog.test.ts ...` | exit 0, 91 tests | ✅ |
| 解析的两组新用例在 | `grep -qF ...` | exit 0 | ✅ |
| show 与提示词的新用例在 | `grep -qF ...` | exit 0 | ✅ |
| 测试 agent 不再拿条目 | `! grep ... \| grep ...` | exit 0 | ✅ |
| 不变量同步 | `grep -qE ...` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：backlog 解析情形与接口

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 情形标签各占一行，全角或半角冒号都认 | 条目 1 | `src/backlog.ts:30` — `const LABEL_SCENARIOS = new RegExp('^情形${COLON}$');` 使用 COLON 模式 | ✅ |
| 接口标签同上 | 条目 1 | `src/backlog.ts:31` — `const LABEL_INTERFACES = new RegExp('^接口${COLON}$');` | ✅ |
| 情形格式 `- <编号> [新\|保持] <文字>` | 条目 1 | `src/backlog.ts:43` — `const SCENARIO_LINE = /^[-*]\s+(?<sid>[A-Z]\d+)\s+\[(?<kind>新\|保持)\]\s+(?<text>.+)$/;` | ✅ |
| 续行与条目续行规则相同 | 条目 1 | `src/backlog.ts:452-456` — `CONTINUATION.test(line.text)` 检查缩进续行；`npx vitest run test/backlog.test.ts` 中 `joins indented continuation lines` Tests 20 passed | ✅ |
| 解析结果 `scenarios` 有 id/kind/text | 条目 1 | `src/schema/index.ts:181-186` — `ScenarioSchema = z.strictObject({ id, kind, text })` | ✅ |
| 解析结果 `interfaces` 为字符串数组 | 条目 1 | `src/schema/index.ts:201` — `z.array(z.string()).optional()` | ✅ |
| 没有对应小节时不出现键 | 条目 1 | `src/backlog.ts:601-603` — 条件赋值 `if (content.scenarios !== undefined) candidate.scenarios = content.scenarios;` ；用整对象比较的 fixture 测试（`matches the hand-written expectation including status`）未被改动仍通过 | ✅ |
| 编号重复拒绝并报行号 | 条目 1 | `src/backlog.ts:441-443` — `throw new BacklogError(source, line.no, batchId, 'duplicate scenario id ...');` | ✅ |
| 类别不对拒绝并报行号 | 条目 1 | `src/backlog.ts:457-462` — 匹配不到 SCENARIO_LINE 的 bullet 抛错 | ✅ |
| 格式不对拒绝并报行号 | 条目 1 | 同上 | ✅ |
| 有标签无情形拒绝并报行号 | 条目 1 | `src/backlog.ts:465-471` — `scenarios.length === 0` 检查 | ✅ |
| 无 [新] 拒绝并报行号 | 条目 1 | `src/backlog.ts:473-479` — `!scenarios.some(s => s.kind === 'new')` | ✅ |
| 同一节出现两次拒绝 | 条目 1 | `src/backlog.ts:409` — `once('scenarios', line.no, '情形');` / `src/backlog.ts:414` — `once('interfaces', line.no, '接口');` | ✅ |
| `collie show` 有情形时打印 | 条目 1 | `src/cli.ts:395-404` — 条件打印 scenarios 与 interfaces；`npx vitest run test/cli.test.ts` Tests 21 passed | ✅ |
| **（加粗行为）** 3 条情形解析正确 | 条目 1 | `npx vitest run test/backlog.test.ts` — `parses 2 [新] and 1 [保持] scenario with correct id, kind, and text` Tests 20 passed | ✅ |
| **（加粗行为）** 不带两节的批次无多出键 | 条目 1 | `npx vitest run test/backlog.test.ts` — `a batch without scenario/interface sections has no extra keys` Tests 20 passed | ✅ |

### 条目 2：测试 agent 只拿情形

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `TesterInputSchema` 去掉 `items`，换成 `scenarios`（非空，至少一条 `new`）和 `interfaces` | 条目 2 | `src/roles/tester.ts:23-29` — `z.strictObject({ batch_id, scenarios: z.array(ScenarioSchema).nonempty(), interfaces: z.array(z.string()), spec_paths, out_dir })` | ✅ |
| 严格对象，共五个字段 | 条目 2 | `src/roles/tester.ts:23` — `z.strictObject` 有 5 个键 | ✅ |
| 至少一条 `new` 验证 | 条目 2 | `src/roles/tester.ts:48` — `if (!parsed.data.scenarios.some((s: Scenario) => s.kind === 'new'))` | ✅ |
| 情形一节分「新行为」「必须保持」两组 | 条目 2 | `src/roles/tester.ts:70-80` — `### 新行为` / `### 必须保持` | ✅ |
| 编号与文字一字不改 | 条目 2 | `src/roles/tester.ts:73` — `\`- ${s.id} ${s.text}\`` 直接输出 | ✅ |
| 接口为空时写「（未指定）」 | 条目 2 | `src/roles/tester.ts:89` — `interfaceLines.push('（未指定）');` | ✅ |
| 通篇不出现「条目」二字 | 条目 2 | `grep -n '条目' src/roles/tester.ts` — 无输出 | ✅ |
| `new.test.ts` 与 `MAP.md` 总是列出 | 条目 2 | `src/roles/tester.ts:93-95` — 无条件加入 | ✅ |
| `keep.test.ts` 与自检命令只在有 keep 时出现 | 条目 2 | `src/roles/tester.ts:97-104` — `if (hasKeep)` 条件块 | ✅ |
| 自检最后加 `npm run lint` 与 `npm run typecheck` | 条目 2 | `src/roles/tester.ts:106-107` — `selfCheckCmds.push('npm run lint'); selfCheckCmds.push('npm run typecheck');` | ✅ |
| **（加粗行为）** 只有 [新] 时通篇不出现 `keep.test.ts` | 条目 2 | `npx vitest run test/tester.test.ts` — `only-new scenarios: prompt does not mention keep.test.ts anywhere` Tests 21 passed | ✅ |
| **（加粗行为）** 有 [保持] 时 keep.test.ts 和自检命令都在 | 条目 2 | `npx vitest run test/tester.test.ts` — `with keep scenarios: keep.test.ts and its self-check command are present` Tests 21 passed | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `test/backlog.test.ts` 新加 `describe('backlog: scenarios and interfaces', …)` | 条目 3 | `test/backlog.test.ts:148` — `describe('backlog: scenarios and interfaces', () => {` | ✅ |
| 含加粗情形、续行、两种冒号用例 | 条目 3 | `test/backlog.test.ts:189-190`（续行）, `test/backlog.test.ts:196-204`（全角冒号） | ✅ |
| `test/backlog-reject.test.ts` 新加 `describe('backlog: rejects malformed scenarios', …)` | 条目 3 | `test/backlog-reject.test.ts:199` — `describe('backlog: rejects malformed scenarios', () => {` | ✅ |
| 六种拒绝各一条 | 条目 3 | 6 个 `it(...)` 测试（duplicate id, bad kind, bad format, zero scenarios, no 新, duplicate section） | ✅ |
| **都断言报错里的行号** | 条目 3 | 仅前 3 条断言 `err.line`（行 232/240/248）；后 3 条（zero scenarios/no 新/duplicate section）**不断言 `err.line`** | ❌ |
| `test/cli.test.ts` 加 `show prints scenarios and interfaces when the batch has them` | 条目 3 | `test/cli.test.ts:84` — 完整用例 | ✅ |
| `test/tester.test.ts` 新加 `describe('tester: scenarios in the prompt', …)` | 条目 3 | `test/tester.test.ts:182` | ✅ |
| 含加粗两种情形、两组先后、接口为空、lint/typecheck | 条目 3 | 5 个用例覆盖所有场景 | ✅ |
| `matches the hand-written expectation including status` 不许改 | 条目 3 | `git diff -- test/backlog.test.ts` 显示 diff 起始于 line 146（新增代码），未修改现有测试 | ✅ |
| `validInput` 改 items→scenarios+interfaces | 条目 3 (允许改写 1) | `test/tester.test.ts:24-28` — 原 `items: [...]` 换成 `scenarios: [...]` 和 `interfaces: [...]` | ✅ |
| `accepts a valid input with exactly four fields` → 五个 | 条目 3 (允许改写 2) | `test/tester.test.ts:56` — `it('accepts a valid input with exactly five fields', …)` | ✅ |
| `includes items verbatim` → 情形文字一字不改 | 条目 3 (允许改写 3) | `test/tester.test.ts:85` — `it('includes scenario text verbatim', …)` | ✅ |
| `includes self-check vitest commands` → 按 keep/no-keep 分开 | 条目 3 (允许改写 4) | `test/tester.test.ts:107-130` — 拆成两个测试 | ✅ |
| **只许改写这四处** | 条目 3 | `includes output directory and the three file names`（原 `test/tester.test.ts`）**也被改写**：重命名为 `includes output directory and the file names`，删除 `expect(prompt).toContain('keep.test.ts')` 断言——此为第 5 处，不在允许列表 | ❌ |
| `test/invariants.test.ts` 加 tester.ts 不含 items 的不变量 | 条目 3 | `test/invariants.test.ts:579` — 新增用例 | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | 额外禁止 | `git diff --stat` 对受保护文件无输出 | ✅ |
| 改动禁止的源文件 | 额外禁止 | `git diff --stat` 对 src/run.ts 等无输出 | ✅ |
| 改变不带两节的批次的解析结果 | 额外禁止 | 整对象比较的 fixture 测试通过；条件赋值确保无多余键 | ✅ |
| 删除或跳过测试 | 额外禁止 | 无用例被删除或 skip | ✅ |
| 改写条目 3 点名之外的任何已有断言 | 额外禁止 | **违反**：`includes output directory and the three file names` 被改名、删除了 `keep.test.ts` 断言 | ❌ |
| 改注释或字面来通过验收命令 | 额外禁止 | 无此情况 | ✅ |
| 测试拉起真实 runner 或网络请求 | 额外禁止 | 新用例均使用 mock/fixture | ✅ |
| 新增依赖 | 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增用例（行 579-596），未修改任何现有数值上下限。

### 被改写或删去的断言

| 文件 | 用例名 | 原断言 | 现断言 | SPEC 仍有效？ |
|---|---|---|---|---|
| test/tester.test.ts | `includes items verbatim` → `includes scenario text verbatim` | `expect(prompt).toContain('exact item text here')` | `expect(prompt).toContain('exact scenario text here')` | 是，改为 scenarios（条目 3 允许改写 3） |
| test/tester.test.ts | `includes output directory and the three file names` → `includes output directory and the file names` | `expect(prompt).toContain('keep.test.ts')` **被删除** | 该断言不存在 | 是（keep.test.ts 仍应在有 keep 情形时出现），**但此改写不在条目 3 允许的四处之中** |
| test/tester.test.ts | `includes self-check vitest commands` → 拆为两个测试 | `expect(prompt).toContain('npx vitest run .../keep.test.ts')` | 移到新 keep 分支测试中 | 是（条目 3 允许改写 4） |

## 结论与理由

**FIX**。全部 8 条验收命令实跑通过，实现逻辑正确，代码质量好。但有两个具体缺口：

1. **改写了条目 3 未点名的第 5 处现有用例** — `test/tester.test.ts` 的 `includes output directory and the three file names` 被重命名并删除了 `expect(prompt).toContain('keep.test.ts')`。任务明确说"只许改写这四处"和"你发现还有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改"。Worker 应停下报告此冲突而非自行修改。这同时违反了额外禁止"改写条目 3 点名之外的任何已有断言"。

2. **6 条拒绝测试中有 3 条未断言 `err.line`** — 任务要求"都断言报错里的行号"。`rejects 情形 label with zero scenarios`、`rejects scenarios with no [新] kind`、`rejects duplicate 情形 section` 三条测试只断言了 `err.batchId` 和 `err.message`，未断言 `err.line`。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b04",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": ["f081e4347c2600b93030a9344cf51e3a6276227c"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "lint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "62 files, 1259 tests passed" },
      { "cmd": "npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts", "exit_code": 0, "summary": "4 files, 91 tests passed" },
      { "cmd": "grep -qF 'backlog: scenarios and interfaces' test/backlog.test.ts && grep -qF 'backlog: rejects malformed scenarios' test/backlog-reject.test.ts", "exit_code": 0, "summary": "both groups found" },
      { "cmd": "grep -qF 'show prints scenarios and interfaces when the batch has them' test/cli.test.ts && grep -qF 'tester: scenarios in the prompt' test/tester.test.ts", "exit_code": 0, "summary": "both groups found" },
      { "cmd": "! grep -vE '^\\s*(//|\\*|/\\*)' src/roles/tester.ts | grep -qE '\\bitems\\b'", "exit_code": 0, "summary": "no items in non-comment code" },
      { "cmd": "grep -qE 'roles/tester.*items|items.*roles/tester' test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [
    "改写了条目 3 未点名的第 5 处现有用例 `includes output directory and the three file names`（test/tester.test.ts）：重命名并删除 expect(prompt).toContain('keep.test.ts')。任务要求只许改写 4 处，发现冲突应停下报告，不应自行修改。同时违反额外禁止「改写条目 3 点名之外的任何已有断言」。应恢复原测试并在偏离或疑问中报告冲突，转 R1 扩充允许列表。",
    "test/backlog-reject.test.ts 的 6 条拒绝测试中，后 3 条（rejects 情形 label with zero scenarios / rejects scenarios with no [新] kind / rejects duplicate 情形 section）未断言 err.line。条目 3 要求「都断言报错里的行号」。需为这 3 条补上 expect(err.line).toBe(...) 断言。"
  ],
  "reason": "全部 8 条验收命令通过，实现逻辑与代码质量好，但 (1) 改写了条目 3 允许列表之外的第 5 处现有用例，违反「只许改写这四处」与额外禁止；(2) 6 条拒绝测试中 3 条缺少 err.line 断言。CI 以 R2 取证为准。"
}
```
