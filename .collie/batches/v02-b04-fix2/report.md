# 批次 v02-b04-fix2 汇报

## 做了什么

### 条目 1: ci.token_file — 配置、读取、环境清洗

1. **Schema 变更**（`src/schema/index.ts`）：在 `CollieConfigSchema` 的 `ci` 段新增 `token_file: z.string().optional()`，允许用户配置一个存放 GitHub PAT 的文件路径。

2. **Evidence 读取**（`src/evidence.ts`）：在构建 `ciQuery` 前，若 `config.ci.token_file` 存在，则读取该文件内容（支持 `~` 展开为 home 目录）。文件不存在或不可读时静默降级为无 token（与 SPEC 3.1 一致）。读取到的 token 注入 `ciQuery.token`。

3. **ClaudeRunner 环境清洗**（`src/runner/claude.ts`）：复制 `process.env` 并剔除 `GITHUB_TOKEN` 和 `GH_TOKEN` 两个键，传入 SDK 的 `env` 选项，确保子进程不能通过环境变量泄漏 CI token。

4. **FakeRunner 环境清洗**（`src/runner/fake.ts`）：在 `run()` 体内保存并删除 `GITHUB_TOKEN` / `GH_TOKEN`，finally 块恢复原值。保证测试中 fake effect 也看不到宿主 token。

5. **.gitignore / GITIGNORE_ENTRIES**：`.gitignore` 新增 `.collie/github-token`；`src/cli.ts` 的 `GITIGNORE_ENTRIES` 数组新增同条目。

6. **测试**：
   - `test/config.test.ts`：token_file 可选接受 / 缺失不报错
   - `test/evidence.test.ts`：读文件设 Authorization header / 文件缺失无 header / tilde 展开
   - `test/runner-claude.test.ts`：验证 env 不含 GITHUB_TOKEN / GH_TOKEN

### 条目 2: rate limit no-wait — 无 token 首次限流立即返回

`src/ci.ts` 的 `waitForCi` catch 块中，当 `CiRateLimitError.authenticated === false` 且 `polls === 1` 时，直接返回 `{ result: undefined, timedOut: true, waitedMs, polls, lastState: 'rate_limited' }`，不再浪费 `ci_wait_secs` 等待。

**测试**：
- `test/ci.test.ts`：新增 "unauthenticated rate limit on first poll returns immediately without waiting" 用例
- 修正原 "waits out a rate limit" 用例使用 authenticated query（`{ ...query, token: 'ghp_test' }`）以匹配新语义
- 新增 "authenticated rate limit on first poll still waits as before" 确保已认证路径不受影响

### 条目 3: structural invariants + scenario-g 去真实定时器

1. **`test/invariants.test.ts`**（新文件）：8 个结构性 grep 检查，覆盖：
   - `.collie/heartbeat.json` gitignored (b02)
   - `.collie/github-token` gitignored (v02-b04-fix2)
   - `scenario-g.test.ts` 无 setInterval/setTimeout( (b04-tests)
   - `ladder.test.ts` 无 setInterval/setTimeout( (b04-tests)
   - `claude.ts` 无 softStopRequested (b03)
   - `claude.ts` 无 extracted interrupt call (b04-fix)
   - `src/` 目录外 `src/runner/` 不 import @anthropic-ai (b02)
   - `ladder.ts` 含 `fingerprint?:` 字段 (b04-fix)

2. **`test/scenario-g.test.ts` 去真实定时器**：
   - `controllableFingerprint`：`setTimeout(0)` → `await Promise.resolve()`（微任务）
   - `fakeSetTimer`：`Promise.resolve().then(cb)` → `setImmediate(cb)`（宏任务，允许 I/O 交错）
   - `fakeClock` 默认 stepMs 200 → 1（防止 setup 阶段 git 子进程期间虚拟时钟越过 stall_secs）

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(0 errors)

$ npm test
 Test Files  31 passed (31)
      Tests  601 passed (601)
   Duration  8.25s
```

## 偏离或疑问

无。三个条目均按 task.md 描述完成，无需额外决策。

## 下一步建议

- 本批次三个条目全部完成并推送。CI 结果由 R2 取证。
- v02-b04-fix2 完结后可继续 v02-b05（按 ROADMAP）。
- 建议后续批次将 `test/invariants.test.ts` 作为回归基线，每次新增结构规则时追加 `it()` 用例。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b04-fix2",
  "head_sha": "43ed35c",
  "claims": {
    "commits": ["145f139", "95c8acb", "43ed35c"],
    "tests_passed": 601,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
