# 批次 v046-b08 汇报

## 做了什么

这是第 2 次运行。上一轮降级原因是 `ci_conclusion=failure`（CI 失败），代码本身无缺口。
本轮确认上一轮的两个代码提交（eacde6d、777ce2a）均已在树中，所有验收标准通过，无需新增代码提交。

**条目 1：`src/acceptance.ts` — `prepareAcceptance(opts)` 函数**（上一轮已完成）

新建 `src/acceptance.ts`，导出 `prepareAcceptance(opts)` 函数。实现逻辑：

- 在系统临时目录下用 `mkdtempSync` + `addWorktree` 创建检出于 `headSha` 的 git worktree（目录名以 `collie-accept-` 开头）。
- 如果主仓库有 `node_modules` 且 worktree 中不存在，则创建符号链接。
- 最多拉起测试 agent `testerMax` 次：每次拉起后做红检查；过了就收集文件并返回 `ok: true`；不过就把问题清单作为 `previous_problems` 交给下一次。
- 测试 agent 以非零退出码退出时，不做红检查，直接算未过，原因写明退出码。
- 过了之后只取走 `test/acceptance/<批次>/` 下的 `new.test.ts`、`MAP.md`，以及批次有 `[保持]` 情形时的 `keep.test.ts`。
- 不往主仓库写任何东西、不提交。不论成败或异常，worktree 都在 finally 中移除。
- 给了 `record` 时，记录 `tester.started`、`tester.finished`、`redcheck.result` 事件。

**条目 2：`src/roles/tester.ts` — `previous_problems` 支持**（上一轮已完成）

`TesterInputSchema` 加了可选的 `previous_problems`。`buildTesterPrompt` 在非空时于「情形」之前插入「上一次没过的原因」一节。

**条目 3：测试**（上一轮已完成）

`test/prepare-acceptance.test.ts` 三组共 10 条；`test/tester.test.ts` 新加 3 条；`test/invariants.test.ts` 加 2 条不变量。

## 测试结果

```
$ npm run lint && npm run typecheck && npm test
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

> tsc -p tsconfig.json

> vitest run
 Test Files  63 passed (63)
      Tests  1308 passed (1308)
   Duration  20.95s
```

所有 8 条验收命令均通过。

## 偏离或疑问

无。上一轮降级原因是 CI 失败，代码无问题。本轮无新代码提交，仅推送确认并重写 report。

## 下一步建议

- 下一批次将 `prepareAcceptance` 接进 `src/run.ts` 的队列流程（SPEC 16.12 接线部分）。
- 接线后需要在 `.collie/collie.toml` 中加 `[agent.tester]` 和 `[verify] static`。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b08",
  "head_sha": "777ce2a6316797555c64728e39b15900df953ab5",
  "claims": {
    "commits": ["eacde6dc99b158ffd3b2ed3663b459636681ef19", "777ce2a6316797555c64728e39b15900df953ab5"],
    "tests_passed": 1308,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
