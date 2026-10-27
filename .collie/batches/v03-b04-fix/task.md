---
schema_version: 1
run_id: r-20261027090540
batch_id: v03-b04-fix
base_sha: 57bb7bf294e683271e8eba33155d19239bd64124
created_at: 2026-10-27T09:05:40.989Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v03-b04-fix：FIX 重跑的 task 语义、fix_max 只计本次队列、队列 journal 可还原

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. FIX 重跑的 task（`run.ts` `batchHistory` / task 生成）：上一轮 `run.finished.verdict === 'FIX'` 时 `interrupted_at: null`、不写「上一轮中断」，
   改写「上一轮判 FIX」一节：上一轮 verdict 的 `gaps` 原样、未通过的验收命令与退出码、上一轮代码提交清单、「只补缺口，不要重做」。
   场景测试（scenario-l 或 scenario-j 加一组）：第 1 轮 fake reviewer 判 FIX 带 gaps，第 2 轮断言 task.md 含该 gaps 文本、`interrupted_at` 为 null、不含「上一轮中断」
2. `fix_max` 计数只数本次 `--continue` 内本批次的 FIX（队列循环里的内存计数，不再 `countBatchFinished` 扫全部历史）；
   场景测试：预先在 `.collie/runs/` 放两个该批次历史 FIX 的 journal，`--continue` 仍应重跑而不是直接 `escalated`
3. 队列 journal：每次拉起批次运行前 `queueRec.record('queue.batch_started', {run_id, batch_id, attempt, why})`，`why` 取 `new` / `fix_retry` / `rule1_retry`；
   `queue.finished.batches` 改为 `{batch_id, run_id, verdict}[]`（schema 同步）。`collie show --queue <q-run_id>` 按 journal 打印时间线。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `queue.batch_started`」「`src/run.ts` 不含 `countBatchFinished`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| FIX 重跑不写中断 | `grep -qE "上一轮判 FIX" src/run.ts && grep -qE "上一轮判 FIX" test/scenario-*.test.ts` | exit 0 |
| fix_max 只计本次队列 | `! grep -v '^\s*//' src/run.ts \| grep -qE "countBatchFinished" && grep -qE "escalated" test/scenario-*.test.ts` | exit 0 |
| 队列事件进 schema | `grep -qE "queue\.batch_started" src/schema/index.ts && grep -qE "fix_retry" src/run.ts` | exit 0 |
| show --queue | `grep -qE "\-\-queue" src/cli.ts && grep -qE "\-\-queue" test/cli.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "queue\.batch_started" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）：匹配到注释就在 report 里指出，照常提交
- 改动放行判定（`gate.ts`）、规则 1~10、`fix_max` 的默认值

## 汇报要求

完成后写 `.collie/batches/v03-b04-fix/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v03-b04-fix` 为提交信息单独提交并推送该文件。
