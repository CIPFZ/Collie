---
schema_version: 1
run_id: r-20261125042926
batch_id: v046-b47
base_sha: 9c098ef3f64369580214b88812785ef066fc6add
created_at: 2026-11-25T04:34:11.593Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b47：reviewer 的提示词：拿到取证结果时不再要求重跑验收命令（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.31 的「提示词（v046-b47）」一段。`src/roles/reviewer.ts` 的 `buildReviewerPrompt`：输入带 `evidence` 时，「验收命令」一节标题下面那两行说明换成 SPEC 16.31 代码块里的两行，「输出」一节末尾多一行 ``JSON 块里不要写 `evidence`：证据以 R2 的取证结果为准。``
   命令清单与别的小节不变。输入不带 `evidence` 时，提示词与现在逐字节相同。
2. 不改别的文件。R1 查过：没有现有测试（含各批次的验收测试）断言「逐条原样实跑」这几个字；`test/acceptance/v046-b46/` 断言的是「R2 的取证结果」一节，不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] `buildReviewerPrompt` 的输入带 `evidence`（各字段填合法的值）：返回的提示词里没有「逐条原样实跑」，有一行恰好是 `以下命令 R2 已经实跑过，结果在下面「R2 的取证结果」一节，不用重跑。`
- S2 [新] 同样的输入：提示词里有「JSON 块里不要写」
- S3 [新] 沙箱默认配置，假 worker 如实，假 reviewer 判 PASS，单批次跑一次：假运行器第 2 次被调用（角色是 reviewer）时拿到的提示词里没有「逐条原样实跑」
- K1 [保持] `buildReviewerPrompt` 的输入不带 `evidence`：提示词里有「逐条原样实跑」，没有「R2 已经实跑过」，没有「JSON 块里不要写」
- K2 [保持] 输入带 `evidence`，`acceptance` 里有一条 `cmd` 为 `npm test -- test/x.test.ts` 的命令：提示词里有这条命令的原文，有一行恰好是 `## 验收命令`，有一行恰好是 `## R2 的取证结果`
- K3 [保持] S3 那一次运行：退出码 0；假运行器被调用的先后是 worker、reviewer

## 本批次接口

- `src/roles/reviewer.ts` 已有的导出 `buildReviewerPrompt(input)` 与类型 `ReviewerInput`（`batch_id`、`base_sha`、`head_sha`、`items`、`acceptance`、`spec_paths`，以及可选的 `evidence`）；各项怎么填合法的值，照 `test/acceptance/v046-b46/new.test.ts`
- 沙箱用 `test/support/sandbox.ts` 导出的 `Sandbox`、`workerScene`、`fooledReviewerScene`、`honestClaims`；假运行器 `FakeRunner` 的 `calls` 每项有 `role` 与 `prompt`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含各批次的验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b47` | exit 0 |

`test/acceptance/v046-b47/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-reviewer.md`）；改动 `src/roles/reviewer.ts` 之外的 `src/` 文件
- 把 worker 的汇报、`claims` 或它们的任何一部分放进提示词；改提示词里别的小节或命令清单的写法
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b47/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b47` 为提交信息单独提交并推送该文件。
