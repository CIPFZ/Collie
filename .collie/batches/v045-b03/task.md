---
schema_version: 1
run_id: r-20261116081338
batch_id: v045-b03
base_sha: cda2bbcec85b55a193f4f1dff6da3360b7220e8f
created_at: 2026-11-16T08:13:38.480Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b03：通知与交接协议：notify 模块、next.md 的键值行、下一步动作的判定

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 通知（SPEC 14.3 第一段）：配置 schema 加可选的 `[notify] webhook_file`（**不要改** `.collie/collie.toml` 与 `templates/collie.toml`）；新建 `src/notify.ts`，`fetch` 由调用方传入；`collie notify <文本>`，`cli.ts` 只做接线。
   地址不得出现在返回值、报错、日志与任何输出里
2. 交接协议（SPEC 14.3 第二段的两张表）：新建 `src/handoff.ts`，`parseNext(text)` 与 `decide(next, state)`，纯函数：不 import `node:fs` / `node:child_process`，不读时钟，不用定时器
3. 新建 `test/notify.test.ts`（没配、文件不存在、2xx、非 2xx、`fetch` 抛错各一条，并断言任何返回值与输出都不含地址）与 `test/handoff.test.ts`
   （三种状态各自的必填键、重复的键、sha 格式不对、`批次上限` 不是正整数、键值行出现在第一个 `## ` 之后不算、SPEC 14.3 判定表的每一行）。
   `test/invariants.test.ts` 加「`src/handoff.ts` 不 import `node:fs` / `node:child_process`」「`src/notify.ts` 存在」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个专项测试通过 | `npm test -- test/notify.test.ts test/handoff.test.ts` | exit 0 |
| 协议测试不少于 10 个 | `grep -cE "^\s+it\(" test/handoff.test.ts \| grep -qE "^[1-9][0-9]$"` | exit 0 |
| 通知测试不少于 5 个 | `grep -cE "^\s+it\(" test/notify.test.ts \| grep -qE "^([5-9]\|[1-9][0-9])$"` | exit 0 |
| 协议模块是纯函数（不看注释行） | `test -f src/handoff.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/handoff.ts \| grep -qE "node:fs\|node:child_process\|setTimeout\|setInterval\|Date\.now"` | exit 0 |
| 有测试断言地址不外泄 | `grep -qE "not\.toContain" test/notify.test.ts` | exit 0 |
| 没配置时跳过而不是报错 | `HOME=$(mktemp -d) npx tsx src/cli.ts notify "acceptance" 2>&1 \| grep -qE "skipped"` | exit 0 |
| 通知配置进 schema | `grep -qE "webhook_file" src/schema/index.ts` | exit 0 |
| 不变量同步 | `grep -qE "handoff" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里向真实网络发请求；让通知地址出现在任何输出、事件或报错里；改动 `run.ts`、`gate.ts`、`arbiter.ts`；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b03/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b03` 为提交信息单独提交并推送该文件。
