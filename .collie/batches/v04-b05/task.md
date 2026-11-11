---
schema_version: 1
run_id: r-20261111093302
batch_id: v04-b05
base_sha: f4267bc5b382c388aa7bafda4c4f91b4ff9997d6
created_at: 2026-11-11T09:33:02.866Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b05：collie watch：实时跟随

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/watch.ts`（SPEC 13.5；`status` 的「当前」段见 13.2，事件字段表在 3.6）：轮询循环，时钟、sleep 与取数函数都由参数注入；每条新事件打印一行，阶段变化时打印 `status` 的「当前」段，
   静默超过 `stall_secs` 时标出秒数；`run.finished`（队列运行为 `queue.finished`）后结束
2. `collie watch [--once] [--interval <秒>] [--timeout <秒>]`，`cli.ts` 只做接线；只读：不写 journal、不碰心跳、不发信号
3. `test/watch.test.ts`：用注入的时钟与 sleep，覆盖 `--once`、跟到 `run.finished` 退出、跟到 `queue.finished` 退出、等待新运行、超时退出、静默标注；
   `test/invariants.test.ts` 加「`test/watch.test.ts` 不含真实定时器」「`src/watch.ts` 不写文件」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| watch 专项测试通过 | `npm test -- test/watch.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/watch.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| watch --once 可用 | `npx tsx src/cli.ts watch --once` | exit 0 |
| 测试不用真实定时器 | `test -f test/watch.test.ts && ! grep -qE "setInterval\|setTimeout\(" test/watch.test.ts` | exit 0 |
| watch 只读（不看注释行） | `test -f src/watch.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/watch.ts \| grep -qE "writeFileSync\|appendFileSync\|process\.kill"` | exit 0 |
| 不变量同步 | `grep -qE "watch\.ts" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；绕过 `src/view.ts` 直接读 journal；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b05/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b05` 为提交信息单独提交并推送该文件。
