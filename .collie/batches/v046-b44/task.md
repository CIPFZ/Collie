---
schema_version: 1
run_id: r-20261124125102
batch_id: v046-b44
base_sha: c9392581d855ed2365ce4235a1f2002c15bd4852
created_at: 2026-11-24T13:01:47.760Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b44：follow 超时之前先同步，每圈打印一行（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.30 的第一段与 14.43「操作员看出来的」第 1、2 条。`src/follow.ts` 的主循环：超时到了之后、退出之前，不是 `dryRun` 时先做一次与每圈开头相同的同步（推送本地领先的汇报提交；`pendingReport` 还在而本地不再领先时发队列结束的通知并清掉它），然后才打印 `follow: timeout reached` 并返回 0。
   同步用现有的那一段，**必须**抽成一个函数在两处调用，不要抄一份。
2. 每一圈算出动作之后打印一行 `follow: action=<动作>`（`decide` 给出的名字）。`dryRun` 的输出不变。别的输出不变。
   R1 没有查到断言 `follow` 的输出「恰好等于」某几行的现有用例；`test/follow.test.ts` 的 33 条都必须照常通过。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 照 `test/follow.test.ts` 第一条用例的搭法（`docs/ops/next.md` 是「开跑」，假的子进程让开跑前检查通过、让队列正常结束并留下队列 journal），`timeoutSecs` 设为 100，注入的时钟在假的 `run --continue` 子进程返回之前往前拨 200 秒，然后调用 `follow`（不带 `once`）：返回 0；返回之后，远端 `main` 的提交历史里有一个提交说明以 `ops: report queue` 开头的提交
- S2 [新] S1 那一次调用：注入的通知函数恰好收到过 1 条含「结束」的文本
- S3 [新] `.collie/follow.json` 里的 `handledBase` 已经等于 `docs/ops/next.md` 的基准提交，`timeoutSecs` 设为 150、`intervalSecs` 设为 60，注入的 sleep 每次把时钟往前拨它被要求睡的毫秒数，调用 `follow`：输出里以 `follow: action=wait` 开头的行至少有 2 行
- K1 [保持] S3 那一次调用：返回 0；假的子进程一次都没有被调用；输出里有 `follow: timeout reached`
- K2 [保持] `docs/ops/next.md` 是「开跑」，带 `dryRun` 调用 `follow`：返回 0；输出恰好一行，以 `action: run` 开头；远端没有新的提交；`.collie/follow.json` 不存在

## 本批次接口

- `src/follow.ts` 导出的 `follow(opts)`，`opts` 可注入：`now`（毫秒）、`sleep(ms)`、`spawn`（假的子进程）、`sendNotify(text)`、`out(text)`、`pinnedParentDir`，另有 `once`、`dryRun`、`intervalSecs`、`timeoutSecs`
- 沙箱、带远端的仓库、假的子进程怎样让 `preflight` 通过并让 `run --continue` 留下一个队列 journal、怎样看远端的提交历史，都照 `test/follow.test.ts` 的第一条用例 `开跑 → starts preflight, run, report; commits (base marker); pushes on second cycle; notifies; records handledBase` 与它用的辅助函数（它们没有导出，照着写一份）
- 状态文件是 `.collie/follow.json`（`handledBase`、`notified`、`pendingReport`）；「基准已经处理过」怎么判断，读 `src/handoff.ts` 的 `decide`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含各批次的验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b44` | exit 0 |

`test/acceptance/v046-b44/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径；改动 `src/follow.ts` 之外的 `src/` 文件（含 `src/handoff.ts`、`src/notify.ts`）
- 改变超时之前的任何行为、退避与通知的次数、提交说明的写法；在超时那一次同步里起队列或跑开跑前检查
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里起真实的子进程、真的等待或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b44/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b44` 为提交信息单独提交并推送该文件。
