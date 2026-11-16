`deps.fetch` is already part of the `CliDeps` interface and is used for the notify call at line 984. The CLI properly wires it.

Now let me verify the SPEC compliance of the `notify` command output. SPEC 14.3 says:
- `collie notify <文本>`：打印 `sent` / `skipped (no webhook)` / `failed: <原因>`，前两种退出码 0，第三种 1

Looking at cli.ts:
- `sent` → `deps.out('sent\n')`, `code = EXIT_CODES.PASS` (0) ✓
- `skipped` → `deps.out('skipped (no webhook)\n')`, `code = EXIT_CODES.PASS` (0) ✓  
- `failed: ...` → `deps.out(...)`, `code = EXIT_CODES.ERROR` (1) ✓

This matches the SPEC exactly.

Now I have all the evidence. Let me compile the verdict.

# 批次 v045-b03 审核

## 取证过程

### 1. 提交事实

```
git log --format='%H' cda2bbcec85b55a193f4f1dff6da3360b7220e8f..f5ad8e1d70aa2df1ab012b4e450a7d32169c7fec
```

产出两条提交：
- `a25d5e85feaeabd102bde18de6f24d10531ee507` — docs: issue v045-b03 task envelope
- `f5ad8e1d70aa2df1ab012b4e450a7d32169c7fec` — cli: add notify module, handoff protocol, and tests (SPEC 14.3)

远程检查：`git ls-remote origin` 显示 `origin/main` 在 `e67513d`，其父提交即 `f5ad8e1`。`git log e67513d -5` 确认两条批次提交均为 `main` 的祖先，已推送。`remote_has_head` = true。

### 2. 受保护文件

```
git diff --stat cda2bbce..f5ad8e1d -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空，无受保护文件被修改。`spec_diff_lines` = 0。

额外检查 `.collie/collie.toml` 和 `templates/collie.toml`：未修改。

### 3. 依赖变化

```
git diff cda2bbce..f5ad8e1d -- package.json package-lock.json
```
输出为空，无依赖变化。

### 4. CI

无 GitHub 凭据，`git ls-remote` 只看到 main/tags，无法查 CI run。`ci_conclusion` = `unknown`，`ci_branch_matched` = `null`。CI 以 R2 取证为准。

### 5. 变更文件列表

共 8 个文件变更：
- `.collie/batches/v045-b03/task.md` — 任务信封
- `src/cli.ts` — 新增 `notify` 子命令接线
- `src/handoff.ts` — 新建，parseNext 和 decide 纯函数
- `src/notify.ts` — 新建，通知模块
- `src/schema/index.ts` — 新增 NotifyConfigSchema 和 `notify` 可选字段
- `test/handoff.test.ts` — 新建，21 个测试
- `test/invariants.test.ts` — 新增 2 个不变量
- `test/notify.test.ts` — 新建，7 个测试

所有文件均在 task.md 的条目范围内，无范围蔓延。未改动 `run.ts`、`gate.ts`、`arbiter.ts`。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 55 files, 1048 tests passed, exit 0 | ✅ |
| 两个专项测试通过 | `npm test -- test/notify.test.ts test/handoff.test.ts` | 2 files, 28 tests passed, exit 0 | ✅ |
| 协议测试不少于 10 个 | `grep -cE "^\s+it\(" test/handoff.test.ts \| grep -qE "^[1-9][0-9]$"` | count=21, exit 0 | ✅ |
| 通知测试不少于 5 个 | `grep -cE "^\s+it\(" test/notify.test.ts \| grep -qE "^([5-9]\|[1-9][0-9])$"` | count=7, exit 0 | ✅ |
| 协议模块是纯函数 | `test -f src/handoff.ts && ! grep ...` | exit 0 | ✅ |
| 有测试断言地址不外泄 | `grep -qE "not\.toContain" test/notify.test.ts` | exit 0 | ✅ |
| 没配置时跳过而不是报错 | `HOME=$(mktemp -d) npx tsx src/cli.ts notify "acceptance" 2>&1 \| grep -qE "skipped"` | exit 0 | ✅ |
| 通知配置进 schema | `grep -qE "webhook_file" src/schema/index.ts` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "handoff" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：通知模块（SPEC 14.3 第一段）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 配置 schema 加可选的 `[notify] webhook_file` | task.md 条目 1 | `src/schema/index.ts:115-119`：`NotifyConfigSchema = z.strictObject({ webhook_file: z.string().optional() })`；`src/schema/index.ts:142`：`notify: NotifyConfigSchema.optional()` | ✅ |
| 不改 `.collie/collie.toml` 和 `templates/collie.toml` | task.md 条目 1 | `git diff --stat ... -- .collie/collie.toml templates/collie.toml` 为空 | ✅ |
| 新建 `src/notify.ts` | task.md 条目 1 | `src/notify.ts` 75 行，存在 | ✅ |
| `fetch` 由调用方传入 | task.md 条目 1 | `src/notify.ts:43`：`fetchFn: NotifyFetch`；`src/notify.ts:62`：`await fetchFn(url, {`；全文未使用全局 `fetch` | ✅ |
| `collie notify <文本>`，cli.ts 只做接线 | task.md 条目 1 | `src/cli.ts:970-997`：command 仅调用 `loadConfig` + `notify()` 并打印结果，无业务逻辑 | ✅ |
| 地址不得出现在返回值、报错、日志与任何输出里 | task.md 条目 1 / SPEC 14.3 | `src/notify.ts:72`：`const sanitized = raw.replaceAll(url, '<redacted>')`；返回值只有 `'sent'` / `'skipped'` / `'failed: HTTP <status>'` / `'failed: <sanitized>'`，均不含 URL | ✅ |
| 没配或文件不存在 → `skipped` | SPEC 14.3 | `src/notify.ts:46`：no config → `'skipped'`；`src/notify.ts:49`：文件不存在 → `'skipped'` | ✅ |
| POST body 格式 `{"msgtype":"text","text":{"content":<文本>}}` | SPEC 14.3 | `src/notify.ts:61`：`JSON.stringify({ msgtype: 'text', text: { content: text } })` | ✅ |
| HTTP 2xx → `sent`，否则 `failed` | SPEC 14.3 | `src/notify.ts:67-68`：`if (response.ok) return 'sent'`；`return \`failed: HTTP ${...}\`` | ✅ |
| 从不抛错 | SPEC 14.3 | `src/notify.ts:69-74`：catch 块返回 `failed:` 字符串 | ✅ |
| notify 行为测试通过 | 行为要求 | `npx vitest run test/notify.test.ts`：Tests 7 passed | ✅ |

### 条目 2：交接协议（SPEC 14.3 第二段）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新建 `src/handoff.ts` | task.md 条目 2 | `src/handoff.ts` 261 行，存在 | ✅ |
| `parseNext(text)` 导出 | task.md 条目 2 | `src/handoff.ts:157`：`export function parseNext(text: string): ParseResult` | ✅ |
| `decide(next, state)` 导出 | task.md 条目 2 | `src/handoff.ts:217`：`export function decide(next: ParseResult, state: FollowState): DecideAction` | ✅ |
| 纯函数：不 import `node:fs` | task.md 条目 2 | grep 排除注释行后搜索 `node:fs`——仅在注释中出现（`src/handoff.ts:2`）；导入只有 `node:crypto`（`src/handoff.ts:6`） | ✅ |
| 纯函数：不 import `node:child_process` | task.md 条目 2 | 同上，未在代码行中出现 | ✅ |
| 不读时钟 | task.md 条目 2 | grep `Date.now` 仅在注释出现（`src/handoff.ts:2`） | ✅ |
| 不用定时器 | task.md 条目 2 | grep `setTimeout|setInterval` 仅在注释出现 | ✅ |
| SPEC 14.3 键值表六个键的解析 | SPEC 14.3 | `src/handoff.ts:80-103` 提取键值对；`src/handoff.ts:160-206` 按状态验证必填键 | ✅ |
| 同一个键出现两次 → 格式错 | SPEC 14.3 | `src/handoff.ts:97-99`：`if (seen.has(key)) { errors.push('duplicate key: ...') }` | ✅ |
| 第一个 `## ` 后的行不算 | SPEC 14.3 | `src/handoff.ts:87`：`if (trimmed.startsWith('## ')) break;` | ✅ |
| SPEC 14.3 判定表 5 行全覆盖 | SPEC 14.3 | `src/handoff.ts:217-261` switch 覆盖：格式错（219-229）、开跑（233-239）、等所有者裁定（243-249）、收工（253-259） | ✅ |
| handoff 行为测试通过 | 行为要求 | `npx vitest run test/handoff.test.ts`：Tests 21 passed | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `test/notify.test.ts` 没配 | task.md 条目 3 | `test/notify.test.ts:28-32`：'skips when no notify section is configured' | ✅ |
| `test/notify.test.ts` 文件不存在 | task.md 条目 3 | `test/notify.test.ts:34-43`：'skips when webhook_file is configured but file does not exist' | ✅ |
| `test/notify.test.ts` 2xx | task.md 条目 3 | `test/notify.test.ts:45-63`：'returns sent on HTTP 2xx' | ✅ |
| `test/notify.test.ts` 非 2xx | task.md 条目 3 | `test/notify.test.ts:65-74`：'returns failed with status on non-2xx' | ✅ |
| `test/notify.test.ts` fetch 抛错 | task.md 条目 3 | `test/notify.test.ts:76-88`：'returns failed with sanitized error when fetch throws' | ✅ |
| 断言返回值和输出不含地址 | task.md 条目 3 | `test/notify.test.ts:87`：`expect(result).not.toContain(url)`；`test/notify.test.ts:90-108`：'never leaks the webhook address in any result'，对 sent/failed/throw 三条路径全断言 `not.toContain(url)` | ✅ |
| `test/handoff.test.ts` 三种状态各自的必填键 | task.md 条目 3 | 开跑：`test/handoff.test.ts:22-37`；等所有者裁定：`test/handoff.test.ts:39-51`；收工：`test/handoff.test.ts:53-65`；缺失必填键：`test/handoff.test.ts:120-126`（固定版本），`test/handoff.test.ts:128-134`（裁定事项），`test/handoff.test.ts:136-142`（摘要） | ✅ |
| 重复的键 | task.md 条目 3 | `test/handoff.test.ts:67-74` | ✅ |
| sha 格式不对 | task.md 条目 3 | `test/handoff.test.ts:76-82` | ✅ |
| 批次上限不是正整数 | task.md 条目 3 | `test/handoff.test.ts:84-95`（0），`test/handoff.test.ts:97-108`（负数），`test/handoff.test.ts:144-155`（非数字） | ✅ |
| 键值行出现在 `## ` 之后不算 | task.md 条目 3 | `test/handoff.test.ts:110-118` | ✅ |
| SPEC 14.3 判定表每一行 | task.md 条目 3 | decide 测试：`test/handoff.test.ts:163-273`，10 个 it，覆盖格式错(未通知/已通知)、开跑(已处理/新的)、等所有者裁定(未通知/已通知)、收工(未通知/已通知)、哈希变化 | ✅ |
| `test/invariants.test.ts` 加 handoff 不 import | task.md 条目 3 | `test/invariants.test.ts:422-435` | ✅ |
| `test/invariants.test.ts` 加 notify 存在 | task.md 条目 3 | `test/invariants.test.ts:437-441` | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径（含 `.collie/collie.toml`） | task.md | diff 为空 | ✅ |
| 不改 `templates/collie.toml` | task.md | diff 为空 | ✅ |
| 不删除或跳过任何测试 | task.md | 全量测试 1048 passed，无 skip | ✅ |
| 不为了验收命令改注释或字面 | task.md（铁律 26） | 无此迹象 | ✅ |
| 测试里不向真实网络发请求 | task.md | `test/notify.test.ts` 使用 okFetch/failFetch/throwFetch 三个假函数 | ✅ |
| 不让通知地址出现在任何输出、事件或报错里 | task.md | `src/notify.ts:72` 清洗地址；测试验证 `not.toContain` | ✅ |
| 不改 `run.ts`、`gate.ts`、`arbiter.ts` | task.md | diff 中无这三个文件 | ✅ |
| 不新增依赖 | task.md | `package.json` diff 为空 | ✅ |

### 不变量数值变化

无。新增的两个不变量测试是结构检查（`not.toContain` 和 `toContain`），无数值上下限改动。

## 声称与实测的差异

无。

## 结论与理由

所有 11 条验收命令实跑通过。代码实现完整覆盖 SPEC 14.3 第一段（通知）和第二段（交接协议）的全部要求。模块纯净性、地址不泄露、fetch 注入、配置 schema 扩展等条目要求全部满足。测试覆盖充分（7 条 notify 测试 + 21 条 handoff 测试），行为测试实跑通过。两个新的不变量已添加。无受保护文件修改，无依赖变更，无范围蔓延。提交已推送至远端 `main`。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b03",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "a25d5e85feaeabd102bde18de6f24d10531ee507",
      "f5ad8e1d70aa2df1ab012b4e450a7d32169c7fec"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "55 files, 1048 tests passed" },
      { "cmd": "npm test -- test/notify.test.ts test/handoff.test.ts", "exit_code": 0, "summary": "2 files, 28 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/handoff.test.ts | grep -qE \"^[1-9][0-9]$\"", "exit_code": 0, "summary": "count=21, matches [1-9][0-9]" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/notify.test.ts | grep -qE \"^([5-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "count=7, matches [5-9]" },
      { "cmd": "test -f src/handoff.ts && ! grep -vE \"^\\s*(//|\\*|/\\*)\" src/handoff.ts | grep -qE \"node:fs|node:child_process|setTimeout|setInterval|Date\\.now\"", "exit_code": 0, "summary": "no impure imports in code lines" },
      { "cmd": "grep -qE \"not\\.toContain\" test/notify.test.ts", "exit_code": 0, "summary": "address leak assertion present" },
      { "cmd": "HOME=$(mktemp -d) npx tsx src/cli.ts notify \"acceptance\" 2>&1 | grep -qE \"skipped\"", "exit_code": 0, "summary": "outputs 'skipped' when no config" },
      { "cmd": "grep -qE \"webhook_file\" src/schema/index.ts", "exit_code": 0, "summary": "webhook_file in schema" },
      { "cmd": "grep -qE \"handoff\" test/invariants.test.ts", "exit_code": 0, "summary": "handoff invariant present" }
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
  "reason": "All 11 acceptance commands pass. notify module correctly injects fetch, scrubs addresses, and handles all code paths. handoff module is pure (only imports node:crypto), implements parseNext and decide per SPEC 14.3 decision table. Tests are comprehensive (7 notify + 21 handoff). Two invariants added. No protected files modified, no deps added. CI以R2取证为准。"
}
```
