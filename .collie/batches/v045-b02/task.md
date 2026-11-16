---
schema_version: 1
run_id: r-20261116074845
batch_id: v045-b02
base_sha: 6cc1bd502f87c35296bdbc22ce84d12c19304a5f
created_at: 2026-11-16T07:48:45.862Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b02：collie report：把一次队列运行写成 Markdown 汇报

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/view.ts` 加 `projectReport` 与 `formatReport`（SPEC 14.2）：七节固定、顺序固定，取不到的写 `—`；第 3 节的 attempt、用时、花费复用现有的推算函数，不另写一套；第 5 节复用 `projectWhy` / `formatWhy`，第 6 节复用 `show --queue` 的逐行格式，第 7 节复用 `status` 的队列段
2. `collie report [--queue <q_run_id>] [--json]`（SPEC 14.2）：缺省取最近一次队列运行；退出码 0 有数据 / 2 本机没有队列运行的 journal 或指定的队列号不存在。`cli.ts` 只做接线；不写任何文件
3. 新建 `test/report.test.ts`：至少两组数据用 `Sandbox` 让 fake runner 跑真实的 `collie run --continue`（一组两个批次连续 PASS，一组先 FIX 后 PASS；fake runner 的 `result` 能脚本化花费与轮数），
   断言七个标题都在且顺序对、「实际经过」表的行数与 attempt / 结论 / 合计花费对、`打扰：` 那一行的数字对；另测：没有 `queue.preflight` 的旧 journal 第 2 节写 `—`、两个退出码、`--json` 是合法 JSON。
   `test/invariants.test.ts` 加「`src/view.ts` 含 `projectReport`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| report 专项测试通过 | `npm test -- test/report.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/report.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 专项测试含真实运行的夹具 | `grep -qE "Sandbox\.create" test/report.test.ts` | exit 0 |
| 没有队列数据时退出码 2 | `npx tsx src/cli.ts report; test $? -eq 2` | exit 0 |
| 投影函数进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "projectReport" && grep -qE "projectReport" test/report.test.ts` | exit 0 |
| 投影模块仍然不写文件（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "writeFileSync\|appendFileSync"` | exit 0 |
| 不变量同步 | `grep -qE "projectReport" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`；改动 `status`、`timeline`、`why`、`watch`、`show` 的输出；读取 `stream.ndjson` 或 `report.md`；让 `report` 写任何文件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b02/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b02` 为提交信息单独提交并推送该文件。
