---
schema_version: 1
run_id: r-20261026-025925
batch_id: v02-e-drill2
base_sha: 7f9393976cd7a3da90e287e57d4317b4259d981a
created_at: 2026-10-26T02:59:25.208Z
attempt: 2
interrupted_at: r-20261026-025529 orphaned user@
issued_by: collie
---

# 批次 v02-e-drill2：场景 E 第 2 次演练（脏工作区 + 不补杀）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `collie show <batch>`（`src/cli.ts`）输出末尾加一段「中断链」：按 attempt 列出 `run.orphaned` / `worker.rescued` / `worker.resumed` 与 `rescue_sha`，
   无中断时省略
2. `test/show.test.ts` 覆盖有中断链与无中断链两种输出
3. `README.md` 加一节「中断与恢复」，三句话说明 kill 后会发生什么、下一轮怎么接、人该看哪里

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| show 有中断链 | `grep -qE "中断链" src/cli.ts && grep -qE "中断链" test/show.test.ts` | exit 0 |
| README 有章节 | `grep -qE "^## .*中断与恢复" README.md` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试

## 汇报要求

完成后写 `.collie/batches/v02-e-drill2/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-e-drill2` 为提交信息单独提交并推送该文件。

## 上一轮中断

中断信息：`r-20261026-025529 orphaned user@`

上一轮未留下救援提交，请从 `git log` 核实已完成到哪一步。
