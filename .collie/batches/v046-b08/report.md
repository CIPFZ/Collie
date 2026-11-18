# 批次 v046-b08 汇报

## 做了什么

**条目 1：`src/acceptance.ts` — `prepareAcceptance(opts)` 函数**

新建 `src/acceptance.ts`，导出 `prepareAcceptance(opts)` 函数。实现逻辑：

- 在系统临时目录下用 `mkdtempSync` + `addWorktree` 创建一个检出于 `headSha` 的 git worktree（目录名以 `collie-accept-` 开头）。
- 如果主仓库有 `node_modules` 且 worktree 中不存在，则创建符号链接。
- 最多拉起测试 agent `testerMax` 次：每次拉起后做红检查；过了就收集文件并返回 `ok: true`；不过就把问题清单作为 `previous_problems` 交给下一次。
- 测试 agent 以非零退出码退出时，不做红检查，直接算未过，原因写明退出码。
- 过了之后只取走 `test/acceptance/<批次>/` 下的 `new.test.ts`、`MAP.md`，以及批次有 `[保持]` 情形时的 `keep.test.ts`。批次有 `[保持]` 情形而没有 `keep.test.ts`，或没有 `MAP.md`，算未过。
- 返回 `{ ok, attempts, files }` 或 `{ ok, attempts, problems }`。
- 不往主仓库写任何东西、不提交。不论成败或异常，worktree 都在 finally 中移除。
- 给了 `record` 时，每次拉起记录 `tester.started` 和 `tester.finished`，每次红检查记录 `redcheck.result`。
- `redCheck` 参数可选，缺省为真实的 `runRedCheck`，方便测试注入。

**条目 2：`src/roles/tester.ts` — `previous_problems` 支持**

`TesterInputSchema` 加了可选的 `previous_problems`（非空字符串的数组）。`buildTesterPrompt` 在非空时于「情形」之前插入「上一次没过的原因」一节，逐条原样列出问题，并写一句「只改有问题的地方，改完重新自检」。不给或给空数组时，提示词与之前完全一致。

**条目 3：测试**

新文件 `test/prepare-acceptance.test.ts`，三组共 10 条用例：
- `prepareAcceptance: retry loop`（4 条）：第 1 次失败第 2 次通过；testerMax=2 两次都失败；非零退出码不触发红检查；record 收到的事件名与顺序。
- `prepareAcceptance: what is taken from the tree`（5 条）：sneaky 文件不被取走、worktree 和 tmpdir 清理干净、git status 干净；有 `[保持]` 但无 `keep.test.ts`→失败；无 `[保持]` 但写了 `keep.test.ts`→files 不含它；无 `MAP.md`→失败；红检查抛异常→错误传播但 worktree 仍被移除。
- `prepareAcceptance: real red check`（1 条）：不注入 redCheck，FakeRunner 写两条会失败的真实测试，用真实的 `runRedCheck`（起真实 vitest 子进程）→ok=true。

`test/tester.test.ts` 新加 `describe('tester: previous problems in the prompt', …)`（3 条）：给两条问题时位置在情形之前；不给和给空数组时提示词逐字相同。

`test/invariants.test.ts` 加了两条不变量：`src/acceptance.ts` 包含 `removeWorktree`；`src/run.ts` 非注释行不含 `acceptance.js`。

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
   Duration  21.93s
```

所有 8 条验收命令均通过。

## 偏离或疑问

无

## 下一步建议

- 下一批次将 `prepareAcceptance` 接进 `src/run.ts` 的队列流程（SPEC 16.12 接线部分）。
- 接线后需要在 `.collie/collie.toml` 中加 `[agent.tester]` 和 `[verify] static`。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b08",
  "head_sha": "777ce2a6316797555c64728e39b15900df953ab5",
  "claims": {
    "commits": ["777ce2a6316797555c64728e39b15900df953ab5"],
    "tests_passed": 1308,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
