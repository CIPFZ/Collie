---
schema_version: 1
run_id: r-20261117122544
batch_id: v045-b18
base_sha: 438a5d5ae480211bcb75da9ba07d53063b1b2066
created_at: 2026-11-17T12:25:45.375Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b18：运行器：失败的返回值一定带结束原因

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. `src/runner/claude.ts` 的 `run`：SDK 抛错的分支里，汇总出来没有结束原因的，记 `error`（被软停的仍是 `stopped`，有 `error_max_turns` 的仍是 `turns_exhausted`）。
   另外两处是 v045-b15 带来、现在定为正确的行为，不改代码，只补测试：一条 `subtype: success` 但 `is_error: true` → 结束原因 `error`；成功但文本为空 → 不带 `finalText`。
   **做完之后：`run` 的任何返回值，只要退出码不是 0，就带结束原因**
2. `test/runner-claude.test.ts` 新加一组 `describe('runner-claude: failed runs always carry a stop reason', …)`，用文件里已有的假 SDK 写法：
   一条成功的结果消息之后抛错 → 退出码非 0、结束原因 `error`、花费与轮数照常带回、没有 `finalText`；
   两条成功的结果消息之后抛错 → 同上，轮数是合计；
   一条 `success` 但 `is_error: true` → 退出码非 0、结束原因 `error`、没有 `finalText`；
   一条成功、文本是空串 → 退出码 0、返回值里没有 `finalText` 这个键。
   已有用例一条都不改。R1 查过：现有用例里断言「没有结束原因」的只有两条，都是成功的情形（`two successful results…`、`three successful results…`），与本条不冲突；
   `two results then SDK throws…` 那一条没有断言结束原因。你发现还有别的用例与本条冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器的测试通过 | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 新的一组测试在 | `grep -qF "failed runs always carry a stop reason" test/runner-claude.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；改动传给 SDK 的参数
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b18/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b18` 为提交信息单独提交并推送该文件。
