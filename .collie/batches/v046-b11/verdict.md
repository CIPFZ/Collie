Now I have all the evidence needed. Let me compile the verdict.

---

# 批次 v046-b11 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline 0ca669ee..fe5c114b -- . ':(exclude).collie/batches'
fe5c114 runner: rule 9 task carries CI link; ci.verdict_commit_error event (SPEC 16.13)
```

单一提交 `fe5c114b299cd05f8f3dc7eccb021300128aea9e`。

推送确认：`git merge-base --is-ancestor fe5c114b 77ae2c63` → true。remote main 在 `77ae2c63`（report commit），fe5c114b 是其祖先。

### 2. 受保护文件

```
$ git diff --stat 0ca669ee..fe5c114b -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(empty — 0 lines)
```

### 3. 额外禁止路径

```
$ git diff --stat 0ca669ee..fe5c114b -- .github/ eslint.config.js vitest.config.ts package.json src/arbiter.ts src/gate.ts src/evidence.ts src/acceptance.ts src/redcheck.ts src/roles/ src/runner/ src/view.ts src/follow.ts
(empty — 0 lines)
```

### 4. 依赖变化

```
$ git diff 0ca669ee..fe5c114b -- package.json package-lock.json
(empty — no changes)
```

### 5. 验收命令实跑

#### 验收 1: `npm run lint`
退出码 0。输出：`Checking formatting... All matched files use Prettier code style!`

#### 验收 2: `npm run typecheck`
退出码 0。输出：`(clean, no errors)`

#### 验收 3: `npm test`
退出码 0。输出：`Test Files 64 passed (64)` / `Tests 1334 passed (1334)`

#### 验收 4: `npm test -- test/queue-journal.test.ts test/verdict-ci-recheck.test.ts test/schema.test.ts`
退出码 0。输出：`Test Files 3 passed (3)` / `Tests 100 passed (100)`

#### 验收 5: `grep -qF "rule 9 FIX rerun task carries head_sha and CI run url" test/queue-journal.test.ts`
退出码 0。

#### 验收 6: `grep -qF "verdict CI query errors are journaled" test/verdict-ci-recheck.test.ts`
退出码 0。

#### 验收 7: `grep -qF "ci.verdict_commit_error" src/schema/index.ts && grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "ci.verdict_commit_error"`
退出码 0。

#### 验收 8: `grep -qF "ci.verdict_commit_error" test/invariants.test.ts`
退出码 0。

### 6. CI 信息

无法查询 GitHub CI（无凭据）。`ci_conclusion` 填 `unknown`，`ci_branch_matched` 填 `null`。CI 以 R2 取证为准。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, all files pass | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 64 files, 1334 tests passed | ✅ |
| 队列日志、CI 复查、事件类型测试 | `npm test -- test/queue-journal.test.ts test/verdict-ci-recheck.test.ts test/schema.test.ts` | exit 0, 3 files, 100 tests passed | ✅ |
| task 带 CI 链接用例在 | `grep -qF "rule 9 FIX rerun task carries head_sha and CI run url" test/queue-journal.test.ts` | exit 0 | ✅ |
| 异常记事件的用例组在 | `grep -qF "verdict CI query errors are journaled" test/verdict-ci-recheck.test.ts` | exit 0 | ✅ |
| 新事件进了类型清单与 R2 | `grep -qF "ci.verdict_commit_error" src/schema/index.ts && ...` | exit 0 | ✅ |
| 不变量同步 | `grep -qF "ci.verdict_commit_error" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：规则 9 重跑 task 带 CI 链接

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 上一次运行被规则 9 降级时，重跑的 task「降级原因」一节多两行：`- head_sha：<sha>` 与 `- CI 运行：<run_url>` | 条目 1 | `src/run.ts:461-465`：`lines.push(\`- head_sha：${info.ciResolvedHeadSha}\`)` 和 `lines.push(\`- CI 运行：${info.ciResolvedRunUrl}\`)` | ✅ |
| 数据取自上一次运行 journal 里最后一条 `ci.resolved` | 条目 1 | `src/run.ts:835`：`const lastCiResolved = batchEvents.findLast((e) => e.event === 'ci.resolved');` | ✅ |
| `run_url` 为空就不写「CI 运行」行 | 条目 1 | `src/run.ts:464`：`if (info.ciResolvedRunUrl !== undefined && info.ciResolvedRunUrl !== '')` | ✅ |
| 没有 `ci.resolved` 就两行都不写 | 条目 1 | `src/run.ts:836`：`if (lastCiResolved !== undefined)` — 未找到时 `ciResolvedHeadSha`/`ciResolvedRunUrl` 保持 `undefined` | ✅ |
| 只在规则 9 时触发，别的规则不变 | 条目 1 | `src/run.ts:834`：`if (downgrade?.rule === RULE_EVIDENCE_MISSING)` — RULE_EVIDENCE_MISSING=9（`src/run.ts:395`） | ✅ |
| 行为验证：规则 9 + CI failure + 有 run_url → task 有 head_sha 和 CI 链接 | 条目 1 加粗 | `npx vitest run test/queue-journal.test.ts -t "rule 9 FIX rerun task carries head_sha and CI run url"` → Tests 1 passed | ✅ |
| 行为验证：run_url 为空时没有「CI 运行」行 | 条目 1 | `npx vitest run test/queue-journal.test.ts -t "rule 9 FIX rerun task omits CI run url line when run_url is empty"` → Tests 1 passed | ✅ |

### 条目 2：`ci.verdict_commit_error` 事件

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 事件类型加 `ci.verdict_commit_error` 到 schema | 条目 2 | `src/schema/index.ts:287`：`'ci.verdict_commit_error'` | ✅ |
| 启动时 CI 查询异常 → 记 `ci.verdict_commit_error`，`when` 为 `startup` | 条目 2 | `src/run.ts:1207-1211`：`rec.record('ci.verdict_commit_error', { sha: lastVerdictSha, when: 'startup', error: ... })` | ✅ |
| 取证后复查异常 → 记 `ci.verdict_commit_error`，`when` 为 `after_evidence` | 条目 2 | `src/run.ts:2002-2006`：`rec.record('ci.verdict_commit_error', { sha: verdictCiRecheckSha, when: 'after_evidence', error: ... })` | ✅ |
| `error` 字段限 500 字符 | 条目 2 | `src/run.ts:1206`：`const ERROR_MAX = 500;`；`src/run.ts:2001`：`const ERROR_MAX_RECHECK = 500;` — 均用 `.slice(0, ERROR_MAX)` | ✅ |
| 异常不让运行失败，不改结论与退出码 | 条目 2 | 两处均在 `catch` 块中，不 rethrow | ✅ |
| 行为验证：启动时抛错 → 运行照常走完，journal 有 1 条 when=startup | 条目 2 加粗 | `npx vitest run test/verdict-ci-recheck.test.ts -t "verdict CI query errors are journaled"` → Tests 3 passed。第一条测试断言 `exitCode === 0`、`verdict === 'PASS'`、errors 长度 1、`when === 'startup'`、error 含 'network timeout' | ✅ |
| 行为验证：复查时抛错 → when=after_evidence，结论与退出码不变 | 条目 2 | 同上 describe 组第二条测试断言 `exitCode === 0`、`verdict === 'PASS'`、errors 长度 1、`when === 'after_evidence'`、error 含 'API rate limit' | ✅ |
| 行为验证：两处都不抛错 → 没有这个事件 | 条目 2 | 同上 describe 组第三条测试断言 `errors.length === 0` | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `test/queue-journal.test.ts` 加 `rule 9 FIX rerun task carries head_sha and CI run url` | 条目 3 | `test/queue-journal.test.ts:676`：`it('rule 9 FIX rerun task carries head_sha and CI run url', ...)`；验收 5 grep 通过 | ✅ |
| 再加一条 `run_url` 为空时没有「CI 运行」行 | 条目 3 | `test/queue-journal.test.ts:808`（从 diff +行数推断）：`it('rule 9 FIX rerun task omits CI run url line when run_url is empty', ...)` | ✅ |
| `test/verdict-ci-recheck.test.ts` 新加 `describe('verdict CI query errors are journaled', …)` | 条目 3 | `test/verdict-ci-recheck.test.ts:479`：`describe('verdict CI query errors are journaled', () => {`；验收 6 grep 通过 | ✅ |
| 含启动时抛错、复查时抛错、两处都不抛错三条测试 | 条目 3 | 实跑 describe 组出 3 passed | ✅ |
| `test/schema.test.ts`：40→41，加一条 `toContain` | 条目 3 | diff 确认：`-expect(EVENT_TYPES).toHaveLength(40)` → `+expect(EVENT_TYPES).toHaveLength(41)`，`+expect(EVENT_TYPES).toContain('ci.verdict_commit_error')` | ✅ |
| `test/invariants.test.ts` 加「`src/run.ts` 里有 `ci.verdict_commit_error`」 | 条目 3 | `test/invariants.test.ts:426-429`：`it('src/run.ts contains ci.verdict_commit_error (v046-b11)', ...)` | ✅ |
| 不改写条目 3 点名之外的已有断言 | 条目 3 | diff 检查：只有 `test/schema.test.ts` 的 40→41 是对已有断言的修改（已许可），其余全是新增行 | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 遵守 |
|---|---|---|---|
| 改动任何受保护路径 | 额外禁止 | `git diff --stat` 对受保护路径：空输出 | ✅ |
| 改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --stat` 对这些路径：空输出 | ✅ |
| 改动 `src/arbiter.ts`、`src/gate.ts` 等列出的文件 | 额外禁止 | `git diff --stat` 对这些路径：空输出 | ✅ |
| 让 CI 查询异常影响结论或退出码 | 额外禁止 | 两处 `catch` 块仅记录事件，不 rethrow，不修改任何结论变量。测试验证 exitCode=0、verdict=PASS | ✅ |
| 删除或跳过测试 | 额外禁止 | diff 无删除行（除 schema.test.ts 的 40→41），1334 tests 通过 | ✅ |
| 改写条目 3 点名之外的已有断言 | 额外禁止 | diff 核查确认 | ✅ |
| 为验收命令通过改注释或字面 | 额外禁止 | diff 中注释仅出现在新增代码区域，不在验收命令检查范围内 | ✅ |
| 测试拉起真实 runner / 真实网络 | 额外禁止 | 新测试使用 `FakeRunner` 和自定义 `FetchLike` mock | ✅ |
| 新增依赖 | 额外禁止 | package.json 和 lock 文件无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 的 diff 仅新增了一个测试用例，无数值上下限改动。

### 被改写或删去的断言

仅 `test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far` 中 `expect(EVENT_TYPES).toHaveLength(40)` → `expect(EVENT_TYPES).toHaveLength(41)`。这是条目 3 明确许可的改写。SPEC 中新增了 `ci.verdict_commit_error` 事件类型，从 40 增到 41 是正确的。无其它已有断言被改写或删去。

## 结论与理由

全部 8 条验收命令实跑通过。3 个条目的结构要求与行为要求逐条核对均满足。受保护文件和禁止改动的文件均未被修改。无新增依赖。diff 范围严格在 task 条目之内（6 个文件全部在条目描述范围中），无范围蔓延。提交已推送到远端。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b11",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["fe5c114b299cd05f8f3dc7eccb021300128aea9e"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "64 files, 1334 tests passed" },
      { "cmd": "npm test -- test/queue-journal.test.ts test/verdict-ci-recheck.test.ts test/schema.test.ts", "exit_code": 0, "summary": "3 files, 100 tests passed" },
      { "cmd": "grep -qF \"rule 9 FIX rerun task carries head_sha and CI run url\" test/queue-journal.test.ts", "exit_code": 0, "summary": "found" },
      { "cmd": "grep -qF \"verdict CI query errors are journaled\" test/verdict-ci-recheck.test.ts", "exit_code": 0, "summary": "found" },
      { "cmd": "grep -qF \"ci.verdict_commit_error\" src/schema/index.ts && grep -vE \"^\\s*(//|\\*|/\\*)\" src/run.ts | grep -qF \"ci.verdict_commit_error\"", "exit_code": 0, "summary": "found in both files (non-comment)" },
      { "cmd": "grep -qF \"ci.verdict_commit_error\" test/invariants.test.ts", "exit_code": 0, "summary": "found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 8 acceptance commands pass. All 3 items implemented correctly: rule 9 rerun task carries head_sha and CI run url from ci.resolved; ci.verdict_commit_error event recorded on startup/after_evidence query exceptions without affecting run conclusion; tests cover all specified scenarios. No protected files modified, no forbidden files touched, no new dependencies. CI conclusion unknown (no credentials); CI 以 R2 取证为准."
}
```
