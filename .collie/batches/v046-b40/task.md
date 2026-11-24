---
schema_version: 1
run_id: r-20261124040209
batch_id: v046-b40
base_sha: a60d6e8b40583fd33269fba0e3f3c75922b94cac
created_at: 2026-11-24T04:15:14.363Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b40：批次清单归档：已了结的批次挪进归档文件，解析时两处都读（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.27。`src/backlog.ts`：导出常量 `BACKLOG_ARCHIVE_RELATIVE_PATH`（`docs/backlog-archive.md`）；`loadBacklog` 在归档文件存在时两处都读，归档里的批次排在前面；
   依赖在两处的并集里核对；同一个批次号两处都有时报错（信息里有批次号与归档文件名）；归档里的批次状态不是 `passed` 或 `blocked` 时报错（信息里有批次号）。
   `parseBacklog` 对单份文本的现有检查都不变（需要的话给它加一个可选参数，传「另一处已有的批次号」）。R2 改状态格的地方不动，仍只写 `docs/backlog.md`。
2. `src/evidence.ts` 的 `PROTECTED_PATHS` 加 `docs/backlog-archive.md`（写法照现有各项，每项一行）；`scripts/mutation.ts` 的清单**必须**加一项 `protected:docs/backlog-archive.md`（写法照已有的 13 项），共 47 项，清单上方注释里的项数相应改。
3. 测试。`test/evidence.test.ts` 加一条 `counts docs/backlog-archive.md as protected (SPEC 16.27)`；`test/mutation.test.ts` 的 `every protected path is in the mutation list`：13 改成 14（点名允许的改写，在「偏离或疑问」里列出）；
   `test/invariants.test.ts` 加一条，用例名 `src/evidence.ts has docs/backlog-archive.md in PROTECTED_PATHS (v046-b40)`。
   R1 查过：仓库里现在没有归档文件，所有读真实 `docs/backlog.md` 的测试结果不变；`test/backlog.test.ts` 测的是 `parseBacklog` 单份文本的行为，不受影响；`test/mutation.test.ts` 的 `has at least 42 items` 用的是「不少于」，不用改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 一个目录下 `docs/backlog-archive.md` 里有一个状态为 `passed` 的批次 `v01-a01`，`docs/backlog.md` 里有一个状态为 `pending`、依赖 `v01-a01` 的批次 `v01-b01`：`loadBacklog` 返回恰好两个批次，依次是 `v01-a01`、`v01-b01`，后者的 `depends_on` 是只含 `v01-a01` 的数组
- S2 [新] 批次号 `v01-a01` 在 `docs/backlog-archive.md` 与 `docs/backlog.md` 里各有一个（两个文件单独看都合法）：`loadBacklog` 抛出 `BacklogError`，它的 `message` 里有 `v01-a01`，也有 `backlog-archive.md`
- S3 [新] `docs/backlog-archive.md` 里那个批次的状态是 `pending`，或者是 `running`（`docs/backlog.md` 单独看合法）：两种都让 `loadBacklog` 抛出 `BacklogError`，`message` 里有归档里那个批次的批次号
- S4 [新] 沙箱里 `docs/backlog-archive.md` 有一个 `passed` 的批次 `v98-a01`，`docs/backlog.md` 里 `v99-b01` 是 `pending`、依赖 `v98-a01`，两个文件都已提交；假 worker 如实提交、假 reviewer 判 PASS，队列模式跑一次（`run --continue`）：退出码 0，`docs/backlog.md` 里 `v99-b01` 的状态是 `passed`
- S5 [新] 沙箱里 `docs/backlog-archive.md` 有一个 `passed` 的批次 `v98-a01`（已提交），`docs/backlog.md` 里 `v99-b01` 是 `pending`、不依赖别的；假 worker 在它的代码提交里另外往 `docs/backlog-archive.md` 末尾加了一个空行和一行文字 `note`，假 reviewer 判 PASS，单批次跑一次：退出码 20，`evidence.collected` 事件的 `spec_diff_lines` 大于 0
- K1 [保持] 目录下没有 `docs/backlog-archive.md`，`docs/backlog.md` 里有一个批次：`loadBacklog` 返回恰好这一个批次
- K2 [保持] `docs/backlog-archive.md` 存在且合法，`docs/backlog.md` 里的批次依赖一个两个文件里都没有的批次号 `v00-x99`：`loadBacklog` 抛出 `BacklogError`，`message` 里有 `v00-x99`
- K3 [保持] S4 那一次运行之后，`docs/backlog-archive.md` 的内容与运行之前逐字节相同

## 本批次接口

- `src/backlog.ts` 已有的导出，签名不变：`loadBacklog(root: string): Batch[]`、`class BacklogError extends Error`（有 `message`、`batchId`）。归档文件是 `<root>/docs/backlog-archive.md`，格式与 `docs/backlog.md` 完全相同：自己的「队列总览」表加各批次的小节
- 一份最小的 backlog 文本怎么拼，照 `test/backlog.test.ts` 里的辅助函数；直接测 `loadBacklog` 时，目录用 `mkdtempSync` 建在系统临时目录下、`afterEach` 里删掉
- 沙箱用 `test/support/sandbox.ts` 导出的 `Sandbox`（`run(runner)` 是单批次，`cli(['run', '--continue'], runner)` 是队列；`read`、`write`、`commitAll`、`events()`）、`workerScene`、`fooledReviewerScene`、`honestClaims`、`BATCH`（就是 `v99-b01`）。
  沙箱自带一份 `docs/backlog.md`：要让 `v99-b01` 依赖别的批次，用 `box.read` 读出来改（总览表里「依赖」那一格与小节里「依赖：」那一行要一致）再提交；要在提交里多改一个文件的假 worker 自己写一个场景，写法照 `test/acceptance/v046-b36/`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b40` | exit 0 |
| 变异清单里有新的一项 | `grep -qF "protected:docs/backlog-archive.md" scripts/mutation.ts` | exit 0 |

`test/acceptance/v046-b40/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`docs/backlog.md`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）；新建或改动 `docs/backlog-archive.md`
- 改动 `src/run.ts`、`src/cli.ts`、`src/view.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/roles/`、`src/runner/`；让 R2 写归档文件；让批次授权能点名归档文件
- 改变没有归档文件时的任何行为；从 `PROTECTED_PATHS` 里去掉或改写已有的项
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b40/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b40` 为提交信息单独提交并推送该文件。
