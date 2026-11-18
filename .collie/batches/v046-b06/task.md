---
schema_version: 1
run_id: r-20261118032107
batch_id: v046-b06
base_sha: 18cb25cf48695c279877ee3880543c6d950a5246
created_at: 2026-11-18T03:21:08.280Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b06：情形与接口的列表允许空行；测试 agent 提示词两处小修（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 14.24 里「操作员读代码查出来的」第一条与 16.12 的「v046-b06 小修」。`src/backlog.ts`：「情形」与「接口」两节的列表项之间允许空行。
   规则：空行跳过；符合格式的列表项接着算进同一个列表；紧跟在一条之后的缩进续行并进那一条（与现在相同）；遇到别的非空行（下一个标签、表格、说明文字）列表结束。
   「情形」一节里，空行之后出现一条不符合情形格式的无序列表项，报错并带那一行的行号（列表中间出现的本来就报错）。「条目」「额外禁止」两节的列表规则不动。
   **三条情形、每两条之间空一行：解析出 3 条，编号、类别、文字都对；两条情形之后空一行再跟一条 `- 这不是情形`：报错，行号是这一行；**
   **「接口」一节两条之间空一行：解析出 2 条**
2. 读 SPEC 14.24 里同一段的第二、三条。`src/roles/tester.ts` 的 `buildTesterPrompt`：
   小标题「需要自行阅读的 SPEC 章节」改成「可查阅的文件」，标题下加一句「情形里点名了小节号的，只读那一节；不要通读」，路径照旧逐条列出；
   「输出」一节加一句，写明汇报末尾 JSON 块里的 `batch_id` 填本批次的批次号（把批次号原样写出来）。
3. 测试。`test/backlog.test.ts` 新加一组 `describe('backlog: blank lines inside scenario and interface lists', …)`：条目 1 加粗的三种情形，外加「情形之后空一行再是 `接口` 标签 → 两节都解析对」；
   拒绝的那一条断言报错里的行号。`test/tester.test.ts` 新加一组 `describe('tester: prompt wording (v046-b06)', …)`：新小标题与那句话在、旧小标题不在；`batch_id` 那一句里有批次号。
   R1 查过现有用例：`test/tester.test.ts` 没有一条断言旧小标题的原文，`includes SPEC paths` 只断言路径字符串，不受影响；
   `test/backlog-reject.test.ts` 的 `rejects a scenario that does not match the expected format` 测的是列表中间的情形，行为不变；
   `test/backlog.test.ts` 的 `a batch without scenario/interface sections has no extra keys` 不受影响。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 解析与提示词的测试通过 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/tester.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "backlog: blank lines inside scenario and interface lists" test/backlog.test.ts && grep -qF "tester: prompt wording (v046-b06)" test/tester.test.ts` | exit 0 |
| 旧小标题不在了（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/roles/tester.ts \| grep -qF "需要自行阅读的 SPEC 章节"` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `docs/backlog.md`、`AGENT-tester.md`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动「条目」「额外禁止」「验收标准」三节的解析；改变不带「情形」「接口」两节的批次的解析结果
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b06/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b06` 为提交信息单独提交并推送该文件。
