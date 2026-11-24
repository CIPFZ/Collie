---
schema_version: 1
run_id: r-20261124060256
batch_id: v046-b41
base_sha: 662459a359db3b35718ff456c081d1ae76edcd3d
created_at: 2026-11-24T06:08:22.141Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b41：status、why、report 不再吞掉批次清单的错误（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.28 的第一段与 14.41「判 PASS 之后查出来的」第 1 条。`src/cli.ts` 的 `status`、`why`、`report`：一开头就读批次清单。`docs/backlog.md` 存在而加载失败时，把错误信息写到标准错误（一行，以 `collie: ` 开头，与 `show` 报错的写法相同），
   返回退出码 1，别的什么都不输出（`--json` 时也一样）。`docs/backlog.md` 不存在时照现在的做法，当成没有批次。三条命令**必须**共用同一个读法（一个函数），不要各写一份 `try`。
2. `scripts/mutation.ts` 里 `Protected paths (11)` 那句注释的项数改成 14（只改这个数）。
   不许变的：批次清单合法时这三条命令的输出与退出码；`show`、`run`、`timeline`、`preflight` 的行为。
   R1 没有查到在「批次清单存在却解析不了」的目录里跑这三条命令的现有用例；在没有 `docs/backlog.md` 的临时目录里跑它们的用例走「文件不存在」那一支，不应受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 沙箱里把 `docs/backlog.md` 中 `v99-b01` 的依赖改成一个不存在的批次号 `v00-x99`（总览表「依赖」一格与小节里「依赖：」那一行都改），执行 `status`：退出码 1；命令的输出里有 `v00-x99`
- S2 [新] 同样的沙箱，执行 `status --json`：退出码 1；命令的输出里有 `v00-x99`
- S3 [新] 同样的沙箱，执行 `why v99-b01`：命令的输出里有 `v00-x99`，没有 `is not in docs/backlog.md`
- S4 [新] 同样的沙箱，执行 `report`：退出码 1；命令的输出里有 `v00-x99`
- K1 [保持] 沙箱的批次清单没有动过、还没有任何运行记录，执行 `status`：退出码 0，输出里有 `no runs recorded`
- K2 [保持] 沙箱的批次清单没有动过，执行 `why v99-b99`：退出码 1，输出里有 `batch v99-b99 is not in docs/backlog.md`
- K3 [保持] S1 那个沙箱，执行 `show v99-b01`：退出码 1，输出里有 `v00-x99`
- K4 [保持] 一个目录下 `docs/backlog-archive.md` 里有两个批次，状态依次是 `blocked`、`passed`，`docs/backlog.md` 里有一个 `pending` 的批次：`loadBacklog` 不报错，返回恰好三个批次，前两个的 `status` 依次是 `blocked`、`passed`

## 本批次接口

- 命令经 `test/support/sandbox.ts` 的 `Sandbox` 执行：`await box.cli(['status'], undefined)` 返回退出码；标准输出与标准错误都进 `box.output`（字符串数组，`join('')` 之后看），所以「命令的输出」指两者合起来
- 沙箱自带的 `docs/backlog.md` 只有 `v99-b01` 一个批次，依赖写的是「无」（总览表里是 `—`）：用 `box.read` 读出来，把这两处改成 `v00-x99`，再 `box.write` 写回，不必提交
- K4 直接测 `src/backlog.ts` 的 `loadBacklog(root)`：目录用 `mkdtempSync` 建在系统临时目录下、`afterEach` 里删掉；两个文件怎么拼，照 `test/acceptance/v046-b40/new.test.ts`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b41` | exit 0 |
| 变异脚本注释里的项数对了 | `grep -qF "Protected paths (14)" scripts/mutation.ts` | exit 0 |

`test/acceptance/v046-b41/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`docs/backlog.md`、`docs/backlog-archive.md`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/cli.ts` 之外的 `src/` 文件；改动 `scripts/mutation.ts` 里那个数之外的任何内容；改变批次清单合法时任何命令的输出
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26；条目 2 点名的那一处除外）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b41/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b41` 为提交信息单独提交并推送该文件。
