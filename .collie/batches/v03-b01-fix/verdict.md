I now have all the evidence needed. Let me compile the final verdict.

# 批次 v03-b01-fix 审核

## 取证过程

### 1. 提交确认

```
git log --format='%H' d2d30323f5da49988742c6a58a647743f07671ba..13a5cee6175bfcfe788111002a60b22ba86ecd35
```

4 个提交在范围内：
- `13a5cee6175bfcfe788111002a60b22ba86ecd35` — test: push invariant and scenario-f timeout (v03-b01-fix)
- `9faa3d0dd43c26a2567a27a1413958e7b68d9fca` — test: scenario I — startup push only for failed verdict (SPEC 12.1 v03-b01-fix)
- `1832377296ae394e207486953833ab3a3f721b52` — run: conditional startup push before orphan rescue (SPEC 12.1 v03-b01-fix)
- `6a96607b4ff4a633f6ef348b8f9f3f544ac3e0ed` — docs: issue v03-b01-fix task envelope

### 2. 远端推送确认

```
git branch -r --contains 13a5cee6175bfcfe788111002a60b22ba86ecd35
→ origin/HEAD -> origin/main
  origin/main
```

head_sha 已在 origin/main 上。✅

### 3. CI 确认

```
gh api repos/CIPFZ/Collie/actions/runs ...
→ To get started with GitHub CLI, please run:  gh auth login
```

无 GitHub 凭据，无法查询 CI。`ci_conclusion` 填 `unknown`、`ci_branch_matched` 填 `null`。CI 以 R2 取证为准。

### 4. 受保护文件

```
git diff --stat d2d3032..13a5cee -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
→ （空输出）
```

0 行受保护文件改动。✅

### 5. 依赖变化

```
git diff d2d3032..13a5cee -- package.json package-lock.json
→ （空输出）
```

无依赖变化。✅

### 6. 验收命令实跑

见下方逐条验收表。

### 7. 行为测试实跑

```
npx vitest run test/scenario-i.test.ts
→ Test Files  1 passed (1)
   Tests  3 passed (3)

npx vitest run test/invariants.test.ts
→ Test Files  1 passed (1)
   Tests  21 passed (21)

npx vitest run test/schema.test.ts
→ Test Files  1 passed (1)
   Tests  60 passed (60)
```

所有行为测试通过。✅

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，ESLint + Prettier 零错误 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0，36 files passed，702 tests passed | ✅ |
| 场景 F 连跑 3 次 | `for i in 1 2 3; do npx vitest run test/scenario-f.test.ts \|\| exit 1; done` | exit 0，3 次均 4 tests passed | ✅ |
| 补推有条件 | `grep -qE "push_skipped" src/run.ts && grep -qE "push_skipped" src/schema/index.ts && grep -cE "await push\(" src/run.ts \| grep -qE "^[1-3]$"` | exit 0 | ✅ |
| 救援提交不被推送有测试 | `grep -qE "worker\.rescued" test/scenario-*.test.ts && grep -qE "push_skipped" test/scenario-*.test.ts` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "push_skipped\|await push" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：run.ts 启动阶段补推逻辑

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 补推移到孤儿检测与救援**之前** | task 条目 1 | `src/run.ts:730-771` 为 catch-up push 块，`src/run.ts:773-793` 为 orphan detection。catch-up 在前 | ✅ |
| 只有 `verdict.push_failed.sha == HEAD` 且远端不含时才 push | task 条目 1 | `src/run.ts:733-734` 检查 `pushFailedSha !== undefined`，`src/run.ts:737` 比较 `headSha !== pushFailedSha`，`src/run.ts:744` 调 `remoteContains` | ✅ |
| 条件不满足记 push_skipped，reason=head_is_not_verdict | task 条目 1 | `src/run.ts:739`: `rec.record('verdict.push_skipped', { head: headSha, reason: 'head_is_not_verdict' })` | ✅ |
| 条件不满足记 push_skipped，reason=already_on_remote | task 条目 1 | `src/run.ts:749`: `rec.record('verdict.push_skipped', { head: headSha, reason: 'already_on_remote' })` | ✅ |
| 推送成功记 verdict.pushed | task 条目 1 | `src/run.ts:754-758`: `rec.record('verdict.pushed', { sha, remote, branch })` | ✅ |
| 没有 push_failed 事件时不调用 push、不记事件 | task 条目 1 | `src/run.ts:733`: `if (pushFailedSha !== undefined)` 才进入逻辑块；`findLastVerdictPushFailedSha` 返回 `undefined` 时整个块跳过，`src/run.ts:771` 注释确认 | ✅ |
| schema 加 verdict.push_skipped | task 条目 1 | `src/schema/index.ts:163-164`: `'verdict.push_skipped'` 在 EVENT_TYPES 中 | ✅ |
| 旧的无条件 push（位于救援之后）已移除 | task 条目 1 隐含 | diff 显示 `src/run.ts` 旧行 721-728（unconditional push after orphan rescue）已删除 | ✅ |
| `findLastVerdictPushFailedSha` 正确扫描跨 run 的 journal | 实现细节 | `src/run.ts:697-719`: 遍历所有 run 目录排序后的 journal events，跟踪最新的 push_failed sha，遇到 verdict.pushed 同 sha 时清零 | ✅ |

### 条目 2：场景测试（test/scenario-i.test.ts）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| I-a: worker 写脏文件 + R2 被 kill，第 2 轮远端不含 rescued sha | task 条目 2a | `test/scenario-i.test.ts:96-147`: 写 dirty-a.txt、设 dead heartbeat、round 2 worker killed、断言 remote 不含 rescuedSha、journal 无 verdict.pushed。`npx vitest run test/scenario-i.test.ts` → Tests 3 passed | ✅ |
| I-b: 注入 push 失败，第 2 轮远端含裁定 sha、journal 有 verdict.pushed | task 条目 2b | `test/scenario-i.test.ts:154-187`: workerThenBlock 安装 pre-receive hook 让 R2 push 失败，round 2 移除 hook，断言 remote 含 failedSha、journal 有 verdict.pushed。`npx vitest run test/scenario-i.test.ts` → Tests 3 passed | ✅ |
| I-c: HEAD 移走后不推送、记 push_skipped reason=head_is_not_verdict | task 条目 2c | `test/scenario-i.test.ts:194-222`: round 1 同 I-b，round 2 前加 extra commit 移走 HEAD，断言 verdict.push_skipped reason=head_is_not_verdict。`npx vitest run test/scenario-i.test.ts` → Tests 3 passed | ✅ |

### 条目 3：invariants + scenario-f timeout

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| invariants 加 push 调用检查 | task 条目 3 | `test/invariants.test.ts:157-173`: 扫描 run.ts 所有 `await push(` 行，检查前 5 行含 `push_failed` 或 `verdict`。`npx vitest run test/invariants.test.ts` → Tests 21 passed | ✅ |
| scenario-f 超时从默认改为 30 秒 | task 条目 3 | `test/scenario-f.test.ts:41`: `describe('scenario F: ...', { timeout: 30_000 }, () => {`。只改 describe 选项，不改断言 | ✅ |

### 额外禁止

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动受保护路径 | task 额外禁止 | `git diff --stat d2d3032..13a5cee -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml` → 空输出 | ✅ |
| 不删除或跳过测试 | task 额外禁止 | diff 中无 `.skip`、无删除测试行为；所有修改为新增测试或参数调整 | ✅ |
| 不改动裁定提交在运行末尾的正常推送路径 | task 额外禁止 | `src/run.ts:909-919`（escalation path push）仅注释改动（`escalation commit` → `verdict commit (escalation path)`），push + verdict.pushed + verdict.push_failed 代码不变。`src/run.ts:1321-1334`（normal path push）完全不在 diff 中。被移除的是异常处理路径中的裸 push（旧行 ~1310-1315），该路径不属于「正常推送」且未记录任何事件 | ✅ |

## 声称与实测的差异

无（本批次为独立取证，未读取 report.md）

## 结论与理由

**PASS。**

全部 7 条验收命令实跑通过。3 个条目的实现要求逐条核对，代码层与测试层均满足：
1. 补推逻辑正确地移到孤儿检测之前，条件判断（push_failed sha == HEAD + 不在远端）齐全，三种 reason 路径清晰，无 push_failed 事件时无动作无记录。
2. 场景 I 三个子场景（a/b/c）用 pre-receive hook 与 heartbeat 模拟真实失败路径，断言精确覆盖远端状态与 journal 事件。
3. 不变量测试保证 run.ts 中所有 push 调用的上下文含 push_failed/verdict 字样，scenario-f 超时仅改 describe 选项。

受保护文件零改动、依赖无变化、额外禁止逐条满足。提交已推送至 origin/main。CI 无 token 无法取证，以 R2 实测为准。

```json
{
  "schema_version": 1,
  "batch_id": "v03-b01-fix",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "6a96607b4ff4a633f6ef348b8f9f3f544ac3e0ed",
      "1832377296ae394e207486953833ab3a3f721b52",
      "9faa3d0dd43c26a2567a27a1413958e7b68d9fca",
      "13a5cee6175bfcfe788111002a60b22ba86ecd35"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "ESLint + Prettier zero errors" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "36 files passed, 702 tests passed" },
      { "cmd": "for i in 1 2 3; do npx vitest run test/scenario-f.test.ts || exit 1; done", "exit_code": 0, "summary": "3 runs × 4 tests passed" },
      { "cmd": "grep -qE \"push_skipped\" src/run.ts && grep -qE \"push_skipped\" src/schema/index.ts && grep -cE \"await push\\(\" src/run.ts | grep -qE \"^[1-3]$\"", "exit_code": 0, "summary": "push_skipped in run.ts and schema, 3 push calls" },
      { "cmd": "grep -qE \"worker\\.rescued\" test/scenario-*.test.ts && grep -qE \"push_skipped\" test/scenario-*.test.ts", "exit_code": 0, "summary": "worker.rescued and push_skipped in scenario tests" },
      { "cmd": "grep -qE \"push_skipped|await push\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant covers push calls" }
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
  "reason": "全部 7 条验收命令实跑通过；3 个条目的代码实现与测试覆盖逐条核对满足；受保护文件与依赖无变化；额外禁止逐条满足。CI 以 R2 取证为准。"
}
```
