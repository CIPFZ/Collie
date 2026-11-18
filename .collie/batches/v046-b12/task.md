---
schema_version: 1
run_id: r-20261118122241
batch_id: v046-b12
base_sha: d0df1a1e7439d960840c52f446e28d271fce132d
created_at: 2026-11-18T12:22:45.949Z
attempt: 2
interrupted_at: r-20261118091441 escalated run.finished@2026-11-18T10:06:16.304Z
issued_by: collie
---

# 批次 v046-b12：接线前的铺垫补齐：测试 agent 的事件与中止、类别标错清单；三处测试小修（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.14 的「铺垫补齐」一段。`src/roles/tester.ts` 的 `runTester` 加第五个可选参数 `opts`：`signal`、`onEvent`、`redact`，原样交给运行器（写法照 `src/roles/reviewer.ts` 的 `runReviewer`）。
   `src/acceptance.ts` 的 `prepareAcceptance`：`opts` 加可选的 `signal`、`onTesterEvent(attempt, event)`、`redact`，交给 `runTester`；`signal` 已经中止时不再拉起下一次，按 `tester_failed` 结束。
   `tester.started` 的字段是 `attempt`、`model`、`max_turns`；`tester.finished` 的字段是 `attempt`、`exit_code`，以及运行器给了的 `num_turns`、`cost_usd`、`duration_ms`、`usage`
   （写法照 `src/run.ts` 里记 `reviewer.finished` 的那一段）；现在的 `exitCode` 改名为 `exit_code`。
   **假测试 agent 的返回值带 `numTurns: 7`、`costUsd: 0.5`：`tester.finished` 里有 `exit_code: 0`、`num_turns: 7`、`cost_usd: 0.5`，没有 `exitCode` 这个键；每次拉起的事件都经 `onTesterEvent` 送出，第一个参数是第几次**
2. 同一文件：类别标错的声明，数组里的每一项可以是字符串，也可以是 `{ id, why }`；失败的返回值加 `misclassified`（字符串数组：字符串原样，对象转成 `<id>：<why>`；没有声明时是空数组）。
   **回复的 JSON 里是 `"misclassified": [{ "id": "S1", "why": "已有行为" }]`：返回值的 `misclassified` 是 `['S1：已有行为']`，不出现 `[object Object]`**
3. 测试。新用例放进点名的组里：`test/prepare-acceptance.test.ts` 新加 `describe('prepareAcceptance: tester events, signal and misclassified list', …)`（条目 1、2 加粗的情形；`signal` 中止 → 不再重拉、`reason` 是 `tester_failed`；字符串写法照旧能用）；
   `test/tester.test.ts` 新加 `describe('tester: run options are forwarded', …)`。另有三处小修：
   甲、`test/redcheck.test.ts`：测试自己建的目录换一个不以 `collie-redcheck-` 开头的名字；每条用例结束、删除私有临时目录之前，断言里面没有 `collie-redcheck-*`。
   新加一组 `describe('runRedCheck: leaves nothing behind', …)`，至少一条：真实跑一次之后私有临时目录里没有 `collie-redcheck-*`。`test/prepare-acceptance.test.ts` 里被 v046-b09 删掉的那条残留检查同样补回（只看私有目录）。
   乙、`test/prepare-acceptance.test.ts` 的建仓库辅助函数：整个用例期间把 `GIT_CONFIG_GLOBAL` 换成自己写的文件、`GIT_CONFIG_NOSYSTEM` 设为 1，用完还原（照 `test/support/sandbox.ts` 的做法），不再读机器的全局 git 配置。
   丙、这两个文件里真实起 vitest 子进程的用例：交给 `runRedCheck` 的 `timeoutMs` 改成 240 秒（现在 `test/redcheck.test.ts` 里是 60 秒，`test/prepare-acceptance.test.ts` 里是 30 秒），用例自己的超时设成 300 秒（慢机器上一个子进程要 60 到 120 秒）。注入假子进程的用例不动。
   R1 查过现有用例：`record receives events in the right order for two attempts` 只断言事件名，改字段名不影响它；`misclassified in reply JSON → …` 用的是字符串写法，仍然应当通过。
   已有断言一条都不改、不删（甲是补回断言，丙只改时限的数值）；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `onTesterEvent`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 三个文件的测试通过 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts test/redcheck.test.ts` | exit 0 |
| 全局 git 配置开了提交签名、没有身份时，模块的测试通过 | `e=$(mktemp) && printf '[commit]\n\tgpgsign = true\n[user]\n\tsigningkey = 0000000000000000\n' > "$e" && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` | exit 0 |
| 三组新用例在 | `grep -qF "prepareAcceptance: tester events, signal and misclassified list" test/prepare-acceptance.test.ts && grep -qF "tester: run options are forwarded" test/tester.test.ts && grep -qF "runRedCheck: leaves nothing behind" test/redcheck.test.ts` | exit 0 |
| 事件字段改了名（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "exit_code" && ! grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "exitCode: result.exitCode"` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "onTesterEvent" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/ladder.ts`、`src/evidence.ts`、`src/runner/`、`src/schema/index.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 为了让测试过而删除或跳过任何测试；改写或删去任何已有断言
- 在测试里改机器的 git 全局配置
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b12/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b12` 为提交信息单独提交并推送该文件。

## 上一轮中断

中断信息：`r-20261118091441 escalated run.finished@2026-11-18T10:06:16.304Z`
上一轮结论：no valid report: /data/workspace/Collie/.collie/batches/v046-b12/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b12/report.md'

上一轮的提交仍在审核范围内，按上面的结论只补缺口。
