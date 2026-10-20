---
schema_version: 1
run_id: r-20261020-124813
batch_id: v02-b02
base_sha: ee8d3a708c660e14e8455dd843fb784e57072ce2
created_at: 2026-10-20T12:48:13.347Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b02：落盘、心跳与救援

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/runner/index.ts` 追加 `resumeSessionId` / `onStarted` / `RunHandle`（11.2）；
   `fake.ts` 实现三级 `stop`，可脚本化「不响应 soft」；`claude.ts` 实现 `RunHandle`
   （soft / hard / kill 的 SDK 映射留在 runner 内，SDK 无 pid 时 `pid` 省略）。
   按 SPEC 11.2 的约束：soft 用 SDK 的轮次级 `interrupt()`，不得与 hard 同为 abort；
   `test/runner-claude.test.ts` 须断言注入的 `query()` 收到的选项中，SDK 的 `resume` 字段等于 `resumeSessionId`
2. `stream.ndjson` 落盘（11.3）；`heartbeat.json` 写入、更新、清理、启动时孤儿检测与并行拒绝（11.3）；
   新增事件 `run.orphaned` / `worker.rescued`（11.8）。
   修正 v01-b01 留下的扩展名错误：`.gitignore` 与 `src/cli.ts` 的 `GITIGNORE_ENTRIES`
   把 `.collie/heartbeat` 改为 `.collie/heartbeat.json`，否则救援提交会把心跳文件带进仓库
3. 脏工作区救援（11.4）：worker 退出后由 R2 执行 wip 提交并记事件；救援提交不推送。
   场景 E 前半段 `test/scenario-e.test.ts`：断言 kill 后救援提交与事件存在
   （`attempt=2` / `interrupted_at` 的断言留给 v02-b04）

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 前半段 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 心跳与孤儿检测 | `npm test -- test/heartbeat.test.ts` | exit 0 |
| 心跳文件被忽略 | `git check-ignore -q .collie/heartbeat.json` | exit 0 |
| resume 字段映射有断言 | `grep -qE "resume" test/runner-claude.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；本批次不新增配置字段
- 测试联网或调用真实 SDK

## 汇报要求

完成后写 `.collie/batches/v02-b02/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b02` 为提交信息单独提交并推送该文件。
