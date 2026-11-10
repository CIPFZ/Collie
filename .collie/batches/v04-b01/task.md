---
schema_version: 1
run_id: r-20261110154601
batch_id: v04-b01
base_sha: 0fdc3f9fa279396d02fe5689e677d5872575a79b
created_at: 2026-11-10T15:46:02.181Z
attempt: 3
interrupted_at: null
issued_by: collie
---

# 批次 v04-b01：观测数据补齐：运行级字段、evidence.collected、裁定依据，判定第 6 项与 README 清理

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 清理：`gate.ts` 删掉 `protectedDiffLines` 与原因码 `protected`，判定共六项，`run.ts` 调用处与 `test/gate.test.ts` 同步；
   `README.md` 的状态行改成现状（v0.3 功能批次已完成、v0.4 进行中）、铁律条数改 26
2. 运行级数据进 journal（SPEC 13.1）：`worker.finished` 加 `num_turns` / `cost_usd` / `duration_ms` / `usage` 四个 token 字段；
   新增 `reviewer.finished`（reviewer 返回后、解析 verdict 前）；`worker.started` / `reviewer.started` 加 `model`。
   `RunResult` 与 `Usage` 按 13.1 扩展，`claude.ts` 的取值类型从 SDK 导出派生，fake runner 可脚本化这些值；runner 没给的字段不写
3. 批次级与裁定依据进 journal（SPEC 13.1）：新增 `evidence.collected`；`run.finished` 加 `rule` / `reason`；`reviewer.verdict` 加 `gaps`。
   新建 `test/journal-fields.test.ts`，用 fake runner 跑完整一轮，逐个断言上面每个新字段出现在 journal 里，并断言 runner 不给用量时这些字段不存在；
   `test/invariants.test.ts` 加「`src/schema/index.ts` 含 `evidence.collected` 与 `reviewer.finished`」「`src/gate.ts` 不含 `protectedDiffLines`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 判定第 6 项已删（不看注释行） | `! cat src/gate.ts src/run.ts test/gate.test.ts \| grep -vE "^\s*(//\|\*\|/\*)" \| grep -qE "protectedDiffLines"` | exit 0 |
| README 改成现状 | `! grep -qE "实现未开始\|25 条" README.md && grep -qE "26 条" README.md` | exit 0 |
| 新字段专项测试通过 | `npm test -- test/journal-fields.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/journal-fields.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 两个新事件进 schema | `grep -qE "reviewer\.finished" src/schema/index.ts && grep -qE "evidence\.collected" src/schema/index.ts` | exit 0 |
| 花费取自 SDK 且有测试 | `grep -qE "total_cost_usd" src/runner/claude.ts && grep -qE "total_cost_usd" test/runner-claude.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "evidence\.collected" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（`test/gate.test.ts` 里 `protected` 那一个用例随条目 1 删除，不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10、队列逻辑、`SCHEMA_VERSION`；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b01/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b01` 为提交信息单独提交并推送该文件。

## 上一轮判 FIX

### 上一轮代码提交

- `7a7d6fd70cec1205558e51808f854a67f2460416`
- `7600a4c6ca44043248fb252da31b817878e0d9d2`
- `89288a6377921144297bf96684874b6da4c47bdf`
- `e0dcdcfb4469ad135b163ea1ed8c4ccbfff9c0e0`

这些提交已在审核范围内，只补缺口，不要重做。
