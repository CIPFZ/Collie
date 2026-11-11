---
schema_version: 1
run_id: r-20261111102121
batch_id: v04-b07
base_sha: 76a86227acab027934fa99be41c2bfbf4da04c57
created_at: 2026-11-11T10:21:22.365Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b07：队列收尾：queue.batch_started 归位、fix_max 提交推送、FIX 重跑写明降级原因

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. journal 归位（SPEC 13.10）：`queue.batch_started` 的批次运行号字段改名 `batch_run_id`，事件落在队列的 `q-` journal；`Recorder.record` 遇到名为 `ts` / `run_id` / `event` 的扩展字段抛错；
   `show --queue` 与现有夹具同步。`reviewer.verdict` 的 `gaps` 在 verdict 可解析时总是写，没有缺口写空数组。
   批次历史（`batchHistory` / `allBatchEvents`）只把含 `run.started` 的 journal 当成一次批次运行：否则事件归位后，队列里每个批次的第一次运行都会变成 attempt 2、task 带「上一轮中断」（SPEC 13.10 末段）
2. `fix_max` 升级时的 backlog 提交按 SPEC 12.1 推送，在队列 journal 记 `verdict.pushed` 或 `verdict.push_failed`
3. FIX 重跑的 task（SPEC 13.10、11.7）：「上一轮判 FIX」一节加小节「降级原因」，写上一轮 `verdict.downgraded` 的规则号与 `reason`，有 `cause` / `detail` 时一并写；
   提交清单只列 worker 的代码提交（按 R2 提交前缀排除）。新建 `test/queue-journal.test.ts`：`queue.batch_started` 在 `q-` journal 里、不在 `r-` journal 里；
   `Recorder` 拒绝信封键；`fix_max` 之后远端含 HEAD 且有 `verdict.pushed`；规则 9 的 FIX 重跑 task 含降级原因；清单不含 `docs: issue` 提交；没有缺口时 `gaps` 是空数组；
   `--continue` 下批次第一次运行的 task 里 `attempt` 是 1、`interrupted_at` 为 null，FIX 重跑是 2。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `batch_run_id`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 队列 journal 专项测试通过 | `npm test -- test/queue-journal.test.ts` | exit 0 |
| 专项测试不少于 7 个 | `grep -cE "^\s+it\(" test/queue-journal.test.ts \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 队列 journal 不算批次运行（有测试） | `grep -qE "interrupted_at" test/queue-journal.test.ts` | exit 0 |
| 字段改名进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "batch_run_id" && grep -qE "batch_run_id" test/queue-journal.test.ts` | exit 0 |
| 降级原因进 task 生成与测试 | `grep -rqE "降级原因" src && grep -qE "降级原因" test/queue-journal.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "batch_run_id" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10、放行判定、`fix_max` 的默认值与计数方式；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b07/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b07` 为提交信息单独提交并推送该文件。
