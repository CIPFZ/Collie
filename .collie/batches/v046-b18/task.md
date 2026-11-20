---
schema_version: 1
run_id: r-20261120035859
batch_id: v046-b18
base_sha: 08f35501357f290d5b9187d374e25359e3612c2e
created_at: 2026-11-20T03:59:00.546Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b18：接线收尾二：带情形的 worker 任务书多出情形与接口两节、写明验收测试不能改

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.16 的「v046-b18」一段。`src/roles/worker.ts` 的 `renderBody`（或它的调用处）：批次有情形时，`task.md` 在「本批次条目」之后、「验收标准」之前多两节：
   「本批次情形」——每条 `- <编号> [新|保持] <文字>`，和给测试 agent 的情形逐字相同；「本批次接口」——有接口才出现，每条一行；并在「验收标准」里或紧接一句写明
   「`test/acceptance/<批次>/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）」。
   批次没有情形时，`task.md` 逐字不变。
   **一个带 2 情形、1 接口的批次：渲染出的 `task.md` 里有「本批次情形」两条、「本批次接口」一条，以及「验收测试……你不能改」那句；一个不带情形的批次：渲染结果和现在逐字节相同**
2. `test/task-envelope.test.ts`：新加一组或在「body」组里加用例，覆盖条目 1 加粗的两种情形（有情形、无情形逐字不变）；
   现有的 `has the SPEC 3.3 section order` 用的是不带情形的批次，断言的小节清单不变，本批次不许改它。
   `test/worker.test.ts` 的闭环用例用的批次不带情形，应当照常通过。
   R1 查过：`test/task-envelope.test.ts` 的 body 组逐条跑 backlog 里的真实批次，这些批次现在都不带情形，所以渲染结果不变、现有断言不受影响。
   已有断言一条都不改；别的现有用例因为本批次的新行为而失败时的处理见下。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 任务书与 worker 的测试通过 | `npm test -- test/task-envelope.test.ts test/worker.test.ts` | exit 0 |
| 带情形时任务书有两节，不带情形时逐字不变——由新用例覆盖 | `grep -qE "本批次情形" src/roles/worker.ts && grep -qE "本批次接口" src/roles/worker.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/reviewer.ts`、`src/roles/tester.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/runner/`；改变不带情形的批次的任务书哪怕一个字节
- 在这一步校验情形、拉起谁、改任何判定
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b18/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b18` 为提交信息单独提交并推送该文件。
