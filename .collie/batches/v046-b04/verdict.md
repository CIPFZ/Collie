I now have all the evidence I need. Let me compile the verdict.

# 批次 v046-b04 审核

## 取证过程

### 1. 提交事实

```
git log --format='%H %s' b7a901ea..f1b553ee -- . ':(exclude).collie/batches'
```

Worker 提交（取证范围内）：
- `f081e4347c2600b93030a9344cf51e3a6276227c` — schema: add scenarios/interfaces to batch parsing and tester input (SPEC 16.11)
- `f1b553eedd090a2ebe6763f42ae6c5cf5af1291d` — test: fix v046-b04 gaps — restore 5th test case and add err.line assertions

R2 基础设施提交（非 worker 产出，不计入评审）：
- `a4bef2a2627a2609ca9bf8e6ab38a8942fe79b6f` — task envelope
- `f482876ee200bc823e8c7d33f3298bb6a50be906` — report envelope
- `e93ad1fcea68db113f82e4e5db0bee712fe872e5` — progress: v046-b04 FIX
- `8e4b93baab0705ef53521ff590a725d774d31381` — task envelope (attempt 2)

### 2. 远端推送

`git ls-remote origin` 显示 HEAD 为 `9c3bbaf3...`，不含 head_sha `f1b553ee...`。这是 reviewer worktree，实际推送状态由 R2 取证。

### 3. CI

无 GitHub 凭据，无法查看 CI。`ci_conclusion: unknown`, `ci_branch_matched: null`。CI 以 R2 取证为准。

### 4. 受保护路径

```
git diff --stat b7a901ea..f1b553ee -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```

输出：`docs/progress.md | 20 +++`

**只有 `docs/progress.md` 被改，且改动出自 R2 的 `e93ad1f progress: v046-b04 FIX` 提交，不是 worker 的产出。** Worker 的两个提交 (`f081e43`, `f1b553ee`) 没有触碰任何受保护文件。spec_diff_lines = 0。

### 5. 额外禁止文件检查

```
git diff --stat b7a901ea..f1b553ee -- src/run.ts src/redcheck.ts src/roles/worker.ts src/roles/reviewer.ts 'src/runner/' src/arbiter.ts src/gate.ts src/evidence.ts src/view.ts src/follow.ts templates/collie.toml '.github/' eslint.config.js vitest.config.ts package.json
```

输出为空。全部禁止文件未被改动。✓

### 6. 依赖变化

```
git diff b7a901ea..f1b553ee -- package.json package-lock.json
```

输出为空。无依赖变化。✓

### 7. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | All matched files use Prettier code style! |
| 2 | `npm run typecheck` | 0 | tsc -p tsconfig.json (无错误) |
| 3 | `npm test` | 0 | 62 test files, 1259 passed, 0 failed |
| 4 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` | 0 | 4 files, 91 passed |
| 5 | `grep -qF "backlog: scenarios and interfaces" test/backlog.test.ts && grep -qF "backlog: rejects malformed scenarios" test/backlog-reject.test.ts` | 0 | — |
| 6 | `grep -qF "show prints scenarios and interfaces when the batch has them" test/cli.test.ts && grep -qF "tester: scenarios in the prompt" test/tester.test.ts` | 0 | — |
| 7 | `! grep -vE "^\s*(//\|\*\|/\*)" src/roles/tester.ts \| grep -qE "\bitems\b"` | 0 | — |
| 8 | `grep -qE "roles/tester.*items\|items.*roles/tester" test/invariants.test.ts` | 0 | — |

全部 8 条验收命令通过。

### 8. 上一轮缺口修复验证

**Gap 1（恢复第 5 处测试 `includes output directory and the three file names`）：**

`git diff f081e43..f1b553ee -- test/tester.test.ts` 确认：
- 测试名从 `includes output directory and the file names` 恢复为 `includes output directory and the three file names`
- `expect(prompt).toContain('keep.test.ts')` 断言重新加回
- `validInput()` 增加 `{ id: 'K1', kind: 'keep', text: 'keep this behavior' }` 使默认夹具含 keep 场景，恢复的断言可正确通过

对比 base (`b7a901ea`) 的原始第 5 个测试：代码完全一致。✓

**Gap 2（3 条拒绝测试补 err.line 断言）：**

`git diff f081e43..f1b553ee -- test/backlog-reject.test.ts` 确认三条 `expect(err.line).toBe(...)` 被添加：
- `rejects 情形 label with zero scenarios` → `expect(err.line).toBe(lineOf(text, '情形：'))`
- `rejects scenarios with no [新] kind` → `expect(err.line).toBe(lineOf(text, '情形：'))`
- `rejects duplicate 情形 section` → `expect(err.line).toBe(lineOf(text, '- S2 [新] 功能 B') - 1)`

全部 6 条拒绝测试现在都断言了行号。✓

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1259 passed | ✅ |
| 解析、show、测试 agent 的测试通过 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` | exit 0, 91 passed | ✅ |
| 解析的两组新用例在 | `grep -qF ...` | exit 0 | ✅ |
| show 与提示词的新用例在 | `grep -qF ...` | exit 0 | ✅ |
| 测试 agent 不再拿条目 | `! grep ... \| grep ...` | exit 0 | ✅ |
| 不变量同步 | `grep -qE ...` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：backlog 解析情形与接口

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 标签 `情形` 识别，全角/半角冒号都认 | 条目 1 | `src/backlog.ts:30` — `const LABEL_SCENARIOS = new RegExp(\`^情形${COLON}$\`)`；测试 `test/backlog.test.ts:150-159` 两种冒号都过：`npx vitest run test/backlog.test.ts` → Tests 20 passed | ✅ |
| 标签 `接口` 识别 | 条目 1 | `src/backlog.ts:31` — `const LABEL_INTERFACES = new RegExp(\`^接口${COLON}$\`)` | ✅ |
| 情形格式 `- <id> [新\|保持] <text>`，编号大写字母+数字 | 条目 1 | `src/backlog.ts:43` — `const SCENARIO_LINE = /^[-*]\s+(?<sid>[A-Z]\d+)\s+\[(?<kind>新\|保持)\]\s+(?<text>.+)$/` | ✅ |
| 解析结果 `scenarios` 含 id/kind/text | 条目 1 | `src/schema/index.ts:181-186` — ScenarioSchema 有 `id`, `kind`, `text`；`src/backlog.ts:454` — `scenarios.push({ id: sid, kind, text: scenarioText })` | ✅ |
| 解析结果 `interfaces` 为字符串数组 | 条目 1 | `src/schema/index.ts:201` — `interfaces: z.array(z.string()).optional()` | ✅ |
| 续行与条目续行规则相同 | 条目 1 | `src/backlog.ts:455-459` — `CONTINUATION.test(line.text)` 判断续行并追加到 `last.text`；测试 `test/backlog.test.ts:142-148` 验证续行用 `\n` 合并 | ✅ |
| 没有对应小节时不出现键 | 条目 1 | `src/backlog.ts:596-597` — `if (content.scenarios !== undefined)` / `if (content.interfaces !== undefined)` 条件性赋值；测试 `test/backlog.test.ts:161-169` — `expect('scenarios' in (batch as object)).toBe(false)` / `expect('interfaces' in (batch as object)).toBe(false)` | ✅ |
| 拒绝编号重复 | 条目 1 | `src/backlog.ts:449-450` — `throw new BacklogError(... 'duplicate scenario id')`；测试 `test/backlog-reject.test.ts:226-230` 断言行号 | ✅ |
| 拒绝非法类别 | 条目 1 | `src/backlog.ts:461-466` — 格式不匹配 bullet 时抛出；测试 `test/backlog-reject.test.ts:232-237` | ✅ |
| 拒绝格式不符 | 条目 1 | 同上，`test/backlog-reject.test.ts:239-244` | ✅ |
| 拒绝有标签但零条 | 条目 1 | `src/backlog.ts:472-478` — `scenarios.length === 0` 检查；测试 `test/backlog-reject.test.ts:246-252` 断言行号 | ✅ |
| 拒绝无 [新] | 条目 1 | `src/backlog.ts:479-485` — `!scenarios.some(s => s.kind === 'new')` 检查；测试 `test/backlog-reject.test.ts:254-260` 断言行号 | ✅ |
| 拒绝同一节出现两次 | 条目 1 | `src/backlog.ts:409` — `once('scenarios', ...)` 使用 `once` 函数；测试 `test/backlog-reject.test.ts:262-269` 断言行号 | ✅ |
| `collie show` 有情形时打印 | 条目 1 | `src/cli.ts:395-403` — 条件性打印 scenarios 和 interfaces；测试 `test/cli.test.ts:83-125` | ✅ |
| **加粗：2 [新] + 1 [保持] + 2 接口** | 条目 1 | `npx vitest run test/backlog.test.ts` → Tests 20 passed；测试 `test/backlog.test.ts:126-133`：`expect(batch?.scenarios).toHaveLength(3)` 且逐条验证 id/kind/text | ✅ |
| **加粗：不带两节的批次不多出键** | 条目 1 | 测试 `test/backlog.test.ts:161-169`：`expect('scenarios' in (batch as object)).toBe(false)` | ✅ |

### 条目 2：测试 agent 只拿情形

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `TesterInputSchema` 去掉 `items`，换成 `scenarios` + `interfaces` | 条目 2 | `src/roles/tester.ts:23-29` — `z.strictObject` 有 batch_id, scenarios, interfaces, spec_paths, out_dir 共 5 个字段；无 items | ✅ |
| `scenarios` 非空，至少一条 `new` | 条目 2 | `src/roles/tester.ts:25` — `.nonempty()`；`src/roles/tester.ts:48` — `!parsed.data.scenarios.some(s => s.kind === 'new')` 额外检查 | ✅ |
| `interfaces` 可以为空数组 | 条目 2 | `src/roles/tester.ts:26` — `z.array(z.string())` 无 `.nonempty()` | ✅ |
| 严格对象，共五个字段 | 条目 2 | `src/roles/tester.ts:23` — `z.strictObject` | ✅ |
| 提示词「情形」分「新行为」「必须保持」两组 | 条目 2 | `src/roles/tester.ts:71` — `### 新行为`；`src/roles/tester.ts:76` — `### 必须保持` | ✅ |
| 编号与文字一字不改 | 条目 2 | `src/roles/tester.ts:73` — `\`- ${s.id} ${s.text}\`` 直接拼接；测试 `test/tester.test.ts:86-93` 验证 verbatim | ✅ |
| 「接口」节为空时写「（未指定）」 | 条目 2 | `src/roles/tester.ts:89` — `interfaceLines.push('（未指定）')`；测试 `test/tester.test.ts:236-239` | ✅ |
| 通篇不出现「条目」二字 | 条目 2 | `grep '条目' src/roles/tester.ts` → 无匹配 | ✅ |
| `new.test.ts` 与 `MAP.md` 总是列出 | 条目 2 | `src/roles/tester.ts:93-95` — 总是在 outputFiles 中 | ✅ |
| `keep.test.ts` 只在有 keep 时出现 | 条目 2 | `src/roles/tester.ts:97-98` — `if (hasKeep)` 条件；测试 `test/tester.test.ts:109-123` 验证只有 new 时 prompt 不含 keep.test.ts | ✅ |
| 自检命令末尾加 lint 和 typecheck | 条目 2 | `src/roles/tester.ts:106-107` — `selfCheckCmds.push('npm run lint')` 和 `selfCheckCmds.push('npm run typecheck')`；测试 `test/tester.test.ts:241-245` | ✅ |
| **加粗：只有 [新] 时 keep.test.ts 通篇不出现** | 条目 2 | 测试 `test/tester.test.ts:194-206`：`expect(prompt).not.toContain('keep.test.ts')`；`npx vitest run test/tester.test.ts` → Tests 21 passed | ✅ |
| **加粗：有 [保持] 时 keep.test.ts 和自检命令都在** | 条目 2 | 测试 `test/tester.test.ts:208-219`：`expect(prompt).toContain('keep.test.ts')` 和 `toContain('npx vitest run .../keep.test.ts')`；`npx vitest run test/tester.test.ts` → Tests 21 passed | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `test/backlog.test.ts` 新加组 `describe('backlog: scenarios and interfaces', …)` | 条目 3 | `test/backlog.test.ts:148` — `describe('backlog: scenarios and interfaces', () => {`；`npx vitest run test/backlog.test.ts` → Tests 20 passed | ✅ |
| `test/backlog-reject.test.ts` 新加组 `describe('backlog: rejects malformed scenarios', …)` | 条目 3 | `test/backlog-reject.test.ts:197` — `describe('backlog: rejects malformed scenarios', () => {`；`npx vitest run test/backlog-reject.test.ts` → Tests 29 passed | ✅ |
| 6 种拒绝各一条，都断言行号 | 条目 3 | 重复编号(226)、非法类别(232)、格式不符(239)、零条(246)、无新(254)、重复节(262)——全部有 `expect(err.line).toBe(...)` | ✅ |
| `test/cli.test.ts` 加 `show prints scenarios and interfaces when the batch has them` | 条目 3 | `test/cli.test.ts:83`；`npx vitest run test/cli.test.ts` → Tests 21 passed | ✅ |
| `test/tester.test.ts` 新加组 `describe('tester: scenarios in the prompt', …)` | 条目 3 | `test/tester.test.ts:193`；`npx vitest run test/tester.test.ts` → Tests 21 passed | ✅ |
| `matches the hand-written expectation including status` 不许改 | 条目 3 | `test/backlog.test.ts:105-112` — 未在 diff 中，完整保留 | ✅ |
| validInput 夹具改写（允许） | 条目 3 | 原：`items: ['item 1: do something', 'item 2: do another thing']` → 现：`scenarios: [{S1,new,...},{S2,new,...},{K1,keep,...}], interfaces: [...]` | ✅ |
| "four fields" → "five fields"（允许） | 条目 3 | 原断言：test name `accepts a valid input with exactly four fields` → 现：`exactly five fields`；`expect(result.success).toBe(true)` 不变 | ✅ |
| "includes items verbatim" → 改名（允许） | 条目 3 | 原：`includes items verbatim`, `items: ['exact item text here']`, `toContain('exact item text here')` → 现：`includes scenario text verbatim`, `scenarios: [{id:'S1',kind:'new',text:'exact scenario text here'}]`, `toContain('exact scenario text here')` | ✅ |
| "includes self-check vitest commands" 分开断言（允许） | 条目 3 | 原：单个测试断言 new + keep → 现：两个测试分别断言 only-new（不含 keep.test.ts）和 with-keep（含 keep.test.ts） | ✅ |
| 不许改写点名之外的断言 | 条目 3 | `git diff b7a901ea..f1b553ee -- test/tester.test.ts`：仅上述 4 处被改、1 处新增 describe 组；第 5 处（`includes output directory and the three file names`）在 fix 提交中恢复至原始形态，代码与 base 逐行一致 | ✅ |
| `test/invariants.test.ts` 加 items 不变量 | 条目 3 | `test/invariants.test.ts:579-596` — 新增 `src/roles/tester.ts non-comment lines do not contain items` | ✅ |

### 额外禁止

| 禁止项 | 证据 | 满足 |
|---|---|---|
| 不改受保护路径 | worker 两个提交无受保护文件改动 | ✅ |
| 不改 `src/run.ts` 等列出的文件 | `git diff --stat` 检查空输出 | ✅ |
| 不改变不带两节的批次解析结果 | `src/backlog.ts:596-597` 条件赋值；测试 `test/backlog.test.ts:161-169` 验证无多余键 | ✅ |
| 不删除或跳过测试 | diff 仅新增和改写 4 处允许项 | ✅ |
| 不改写点名之外的已有断言 | 仅改写 4 处允许项，第 5 处已恢复 | ✅ |
| 不为验收命令改注释/字面 | 无此类改动 | ✅ |
| 不拉起真实 runner/网络请求 | 测试用 FakeRunner 和内存夹具 | ✅ |
| 不新增依赖 | package.json 未改 | ✅ |

### 不变量数值变化

`git diff` 中 `test/invariants.test.ts` 仅新增一条测试（`src/roles/tester.ts non-comment lines do not contain items`），无现有数值上下限的改动。→ 无

### 被改写或删去的断言

test/tester.test.ts 中 4 处被改写（全部在允许列表内）：

| 原测试名 | 原断言 | 现断言 | SPEC 有效性 |
|---|---|---|---|
| `validInput` 夹具 | `items: [...]` | `scenarios: [...], interfaces: [...]` | 对应 SPEC 16.11 迁移，原 items 字段在 TesterInput 中已不存在 |
| `accepts a valid input with exactly four fields` | test name 含 "four" | test name 含 "five" | SPEC 16.11 新增 interfaces 字段，共 5 个 |
| `includes items verbatim` | `toContain('exact item text here')` + items 入参 | `toContain('exact scenario text here')` + scenarios 入参 | SPEC 16.11 迁移 |
| `includes self-check vitest commands` | 单测试含 new+keep 的 toContain | 拆成 2 个测试，分别断言 only-new（not.toContain keep）和 with-keep（toContain keep） | SPEC 16.11 keep.test.ts 仅在有 keep 时出现 |

无删除的用例。第 5 处 `includes output directory and the three file names` 在修复提交中完全恢复，与 base 逐行一致。

## 结论与理由

**PASS**。全部 8 条验收命令实跑通过。上一轮两个缺口（恢复第 5 处测试、3 条拒绝测试补 err.line 断言）均已正确修复。解析逻辑（scenarios/interfaces 条件性出现、6 种拒绝带行号）、tester prompt（情形分两组、接口为空时「未指定」、keep.test.ts 条件出现、自检命令含 lint+typecheck、通篇无「条目」）、`collie show` 打印情形与接口，全部在代码层面和测试层面验证通过。无受保护文件被 worker 修改，无额外禁止文件被触碰，无新增依赖，测试修改严格限于 4 处允许范围。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b04",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "f081e4347c2600b93030a9344cf51e3a6276227c",
      "f1b553eedd090a2ebe6763f42ae6c5cf5af1291d"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "All matched files use Prettier code style!" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc -p tsconfig.json, no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "62 test files, 1259 passed, 0 failed" },
      { "cmd": "npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts", "exit_code": 0, "summary": "4 files, 91 passed" },
      { "cmd": "grep -qF 'backlog: scenarios and interfaces' test/backlog.test.ts && grep -qF 'backlog: rejects malformed scenarios' test/backlog-reject.test.ts", "exit_code": 0, "summary": "both groups found" },
      { "cmd": "grep -qF 'show prints scenarios and interfaces when the batch has them' test/cli.test.ts && grep -qF 'tester: scenarios in the prompt' test/tester.test.ts", "exit_code": 0, "summary": "both groups found" },
      { "cmd": "! grep -vE '^\\s*(//|\\*|/\\*)' src/roles/tester.ts | grep -qE '\\bitems\\b'", "exit_code": 0, "summary": "no non-comment items in tester.ts" },
      { "cmd": "grep -qE 'roles/tester.*items|items.*roles/tester' test/invariants.test.ts", "exit_code": 0, "summary": "invariant test present" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 8 acceptance commands pass. Both gaps from previous FIX round correctly resolved: 5th test case restored to original form (verified identical to base), 3 reject tests now assert err.line. No protected files modified by worker, no prohibited files touched, no dependency changes. All structural and behavioral requirements verified via code inspection and test execution. CI status unknown — to be verified by R2."
}
```
