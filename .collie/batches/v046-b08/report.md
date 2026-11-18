# 批次 v046-b08 汇报

## 做了什么

这是第 3 次运行。前两次降级原因均为 `ci_conclusion=failure`（CI 失败），代码本身在第 1 次运行的 777ce2a 中已全部完成并通过所有本地验证。

**条目 1：`src/acceptance.ts` — `prepareAcceptance(opts)` 函数**（777ce2a 已完成）

新建 `src/acceptance.ts`，导出 `prepareAcceptance(opts)` 函数：
- 在系统临时目录下用 `mkdtempSync` + `addWorktree` 创建检出于 `headSha` 的 git worktree（目录名以 `collie-accept-` 开头）。
- 主仓库有 `node_modules` 就链进 worktree。
- 最多拉起测试 agent `testerMax` 次：每次拉起后做红检查；过了收集文件返回 `ok: true`；不过把问题清单作为 `previous_problems` 交给下一次。
- 非零退出不做红检查，原因写明退出码。
- 过了之后只取走 `new.test.ts`、`MAP.md`，以及批次有 `[保持]` 情形时的 `keep.test.ts`。
- 不往主仓库写东西、不提交。不论成败或异常，worktree 都在 finally 中移除。
- 给了 `record` 时记录 `tester.started`、`tester.finished`、`redcheck.result` 事件。

**条目 2：`src/roles/tester.ts` — `previous_problems` 支持**（777ce2a 已完成）

`TesterInputSchema` 加了可选的 `previous_problems`（非空字符串的数组）。`buildTesterPrompt` 在非空时于「情形」之前插入「上一次没过的原因」一节，逐条原样列出并附「只改有问题的地方，改完重新自检」。不给或空数组时提示词与原来逐字相同。

**条目 3：测试**（777ce2a 已完成）

- `test/prepare-acceptance.test.ts` 三组共 10 条用例：retry loop（4 条）、what is taken from the tree（5 条）、real red check（1 条）。
- `test/tester.test.ts` 新加 `describe('tester: previous problems in the prompt', …)` 3 条。
- `test/invariants.test.ts` 加 `src/acceptance.ts` 有 `removeWorktree`、`src/run.ts` 非注释行没有 `acceptance.js` 两条不变量。

**本轮无新代码提交。** 所有代码均在 777ce2a，该提交在前两轮已推送到远端。本轮确认所有验收标准通过，推送最新 task 信封，写 report。

## 测试结果

```
$ npm run lint && npm run typecheck && npm test
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

> tsc -p tsconfig.json
(no errors)

> vitest run
 Test Files  63 passed (63)
      Tests  1308 passed (1308)
   Duration  21.40s

$ npm run build
> tsc -p tsconfig.build.json
(no errors)
```

8 条验收命令全部通过（lint、typecheck、全量测试、指定测试文件、三组用例 grep、tester 新用例 grep、函数导出与队列无用、TMPDIR 无残留、不变量同步）。

## 偏离或疑问

无新代码改动。前两次降级原因是 CI 失败，本地所有测试、lint、typecheck、build 均通过。可能的 CI 失败原因：
1. 已知的 `verdict-ci-recheck` 测试偶发不稳定（队列备注中提到 "one unexplained flaky failure"）。
2. CI 环境瞬时问题（npm ci 网络、runner 资源等）。
本轮无法做进一步诊断（无 gh CLI），但代码无缺口。

## 下一步建议

- 如果 CI 再次失败，建议操作员查看具体 CI 日志确认是哪个步骤/测试失败。
- 下一批次将 `prepareAcceptance` 接进 `src/run.ts` 的队列流程（SPEC 16.12 接线部分）。
- 接线通过后需要在 `.collie/collie.toml` 中加 `[agent.tester]` 和 `[verify] static`。

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
