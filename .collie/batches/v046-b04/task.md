---
schema_version: 1
run_id: r-20261117141835
batch_id: v046-b04
base_sha: b7a901ea1777bad08cf903cf9a54d57a7802b3bc
created_at: 2026-11-17T14:18:36.763Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b04：条目的「情形」写法：backlog 解析情形与接口，测试 agent 只拿情形（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.11 的「条目怎么写」一段。`src/backlog.ts` 与 `src/schema/index.ts`：批次小节里可选的两节，标签各占一行，写法与现有的 `条目` 标签相同（全角或半角冒号都认）。
   第一节的标签是 `情形`，内容是无序列表，每条 `- <编号> [新] <文字>` 或 `- <编号> [保持] <文字>`，编号是一个大写字母加数字，缩进的续行并进同一条（与条目的续行规则相同）；
   第二节的标签是 `接口`，内容是无序列表，自由文字。解析结果里多出 `scenarios`（每条有 `id`、`kind`（`new` 或 `keep`）、`text`）与 `interfaces`（字符串数组）。
   没有对应小节时，解析结果里不出现这个键。拒绝并报出行号的：编号重复；类别不是这两个；条目不符合上面的格式；有 `情形` 标签而一条都没有；一条 `[新]` 都没有；同一节出现两次。
   `collie show <批次>`：有情形时，在验收命令之后打印情形（编号、类别、文字）与接口。
   **一个带两条 `[新]`、一条 `[保持]`、两条接口的批次：解析出 3 条情形，编号、类别、文字都对；同一份 backlog 里不带这两节的批次，解析结果与现在逐字段相同，没有多出键**
2. 读 SPEC 16.11 的「测试 agent 拿到什么」一段。`src/roles/tester.ts`：`TesterInputSchema` 去掉 `items`，换成 `scenarios`（非空，至少一条 `new`）与 `interfaces`（可以为空数组），仍是严格对象，共五个字段。
   `buildTesterPrompt`：「情形」一节分「新行为」「必须保持」两组列出，编号与文字一字不改；「接口」一节逐条列出，为空时写「（未指定）」；通篇不出现「条目」二字。
   输出一节：`new.test.ts` 与 `MAP.md` 总是列出；`keep.test.ts` 与它的自检命令只在有 `keep` 情形时出现；自检命令的最后加 `npm run lint` 与 `npm run typecheck` 两行。
   **只有 `[新]` 情形时，提示词通篇不出现 `keep.test.ts`；有 `[保持]` 情形时，它和它的自检命令都在**
3. 测试。新用例放进点名的组里：`test/backlog.test.ts` 新加一组 `describe('backlog: scenarios and interfaces', …)`，含条目 1 加粗的情形、续行、两种冒号；
   `test/backlog-reject.test.ts` 新加一组 `describe('backlog: rejects malformed scenarios', …)`，条目 1 列的六种拒绝各一条，都断言报错里的行号；
   `test/cli.test.ts` 加一条 `show prints scenarios and interfaces when the batch has them`；
   `test/tester.test.ts` 新加一组 `describe('tester: scenarios in the prompt', …)`，含条目 2 加粗的两种情形、两组的先后、接口为空时的写法、自检命令里有 lint 与 typecheck 两行。
   R1 查过现有用例：`test/backlog.test.ts` 的 `matches the hand-written expectation including status` 用整对象比较，所以「没有小节时不出现这个键」必须成立，这一条不许改；
   `test/tester.test.ts` 里会被碰到的只有：夹具函数 `validInput`（`items` 换成 `scenarios` 与 `interfaces`）、`accepts a valid input with exactly four fields`（改成五个字段）、
   `includes items verbatim`（改成情形的文字一字不改）、`includes self-check vitest commands`（按有没有 `keep` 情形分开断言）。只许改写这四处，每处在「偏离或疑问」里列出原断言与现断言。
   你发现还有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/roles/tester.ts` 的非注释行里不出现 `items`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 解析、show、测试 agent 的测试通过 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` | exit 0 |
| 解析的两组新用例在 | `grep -qF "backlog: scenarios and interfaces" test/backlog.test.ts && grep -qF "backlog: rejects malformed scenarios" test/backlog-reject.test.ts` | exit 0 |
| show 与提示词的新用例在 | `grep -qF "show prints scenarios and interfaces when the batch has them" test/cli.test.ts && grep -qF "tester: scenarios in the prompt" test/tester.test.ts` | exit 0 |
| 测试 agent 不再拿条目（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/roles/tester.ts \| grep -qE "\bitems\b"` | exit 0 |
| 不变量同步 | `grep -qE "roles/tester.*items\|items.*roles/tester" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `docs/backlog.md`、`.collie/collie.toml`、`AGENT-tester.md`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把测试 agent 接进队列
- 改变不带这两节的批次的解析结果；为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b04/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b04` 为提交信息单独提交并推送该文件。
