---
schema_version: 1
run_id: r-20261027055553
batch_id: v03-b04
base_sha: eb22b9e45ee2cb48a9f95fe7182c6e511b18380d
created_at: 2026-10-27T05:55:57.729Z
attempt: 2
interrupted_at: r-20261027051508 unknown run.finished@2026-10-27T05:55:53.475Z
issued_by: collie
---

# 批次 v03-b04：放行判定与停表：queue.paused、规则 1 自动重跑、规则 9 连续两次

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 放行判定（`src/run.ts` 队列循环，PASS 之后、选下一批之前）：按 SPEC 12.3 的七项逐条检查，任一不满足则 `rec.record('queue.paused', {batch_id, reasons})`、
   `queue.finished` reason=`paused` 带 `paused_count`、退出码 30；全部满足才取下一批。判定函数独立为纯函数 `gateDecision(input): {pass: boolean; reasons: string[]}`
   放在 `src/arbiter.ts` 旁的 `src/gate.ts`，输入只含 SPEC 12.3 列的字段。`schema` 加两个事件；`cli.ts` 退出码 30。单批次模式不调用
2. 规则 1 自动重跑与规则 9 连续两次（同一队列循环）：BLOCK 且 `decision.rule === 1` 且本批次此前没有 `batch.retried` → 记 `batch.retried` 立即重跑同批次，
   不计入 `fix_max`；第二次仍规则 1 → 停、退出码 20。连续两个批次都有 `verdict.downgraded` rule=9 → `queue.paused` reason=`rule9_twice`、退出码 30
3. 场景 L（`test/scenario-l.test.ts`，fake runner，三组）：a. 批次 PASS 但 reviewer `gaps` 非空 → `queue.paused` reasons 含 `gaps`、backlog 状态 `passed`、退出码 30、
   `queue.finished` paused_count=1；b. 第一轮 reviewer 输出坏 JSON（规则 1 BLOCK）、第二轮正常 PASS → journal 有 `batch.retried` rule=1、继续到下一批、
   `fix_max` 计数未增加；c. 两个批次连续 `claims.pushed=false`（规则 9 降级）→ 第二个批次后 `queue.paused` reason=`rule9_twice`。
   `test/gate.test.ts` 覆盖 `gateDecision` 七项各自单独不满足的情况。`test/invariants.test.ts` 加「`src/gate.ts` 存在且不 import runner」「`scenario-l` 存在」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 L | `npm test -- test/scenario-l.test.ts` | exit 0 |
| 两个事件进 schema | `grep -qE "queue\.paused" src/schema/index.ts && grep -qE "batch\.retried" src/schema/index.ts` | exit 0 |
| 判定是纯函数 | `grep -qE "export function gateDecision" src/gate.ts && ! grep -qE "runner\|run\.js" src/gate.ts` | exit 0 |
| 退出码 30 | `grep -qE "\b30\b" src/cli.ts && grep -qE "\b30\b" test/scenario-l.test.ts` | exit 0 |
| 规则 1 重跑不计 fix_max | `grep -qE "batch\.retried" src/run.ts && grep -qE "fix_max" test/scenario-l.test.ts` | exit 0 |
| 规则 9 连续两次 | `grep -qE "rule9_twice" src/run.ts && grep -qE "rule9_twice" test/scenario-l.test.ts` | exit 0 |
| 七项各有单测 | `grep -cE "^\s+it\(" test/gate.test.ts \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 不变量同步 | `grep -qE "gate\.ts\|scenario-l" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动规则 1~10 的实现或仲裁结论：放行判定只决定「继续还是停」，不改 PASS
- 单批次模式 `collie run <batch>` 发出 `queue.paused` 或返回 30

## 汇报要求

完成后写 `.collie/batches/v03-b04/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v03-b04` 为提交信息单独提交并推送该文件。

## 上一轮中断

中断信息：`r-20261027051508 unknown run.finished@2026-10-27T05:55:53.475Z`

上一轮未留下救援提交，请从 `git log` 核实已完成到哪一步。
