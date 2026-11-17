---
schema_version: 1
run_id: r-20261117091738
batch_id: v045-b14
base_sha: 6d748028809bc97f450f0db067cf571682c190f6
created_at: 2026-11-17T09:17:39.005Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b14：运行器：SDK 抛错之前已收到结果消息时，花费与轮数照常带回

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. `src/runner/claude.ts` 的 `run`：遍历 SDK 消息的循环抛错时，如果此前已经收到过结果消息，返回值里带上花费、轮数、token、会话号，
   结束原因按结果消息的类型映射（与正常结束时同一套，`error_max_turns` → `turns_exhausted`）。只多带数据，成败的判定不变：这条路径上退出码仍然非 0，不带 `finalText`。
   没收到过结果消息的，行为不变；被 signal 中止的，行为不变。
2. `test/runner-claude.test.ts`，用文件里已有的假 SDK 写法，新用例放进一组 `describe('claude runner: result message before the SDK throws', …)`：
   先给出 `error_max_turns` 的结果消息（带 `total_cost_usd` 与 `num_turns`）再抛错 → 返回值带这两个数、结束原因是 `turns_exhausted`、退出码非 0、没有 `finalText`；
   先给出别的出错类型的结果消息再抛错 → 花费与轮数带回、结束原因是 `error`；没有结果消息就抛错 → 和现在一样。
   已有用例一条都不改；如果你发现这条路径的现状和上面的推断对不上，停下，在「偏离或疑问」里写明你看到的，不要照猜的改。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器的测试通过 | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 新情形有一组测试 | `grep -qF "result message before the SDK throws" test/runner-claude.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；改动传给 SDK 的参数
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b14/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b14` 为提交信息单独提交并推送该文件。
