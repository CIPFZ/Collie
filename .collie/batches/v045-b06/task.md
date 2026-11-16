---
schema_version: 1
run_id: r-20261116104902
batch_id: v045-b06
base_sha: 2ebe6fe53fa45efca6b0a1d88aead37c2dfedf2a
created_at: 2026-11-16T10:49:02.977Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b06：collie report 与 why 补齐：开始与墙钟、合计、轮数上限、tool.denied、批次状态、CI 链接

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 开始、墙钟与合计（SPEC 14.10 前两条；`src/view.ts` 的 `projectReport` / `formatReport` 与 timeline 的投影）：开始 = 队列 journal 第一条事件的时间；`timeline` 输出 `queue_start` 节点；
   「实际经过」表加合计行；删除 `test/report.test.ts` 里手工写进队列 journal 的 `run.started`。
   **开始时间、墙钟、合计这三处的断言必须用 `Sandbox` 让 fake runner 真实跑出来的 `run --continue`，不得手写事件**
2. 轮数上限（SPEC 14.10 第三条）：`src/run.ts` 的 `worker.started` 与 `reviewer.started` 追加可选字段 `max_turns`（取自配置）——`run.ts` 只许改这两处记录；
   `why` 与 `report` 显示 `<轮数>/<上限>`，相等时加「（到上限）」；没有上限数据的旧 journal 只显示轮数
3. 其余补齐与测试（SPEC 14.10 第四、五条）：`report` 的「放行与打扰」加 `tool.denied` 合计与每条 `batch.status`；`why` 的 `ci:` 行加 `polls=` 与 `run_url`，`ci.verdict_commit:` 行加 `run_url`。
   `test/report.test.ts`、`test/why.test.ts`、`test/timeline.test.ts`、`test/journal-fields.test.ts` 各补用例。`test/invariants.test.ts` 加「`src/run.ts` 含 `max_turns`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 四个专项测试通过 | `npm test -- test/report.test.ts test/why.test.ts test/timeline.test.ts test/journal-fields.test.ts` | exit 0 |
| 测试里不再手写队列 journal 的 run.started | `! grep -A3 -E "run_id: 'q-" test/report.test.ts \| grep -qE "run\.started"` | exit 0 |
| 轮数上限进 journal 且有测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "max_turns" && grep -qE "max_turns" test/journal-fields.test.ts` | exit 0 |
| 到上限的标注进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "到上限" && grep -qE "到上限" test/why.test.ts` | exit 0 |
| why 显示 CI 轮询次数（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "polls=" && grep -qE "polls=" test/why.test.ts` | exit 0 |
| timeline 测试覆盖队列开始节点 | `grep -qE "queue_start" test/timeline.test.ts && grep -qE "Sandbox\.create" test/timeline.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "max_turns" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（删掉手写的那条队列 `run.started` 夹具并改用真实运行不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- `run.ts` 除条目 2 那两处记录外的任何改动；改动 `gate.ts`、`arbiter.ts`、`follow.ts`；读取 `stream.ndjson` 或 `report.md`；让 `report` / `why` / `timeline` 写任何文件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b06/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b06` 为提交信息单独提交并推送该文件。
