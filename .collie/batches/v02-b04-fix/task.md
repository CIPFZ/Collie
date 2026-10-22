---
schema_version: 1
run_id: r-20261022-062718
batch_id: v02-b04-fix
base_sha: 34a3b23edc400cecc6a274d7d842fb1d18b49c28
created_at: 2026-10-22T06:27:18.996Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b04-fix：R2 不再崩：interrupt this、异常兜底、内容指纹

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `claude.ts` 的 `interrupt()` 调用保持 `this`（11.2）：两处（惰性包装与 `stop('soft')`）都改为直接在对象上调用并 `await`，
   不再 `void`。`test/runner-claude.test.ts` 加回归测试：替身的 `interrupt` 读 `this` 上的字段、`this` 为 undefined 时抛错，
   测试名含 `binds this`
2. R2 异常兜底（11.3）与阶梯容错（11.6）：`run.ts` 最外层 try / finally，任何异常都先记 `run.finished(result=error)`、
   救援、追加 progress、删心跳，再以退出码 1 退出；注册 `unhandledRejection`；
   阶梯里某级 `stop()` 抛出时记 `worker.signaled` 带 `error` 字段并进入下一级。
   `test/ladder.test.ts` 加「soft 抛错 → 记 error → 升级 hard」用例；`test/run.test.ts`（或现有 run 测试文件）加
   「worker 阶段抛出 → run.finished(error) 存在、心跳已删、进程未直接退出」用例
3. 产出指纹（11.5）：改为 `HEAD` + `git diff HEAD` 哈希 + 未跟踪文件 (路径, 大小, mtime) 哈希，
   并做成可注入（`LivenessConfig.fingerprint?`）。`test/scenario-g.test.ts` 注入假指纹，fake worker 发事件、推进假时钟、
   改变假指纹三者全部由测试代码顺序控制；另加一条单测：同一文件内容改两次，两次指纹不同

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 连跑 5 次 | `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts \|\| exit 1; done` | exit 0 |
| interrupt 不再拆出调用 | `! grep -qE "= *(resolvedIterable\|queryIterable)\??\.interrupt;" src/runner/claude.ts` | exit 0 |
| this 绑定有回归测试 | `grep -qE "binds this" test/runner-claude.test.ts` | exit 0 |
| 未处理拒绝有兜底 | `grep -qE "unhandledRejection" src/run.ts src/cli.ts` | exit 0 |
| 指纹已注入且看内容 | `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts` | exit 0 |
| 场景 G 两个用例都注入了假指纹 | `test "$(grep -cE "livenessFingerprint" test/scenario-g.test.ts)" -ge 2` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 实现限流不等待或 worker_pid（那是 v02-b04-fix2）

## 汇报要求

完成后写 `.collie/batches/v02-b04-fix/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b04-fix` 为提交信息单独提交并推送该文件。
