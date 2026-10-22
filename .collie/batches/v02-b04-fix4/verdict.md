Now I have all the evidence I need. Let me compile my verdict.

# 批次 v02-b04-fix4 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline dfa00e04b9b02dffaf46e2a51a913ff0f5e96ef3..1bd1ac5
1bd1ac5 cli: collie smoke subcommand (SPEC v02-b04-fix4)
8170a3d runner: SDK-derived types and single-object spawn hook (SPEC 11.2, v02-b04-fix4)
```

两个提交在范围内。

```
$ git branch -r --contains 1bd1ac5
  origin/HEAD -> origin/main
  origin/main
```

head_sha 已推送至远端 main 分支。✅

### 2. 受保护路径

```
$ git diff --stat dfa00e04b9b02dffaf46e2a51a913ff0f5e96ef3..1bd1ac5 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(无输出)
```

零行变动。✅

### 3. 依赖变化

```
$ git diff dfa00e04b9b02dffaf46e2a51a913ff0f5e96ef3..1bd1ac5 -- package.json package-lock.json
(无输出)
```

无依赖变动。✅

### 4. 变动范围

```
$ git diff --name-only dfa00e04b9b02dffaf46e2a51a913ff0f5e96ef3..1bd1ac5
src/cli.ts
src/runner/claude.ts
test/cli.test.ts
test/invariants.test.ts
test/runner-claude.test.ts
```

5 个文件，全部在条目要求范围内（条目 1 → `src/runner/claude.ts` + `test/runner-claude.test.ts`；条目 2 → `src/runner/claude.ts` + `test/invariants.test.ts`；条目 3 → `src/cli.ts` + `test/cli.test.ts`）。无范围蔓延。✅

### 5. CI 状态

```
$ gh run list --branch main --limit 3
To get started with GitHub CLI, please run:  gh auth login
```

无 GitHub 凭据，无法查询 CI。CI 以 R2 取证为准。

### 6. 验收命令逐条实跑

#### 命令 1: `npm run lint`
```
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
EXIT_CODE=0
```

#### 命令 2: `npm run typecheck`
```
> tsc -p tsconfig.json
EXIT_CODE=0
```

#### 命令 3: `npm test`
```
Test Files  31 passed (31)
     Tests  616 passed (616)
EXIT_CODE=0
```

#### 命令 4: 钩子不再是三参数
```
$ ! grep -qE "spawnClaudeCodeProcess\?: \($" src/runner/claude.ts && ! grep -qE "command: string,$" src/runner/claude.ts
EXIT_CODE=0
```

#### 命令 5: 类型来自 SDK
```
$ grep -qE "import type .* from '@anthropic-ai/claude-agent-sdk'" src/runner/claude.ts && ! grep -qE "interface SpawnHook" src/runner/claude.ts
EXIT_CODE=0
```

#### 命令 6: 不变量已加
```
$ grep -qE "claude-agent-sdk" test/invariants.test.ts
EXIT_CODE=0
```

#### 命令 7: 测试按单对象调用钩子
```
$ grep -qE "spawnClaudeCodeProcess\(\{" test/runner-claude.test.ts || grep -qE "spawnClaudeCodeProcess\?\.\(\{" test/runner-claude.test.ts
EXIT_CODE=0
```

#### 命令 8: smoke 子命令存在且有测试
```
$ grep -qE "'smoke'" src/cli.ts && grep -qE "smoke" test/cli.test.ts
EXIT_CODE=0
```

#### 命令 9: SDK 概念不泄漏
```
$ ! grep -rlE "@anthropic-ai|spawnClaudeCodeProcess" src --include='*.ts' | grep -v '^src/runner/'
EXIT_CODE=0
```

全部 9 条通过。✅

### 7. 测试完整性检查

```
$ git diff ... test/runner-claude.test.ts | grep "^\-.*it\(|^\-.*describe\("
NO_DELETED_TESTS

$ grep -rE "it\.skip|describe\.skip|test\.skip" test/runner-claude.test.ts test/cli.test.ts test/invariants.test.ts
NO_SKIPS
```

无测试被删除或跳过。✅

### 8. soft/hard 停止实现未变

```
$ git diff ... src/runner/claude.ts | grep -A5 -B5 "case 'soft'"
NO_SOFT_STOP_CHANGES
```

diff 中 `stop()` 方法体（soft/hard/kill 三条路径）没有任何改动。✅

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, eslint + prettier 全清 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, tsc 无错误 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 31 文件 616 测试全过 | ✅ |
| 钩子不再是三参数 | `! grep -qE ...` | exit 0 | ✅ |
| 类型来自 SDK | `grep -qE "import type..." && ! grep -qE "interface SpawnHook..."` | exit 0 | ✅ |
| 不变量已加 | `grep -qE "claude-agent-sdk" test/invariants.test.ts` | exit 0 | ✅ |
| 测试按单对象调用钩子 | `grep -qE "spawnClaudeCodeProcess\(\{" ...` | exit 0 | ✅ |
| smoke 子命令存在且有测试 | `grep -qE "'smoke'" src/cli.ts && grep -qE "smoke" test/cli.test.ts` | exit 0 | ✅ |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|spawnClaudeCodeProcess" src ... \| grep -v '^src/runner/'` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：spawn 钩子改为单对象签名

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 钩子签名 `(options) => spawn(...)` | task.md 条目 1 | `src/runner/claude.ts:224` — `const spawnHook: NonNullable<ClaudeQueryOptions['spawnClaudeCodeProcess']> = (options) => {` | ✅ |
| 用 `options.command`, `options.args` 调 spawn | task.md 条目 1 | `src/runner/claude.ts:232` — `const child = spawn(options.command, [...options.args], {` | ✅ |
| 传 `cwd: options.cwd` | task.md 条目 1 | `src/runner/claude.ts:233` — `cwd: options.cwd,` | ✅ |
| 传 `env: 去密钥后的 options.env` | task.md 条目 1 | `src/runner/claude.ts:225-231` — 从 `options.env` 过滤 `STRIPPED_ENV_KEYS`，产出 `cleanEnv`；`src/runner/claude.ts:234` — `env: cleanEnv,` | ✅ |
| 传 `signal: options.signal` | task.md 条目 1 | `src/runner/claude.ts:235` — `signal: options.signal,` | ✅ |
| 返回值满足 SDK 的 `SpawnedProcess` | task.md 条目 1 | `src/runner/claude.ts:237-238` — 返回 `child`（`ChildProcess`），SDK 文档注明 "ChildProcess already satisfies this interface"。类型签名 `NonNullable<ClaudeQueryOptions['spawnClaudeCodeProcess']>` 要求返回 `SpawnedProcess` | ✅ |
| 测试改为传单个对象 | task.md 条目 1 | `test/runner-claude.test.ts:471-476` — `spawnClaudeCodeProcess?.({ command: 'echo', args: ['collie-test'], env: {...}, signal: ... } satisfies SpawnOptions)`；`:504-513` 同理 | ✅ |
| 断言：钩子收到含 `GITHUB_TOKEN` 的 env，spawn 替身收到的 env 无 `GITHUB_TOKEN` 有 `PATH` | task.md 条目 1 | `test/runner-claude.test.ts:537-542` — 传入 `env: { GITHUB_TOKEN: 'fake-token', PATH: '/x' }`；`:558-560` — `expect(childEnvKeys).not.toContain('GITHUB_TOKEN')` + `expect(childEnvKeys).toContain('PATH')` | ✅ |

### 条目 2：类型来自 SDK

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `ClaudeQueryOptions` 用 `Pick` 派生自 SDK 的 `Options` | task.md 条目 2 | `src/runner/claude.ts:19-33` — `export type ClaudeQueryOptions = Pick<SdkOptions, ...>` | ✅ |
| `SpawnOptions` 来自 SDK | task.md 条目 2 | `src/runner/claude.ts:36` — `export type SpawnOptions = SdkSpawnOptions;` | ✅ |
| `SpawnedProcess` 来自 SDK | task.md 条目 2 | `src/runner/claude.ts:37` — `export type SpawnedProcess = SdkSpawnedProcess;` | ✅ |
| `import type` 自 SDK 包 | task.md 条目 2 | `src/runner/claude.ts:11` — `import type { Options as SdkOptions, SpawnOptions as SdkSpawnOptions, SpawnedProcess as SdkSpawnedProcess } from '@anthropic-ai/claude-agent-sdk'` | ✅ |
| 删除手写的 `SpawnHookOptions` / `SpawnHookResult` | task.md 条目 2 | diff 确认移除了 `interface SpawnHookOptions` 和 `interface SpawnHookResult`；grep `interface SpawnHook` 返回 exit 0（不匹配） | ✅ |
| `test/invariants.test.ts` 加检查 | task.md 条目 2 | `test/invariants.test.ts:77-84` — 测试 `from '@anthropic-ai/claude-agent-sdk'`、`import type` 存在、`interface SpawnHook` 不存在 | ✅ |

### 条目 3：`collie smoke` 子命令

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 用配置的真实 runner | task.md 条目 3 | `src/cli.ts:255` — `resolveRunner(runnerChoice ?? deps.runner, deps.cwd)` | ✅ |
| `maxTurns: 1` | task.md 条目 3 | `src/cli.ts:248` — `const SMOKE_MAX_TURNS = 1;`；`:267` — `maxTurns: SMOKE_MAX_TURNS,` | ✅ |
| `allowedTools: []` | task.md 条目 3 | `src/cli.ts:264` — `allowedTools: [],` | ✅ |
| prompt "Reply with the single word ok." | task.md 条目 3 | `src/cli.ts:247` — `const SMOKE_PROMPT = 'Reply with the single word ok.';`；`:262` — `prompt: SMOKE_PROMPT,` | ✅ |
| 收到 RunResult 退出码 0，打印 exitCode/sessionId/usage | task.md 条目 3 | `src/cli.ts:269-272` — 构造包含 exitCode、sessionId、usage 的 parts 并输出；`:273` — `return EXIT_CODES.PASS;` (即 0) | ✅ |
| 拉不起来或抛出退出码 1 + 打印错误 | task.md 条目 3 | `src/cli.ts:275-276` — catch 块打印错误并返回 `EXIT_CODES.ERROR` (即 1)；`:258-259` — 无 runner 时也返回 ERROR | ✅ |
| 不写 journal 不碰 batches | task.md 条目 3 | `src/cli.ts:254-278` — smoke 函数体无 journal 或 batches 目录的任何引用 | ✅ |
| 测试用 fake runner 覆盖成功和失败 | task.md 条目 3 | `test/cli.test.ts:123-139` — 成功路径（FakeRunner 返回 RunResult，验证 exit 0 和输出内容）；`:141-147` — 失败路径（FakeRunner 抛出 Error，验证 exit 1 和错误信息） | ✅ |

### 额外禁止

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动任何受保护路径 | task.md 额外禁止 | `git diff --stat ... -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml` → 无输出 | ✅ |
| 不删除或跳过测试 | task.md 额外禁止 | diff 中无 `it\(` 行被删；grep `it.skip/describe.skip/test.skip` → 无匹配 | ✅ |
| 不改变 soft/hard 现有实现 | task.md 额外禁止 | diff 中 `stop()` 方法的 soft/hard/kill 三条 case 无变动（`grep -A5 -B5 "case 'soft'"` → NO_SOFT_STOP_CHANGES） | ✅ |

## 声称与实测的差异

无。（本轮审核中没有收到实现 Agent 的任何声称文档，只看 diff 和实跑结果。）

## 结论与理由

**PASS**。

所有 9 条验收命令实跑通过。三个条目的具体实现要求——spawn 钩子改为 SDK 单对象签名（含 env 过滤和 signal 透传）、类型全部 Pick/索引自 SDK 包（手写接口已删）、smoke 子命令按规格实现（maxTurns=1、allowedTools=[]、正确 prompt、成功/失败两条路径测试覆盖）——逐条核实均满足。额外禁止（受保护路径、测试删除/跳过、soft/hard 实现变更）全部清白。无依赖变动，变动文件均在条目范围内。提交已推送至远端 main 分支。CI 因无 GitHub 凭据无法查询，以 R2 取证为准。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b04-fix4",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "8170a3d runner: SDK-derived types and single-object spawn hook (SPEC 11.2, v02-b04-fix4)",
      "1bd1ac5 cli: collie smoke subcommand (SPEC v02-b04-fix4)"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "31 files, 616 tests passed" },
      { "cmd": "! grep -qE \"spawnClaudeCodeProcess\\?: \\($\" src/runner/claude.ts && ! grep -qE \"command: string,$\" src/runner/claude.ts", "exit_code": 0, "summary": "hook is no longer three-arg" },
      { "cmd": "grep -qE \"import type .* from '@anthropic-ai/claude-agent-sdk'\" src/runner/claude.ts && ! grep -qE \"interface SpawnHook\" src/runner/claude.ts", "exit_code": 0, "summary": "types imported from SDK, no hand-written SpawnHook" },
      { "cmd": "grep -qE \"claude-agent-sdk\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant test references SDK package" },
      { "cmd": "grep -qE \"spawnClaudeCodeProcess\\(\\{\" test/runner-claude.test.ts || grep -qE \"spawnClaudeCodeProcess\\?\\.\\(\\{\" test/runner-claude.test.ts", "exit_code": 0, "summary": "tests call hook with single object" },
      { "cmd": "grep -qE \"'smoke'\" src/cli.ts && grep -qE \"smoke\" test/cli.test.ts", "exit_code": 0, "summary": "smoke subcommand exists with tests" },
      { "cmd": "! grep -rlE \"@anthropic-ai|spawnClaudeCodeProcess\" src --include='*.ts' | grep -v '^src/runner/'", "exit_code": 0, "summary": "SDK concepts confined to src/runner/" }
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
  "reason": "All 9 acceptance commands pass. Three items fully implemented: spawn hook uses SDK single-object signature with env stripping and signal passthrough; types derived from SDK via Pick/re-export with hand-written interfaces deleted; collie smoke subcommand works per spec with fake-runner test coverage for success and failure paths. No protected files changed, no tests deleted or skipped, soft/hard stop untouched, no dependency changes, no scope creep. CI cannot be verified (no GH credentials) — deferred to R2."
}
```
