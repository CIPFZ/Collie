---
schema_version: 1
run_id: r-20261026-114631
batch_id: v03-b03
base_sha: 556049e3b19e7602ca62bf22408710ec63ea7ec0
created_at: 2026-10-26T11:46:32.471Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v03-b03：队列消费与分流：--continue、fix_max 返工闸、backlog 状态列

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `collie run --continue [--max N]`（`src/cli.ts` + `src/run.ts`）：选批逻辑（第一个 `pending` 且依赖全 `passed`，依赖未满足记 `batch.skipped`）、
   分流（PASS 取下一个；FIX 计数 ≤ `fix_max` 立即重跑，否则 `escalated` reason=`fix_max` 并停；BLOCK / 上报停、退出码 20）、
   `queue.finished`（reason / batches）。每批次结束仍走 11.3 清理与 12.1 推送；批次之间不共享进程。单批次模式行为不变
2. backlog 状态列写入（`src/backlog.ts` 加 `setBatchStatus(text, id, status)` 纯函数 + R2 落盘）：只改该行最后一列、其余字节不动，
   找不到或格式不符记 `batch.status` to=`unchanged`。状态文件改动并入裁定提交（`progress: ...`）。单批次模式不写
3. 场景 J（`test/scenario-j.test.ts`，fake runner）：backlog 三个批次 A(passed)、B(pending 依赖 A)、C(pending 依赖 X 不存在)，
   `--continue`：B 跑 PASS → 状态列变 `passed`、C 记 `batch.skipped`、`queue.finished` reason=`exhausted`；
   第二组：B 连续 FIX 3 次（`fix_max`=2）→ 第 3 次 `escalated` reason=`fix_max`、退出码 20、B 状态 `blocked`、attempt 为 3 且 `base_sha` 三次相同；
   第三组：`--max 1` 跑一个即停 reason=`limit`。`test/invariants.test.ts` 加「`src/backlog.ts` 有 `setBatchStatus`」「`scenario-j` 存在」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 J | `npm test -- test/scenario-j.test.ts` | exit 0 |
| 三个事件进 schema | `grep -qE "batch\.skipped" src/schema/index.ts && grep -qE "batch\.status" src/schema/index.ts && grep -qE "queue\.finished" src/schema/index.ts` | exit 0 |
| --continue 存在 | `grep -qE "\-\-continue" src/cli.ts && grep -qE "\-\-max" src/cli.ts` | exit 0 |
| 状态列纯函数 | `grep -qE "export function setBatchStatus" src/backlog.ts && grep -qE "setBatchStatus" test/backlog.test.ts` | exit 0 |
| fix_max 闸有测试 | `grep -qE "fix_max" test/scenario-j.test.ts && grep -qE "escalated" test/scenario-j.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "setBatchStatus\|scenario-j" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（`docs/backlog.md` 的状态列由 R2 在运行时写，worker 不碰）
- 为了让测试过而删除或跳过任何测试
- 单批次模式 `collie run <batch>` 改写 backlog
- 批次之间复用 runner、守护进程或心跳

## 汇报要求

完成后写 `.collie/batches/v03-b03/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v03-b03` 为提交信息单独提交并推送该文件。
