# 批次 v045-b01 汇报

## 做了什么

### 条目 1：collie preflight 命令
新建 `src/preflight.ts`，实现四个基础检查项：
- `worktree_clean`：通过 `gitStatus` 检查，存在心跳文件时视为孤儿运行、返回 ok
- `remote_in_sync`：`git fetch` + `isAncestor` 检查本地不落后于远端
- `ci_token`：复用 `run.ts` 的 `readCiTokenChecked`，避免直接访问 `.token_file`（不变量约束）
- `disk_free`：通过注入的 `diskFreeMb` 函数与 `limits.min_free_mb` 比较

`--smoke` 额外执行 `runner`（FakeRunner 单轮 trivial prompt）和 `ci_query`（queryCi 查 CI）。

`cli.ts` 接线新增 `preflight` 命令，支持 `--smoke`、`--json`、`--runner` 选项。
`CliDeps` 新增 `diskFreeMb` 可选字段用于测试注入。

`LimitsSchema` 新增 `min_free_mb`（可选，缺省 1024），**未修改** `.collie/collie.toml` 和 `templates/collie.toml`。

### 条目 2：队列 preflight 门禁与 audit 集成
- `runQueue` 在选第一个批次之前执行不带 `--smoke` 的检查，记录 `queue.preflight` 事件；失败时记 `queue.finished`（reason: `preflight_failed`）并退出码 1
- 单批次模式不自动执行 preflight
- 从 `cli.ts` 的 `audit` 命令逻辑中提取 `auditReviewerTools` 函数到 `run.ts`，供两处共用
- `runBatch` 在 reviewer 结束后调用 `auditReviewerTools`，记录 `audit.result` 事件（outcome: match/mismatch/no_init）
- `--continue` 模式下 mismatch → `queue.paused`（reasons 含 `audit_mismatch`）+ `queue.finished`（reason: `paused`），退出码 30
- `collie audit` 命令的输出与退出码不变

### 条目 3：测试
- `test/preflight.test.ts`：10 个测试（clean pass、dirty fail、heartbeat orphan ok、local behind remote、disk below threshold、--smoke pass、--smoke runner fail、--json output、queue preflight_failed、single-batch skip）
- `test/queue-audit.test.ts`：5 个测试（match 放行、mismatch+PASS 停、mismatch+FIX 停、no_init 不停、无 reviewer 不记）
- `test/invariants.test.ts` 新增 2 条：`queue.preflight` in run.ts、`audit.result` in schema

同步更新了 `test/config.test.ts`（limits 加 min_free_mb）、`test/schema.test.ts`（EVENT_TYPES 从 35 调到 37）、`test/support/sandbox.ts`（注入 diskFreeMb 默认值）。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting... All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
（零错误）

$ npm test
 Test Files  52 passed (52)
      Tests  1002 passed (1002)
   Duration  16.51s

$ npm test -- test/preflight.test.ts test/queue-audit.test.ts
 Test Files  2 passed (2)
      Tests  15 passed (15)
```

全部 11 条验收标准均已通过。

## 偏离或疑问

无。所有实现均严格按照 task 和 SPEC 14.1 的要求完成。

## 下一步建议

- 若后续批次新增 preflight 检查项（如 Node 版本校验），只需在 `runPreflight` 中追加 check
- audit 的 mismatch 检测依赖 SDK init 事件中的 tools 列表；FakeRunner 测试需要手动提供 events 来模拟 init

```json
{
  "schema_version": 1,
  "batch_id": "v045-b01",
  "head_sha": "772fb4181709d411e497c552948a1f33212628d9",
  "claims": {
    "commits": ["772fb4181709d411e497c552948a1f33212628d9"],
    "tests_passed": 1002,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
