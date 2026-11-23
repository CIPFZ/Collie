---
schema_version: 1
run_id: r-20261123050505
batch_id: v046-b34
base_sha: a5a9cd737c79290c3bb54c260fa4834361c75bfc
created_at: 2026-11-23T05:08:34.910Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b34：授权路径的两处补全：报错信息的说法、带 .. 的写法有测试守着（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.21 的「v046-b32」一段与 14.36「判 PASS 之后才查出来的」第 2、3 条。`src/backlog.ts`：授权小节里点名了不许点名的路径时，报错信息末尾括号里的说法改成
   `(only .github, paths under .github/, eslint.config.js, vitest.config.ts)`。哪些路径能点名、哪些被拒绝，一概不变。
2. `src/evidence.ts` 第 103 行附近那条注释里的「受保護」改成「受保护」（只改这一个字）。
   R1 查过：`test/backlog.test.ts` 的 `rejects %s as not allowable` 一组只断言报错信息里有被点名的那一项，改说法不影响它；别的测试没有断言这句括号里的文字。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 批次的授权小节点名 `SPEC.md`：`parseBacklog` 抛出 `BacklogError`，它的 `message` 里有 `only .github, paths under .github/, eslint.config.js, vitest.config.ts`，并且整条 `message` 里不出现 `.github/*`
- K1 [保持] 授权小节点名 `.github/../SPEC.md`：`parseBacklog` 抛出 `BacklogError`，`message` 里有 `.github/../SPEC.md`
- K2 [保持] 授权小节点名 `.github/workflows/../../docs/backlog.md`：`parseBacklog` 抛出 `BacklogError`
- K3 [保持] 授权小节点名 `/etc/x`、`../x`、`.github/*`、`.github/workflows/?.yml` 当中任何一个：`parseBacklog` 抛出 `BacklogError`，`message` 里有被点名的那一项
- K4 [保持] 授权小节依次点名 `.github`、`.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts`：不报错，那个批次的 `allowed_protected` 就是这四项、次序相同
- K5 [保持] 没有授权小节的批次：解析结果里没有 `allowed_protected` 这个键

## 本批次接口

- `src/backlog.ts` 已有的导出，签名不变：`parseBacklog(text: string, source?: string): Batch[]`、`class BacklogError extends Error`（有 `message`、`batchId`、`line`）
- 授权小节的标签是「可改的受保护路径」后面跟一个冒号、独占一行，下面每行一个 `- <路径>`（SPEC 16.21）；一份最小的 backlog 文本怎么拼，照 `test/backlog.test.ts` 里 `describe('backlog: allowed protected paths', …)` 一组用的辅助函数

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b34` | exit 0 |

`test/acceptance/v046-b34/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/backlog.ts`、`src/evidence.ts` 之外的 `src/` 文件；改变哪些路径能被授权；改动 `src/evidence.ts` 里那一个字之外的任何内容
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b34/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b34` 为提交信息单独提交并推送该文件。
