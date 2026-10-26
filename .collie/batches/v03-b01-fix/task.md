---
schema_version: 1
run_id: r-20261026-082249
batch_id: v03-b01-fix
base_sha: d2d30323f5da49988742c6a58a647743f07671ba
created_at: 2026-10-26T08:22:52.512Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v03-b01-fix：启动补推只认失败的裁定提交，且先于救援

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `run.ts` 启动阶段：补推移到孤儿检测与救援**之前**；只有 journal 最近一条 `verdict.push_failed.sha` 等于 `HEAD` 且远端不含它时才 `push`
   并记 `verdict.pushed`；条件不满足记 `verdict.push_skipped`（字段 head / reason，reason 取 `no_failed_push` / `head_is_not_verdict` / `already_on_remote`）；
   没有 `push_failed` 事件时不调用 `push`、不记事件。`schema` 加 `verdict.push_skipped`
2. 场景测试（加进 `test/scenario-e.test.ts` 或新建 `test/scenario-i.test.ts`）：
   a. 第 1 轮 worker 写脏文件后模拟 R2 被 kill；第 2 轮启动后断言远端**不含** `worker.rescued.sha`，journal 无 `verdict.pushed`；
   b. 第 1 轮以注入的 push 替身让裁定推送失败（`verdict.push_failed`）；第 2 轮启动后断言远端含该裁定 sha、journal 有 `verdict.pushed`；
   c. 在 b 的基础上，第 2 轮启动前在 HEAD 上再加一个提交，断言不推送、记 `verdict.push_skipped` reason=`head_is_not_verdict`
3. `test/invariants.test.ts` 加一条：`src/run.ts` 里 `push(` 的调用处每一处前 5 行内都有 `push_failed` 或 `verdict`
   字样（粗略保证没有裸的启动 push）；顺带把 `scenario-f` 的 vitest 超时从默认 10 秒提到 30 秒（只改该文件的 `describe` 选项，不改断言）

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 F 连跑 3 次 | `for i in 1 2 3; do npx vitest run test/scenario-f.test.ts \|\| exit 1; done` | exit 0 |
| 补推有条件 | `grep -qE "push_skipped" src/run.ts && grep -qE "push_skipped" src/schema/index.ts && grep -cE "await push\(" src/run.ts \| grep -qE "^[1-3]$"` | exit 0 |
| 救援提交不被推送有测试 | `grep -qE "worker\.rescued" test/scenario-*.test.ts && grep -qE "push_skipped" test/scenario-*.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "push_skipped\|await push" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动裁定提交在运行末尾的正常推送路径（12.1 第一条）

## 汇报要求

完成后写 `.collie/batches/v03-b01-fix/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v03-b01-fix` 为提交信息单独提交并推送该文件。
