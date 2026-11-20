I now have all the evidence I need. Let me compile the verdict.

---

# 批次 v046-b18 审核

## 取证过程

### 1. 受保护文件

```
git diff --stat 08f35501..d6571e1b -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance
```
输出为空——无受保护文件被修改。

Worker 是否动了 `test/acceptance`：
```
git log --format='%h %s' 08f35501..d6571e1b -- test/acceptance
```
输出为空——未触碰。

### 2. 依赖变化

```
git diff 08f35501..d6571e1b -- package.json package-lock.json
```
输出为空——无依赖变化。

### 3. 不变量数值变化

```
git diff 08f35501..d6571e1b -- test/invariants.test.ts
```
输出为空——无。

### 4. 被改写或删去的断言

diff 中 `test/task-envelope.test.ts` 的变化全部是在第 186 行（原有 describe 块末尾 `});` 之前）新增 55 行，包含两个新的 `it` 用例。没有删除或修改任何已有断言行。无。

### 5. 提交事实

```
git rev-parse d6571e1bcbd945bc680f130d5ed8820d6d3b5785
→ d6571e1bcbd945bc680f130d5ed8820d6d3b5785

git merge-base --is-ancestor d6571e1b a5e45bf4 → YES (remote main = a5e45bf, report commit在其后)
```
提交存在且已推送至远端。

### 6. 验收命令逐条实跑

**命令 1: `npm run lint`**
退出码 0。输出：`All matched files use Prettier code style!`

**命令 2: `npm run typecheck`**
退出码 0。输出：`tsc -p tsconfig.json`（无错误）

**命令 3: `npm test`**
退出码 0。输出：`Test Files 67 passed (67) / Tests 1402 passed (1402)`

**命令 4: `npm test -- test/task-envelope.test.ts test/worker.test.ts`**
退出码 0。输出：`Test Files 2 passed (2) / Tests 200 passed (200)`

**命令 5: `grep -qE "本批次情形" src/roles/worker.ts && grep -qE "本批次接口" src/roles/worker.ts`**
退出码 0。

### 7. CI

无 GitHub 凭据，查不到 CI 状态。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, all files pass | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, no errors | ✅ |
| 全部测试通过 | `npm test` | exit 0, 67 files / 1402 tests passed | ✅ |
| 任务书与 worker 的测试通过 | `npm test -- test/task-envelope.test.ts test/worker.test.ts` | exit 0, 2 files / 200 tests passed | ✅ |
| 带情形时任务书有两节，不带情形时逐字不变 | `grep -qE "本批次情形" src/roles/worker.ts && grep -qE "本批次接口" src/roles/worker.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 批次有情形时，task.md 在「条目」之后、「验收标准」之前多「本批次情形」节 | 条目 1 | `src/roles/worker.ts:108-115`：`result.push(['## 本批次情形', '', ...batch.scenarios.map(...)].join('\n'))` 在 `renderScenarioSections` 中生成；`src/roles/worker.ts:152`：`...scenarioSections` 散布在 items 和 acceptance 之间 | ✅ |
| 情形格式为 `- <编号> [新\|保持] <文字>` | 条目 1 | `src/roles/worker.ts:113`：`` listItem('-', `${s.id} [${scenarioKindLabel(s.kind)}] ${s.text}`) ``；`src/roles/worker.ts:94-95`：`scenarioKindLabel` 映射 `'new'→'新'`, `'keep'→'保持'` | ✅ |
| 「本批次接口」有接口才出现 | 条目 1 | `src/roles/worker.ts:119`：`if (batch.interfaces !== undefined && batch.interfaces.length > 0)` | ✅ |
| 写明验收测试不能改 | 条目 1 | `src/roles/worker.ts:134-136`：`` acceptanceNote = `\n\n\`test/acceptance/${batch.id}/\` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。` `` | ✅ |
| 不带情形时 task.md 逐字不变 | 条目 1 | `src/roles/worker.ts:104`：`renderScenarioSections` 返回 `[]` 当无 scenarios；`src/roles/worker.ts:130`：`hasScenarios` 为 false 时 `acceptanceNote` 为 `''`；spread `[]` 和追加 `''` 不改变输出 | ✅ |

### 条目 1 行为要求（实跑测试）

| 要求 | 测试 | 实跑证据 | 满足 |
|---|---|---|---|
| 带 2 情形、1 接口：渲染出情形两条、接口一条、验收测试不能改那句 | `test/task-envelope.test.ts` "renders 本批次情形 and 本批次接口 when batch has scenarios" | `npx vitest run test/task-envelope.test.ts` → `Tests 182 passed` | ✅ |
| 不带情形：渲染结果和现在逐字节相同 | `test/task-envelope.test.ts` "without scenarios, task body is byte-for-byte identical" | 同上 182 passed | ✅ |

### 条目 2 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新加用例覆盖有情形的情形 | 条目 2 | `test/task-envelope.test.ts:190-221`：新用例用 2 scenarios + 1 interface，断言 section order、情形格式、接口内容、保护说明 | ✅ |
| 新加用例覆盖无情形逐字不变 | 条目 2 | `test/task-envelope.test.ts:223-243`：新用例用 v01-b01（无 scenarios），断言不含情形/接口节、heading 列表不变 | ✅ |
| 现有 `has the SPEC 3.3 section order` 不许改 | 条目 2 | diff 中 `test/task-envelope.test.ts` 变化全在 +189 行后，原 177-188 行完全未改 | ✅ |
| 已有断言一条都不改 | 条目 2 | diff 只有纯增（55 行 `+`，0 行 `-` 在 test 文件中） | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | 额外禁止 | `git diff --stat` 对受保护路径输出为空 | ✅ |
| 改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | diff stat 只含 `src/roles/worker.ts` 和 `test/task-envelope.test.ts` | ✅ |
| 改动 `src/run.ts`、`src/acceptance.ts` 等列出的文件 | 额外禁止 | 同上，只改了 `src/roles/worker.ts` 和 `test/task-envelope.test.ts` | ✅ |
| 改变不带情形的批次的任务书 | 额外禁止 | 代码分析：无 scenarios 时 `renderScenarioSections` 返回 `[]`、`acceptanceNote` 为 `''`，输出不变；且全部现有批次（都无情形）的 round-trip 测试通过 | ✅ |
| 在这一步校验情形、拉起谁、改任何判定 | 额外禁止 | diff 只涉及 `renderBody` 的渲染，无判定逻辑变化 | ✅ |
| 删除或跳过任何测试 | 额外禁止 | diff 无删除行；测试数从 182 保持到 182（task-envelope 文件原有用例 + 2 个新用例） | ✅ |
| 改注释或字面为了验收命令通过 | 额外禁止 | 验收命令 5 的 grep 匹配到的是功能代码中的字符串字面（`'## 本批次情形'`、`'## 本批次接口'`），这正是实现本身 | ✅ |
| 测试里拉起真实 runner 或真实网络请求 | 额外禁止 | 新用例只调用 `buildTask` 纯函数，无 runner/网络 | ✅ |
| 新增依赖 | 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化
无。

### 被改写或删去的断言
无。

## 结论与理由

全部 5 条验收命令实跑通过。diff 范围严格在 `src/roles/worker.ts`（实现）和 `test/task-envelope.test.ts`（测试）两个文件内，无任何受保护文件、依赖或不变量变化。条目 1 的两种情形（有情形/无情形）均实现正确且有测试覆盖。条目 2 的两个新用例覆盖了两种加粗情形，现有断言零修改。所有额外禁止事项均满足。提交已推送至远端。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b18",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["d6571e1bcbd945bc680f130d5ed8820d6d3b5785"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "67 files, 1402 tests passed" },
      { "cmd": "npm test -- test/task-envelope.test.ts test/worker.test.ts", "exit_code": 0, "summary": "2 files, 200 tests passed" },
      { "cmd": "grep -qE \"本批次情形\" src/roles/worker.ts && grep -qE \"本批次接口\" src/roles/worker.ts", "exit_code": 0, "summary": "both strings found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "全部验收命令通过，实现符合 SPEC 16.16 对 v046-b18 的要求，测试覆盖有/无情形两种情况，无受保护文件或依赖变化。CI 以 R2 取证为准。"
}
```
