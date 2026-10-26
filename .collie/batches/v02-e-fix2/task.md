---
schema_version: 1
run_id: r-20261026-035021
batch_id: v02-e-fix2
base_sha: 010055e54d8778274cb38979479d8edd68556a60
created_at: 2026-10-26T03:50:21.392Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-e-fix2：rescue_sha 跨轮查找、interrupted_at 时间

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `run.ts` 生成 task 时，`worker.rescued` 同时在上一轮 journal 与本轮 journal（`run.orphaned` 之后）查找，取最后一条；
   有 `rescue_sha` 时 frontmatter 写入且正文含「请先核实」句，没有时正文含「上一轮未留下救援提交」句
2. `readStreamLastEvent`：事件类型按 SPEC 11.7 细化（`type/subtype` 或 `tool_use` 的 `name`），时间取消息 `timestamp`，
   缺失则向前找最近一条有 `timestamp` 的行，再缺失用心跳 `updated_at`；返回的时间不得为空串
3. `test/scenario-e.test.ts` 用 fake runner 覆盖孤儿救援路径：第 1 轮写脏文件后模拟 R2 被 kill（心跳遗留、无 `run.finished`、
   `stream.ndjson` 末行是无 `timestamp` 的 `user` 消息），第 2 轮启动后断言 `task.md` 的 `rescue_sha` 等于 `worker.rescued.sha`、
   正文含「请先核实」、`interrupted_at` 含 `orphaned` 且时间非空且事件类型不是裸的 `user`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 孤儿路径 rescue_sha 有断言 | `grep -qE "rescue_sha" test/scenario-e.test.ts && grep -qE "请先核实" test/scenario-e.test.ts` | exit 0 |
| interrupted_at 时间非空有断言 | `grep -qE "interrupted_at" test/scenario-e.test.ts && grep -qE "toBeTruthy\|toHaveLength\|toMatch" test/scenario-e.test.ts && grep -qE "tool_use" src/run.ts` | exit 0 |
| 不变量同步 | `grep -qE "请先核实\|rescue_sha" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动守护进程、取证范围、规则链的任何实现

## 汇报要求

完成后写 `.collie/batches/v02-e-fix2/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-e-fix2` 为提交信息单独提交并推送该文件。
