Now I have all the evidence needed to write the verdict.

# 批次 v046-b01 审核

## 取证过程

### 1. 受保护文件检查

```
git diff --stat c5827c7a..f4819c6c -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出。受保护文件无任何修改。`spec_diff_lines = 0`。

### 2. 额外禁止路径检查

```
git diff --stat c5827c7a..f4819c6c -- templates/collie.toml .github/ eslint.config.js vitest.config.ts package.json
```
结果：无输出。这些文件均未被修改。

```
git diff --stat c5827c7a..f4819c6c -- src/
```
结果：无输出。`src/` 下无任何文件被修改。

```
git diff --stat c5827c7a..f4819c6c -- test/support/sandbox.ts
```
结果：无输出。`sandbox.ts` 未被修改。

### 3. 依赖变更检查

```
git diff c5827c7a..f4819c6c -- package.json package-lock.json
```
结果：无输出。无依赖变更。

### 4. 提交事实

- 单一提交：`f4819c6c647d1e28fcda791ecbb210703ccbf689` — `test: decouple tests from repository .collie/collie.toml values`
- `git merge-base --is-ancestor f4819c6c c13dac91` → YES。工作提交是远端 `origin/main` (c13dac9) 的祖先，已推送。

### 5. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 均通过 |
| 2 | `npm run typecheck` | 0 | tsc 无错误 |
| 3 | `npm test` | 0 | 60 files passed, 1186 tests passed, 21.37s |
| 4 | `npm test -- test/cli.test.ts test/config.test.ts test/evidence.test.ts test/reviewer-isolation.test.ts test/reviewer.test.ts test/runner-claude.test.ts test/worker.test.ts` | 0 | 7 files passed, 205 tests passed |
| 5 | `grep -qE "export function templateConfig" ... && grep -lE ... \| grep -c . \| grep -qE ...` | 0 | templateConfig 导出存在，7 个测试文件引用 |
| 6 | `grep -nE "loadConfig..." ... \| grep -v ... \| grep -c . \| grep -qx 1 && grep -qE ... test/config.test.ts` | 0 | 仅 config.test.ts:67 一处 |
| 7 | `! grep -vE "^\s*(//\|\*\|/\*)" scripts/mutation.ts \| grep -qF "'.collie'" && grep -qF "'templates'" scripts/mutation.ts` | 0 | .collie 在非注释行中不出现，templates 存在 |
| 8 | `out=$(npx tsx scripts/mutation.ts ...) && ... grep -qE "^mutation: caught 42 survived 0 ..."` | 0 | caught 42 survived 0 invalid 0 timeout 0 stale 0 |
| 9 | `grep -qE "templateConfig\|template-config" test/invariants.test.ts` | 0 | 匹配到 |

**全部 9 条验收命令通过。**

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 60 files 1186 tests | ✅ |
| 改过的 7 个测试文件通过 | `npm test -- test/cli.test.ts ...` | exit 0, 7 files 205 tests | ✅ |
| 取模板配置的函数存在，7 个文件都用上了 | grep 组合命令 | exit 0 | ✅ |
| 从仓库根加载配置的只剩 config.test.ts 里的一处 | grep 组合命令 | exit 0, 仅 test/config.test.ts:67 | ✅ |
| 变异副本复制模板，不再复制 .collie | grep 组合命令 | exit 0 | ✅ |
| 变异检查全部被发现 | npx tsx scripts/mutation.ts | exit 0, caught 42 survived 0 | ✅ |
| 不变量同步 | grep templateConfig/template-config | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：新文件 `test/support/template-config.ts`

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 导出 `templateConfig()` | 条目1 | `test/support/template-config.ts:17` — `export function templateConfig(): CollieConfig {` | ✅ |
| 读 `templates/collie.toml` | 条目1 | `test/support/template-config.ts:9` — `const TEMPLATE_PATH = join(import.meta.dirname, '..', '..', 'templates', 'collie.toml');`，`:18` — `const raw = readFileSync(TEMPLATE_PATH, 'utf8');` | ✅ |
| 把 `{{name}}`、`{{repo}}` 换成固定值后解析 | 条目1 | `test/support/template-config.ts:19-21` — `.replace('"{{name}}"', JSON.stringify(TEMPLATE_NAME)).replace('"{{repo}}"', JSON.stringify(TEMPLATE_REPO))` | ✅ |
| 返回配置对象 | 条目1 | `test/support/template-config.ts:22` — `return parseConfig(text, 'templates/collie.toml');` | ✅ |
| 7 个测试文件都改用它 | 条目1 | `grep -lE "templateConfig\(" test/*.test.ts` 输出 7 个文件（加上 invariants 共 8 个引用，invariants 是不变量检查） | ✅ |
| `test/config.test.ts` 只留一条读本仓库配置的用例 | 条目1 | `test/config.test.ts:65-72` — 新增 `describe('config: the repository .collie/collie.toml')` 只含一条 `it('loads and passes schema validation')`，只断言类型不断言数值 | ✅ |

### 条目 2：`scripts/mutation.ts` 改为复制 `templates/`

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 不再复制 `.collie/`，改为复制 `templates/` | 条目2 | `scripts/mutation.ts:424` — `'templates',`（原为 `'.collie'`） | ✅ |
| 清单 42 项不动 | 条目2 | 变异检查输出 `caught 42 survived 0 invalid 0 timeout 0 stale 0` | ✅ |

### 条目 3：允许改写的旧用例（逐一核对）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `config.test.ts` 的 6 条原组用例：数值原样保留，只换对象 | 条目3 | `test/config.test.ts:74-135`：`describe('config: template config (SPEC 3.1 values)')` 组含 6 条 it，worker/reviewer/limits/verify/ci 的所有数值与原版完全相同（max_turns: 200, 60; stall_secs: 300, progress_secs: 1500 等）。project 断言改为 `{name:'test-project', repo:'https://github.com/test-org/test-project'}`（即 templateConfig 固定值） | ✅ |
| `cli.test.ts` 的 `renders to exactly...` 改成「模板填上名字和仓库地址后能通过校验」 | 条目3 | `test/cli.test.ts:22` — `it('template with name and repo passes schema validation')`，`:26` — `expect(() => parseConfig(text, 'template')).not.toThrow()` | ✅ |
| `cli.test.ts` 的 `init derives the repo...` 里 `config.limits` 改成和模板配置的 limits 比 | 条目3 | `test/cli.test.ts:57` — `expect(config.limits).toEqual(templateConfig().limits)` | ✅ |
| `reviewer.test.ts` 的 `launches role reviewer...` 的 `maxTurns: 60` 改成取配置对象里的值 | 条目3 | `test/reviewer.test.ts:89` — `maxTurns: config.agent.reviewer.max_turns` | ✅ |
| `invariants.test.ts` 加不变量 | 条目3 | `test/invariants.test.ts:544` — `it('test/ files that load config from repo root: only test/config.test.ts (v046-b01)')` | ✅ |
| VALID_TOML 内联 fixture 中 project 值跟着改 | 隐含 | `test/config.test.ts:15-16` — `name = "test-project"`, `repo = "https://github.com/test-org/test-project"` — 与 templateConfig 固定值一致，且最后一条测试 `equals the inline SPEC 3.1 fixture used by the error tests` 仍断言 `parseConfig(VALID_TOML, 'inline.toml')).toEqual(config)` | ✅ |

### 额外禁止逐条核对

| 禁止项 | 出处 | 证据 | 遵守 |
|---|---|---|---|
| 不改任何受保护路径（含 `.collie/collie.toml`） | 额外禁止 | `git diff --stat` 对受保护路径输出为空 | ✅ |
| 不改 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --stat` 对这些路径输出为空 | ✅ |
| 不改 `src/` 下任何文件 | 额外禁止 | `git diff --stat` 对 src/ 输出为空 | ✅ |
| 不改 `test/support/sandbox.ts` | 额外禁止 | `git diff --stat` 对该文件输出为空 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | 旧 config.test.ts 22 条 → 新 23 条（+1）；grep `it.skip/describe.skip/xit` 全为 0 | ✅ |
| 不改写条目 3 点名之外的已有断言 | 额外禁止 | diff 中被删的 `expect` 行仅 3 条，全在条目3 点名范围内（见上） | ✅ |
| 不放宽点名用例的数值 | 额外禁止 | 所有数值（max_turns:200/60, stall_secs:300, progress_secs:1500 等）均保持不变 | ✅ |
| 不从变异清单去掉任何项 | 额外禁止 | 变异仍 caught 42 | ✅ |
| 不为验收通过改注释或字面 | 额外禁止（铁律26） | diff 中无此类操作 | ✅ |
| 测试不拉起真实 runner 或网络请求 | 额外禁止 | 新增代码仅读本地文件和调用 parseConfig | ✅ |
| 不新增依赖 | 额外禁止 | package.json 和 lock 文件无变更 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 的 diff 仅新增了一条不变量测试（`test/ files that load config from repo root`），没有修改任何已有数值上下限。

### 被改写或删去的断言

| 文件 | 用例名 | 原断言 | 现断言 | SPEC 仍有效？ |
|---|---|---|---|---|
| `test/cli.test.ts` | `renders to exactly the SPEC 3.1 config the repository uses (no drift)` → `template with name and repo passes schema validation` | `expect(parseConfig(text, 'template')).toEqual(loadConfig(repoRoot))` | `expect(() => parseConfig(text, 'template')).not.toThrow()` | 是，但条目3 明确允许此变更：「改成模板填上名字和仓库地址后能通过校验，不再和本仓库配置比」 |
| `test/cli.test.ts` | `init derives the repo from an SSH origin...` | `expect(config.limits).toEqual(loadConfig(repoRoot).limits)` | `expect(config.limits).toEqual(templateConfig().limits)` | 是，条目3 明确允许 |
| `test/config.test.ts` | `has schema_version 1 and the project section` | `expect(config.project).toEqual({ name: 'collie', repo: 'https://github.com/CIPFZ/Collie' })` | `expect(config.project).toEqual({ name: 'test-project', repo: 'https://github.com/test-org/test-project' })` | 是，条目3：「project 那一条按 templateConfig() 填的固定值断言」 |
| `test/reviewer.test.ts` | `launches role reviewer in root with the configured turns` | `maxTurns: 60` | `maxTurns: config.agent.reviewer.max_turns` | 是，条目3 明确允许 |

以上 4 处全部在条目3 点名范围内。无其他断言被删去或改写。

## 结论与理由

全部 9 条验收命令实跑通过。条目 1-3 的所有结构要求逐一核对均满足。额外禁止的所有条款均遵守。受保护文件无变更，无新增依赖。工作提交已推送至远端（作为 origin/main 的祖先）。diff 范围恰好覆盖 task.md 的 3 个条目，无范围蔓延。不变量无数值变化。被改写的断言均在条目3 明确允许的范围内。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b01",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["f4819c6c647d1e28fcda791ecbb210703ccbf689"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "60 files 1186 tests passed" },
      { "cmd": "npm test -- test/cli.test.ts test/config.test.ts test/evidence.test.ts test/reviewer-isolation.test.ts test/reviewer.test.ts test/runner-claude.test.ts test/worker.test.ts", "exit_code": 0, "summary": "7 files 205 tests passed" },
      { "cmd": "grep -qE 'export function templateConfig' test/support/template-config.ts && grep -lE 'templateConfig\\(' test/*.test.ts | grep -c . | grep -qE '^([7-9]|[1-9][0-9])$'", "exit_code": 0, "summary": "templateConfig exported and used in 7+ files" },
      { "cmd": "grep -nE 'loadConfig\\((repoRoot|ROOT|join\\(import\\.meta\\.dirname)' test/*.test.ts | grep -v '^test/invariants.test.ts:' | grep -c . | grep -qx 1 && grep -qE 'loadConfig\\((repoRoot|ROOT|join\\(import\\.meta\\.dirname)' test/config.test.ts", "exit_code": 0, "summary": "only config.test.ts:67 loads from repo root" },
      { "cmd": "! grep -vE '^\\s*(//|\\*|/\\*)' scripts/mutation.ts | grep -qF \"'.collie'\" && grep -qF \"'templates'\" scripts/mutation.ts", "exit_code": 0, "summary": "mutation copies templates not .collie" },
      { "cmd": "out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\\n' \"$out\" | tail -n 1 | grep -qE '^mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0$' && ! test -e .vitest", "exit_code": 0, "summary": "caught 42 survived 0" },
      { "cmd": "grep -qE 'templateConfig|template-config' test/invariants.test.ts", "exit_code": 0, "summary": "invariant references templateConfig" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 9 acceptance commands pass. The 3 task items are fully implemented: templateConfig() created, 7 test files decoupled from repo config, mutation.ts copies templates/ instead of .collie/, invariant added. No protected files modified, no dependencies changed, no assertions deleted or weakened outside the explicitly allowed scope. CI以R2取证为准。"
}
```
