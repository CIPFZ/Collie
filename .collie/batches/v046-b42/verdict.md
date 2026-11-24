The detail format matches the task spec exactly: `exitCode=0 secs=<N> exceeds smoke_max_secs=<M>`.

Now I have all evidence needed. Let me compile the verdict.

---

# 批次 v046-b42 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline 275427165827c6d92c2314116825c2fa04869a9d..aaf78da04b075436c53333fbd120bb8bde615683 -- . ':(exclude).collie/batches'
aaf78da schema: add smoke_max_secs limit; preflight runner check enforces time cap (SPEC 16.28)
08b155a docs: issue v046-b42 task envelope
```

Worker 的产出是单个提交 `aaf78da`。`08b155a` 是信封提交（`docs: issue`）。

远端推送：`aaf78da` 是远端 HEAD `7818c7c`（report commit）的祖先，已推送。

### 2. 受保护文件

```
$ git diff --stat base..head -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```

只有 `test/acceptance/v046-b42/` 下的 3 个文件（MAP.md、keep.test.ts、new.test.ts），这些都是测试 Agent 在 `docs: issue` 信封提交（`08b155a`）中写入的，不是 worker 的改动。

Worker 是否动了验收测试：`git log --format='%h %s' base..head -- test/acceptance` 只有 `08b155a docs: issue v046-b42 task envelope`，worker 的提交 `aaf78da` 没碰。✓

### 3. 额外禁止路径

```
$ git diff base..head -- src/cli.ts src/follow.ts src/run.ts src/runner/
```
无输出——未修改。✓

`.collie/collie.toml` 也未修改。✓

### 4. 依赖变化

```
$ git diff base..head -- package.json package-lock.json
```
无输出——无新增依赖。✓

### 5. 变异检查清单

```
$ git diff base..head -- scripts/mutation.ts
```
无输出——未改动。✓

### 6. 验收命令实跑

**命令 1**：`npm run lint` → 退出码 0，输出 "All matched files use Prettier code style!" ✓

**命令 2**：`npm run typecheck` → 退出码 0，无错误输出 ✓

**命令 3**：`npm test` → 退出码 0，86 test files passed，1587 tests passed ✓

**命令 4**：`npm test -- test/acceptance/v046-b42` → 退出码 0，2 test files passed，6 tests passed ✓

**命令 5**：`grep -qE "^# smoke_max_secs = 60" templates/collie.toml && ! grep -qE "^smoke_max_secs" templates/collie.toml && ! grep -qF "smoke_max_secs" .collie/collie.toml` → 退出码 0 ✓

### 7. 行为要求实跑

```
$ npx vitest run test/preflight.test.ts
Test Files  1 passed (1)
     Tests  15 passed (15)
```
preflight 测试全部通过。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 86 files, 1587 tests | ✅ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b42` | exit 0, 2 files, 6 tests | ✅ |
| 模板注释/配置不动 | `grep -qE "^# smoke_max_secs = 60" ...` | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `[limits]` 加可选 `smoke_max_secs`，整数，>0，缺省 60 | 条目 1 | `src/schema/index.ts:176` — `z.number().int().positive().optional().default(DEFAULT_SMOKE_MAX_SECS)` 且 `src/schema/index.ts:63` — `export const DEFAULT_SMOKE_MAX_SECS = 60` | ✅ |
| 写法照 `api_retry_wait_secs` | 条目 1 | `src/schema/index.ts:169-174` vs `src/schema/index.ts:176` — 都是 `z.number().int().<constraint>.optional().default(...)` 模式，`smoke_max_secs` 用 `.positive()` 而非 `.nonnegative()` 因为要求 >0 | ✅ |
| exitCode=0 且 secs > smoke_max_secs → 不过，detail 格式 | 条目 1 | `src/preflight.ts:176-181` — `if (secs > smokeMaxSecs)` 返回 `ok: false, detail: exitCode=0 secs=... exceeds smoke_max_secs=...` | ✅ |
| 不大于时与现在相同 | 条目 1 | `src/preflight.ts:183` — `return { name, ok: true, detail: exitCode=0 secs=... }` | ✅ |
| exitCode 非零不变 | 条目 1 | `src/preflight.ts:169-173` — exitCode !== 0 分支保持原逻辑 | ✅ |
| 抛错情况不变 | 条目 1 | `src/preflight.ts:184-186` — catch 分支未改 | ✅ |
| smokeMaxSecs 从 config.limits 传入 | 条目 1 | `src/preflight.ts:241` — `opts.config.limits.smoke_max_secs` | ✅ |
| 模板加注释行 | 条目 2 | `templates/collie.toml:50` — `# smoke_max_secs = 60   # 可选；preflight --smoke 调一次模型超过这么多秒就算不过（SPEC 16.28）` | ✅ |
| 不加成真的键 | 条目 2 | 验收命令 5 确认 `grep -qE "^smoke_max_secs" templates/collie.toml` 返回 1 | ✅ |
| 本仓库 .collie/collie.toml 不动 | 条目 2 | `git diff` 无输出 | ✅ |
| config.test.ts 加 `smoke_max_secs: 60` | 条目 3 | `test/config.test.ts` diff：`+      smoke_max_secs: 60,` 在 `has the limits of SPEC 3.1` 用例里 | ✅ |
| schema.test.ts 夹具加 `smoke_max_secs: 60` | 条目 3 | `test/schema.test.ts` diff：`+    smoke_max_secs: 60,` 在 `validConfig.limits` 里 | ✅ |
| 不改 src/cli.ts, src/follow.ts, src/run.ts, src/runner/ | 额外禁止 | `git diff` 无输出 | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 只有测试 agent 的信封提交 | ✅ |
| 不删除或跳过测试 | 额外禁止 | diff 仅添加字段，无删除 | ✅ |
| 不改写条目 3 点名之外的断言 | 额外禁止 | 只有 config.test.ts 和 schema.test.ts 被改，均为点名的 | ✅ |
| 无新增依赖 | 额外禁止 | `git diff -- package.json package-lock.json` 无输出 | ✅ |
| detail 里不写模型回复/token/绝对路径 | 额外禁止 | `src/preflight.ts:170-181` — detail 只含 exitCode/secs/stopReason/smoke_max_secs | ✅ |
| S1 行为：exitCode=0, secs=61, 默认配置 → FAIL runner | 条目 1 行为 | `npx vitest run test/acceptance/v046-b42` → Tests 6 passed；`npx vitest run test/preflight.test.ts` → Tests 15 passed | ✅ |
| S2 行为：smoke_max_secs=120 时 61s → ok | 条目 1 行为 | 同上验收测试通过 | ✅ |
| K1 行为：恰好 60s → ok（边界 `>` 而非 `>=`） | 条目 1 行为 | `src/preflight.ts:176` — `secs > smokeMaxSecs`（严格大于），K1 验收测试通过 | ✅ |

### 不变量数值变化

无（`git diff base..head -- test/invariants.test.ts` 无输出）。

### 被改写或删去的断言

无。diff 中 `test/config.test.ts` 和 `test/schema.test.ts` 的改动仅为在已有 expect 对象和夹具中添加新字段 `smoke_max_secs: 60`，未删除或修改任何已有断言。

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 [新] exitCode=0, 61s, 默认配置 → FAIL | `new.test.ts`: `S1: exit code is not 0, output has FAIL runner line, last line is preflight: failed (runner)` | 是：断言 code≠0, hasLine `FAIL runner: exitCode=0 secs=61`, lastLine `preflight: failed (runner)` | 是：去掉 `secs > smokeMaxSecs` 分支后 61s 不会被判 FAIL |
| S2 [新] exitCode=0, 61s, smoke_max_secs=120 → ok | `new.test.ts`: `S2: exit code is 0 and output has ok runner line` | 是：断言 code=0, hasLine `ok   runner: exitCode=0 secs=61` | 是：若不读配置中的 120 仍用默认 60 就会 FAIL |
| S3 [新] exitCode=0, 61s, --json → runner.ok=false, top ok=false | `new.test.ts`: `S3: JSON checks.runner.ok is false and top-level ok is false` | 是：解析 JSON，断言 runnerCheck.ok=false, parsed.ok=false | 是：去掉新行为后 exitCode=0 的 runner 总是 ok:true |
| K1 [保持] exitCode=0, 60s → ok | `keep.test.ts`: `K1: exit code is 0 and output has ok runner line with secs=60` | 是：断言 code=0, hasLine `ok   runner: exitCode=0 secs=60` | 否（保持行为，恰好 60s 不超过默认上限 60） |
| K2 [保持] exitCode=1, 3s → FAIL | `keep.test.ts`: `K2: output has FAIL runner with exitCode=1 and last line is preflight: failed (runner)` | 是：断言 code≠0, hasLine `FAIL runner: exitCode=1`, lastLine `preflight: failed (runner)` | 否（保持行为，exitCode≠0 分支未改） |
| K3 [保持] 无 --smoke → 无 runner 行 | `keep.test.ts`: `K3: exit code is 0 and output has no ok runner or FAIL runner lines` | 是：断言 code=0, 无 `ok   runner` 也无 `FAIL runner` 开头的行 | 否（保持行为，不带 --smoke 本来就不跑 runner） |

所有情形均有对应用例，断言内容与情形描述一致，新行为用例在去掉新行为后确实会失败。无测试缺口。

## 结论与理由

所有 5 条验收命令实跑通过。实现完全落在 task.md 的 3 个条目范围内：
- 条目 1：schema 加了 `smoke_max_secs`，preflight runner 检查正确地在 exitCode=0 且 secs > smokeMaxSecs 时返回 FAIL，detail 格式匹配要求
- 条目 2：模板加了注释行，未加真键，本仓库配置未动
- 条目 3：只改了点名的两个测试文件的指定位置，仅添加字段不删改断言

无受保护文件被修改，无新增依赖，无范围蔓延，无额外禁止被违反。提交已推送到远端。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b42",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["aaf78da04b075436c53333fbd120bb8bde615683"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "86 files, 1587 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b42", "exit_code": 0, "summary": "2 files, 6 tests passed" },
      { "cmd": "grep -qE \"^# smoke_max_secs = 60\" templates/collie.toml && ! grep -qE \"^smoke_max_secs\" templates/collie.toml && ! grep -qF \"smoke_max_secs\" .collie/collie.toml", "exit_code": 0, "summary": "template has comment only, repo config untouched" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "CI 以 R2 取证为准。全部验收命令通过，实现符合条目要求，无受保护文件改动，无依赖变化，无范围蔓延。"
}
```
