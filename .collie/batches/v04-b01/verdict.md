I now have all the evidence I need. Let me compile the final verdict.

---

# 批次 v04-b01 审核

## 取证过程

### 1. 提交与推送确认

```
git log --oneline 0fdc3f9..e0dcdcf
e0dcdcf test: add journal-fields test and invariants for SPEC 13.1 events
89288a6 schema: add SPEC 13.1 observability fields to runner, events, and journal
7600a4c gate: remove duplicate protectedDiffLines condition, update README status
7a7d6fd docs: issue v04-b01 task envelope
```

```
git branch -r --contains e0dcdcfb4469ad135b163ea1ed8c4ccbfff9c0e0
  origin/HEAD -> origin/main
  origin/main
```

head commit 已在 `origin/main` 上。

### 2. 受保护路径变更

```
git diff --stat 0fdc3f9..e0dcdcf -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空，**0 行变更**。

### 3. 依赖变更

```
git diff 0fdc3f9..e0dcdcf -- package.json package-lock.json
```
输出为空，**无依赖变更**。

### 4. SCHEMA_VERSION 检查

```
git diff 0fdc3f9..e0dcdcf -- src/schema/index.ts | grep -E '^[+-].*SCHEMA_VERSION'
→ No SCHEMA_VERSION changes
```

### 5. 验收命令逐条实跑

| # | 命令 | 退出码 | 实测输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | All matched files use Prettier code style! |
| 2 | `npm run typecheck` | 0 | tsc -p tsconfig.json（无输出） |
| 3 | `npm test` | 0 | 40 files passed, 826 tests passed, 13.96s |
| 4 | `! cat src/gate.ts src/run.ts test/gate.test.ts \| grep -vE "^\s*(//\|\*\|/\*)" \| grep -qE "protectedDiffLines"` | 0 | 无匹配（已删除） |
| 5 | `! grep -qE "实现未开始\|25 条" README.md && grep -qE "26 条" README.md` | 0 | 通过 |
| 6 | `npm test -- test/journal-fields.test.ts` | 0 | 1 file, 9 tests passed |
| 7 | `grep -cE "^\s+it\(" test/journal-fields.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | 0 | 计数=9，满足≥6 |
| 8 | `grep -qE "reviewer\.finished" src/schema/index.ts && grep -qE "evidence\.collected" src/schema/index.ts` | 0 | 两个均匹配 |
| 9 | `grep -qE "total_cost_usd" src/runner/claude.ts && grep -qE "total_cost_usd" test/runner-claude.test.ts` | 0 | 两个均匹配 |
| 10 | `grep -qE "evidence\.collected" test/invariants.test.ts` | 0 | 匹配 |

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 826 tests | ✅ |
| 判定第 6 项已删 | 见上 #4 | exit 0 | ✅ |
| README 改成现状 | 见上 #5 | exit 0 | ✅ |
| 新字段专项测试通过 | `npm test -- test/journal-fields.test.ts` | exit 0, 9 tests | ✅ |
| 专项测试不少于 6 个 | `grep -cE` | 9 ≥ 6 | ✅ |
| 两个新事件进 schema | 见上 #8 | exit 0 | ✅ |
| 花费取自 SDK 且有测试 | 见上 #9 | exit 0 | ✅ |
| 不变量同步 | 见上 #10 | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：清理

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `gate.ts` 删掉 `protectedDiffLines` 字段 | task.md L21 | `src/gate.ts` 全文无 `protectedDiffLines`（grep 无匹配） | ✅ |
| `gate.ts` 删掉原因码 `protected` | task.md L21 | `src/gate.ts:49-71` — 只有 6 条 reasons，无 `'protected'` | ✅ |
| 判定共六项 | task.md L21 | `src/gate.ts:39` — "evaluates the six" | ✅ |
| `run.ts` 调用处同步 | task.md L21 | `src/run.ts` 无 `protectedDiffLines`（grep 无匹配） | ✅ |
| `test/gate.test.ts` 同步 | task.md L21 | `test/gate.test.ts` 无 `protectedDiffLines`（grep 无匹配） | ✅ |
| README 状态行改成现状 | task.md L22 | `README.md:9` — "v0.3 功能批次已完成，v0.4 进行中" | ✅ |
| 铁律条数改 26 | task.md L22 | `README.md:56` — "26 条全局铁律" | ✅ |

### 条目 2：运行级数据进 journal（SPEC 13.1）

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| `worker.finished` 加 `num_turns`/`cost_usd`/`duration_ms`/`usage` | task.md L23, SPEC 13.1 L946 | `src/run.ts:1342-1355`（条件展开四个字段，含 usage 子字段） | ✅ |
| 新增 `reviewer.finished`（reviewer 返回后、解析 verdict 前） | task.md L24, SPEC 13.1 L948 | `src/run.ts:1449-1469`（在 `persistVerdict` 之前记录） | ✅ |
| `worker.started` 加 `model` | task.md L24, SPEC 13.1 L949 | `src/run.ts:1162` — `{ model: config.agent.worker.model }` | ✅ |
| `reviewer.started` 加 `model` | task.md L24, SPEC 13.1 L949 | `src/run.ts:1421-1424` — `model: config.agent.reviewer.model` | ✅ |
| `RunResult` 加 `numTurns?`/`costUsd?`/`durationMs?` | task.md L25, SPEC 13.1 L950 | `src/runner/index.ts:77-81` | ✅ |
| `Usage` 加两个可选缓存字段 | task.md L25, SPEC 13.1 L950 | `src/runner/index.ts:10-13` — `cacheCreationInputTokens?`, `cacheReadInputTokens?` | ✅ |
| `claude.ts` 从 SDK 结果取值 | task.md L25, SPEC 13.1 L950 | `src/runner/claude.ts:191-194`（`total_cost_usd`/`num_turns` 在 `ResultMessage`），`src/runner/claude.ts:479-484`（映射到 `RunResult`） | ✅ |
| 类型从 SDK 导出派生 | task.md L25, SPEC 13.1 L950-951 | `src/runner/claude.ts:177` — `ResultMessage` 接口注释 "narrowed locally so nothing leaks out"，字段名直接对应 SDK 的 snake_case | ✅ |
| fake runner 可脚本化这些值 | task.md L25, SPEC 13.1 L951 | `src/runner/fake.ts:187` — `return { ...scene.result }`，`RunResult` 含新字段即可透传；`test/journal-fields.test.ts:25-35` 实测脚本化 | ✅ |
| runner 没给的字段不写 | task.md L25, SPEC 13.1 L944 | `src/run.ts:1342-1355` — 每个字段用 `result.X !== undefined ? {...} : {}` 条件展开 | ✅ |

**行为验证（实跑测试）：**

| 行为要求 | 测试文件 | 实跑命令与结果 |
|---|---|---|
| runner 提供 usage 时所有字段出现在 journal | `test/journal-fields.test.ts` (Group 1, 7 tests) | `npx vitest run test/journal-fields.test.ts` → Tests 9 passed |
| runner 不提供 usage 时字段不存在 | `test/journal-fields.test.ts` (Group 2, 2 tests) | 同上，Tests 9 passed |
| claude.ts 正确提取 total_cost_usd / num_turns | `test/runner-claude.test.ts` | `npx vitest run test/runner-claude.test.ts` → Tests 67 passed |
| gate 变为六项条件 | `test/gate.test.ts` | `npx vitest run test/gate.test.ts` → Tests 10 passed |

### 条目 3：批次级与裁定依据

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 新增 `evidence.collected` | task.md L26, SPEC 13.1 L952 | `src/run.ts:1551-1562`（字段 commits/tests_passed/tests_failed/acceptance_passed/acceptance_total/spec_diff_lines/deps_diff/remote_has_head） | ✅ |
| `run.finished` 加 `rule`/`reason` | task.md L26, SPEC 13.1 L954 | `src/run.ts:997-1001`（reason 截断至 500 字） | ✅ |
| `reviewer.verdict` 加 `gaps` | task.md L26, SPEC 13.1 L955 | `src/run.ts:1472-1483`（至多 20 条，每条截断至 300 字） | ✅ |
| 新建 `test/journal-fields.test.ts` | task.md L27 | 文件存在，172 行，9 个 `it()` | ✅ |
| 用 fake runner 跑完整一轮 | task.md L27 | `test/journal-fields.test.ts:48` — `await box.run(new FakeRunner([worker, reviewer]))` | ✅ |
| 断言每个新字段出现在 journal 里 | task.md L27 | 7 个 it() 在 Group 1 断言 model/num_turns/cost_usd/duration_ms/usage/evidence.collected/rule/reason | ✅ |
| 断言 runner 不给用量时字段不存在 | task.md L27 | 2 个 it() 在 Group 2 断言 not.toHaveProperty | ✅ |
| `test/invariants.test.ts` 加 `evidence.collected` 与 `reviewer.finished` | task.md L28 | `test/invariants.test.ts:286-290` | ✅ |
| `test/invariants.test.ts` 加 `gate.ts` 不含 `protectedDiffLines` | task.md L28 | `test/invariants.test.ts:292-295` | ✅ |

**行为验证（实跑测试）：**

| 行为要求 | 测试文件 | 实跑命令与结果 |
|---|---|---|
| evidence.collected 字段出现 | `test/journal-fields.test.ts` | `npx vitest run test/journal-fields.test.ts` → Tests 9 passed |
| run.finished 含 rule/reason | `test/journal-fields.test.ts` | 同上 |
| 新事件正确注册到 EVENT_TYPES | `test/schema.test.ts` | `npx vitest run test/schema.test.ts` → Tests 72 passed |
| exit-codes 事件序列含新事件 | `test/exit-codes.test.ts` | `npx vitest run test/exit-codes.test.ts` → Tests 29 passed |
| 结构不变量 | `test/invariants.test.ts` | `npx vitest run test/invariants.test.ts` → Tests 36 passed |

### 额外禁止核对

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | task.md L47 | `git diff --stat` 对受保护路径输出为空 | ✅ |
| 为了让测试过而删除或跳过测试 | task.md L48 | 只删除了 `test/gate.test.ts` 中 `protected` 测试用例（条目 1 允许） | ✅ |
| 为了让验收命令通过而改注释或字面 | task.md L49 | 注释变更只是 "seven→six" 等与实质改动同步的表述更新 | ✅ |
| 改动规则 1~10 | task.md L50 | diff 未触及仲裁规则逻辑 | ✅ |
| 改动队列逻辑 | task.md L50 | 队列逻辑未变更（只在 gateInput 构造处删除了 `protectedDiffLines`） | ✅ |
| 改动 SCHEMA_VERSION | task.md L50 | `git diff` 确认无 SCHEMA_VERSION 变更行 | ✅ |
| 新增依赖 | task.md L50 | `package.json` / `package-lock.json` 无变更 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 10 条验收命令实跑通过。三个条目的所有结构要求与行为要求均已满足：

- 条目 1：`protectedDiffLines` 从 `gate.ts`/`run.ts`/`test/gate.test.ts` 完全移除，判定条件从 7 项降至 6 项，README 状态行和铁律条数已更新。
- 条目 2：`worker.finished` 新增四组运行级字段，新增 `reviewer.finished` 事件（位于 verdict 解析前），`worker.started`/`reviewer.started` 携带 `model`。`RunResult`/`Usage` 已扩展，`claude.ts` 从 SDK 的 `total_cost_usd`/`num_turns` 取值，fake runner 透传 `scene.result`，runner 缺字段时用条件展开不写。
- 条目 3：新增 `evidence.collected` 含 8 个摘要字段，`run.finished` 追加 `rule`/`reason`（reason 截断至 500），`reviewer.verdict` 追加 `gaps`（至多 20 条×300 字）。`test/journal-fields.test.ts` 有 9 个测试用例覆盖正反两组。不变量测试已补充。

无受保护文件变更、无新增依赖、无 SCHEMA_VERSION 变更、无规则逻辑变更。提交已推送至 `origin/main`。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b01",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "7a7d6fd70cec1205558e51808f854a67f2460416",
      "7600a4c6ca44043248fb252da31b817878e0d9d2",
      "89288a6377921144297bf96684874b6da4c47bdf",
      "e0dcdcfb4469ad135b163ea1ed8c4ccbfff9c0e0"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "40 files, 826 tests passed" },
      { "cmd": "! cat src/gate.ts src/run.ts test/gate.test.ts | grep -vE \"^\\s*(//|\\*|/\\*)\" | grep -qE \"protectedDiffLines\"", "exit_code": 0, "summary": "protectedDiffLines absent from non-comment code" },
      { "cmd": "! grep -qE \"实现未开始|25 条\" README.md && grep -qE \"26 条\" README.md", "exit_code": 0, "summary": "README status updated" },
      { "cmd": "npm test -- test/journal-fields.test.ts", "exit_code": 0, "summary": "9 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/journal-fields.test.ts | grep -qE \"^([6-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "9 test cases >= 6" },
      { "cmd": "grep -qE \"reviewer\\.finished\" src/schema/index.ts && grep -qE \"evidence\\.collected\" src/schema/index.ts", "exit_code": 0, "summary": "both event types in schema" },
      { "cmd": "grep -qE \"total_cost_usd\" src/runner/claude.ts && grep -qE \"total_cost_usd\" test/runner-claude.test.ts", "exit_code": 0, "summary": "cost field in source and test" },
      { "cmd": "grep -qE \"evidence\\.collected\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "All 10 acceptance commands pass. Three items fully implemented per SPEC 13.1: gate cleanup (6 conditions), running-level journal fields with conditional omission, batch-level evidence.collected and ruling fields. No protected files changed, no new dependencies, SCHEMA_VERSION unchanged. CI 以 R2 取证为准。"
}
```
