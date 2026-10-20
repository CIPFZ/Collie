All evidence is gathered. Let me now compose the full verdict.

---

# 批次 v02-b02 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline dcc9dd607daf14dd634132f7ccb777547e3ca2a4..1299f3a
1299f3a test: heartbeat lifecycle and scenario E front-half (SPEC 11.3-11.4, 11.9)
42b7722 runner: stream.ndjson, heartbeat.json, orphan detection, rescue (SPEC 11.3-11.4)
f800f19 runner: add RunHandle, resumeSessionId, onStarted, stopReason (SPEC 11.2)
```

3 个提交，均在取证范围内。信封提交 `58f664b report(collie): v02-b02` 在 `head_sha` 之后，不在范围内（SPEC 3.4 正确）。

### 2. 远端推送确认

```
$ git branch -r --contains 1299f3a
  origin/HEAD -> origin/main
  origin/main

$ git log --oneline 1299f3a..58f664b8
58f664b report(collie): v02-b02

$ git diff --name-only 1299f3a..58f664b8
.collie/batches/v02-b02/report.md
```

`1299f3a` 在 `origin/main` 上。后续只有一个 report 信封提交，只改 `.collie/batches/` 下文件，符合 SPEC 3.5 的后代采信条件。

### 3. 受保护文件检查

```
$ git diff --stat dcc9dd607daf14dd634132f7ccb777547e3ca2a4..1299f3a -- SPEC.md CONSTRAINTS.md
(空输出)
```

受保护文件未被修改。`spec_diff_lines = 0`。

### 4. 依赖变化

```
$ git diff dcc9dd607daf14dd634132f7ccb777547e3ca2a4..1299f3a -- package.json
(空输出)

$ git diff dcc9dd607daf14dd634132f7ccb777547e3ca2a4..1299f3a -- package-lock.json
(空输出)
```

无新增依赖。

### 5. CI 取证

```
$ gh run list --branch main --limit 5
(失败: gh auth not configured — exit code 4)
```

环境中无 `gh` 认证，无法取证 CI 实际运行结论。`ci_conclusion` 设为 `"unknown"`，`ci_branch_matched` 设为 `null`。按 SPEC 3.5，`ci_branch_matched=null` 视为未取证，arbiter 会根据规则 7 处理。

### 6. 验收命令实跑

#### 6.1 `npm run lint`
- 退出码: 0
- 输出: `All matched files use Prettier code style!`

#### 6.2 `npm run typecheck`
- 退出码: 0
- 输出: 无错误

#### 6.3 `npm test`
- 退出码: 0
- 输出: `Test Files  27 passed (27)`, `Tests  554 passed (554)`

#### 6.4 `npm test -- test/scenario-e.test.ts`
- 退出码: 0
- 输出: `Test Files  1 passed (1)`, `Tests  5 passed (5)`

#### 6.5 `npm test -- test/heartbeat.test.ts`
- 退出码: 0
- 输出: `Test Files  1 passed (1)`, `Tests  10 passed (10)`

#### 6.6 `git check-ignore -q .collie/heartbeat.json`
- 退出码: 0

#### 6.7 `grep -qE "resume" test/runner-claude.test.ts`
- 退出码: 0

#### 6.8 `! grep -rlE "@anthropic-ai" src --include='*.ts' | grep -v '^src/runner/'`
- 退出码: 0

全部 8 条验收命令通过。

### 7. diff 范围与任务条目对照

变更文件清单（16 个文件，+694 行，-28 行）：

| 文件 | 对应条目 |
|---|---|
| `.gitignore` | 条目 2：heartbeat 扩展名修正 |
| `src/cli.ts` | 条目 2：GITIGNORE_ENTRIES 扩展名修正 |
| `src/heartbeat.ts`（新增） | 条目 2：heartbeat 管理 |
| `src/roles/worker.ts` | 条目 1：传递 onEvent/onStarted/resumeSessionId |
| `src/run.ts` | 条目 2/3：stream、heartbeat 集成、rescue |
| `src/runner/claude.ts` | 条目 1：RunHandle、soft/hard/kill 映射、resume |
| `src/runner/fake.ts` | 条目 1：三级 stop、scriptable ignoreSoft |
| `src/runner/index.ts` | 条目 1：RunHandle、RunOptions、RunResult 追加 |
| `src/schema/index.ts` | 条目 2：run.orphaned、worker.rescued 事件 |
| `test/heartbeat.test.ts`（新增） | 条目 2：heartbeat 测试 |
| `test/runner-claude.test.ts` | 条目 1：resume 映射、RunHandle 测试 |
| `test/runner-fake.test.ts` | 条目 1：call recording 更新 |
| `test/scenario-e.test.ts`（新增） | 条目 3：场景 E 前半段 |
| `test/schema.test.ts` | 条目 2：事件类型数量更新 |
| `test/skeleton.test.ts` | 条目 2：heartbeat 扩展名修正 |
| `test/support/sandbox.ts` | 条目 2：sandbox gitignore 修正 |

全部变更落在 3 个条目范围内，无范围蔓延。

### 8. 关键实现正确性核查

**soft ≠ hard（SPEC 11.2 约束）**：
- `soft`：设置 `softStopRequested = true`，`for await` 循环在处理当前消息后 `break`，controller 不被 abort
- `hard`/`kill`：调用 `controller.abort()`
- 测试 `'soft stop breaks the stream without aborting the controller'` 明确断言 `abortController?.signal.aborted` 为 `false`

**resume 字段映射**：
- `claude.ts` 第 165 行：`opts.resumeSessionId` → `queryOptions.resume`
- 测试断言：`expect(calls[0]?.options?.resume).toBe('session-42')`

**sessionId 不丢失（SPEC 11.2）**：
- `extractSessionId()` 从每条消息提取 session_id
- catch 块中若有 `lastSessionId`，返回 `RunResult` 而不是抛出
- 测试 `'preserves sessionId when the SDK throws an error'` 验证

**SDK 无 pid 时省略**：
- ClaudeRunner 的 handle 不设 pid 属性
- 测试断言 `expect(handle).not.toHaveProperty('pid')`

**heartbeat 生命周期**：
- 运行开始时 `writeHeartbeat`（onStarted 回调中）
- 每条事件 `touchHeartbeat`（onEvent 回调中）
- 正常结束和异常结束都 `removeHeartbeat`
- 启动时检查：pid 存活 → 拒绝启动；pid 死亡 → orphan → 记事件 → rescue → 删除

**脏工作区救援（SPEC 11.4）**：
- `rescueDirtyWorkspace()`：检查 `git status --porcelain` → `git add -A` → `git commit -m "wip(collie): <batch_id> rescue"`
- 在三处调用：orphan 检测后、worker crash 后、worker 正常退出后
- 场景 E 测试验证 rescue 提交存在且含两个脏文件

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, all files pass | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, no errors | ✅ |
| 全部测试通过 | `npm test` | exit 0, 27 files / 554 tests | ✅ |
| 场景 E 前半段 | `npm test -- test/scenario-e.test.ts` | exit 0, 5 tests | ✅ |
| 心跳与孤儿检测 | `npm test -- test/heartbeat.test.ts` | exit 0, 10 tests | ✅ |
| 心跳文件被忽略 | `git check-ignore -q .collie/heartbeat.json` | exit 0 | ✅ |
| resume 字段映射有断言 | `grep -qE "resume" test/runner-claude.test.ts` | exit 0 | ✅ |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 | ✅ |

## 声称与实测的差异

无。测试数字实测 554 passed / 0 failed；提交确实存在且已推送；受保护文件未被修改；无新增依赖。

## 结论与理由

**PASS**。

全部 8 条验收命令实跑通过。3 个提交已推送至 `origin/main`。受保护文件零改动。无新增依赖。diff 范围严格落在任务 3 个条目之内，无范围蔓延。关键实现正确性经代码审读确认：soft 与 hard 为不同机制（flag break vs controller abort）、resume 字段映射有明确测试断言、sessionId 在异常路径不丢失、heartbeat 完整生命周期正确、脏工作区救援逻辑覆盖三种退出路径。

CI 取证因环境无 `gh` 认证无法执行，`ci_branch_matched` 设为 `null`；此项由 arbiter 规则 7 处理。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b02",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["f800f19", "42b7722", "1299f3a"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "27 files, 554 passed, 0 failed" },
      { "cmd": "npm test -- test/scenario-e.test.ts", "exit_code": 0, "summary": "1 file, 5 passed" },
      { "cmd": "npm test -- test/heartbeat.test.ts", "exit_code": 0, "summary": "1 file, 10 passed" },
      { "cmd": "git check-ignore -q .collie/heartbeat.json", "exit_code": 0, "summary": "heartbeat.json is gitignored" },
      { "cmd": "grep -qE \"resume\" test/runner-claude.test.ts", "exit_code": 0, "summary": "resume assertion exists" },
      { "cmd": "! grep -rlE \"@anthropic-ai\" src --include='*.ts' | grep -v '^src/runner/'", "exit_code": 0, "summary": "no SDK leak outside src/runner/" }
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
  "reason": "全部 8 条验收命令实跑通过；3 个提交已推送至 origin/main；受保护文件与依赖零变化；diff 范围落在条目之内；关键实现 soft≠hard、resume 映射、sessionId 保全、heartbeat 生命周期、rescue 逻辑经代码审读确认正确。CI 因环境无 gh 认证未取证（ci_branch_matched=null），交由 arbiter 规则 7 裁定。"
}
```
