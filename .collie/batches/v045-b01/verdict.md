No numerical upper/lower limit changes in invariants — only new string-containment checks were added.

---

# 批次 v045-b01 审核

## 取证过程

### 1. 提交确认

```
git log --oneline 71112d0..772fb41
772fb41 feat: collie preflight, queue preflight gate, and audit integration (v045-b01)
d337c7e docs: issue v045-b01 task envelope
```

两个提交在范围内。`772fb4181709d411e497c552948a1f33212628d9` 已推送至远端（是 `origin/main` 4fd671e 的祖先，4fd671e 为 report 信封提交）。

### 2. 受保护路径

```
git diff --stat 71112d0..772fb41 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空。另外单独确认 `templates/collie.toml` 和 `.collie/collie.toml` 均无改动。

### 3. 依赖变化

```
git diff 71112d0..772fb41 -- package.json package-lock.json
```
输出为空。无新增依赖。

### 4. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | All matched files use Prettier code style! |
| 2 | `npm run typecheck` | 0 | 无输出 |
| 3 | `npm test` | 0 | 52 files, 1002 tests passed |
| 4 | `npm test -- test/preflight.test.ts test/queue-audit.test.ts` | 0 | 2 files, 15 tests passed |
| 5 | `grep -cE ... preflight.test.ts \| grep -qE ...` | 0 | 10 个 it() |
| 6 | `grep -cE ... queue-audit.test.ts \| grep -qE ...` | 0 | 5 个 it() |
| 7 | `npx tsx src/cli.ts preflight 2>&1 \| grep -qE "worktree_clean"` | 0 | 匹配到 |
| 8 | queue.preflight 在 run.ts + schema | 0 | 匹配到 |
| 9 | audit_mismatch 在 run.ts + tests | 0 | 匹配到 |
| 10 | `grep -qE "min_free_mb" src/schema/index.ts` | 0 | 匹配到 |
| 11 | `grep -qE "queue\.preflight" test/invariants.test.ts` | 0 | 匹配到 |

全部 11 条验收命令退出码为 0。

### 5. 专项测试单独实跑

```
npx vitest run test/preflight.test.ts
→ Tests 10 passed

npx vitest run test/queue-audit.test.ts
→ Tests 5 passed

npx vitest run test/invariants.test.ts
→ Tests 57 passed
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 52 files, 1002 passed | ✅ |
| 两个专项测试通过 | `npm test -- test/preflight.test.ts test/queue-audit.test.ts` | exit 0, 15 passed | ✅ |
| preflight 测试不少于 8 个 | grep 计数 | 10 ≥ 8 | ✅ |
| audit 入队列测试不少于 4 个 | grep 计数 | 5 ≥ 4 | ✅ |
| 命令已接线并列出检查项 | npx tsx + grep | exit 0 | ✅ |
| 队列开头记检查结果（不看注释行） | grep 两处 | exit 0 | ✅ |
| audit 不符会停表（不看注释行） | grep 两处 | exit 0 | ✅ |
| 磁盘阈值进配置 schema | grep | exit 0 | ✅ |
| 不变量同步 | grep | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新建 `src/preflight.ts` | 条目 1 | `src/preflight.ts:1-239`（新文件，diff 全为新增） | ✅ |
| 检查项 worktree_clean / remote_in_sync / ci_token / disk_free | 条目 1 | `src/preflight.ts:63` checkWorktreeClean, `:85` checkRemoteInSync, `:101` checkCiToken, `:113` checkDiskFree | ✅ |
| `--smoke` 时加 runner / ci_query | 条目 1 | `src/preflight.ts:130` checkRunner, `:148` checkCiQuery, `:183-185` 仅 smoke 时加入 | ✅ |
| `ci_token` 复用 `readCiTokenChecked` | 条目 1 | `src/preflight.ts:10` import, `:108` 和 `:168` 调用 | ✅ |
| 不放宽 .token_file 的访问不变量 | 条目 1 | `preflight.ts` 无 `token_file` 字符串（grep 确认零匹配），仅通过 `readCiTokenChecked` 间接访问 | ✅ |
| `min_free_mb` 进配置 schema，可选，缺省 1024 | 条目 1 | `src/schema/index.ts:110-111`：`min_free_mb: z.number().int().positive().optional().default(DEFAULT_MIN_FREE_MB)`，`:25` `DEFAULT_MIN_FREE_MB = 1024` | ✅ |
| 不改 `.collie/collie.toml` 与 `templates/collie.toml` | 条目 1 | git diff 均为空 | ✅ |
| 磁盘取数函数经 `CliDeps` 注入 | 条目 1 | `src/cli.ts:73` `diskFreeMb?: (root: string) => number` | ✅ |
| `cli.ts` 只做接线 | 条目 1 | `src/cli.ts:823-882` preflight 命令只调用 `runPreflight` + `formatPreflight`，不含检查逻辑 | ✅ |
| `run --continue` 在选批次前做不带 `--smoke` 的检查 | 条目 2 | `src/run.ts:2410-2441`：preflight 无 smoke 参数，在 batch loop 前 | ✅ |
| 记 `queue.preflight` | 条目 2 | `src/run.ts:2417` `queueRec.record('queue.preflight', ...)` | ✅ |
| 没过记 `queue.finished`（reason `preflight_failed`）、退出码 1 | 条目 2 | `src/run.ts:2432-2438`：record `queue.finished` reason `preflight_failed`, exit `EXIT_CODES.ERROR` | ✅ |
| 不签发 task | 条目 2 | preflight 失败时 return 在 batch loop 之前，不进入 `runBatch` | ✅ |
| 单批次模式不自动检查 | 条目 2 | preflight 仅在 `runQueue` 中（`--continue`），`runBatch` 无 preflight 调用 | ✅ |
| audit 逻辑抽成共用函数 | 条目 2 | `src/run.ts:2176-2245` `auditReviewerTools` 函数，`src/cli.ts:501` 调用同一函数 | ✅ |
| reviewer 结束后记 `audit.result`（批次 journal） | 条目 2 | `src/run.ts:1911-1915` `rec.record('audit.result', ...)` | ✅ |
| `--continue` 下 mismatch 记 `queue.paused`（reasons 含 `audit_mismatch`）并停，退出码 30 | 条目 2 | `src/run.ts:2517-2531`：`queue.paused` reasons `['audit_mismatch']`，`EXIT_CODES.PAUSED` (30) | ✅ |
| `collie audit` 的输出与退出码不变 | 条目 2 | `src/cli.ts:499-523`：相同的 AUDIT_EXIT 常量 (0/1/2)，相同的输出格式 | ✅ |
| 测试用 Sandbox，不依赖真实 home 与磁盘 | 条目 3 | `test/preflight.test.ts:8` import Sandbox，`:28` diskFreeMb 注入；`test/support/sandbox.ts:180` 默认注入 diskFreeMb | ✅ |
| `test/invariants.test.ts` 加两个不变量 | 条目 3 | `test/invariants.test.ts:406-416`：`queue.preflight` 和 `audit.result` | ✅ |

### 行为要求

| 要求 | 出处 | 证据（命令 + 输出） | 满足 |
|---|---|---|---|
| 每个检查项的通过与失败 | 条目 3 | `npx vitest run test/preflight.test.ts` → Tests 10 passed（包含 passes / fails dirty / fails disk / fails behind remote） | ✅ |
| 心跳存在时脏工作区不算失败 | 条目 3 | 同上，test "worktree_clean is ok when heartbeat exists" 包含在 10 passed 中 | ✅ |
| `--smoke` 两项 | 条目 3 | 同上，tests "--smoke adds runner and ci_query checks" + "--smoke runner failure" 包含在 10 passed 中 | ✅ |
| `--json` | 条目 3 | 同上，test "--json outputs valid JSON" 包含在 10 passed 中 | ✅ |
| 队列开头没过时没有 `batch.task_written` 且退出码 1 | 条目 3 | 同上，test "--continue with dirty worktree: no batch.task_written, exit 1" 包含在 10 passed 中 | ✅ |
| 单批次模式不检查 | 条目 3 | 同上，test "single-batch mode does not run preflight" 包含在 10 passed 中 | ✅ |
| match 放行 | 条目 3 | `npx vitest run test/queue-audit.test.ts` → Tests 5 passed（"match: audit.result recorded, queue continues"） | ✅ |
| mismatch 在 PASS 与 FIX 两种裁决下都停且退出码 30 | 条目 3 | 同上（"mismatch with PASS verdict" + "mismatch with FIX verdict" 各检查 exit 30） | ✅ |
| `no_init` 不停 | 条目 3 | 同上（"no_init does not stop the queue"） | ✅ |
| 没有 reviewer 的运行不记 | 条目 3 | 同上（"runs without reviewer do not record audit.result"） | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动受保护路径（含 `.collie/collie.toml`）或 `templates/collie.toml` | task.md:47 | git diff 为空 | ✅ |
| 为测试而删除/跳过测试 | task.md:48 | diff 中无 `.skip`、`.todo`、删除 `it(` 行 | ✅ |
| 改注释/字面以通过验收 | task.md:49 | 无此类操作 | ✅ |
| 改动规则 1-10 和放行判定六项 | task.md:50 | `src/run.ts` diff 中无 rule/gate 定义改动 | ✅ |
| audit 结果改变结论或 backlog 状态 | task.md:50 | `audit.result` 仅记录 journal；`audit_mismatch` 只停队列不改 verdict | ✅ |
| 改动单批次模式的启动条件 | task.md:50 | `runBatch` 入口无改动 | ✅ |
| 新增依赖 | task.md:50 | package.json 无变化 | ✅ |

### 不变量数值变化

`test/invariants.test.ts` 的 diff 仅新增两个 `it()` 块（字符串包含检查），无数值上下限改动。
`test/schema.test.ts` 中 `EVENT_TYPES` 计数从 35 → 37（+2 个新事件类型 `queue.preflight`、`audit.result`），与实际新增一致。

## 声称与实测的差异

无。

## 结论与理由

全部 11 条验收命令实跑通过。两个提交确实存在且已推送到远端（head 是 origin/main 的祖先）。无受保护文件被修改，无新增依赖。diff 范围完全落在 task.md 的三个条目内，无范围蔓延。每一条额外禁止和条目具体实现要求均逐条核对满足。测试文件实跑全部通过。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b01",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "d337c7e505621b2cdf0cef6a3bbafad7d0902d38",
      "772fb4181709d411e497c552948a1f33212628d9"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "52 files, 1002 tests passed" },
      { "cmd": "npm test -- test/preflight.test.ts test/queue-audit.test.ts", "exit_code": 0, "summary": "2 files, 15 tests passed" },
      { "cmd": "grep -cE '^\\ +it\\(' test/preflight.test.ts | grep -qE '^([8-9]|[1-9][0-9])$'", "exit_code": 0, "summary": "10 >= 8" },
      { "cmd": "grep -cE '^\\ +it\\(' test/queue-audit.test.ts | grep -qE '^([4-9]|[1-9][0-9])$'", "exit_code": 0, "summary": "5 >= 4" },
      { "cmd": "npx tsx src/cli.ts preflight 2>&1 | grep -qE 'worktree_clean'", "exit_code": 0, "summary": "worktree_clean found in output" },
      { "cmd": "grep -vE '^\\s*(//|\\*|/\\*)' src/run.ts | grep -qE 'queue\\.preflight' && grep -qE 'queue\\.preflight' src/schema/index.ts", "exit_code": 0, "summary": "queue.preflight in run.ts code and schema" },
      { "cmd": "grep -vE '^\\s*(//|\\*|/\\*)' src/run.ts | grep -qE 'audit_mismatch' && grep -qE 'audit_mismatch' test/queue-audit.test.ts", "exit_code": 0, "summary": "audit_mismatch in run.ts code and tests" },
      { "cmd": "grep -qE 'min_free_mb' src/schema/index.ts", "exit_code": 0, "summary": "min_free_mb in schema" },
      { "cmd": "grep -qE 'queue\\.preflight' test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
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
  "reason": "All 11 acceptance commands pass. Commits pushed (head is ancestor of origin/main). No protected files modified, no new dependencies. All structural and behavioral requirements verified with file:line evidence and test execution. CI 以 R2 取证为准。"
}
```
