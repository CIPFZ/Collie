---
schema_version: 1
run_id: r-20261123083637
batch_id: v046-b35
base_sha: 67bf0ac362b0e011caf5eda12f286fe761ccdb02
created_at: 2026-11-23T08:47:56.091Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b35：没过的验收命令留下输出的末尾：进运行日志与重跑的任务书（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.23 的「没过的验收命令留下输出的末尾」一段。`src/run.ts`：记 `acceptance.failed` 的地方带上 `output_tail`；从上一次运行的 journal 重建 `failedAcceptance` 的地方把它取出来；`renderFixSection` 把它渲染成那条命令下面的围栏代码块。
   取多少行、每行截到多少字符写成具名常量（20、300）；脱敏用这次运行已有的那份清单，替换成 `***`；命令没有输出时不带这个字段。
2. 不许变的：`acceptance.failed` 原有的三个字段；`docs/progress.md` 里每条命令的摘要；`why` 与 `report` 的输出；命令通过时不记事件；事件类型的个数。
   R1 查过：`test/scenario-d.test.ts` 对 `acceptance.failed` 的断言用的是 `objectContaining`，多一个字段不影响；`test/scenario-n.test.ts`、`test/why.test.ts` 里涉及这个事件的用例不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] `renderFixSection` 拿到的 `failedAcceptance` 里有一项是 `cmd` 为 `sh noisy.sh`、`exit_code` 为 1、`output_tail` 为两行文字 `line A` 与 `line B`：返回的文字里，`sh noisy.sh` 那一行之后有一个围栏代码块，块里依次是 `line A`、`line B` 两行
- S2 [新] 沙箱的全局验收命令里多一条 `sh noisy.sh`，它依次打印 `out 1` 到 `out 30` 共 30 行后以 1 退出；假 worker 如实提交、假 reviewer 判 PASS，跑一次：journal 里 `cmd` 为 `sh noisy.sh` 的 `acceptance.failed` 事件带 `output_tail`，按行拆开恰好 20 行，第一行是 `out 11`，最后一行是 `out 30`
- S3 [新] 同样的沙箱，`noisy.sh` 改成先打印一行 500 个 `x` 再以 1 退出：`output_tail` 里那一行恰好是 300 个 `x`
- S4 [新] 同样的沙箱，测试里把环境变量 `GITHUB_TOKEN` 设成 `tok-secret-12345`（用完还原），`noisy.sh` 打印一行 `token=tok-secret-12345` 后以 1 退出：`output_tail` 恰好是一行 `token=***`
- S5 [新] 接着 S2 那一次（结论是 FIX）再跑一次，第 2 次的假 worker 把它拿到的 `task.md` 读出来：`task.md` 里有单独成行的 `out 11`，也有单独成行的 `out 30`
- K1 [保持] `renderFixSection` 拿到的 `failedAcceptance` 里那一项不带 `output_tail`：返回的文字里有一行 ``- `sh noisy.sh` → exit 1``，并且「未通过的验收命令」那一节里没有围栏代码块
- K2 [保持] S2 那一次运行里，`acceptance.failed` 事件的 `cmd`、`exit_code`、`expect` 三个字段照旧都在；结论是 FIX、规则 8，退出码 10
- K3 [保持] 全局验收命令都通过的一次运行：journal 里没有 `acceptance.failed` 事件

## 本批次接口

- `src/run.ts` 已有的导出：`renderFixSection(info: FixInfo): string` 与类型 `FixInfo`。`FixInfo.failedAcceptance` 每一项现在是 `{ cmd, exit_code }`，本批次起多一个可选的 `output_tail?: string`（多行文字，用换行分隔）；实现之前类型上还没有它
- `acceptance.failed` 事件本批次起多一个字段 `output_tail`（字符串）；读事件用 `Sandbox` 的 `events()`
- 沙箱、假 worker、假 reviewer 怎么搭，照 `test/scenario-d.test.ts`（它就是「worker 如实、验收命令没过、reviewer 判 PASS」）与 `test/support/sandbox.ts` 导出的 `Sandbox`、`workerScene`、`fooledReviewerScene`、`honestClaims`、`TEST_CMD`；
  往全局验收命令里加一条的办法：改写沙箱里 `.collie/collie.toml` 的 `commands` 一行并提交，`noisy.sh` 写在沙箱仓库根并提交；第 2 次运行里读 `task.md` 的假 worker 自己写一个场景

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b35` | exit 0 |

`test/acceptance/v046-b35/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/progress.ts`、`src/schema/index.ts`、`src/roles/`、`src/runner/`；改任何一条规则的判定
- 把整段输出不截断、不脱敏地写进 journal 或 task
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b35/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b35` 为提交信息单独提交并推送该文件。
