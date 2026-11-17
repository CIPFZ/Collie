---
schema_version: 1
run_id: r-20261117101212
batch_id: v045-b15
base_sha: 15c645ee0ca5b54bb9862b20c048861d7d7e09ce
created_at: 2026-11-17T10:12:13.264Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b15：运行器：一个会话给出多条结果消息时，轮数与 token 合计，成败不被后一条盖掉

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. `src/runner/claude.ts` 的 `run`：遍历消息时把结果消息都留下，返回值按 SPEC 14.20 第一部分汇总：轮数与 token 的各个字段取各条之和；花费取最后一条带花费的；
   每一条都成功才算成功；结束原因：被软停的仍记 `stopped`，否则有一条是 `error_max_turns` 记 `turns_exhausted`，否则有一条失败记 `error`；
   `finalText` 只在成功时带，取各条的文本按先后用空行连起来；会话号取最后一条的。SDK 抛错的分支（v045-b14）用同一套汇总。只有一条结果消息时，返回值和现在完全一样。
   **两条成功的结果消息（66 轮、1 轮）：轮数 67，token 是两条之和，花费是第二条的，`finalText` 里两段文本都在、先后不变，退出码 0；**
   **第一条是 `error_max_turns`、第二条成功：退出码非 0，结束原因 `turns_exhausted`，没有 `finalText`，轮数是两条之和**
2. `test/runner-claude.test.ts`，用文件里已有的 `scripted` 写法，新用例放进一组 `describe('runner-claude: more than one result message', …)`：
   条目 1 两处加粗的情形各一条；三条结果消息的合计一条；先给两条结果消息再抛错 → 花费与合计的轮数照常带回，一条。
   另在 `claude runner: result message before the SDK throws` 一组里补一条：没有结果消息、但已经收到过带 `session_id` 的消息之后抛错 →
   不抛出，返回退出码非 0、那个会话号、结束原因 `error`（这是现有行为，以前没有测试守着）。已有用例一条都不改。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器的测试通过 | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 多条结果消息有一组测试 | `grep -qF "more than one result message" test/runner-claude.test.ts` | exit 0 |
| 不再只留最后一条（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/runner/claude.ts \| grep -qE "isResultMessage\(message\)\) result = message"` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；改动传给 SDK 的参数
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b15/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b15` 为提交信息单独提交并推送该文件。
