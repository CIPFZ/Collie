Good. The sandbox passes `extra: Partial<CliDeps>` to the `main` function, which allows the tests to inject `livenessNow` and `livenessSetTimer` through `CliDeps`. The scenario-g test passes `livenessNow: clock.now` this way. The injection chain is:

`Sandbox.run(runner, { livenessNow })` → `main(argv, { livenessNow })` → `CliDeps` → `RunContext` → `LivenessConfig.now`

Now I have all the evidence needed. Let me write the verdict.

# 批次 v02-b04 审核

## 取证过程

### 1. 验收命令逐条实跑

**命令 1: `npm run lint`**
```
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✅

**命令 2: `npm run typecheck`**
```
> tsc -p tsconfig.json
```
退出码：0 ✅

**命令 3: `npm test`**
```
Test Files  29 passed (29)
     Tests  572 passed (572)
  Duration  6.62s
```
退出码：0 ✅

**命令 4: `npm test && npm test && npm test`**
三次运行均为 29 文件通过、572 测试通过（6.46s / 6.41s / 6.39s）。
退出码：0 ✅

**命令 5: `! grep -qE "toBeLessThan\(2000\)|Date.now" test/scenario-g.test.ts`**
退出码：0 ✅（未找到匹配项，即场景 G 不再断言真实耗时）

**命令 6: `! grep -qE "interrupt\?\." src/runner/claude.ts`**
退出码：0 ✅（未找到 `interrupt?.` 的可选链调用）

**命令 7: `grep -qE "reviewer" test/heartbeat.test.ts`**
退出码：0 ✅（存在 "reviewer" 字样）

### 2. 提交事实

```
ff0f05754945bdcdca8ae0504c649ea721a0018c runner: heartbeat full-run lifecycle, required interrupt, injected liveness clock (SPEC 11.2, 11.3, 11.5)
```
单一提交在范围内。`git branch -r --contains ff0f057` 显示 `origin/main`，确认已推送。

### 3. CI 查证

无 `GITHUB_TOKEN` / `gh auth`，无法通过 `gh run list` 查询 CI。
`ci_conclusion: "unknown"`，`ci_branch_matched: null`。

### 4. 受保护文件检查

```
git diff --stat eb2e231..ff0f057 -- SPEC.md CONSTRAINTS.md ROLES.md
```
输出为空——无受保护文件被修改。`spec_diff_lines = 0`。

### 5. 依赖变化

```
git diff --stat eb2e231..ff0f057 -- package.json package-lock.json
```
输出为空——无依赖变化。

### 6. 范围检查

diff 涉及 10 个文件：`src/cli.ts`、`src/heartbeat.ts`、`src/ladder.ts`、`src/progress.ts`、`src/run.ts`、`src/runner/claude.ts`、`test/heartbeat.test.ts`、`test/ladder.test.ts`、`test/runner-claude.test.ts`、`test/scenario-g.test.ts`。全部落在三个条目范围之内，无范围蔓延。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 29 files, 572 tests passed, exit 0 | ✅ |
| 全量连跑 3 次稳定 | `npm test && npm test && npm test` | 3 次均 572 passed, exit 0 | ✅ |
| 场景 G 不再断言真实耗时 | `! grep -qE "toBeLessThan\(2000\)\|Date.now" test/scenario-g.test.ts` | exit 0 | ✅ |
| interrupt 不再可选 | `! grep -qE "interrupt\?\." src/runner/claude.ts` | exit 0 | ✅ |
| 心跳并行拒绝覆盖 reviewer 阶段 | `grep -qE "reviewer" test/heartbeat.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 心跳覆盖整个 run：`run.finished` 之后才删除 | 条目 1, SPEC 11.3 | `src/run.ts:313-321`：`finish()` 先写 `run.finished` 事件再调 `removeHeartbeat`；旧的两处独立 `removeHeartbeat` 调用已删除 | ✅ |
| 加 `phase` 字段 | 条目 1, SPEC 11.3 | `src/heartbeat.ts:12`：`HeartbeatPhaseSchema = z.enum(['worker','reviewer','ci','arbiter'])`；`src/run.ts:303` 初始 phase='worker'；`src/run.ts:494,523,549` 依次转为 reviewer→ci→arbiter | ✅ |
| 加 `worker_pid` 字段 | 条目 1, SPEC 11.3 | `src/heartbeat.ts:20`：`worker_pid: z.number().int().positive().optional()`；`src/run.ts:422-423` 在 `onStarted` 中写入 `handle.pid` | ✅ |
| 孤儿检测同时看两个 pid | 条目 1, SPEC 11.3 | `src/heartbeat.ts:140-142`：`pidAlive \|\| workerPidAlive` | ✅ |
| 补「reviewer 阶段并行启动被拒绝」用例 | 条目 1 | `test/heartbeat.test.ts:159-181`：三个测试分别覆盖 reviewer、ci、arbiter 阶段 | ✅ |
| 补 dual-pid 检测用例 | 条目 1 | `test/heartbeat.test.ts:120-130`：worker_pid alive + pid dead → alive；both dead → orphan | ✅ |
| `stop('soft')` 必调并 `await interrupt()` | 条目 2, SPEC 11.2 | `src/runner/claude.ts:220-229`：`const interruptFn = queryIterable.interrupt; ... await interruptFn();` | ✅ |
| 缺失 interrupt 即抛错 | 条目 2, SPEC 11.2 | `src/runner/claude.ts:225-227`：`if (interruptFn === undefined) throw new Error(...)` | ✅ |
| 抛错有测试覆盖 | 条目 2 | `test/runner-claude.test.ts:335-355`：`soft stop throws when interrupt() is missing` | ✅ |
| `run.finished` 带 worker `exit_code`/`stop_reason` | 条目 2, SPEC 11.7 | `src/run.ts:317-318`：`worker_exit_code` 与 `worker_stop_reason` 写入事件 | ✅ |
| progress 运行记录带 worker `exit_code`/`stop_reason` | 条目 2, SPEC 11.7 | `src/progress.ts:23-26`：`workerExitCode?`/`workerStopReason?`；`src/progress.ts:65-69`：渲染输出 | ✅ |
| `LivenessMonitor` 注入 `now()` | 条目 3, SPEC 11.5 | `src/ladder.ts:77-78,109-110`：`now?: () => number`；`this.nowFn = config.now ?? (() => Date.now())`；所有 `Date.now()` 替换为 `this.nowFn()` | ✅ |
| `LivenessMonitor` 注入 `setTimer()` | 条目 3, SPEC 11.5 | `src/ladder.ts:82-83,111`：`setTimer?`；`this.setTimerFn = config.setTimer ?? ((cb,ms) => setTimeout(cb,ms))`；`scheduleCheck` 用 `this.setTimerFn` | ✅ |
| `test/scenario-g.test.ts` 改用假时钟 | 条目 3 | `test/scenario-g.test.ts:34-41`：`fakeClock()`；`test/scenario-g.test.ts:139,171`：传入 `livenessNow: clock.now` | ✅ |
| `test/ladder.test.ts` 删除真实耗时断言 | 条目 3 | diff 移除 `Date.now()` 测量、`expect(elapsed).toBeLessThan(2000)` | ✅ |
| 额外禁止：改动受保护路径 | backlog | `git diff -- SPEC.md CONSTRAINTS.md ROLES.md` 为空 | ✅ |
| 额外禁止：实现 resume/中断标记注入 | backlog | diff 中无 resume 逻辑、无 `interrupted_at` 赋值、无 `attempt` 递增 | ✅ |

## 声称与实测的差异

无。本批次裁决不使用 worker 的 report（reviewer 工作区不含 report.md），所有证据均为独立取证。

## 结论与理由

七条验收命令全部实跑通过，三次连跑稳定无随机失败。三个条目的每项具体要求（心跳全生命周期覆盖、interrupt 必调 await 并抛错、注入假时钟消除时序脆弱）均经代码审查确认实现。无受保护文件修改，无依赖变化，无范围蔓延，无 v02-b05 领域的 resume/中断标记越界实现。head_sha 已推送到 origin/main。CI 无法查询（无 GH_TOKEN），按 unknown 处理。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b04",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["ff0f05754945bdcdca8ae0504c649ea721a0018c"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier zero errors" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "29 files, 572 passed, 0 failed" },
      { "cmd": "npm test && npm test && npm test", "exit_code": 0, "summary": "3x stable: 572/572/572 passed" },
      { "cmd": "! grep -qE \"toBeLessThan\\(2000\\)|Date.now\" test/scenario-g.test.ts", "exit_code": 0, "summary": "no real-time assertions in scenario-g" },
      { "cmd": "! grep -qE \"interrupt\\?\\.\" src/runner/claude.ts", "exit_code": 0, "summary": "no optional-chained interrupt" },
      { "cmd": "grep -qE \"reviewer\" test/heartbeat.test.ts", "exit_code": 0, "summary": "reviewer phase covered in heartbeat tests" }
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
  "reason": "七条验收命令全部实跑通过，三次连跑稳定；三个条目逐条代码审查确认；无受保护文件、无依赖变化、无范围蔓延、无越界实现。CI 无法查询（无 GH_TOKEN）。"
}
```
