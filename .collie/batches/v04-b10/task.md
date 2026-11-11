---
schema_version: 1
run_id: r-20261111113528
batch_id: v04-b10
base_sha: c1d97b4d0a2346ee875239a1d667dbc3dece3a70
created_at: 2026-11-11T11:35:29.678Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b10：队列里的中断自动续跑一次、验收失败全记、放行留痕

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 中断续跑（SPEC 13.14；先例是 12.3 的规则 1 重跑；中断语义见 11.7）：`--continue` 下，走上报路径且 `worker_stop_reason` 是 `idling` / `stalled` / `wallclock` 的批次运行，
   本次队列内第一次自动重跑：记 `batch.retried`（cause `interrupted`、带 stop_reason），不计 `fix_max` 与 `--max`，backlog 状态改回 `pending`，`queue.batch_started.why` 为 `interrupt_retry`；
   第二次仍中断则停，退出码 20。worker 崩溃、`turns_exhausted`、reviewer 失败不重跑。规则 1 的重跑判断只认带 `rule: 1` 的 `batch.retried`
2. 留痕（SPEC 13.14、3.6）：R2 实测未满足的每条验收不论裁决都记 `acceptance.failed`（规则 8 的判定不变）；
   PASS 后放行判定通过时在队列 journal 记 `queue.gate_passed`（字段 batch_id / batch_run_id，不得用 `run_id` 作扩展字段名）
3. 新建 `test/scenario-n.test.ts`，时钟与产出指纹按场景 G 的做法注入，不用真实定时器：空转一次后续跑 PASS、队列继续；连续两次空转退出码 20；worker 崩溃不续跑；
   续跑不占 `fix_max`；reviewer 判 FIX 时 journal 有 `acceptance.failed`；PASS 后队列 journal 有 `queue.gate_passed`。
   `test/invariants.test.ts` 加「`src/schema/index.ts` 含 `queue.gate_passed`」「`src/run.ts` 含 `interrupt_retry`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 N 通过 | `npm test -- test/scenario-n.test.ts` | exit 0 |
| 场景 N 不少于 6 个用例 | `grep -cE "^\s+it\(" test/scenario-n.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 场景 N 不用真实定时器 | `test -f test/scenario-n.test.ts && ! grep -qE "setInterval\|setTimeout\(" test/scenario-n.test.ts` | exit 0 |
| 续跑原因进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "interrupt_retry" && grep -qE "interrupt_retry" test/scenario-n.test.ts` | exit 0 |
| 放行事件进 schema 与测试 | `grep -qE "queue\.gate_passed" src/schema/index.ts && grep -qE "queue\.gate_passed" test/scenario-n.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "queue\.gate_passed" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 的判定、放行判定的六项、`fix_max` 与各项阈值的默认值；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b10/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b10` 为提交信息单独提交并推送该文件。
