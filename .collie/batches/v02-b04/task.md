---
schema_version: 1
run_id: r-20261021-025435
batch_id: v02-b04
base_sha: 35ed1cdcef8ebdae980bdd8ec4a78552f8a51155
created_at: 2026-10-21T02:54:35.381Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b04：b02/b03 遗留修补

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 心跳覆盖整个 run（11.3）：`run.finished` 之后才删除；加 `phase` 与 `worker_pid`；
   孤儿检测同时看两个 pid。`test/heartbeat.test.ts` 补「reviewer 阶段并行启动被拒绝」用例
2. `claude.ts` 的 `stop('soft')` 必调并 `await` `interrupt()`，缺失即抛错（11.2）；
   `run.finished` 与 progress 运行记录带 worker 的 `exit_code` / `stop_reason`（11.7）
3. `LivenessMonitor` 注入 `now()` / `setTimer()`（11.5）；`test/scenario-g.test.ts` 与 `test/ladder.test.ts`
   改用假时钟，删除所有真实耗时断言

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 全量连跑 3 次稳定 | `npm test && npm test && npm test` | exit 0 |
| 场景 G 不再断言真实耗时 | `! grep -qE "toBeLessThan\(2000\)\|Date.now" test/scenario-g.test.ts` | exit 0 |
| interrupt 不再可选 | `! grep -qE "interrupt\?\." src/runner/claude.ts` | exit 0 |
| 心跳并行拒绝覆盖 reviewer 阶段 | `grep -qE "reviewer" test/heartbeat.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 实现任何 resume / 中断标记注入（那是 v02-b05）

## 汇报要求

完成后写 `.collie/batches/v02-b04/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b04` 为提交信息单独提交并推送该文件。
