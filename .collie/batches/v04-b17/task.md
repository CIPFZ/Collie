---
schema_version: 1
run_id: r-20261113145215
batch_id: v04-b17
base_sha: 85819ca82135d79f2b5f1f2ff40942464aafd250
created_at: 2026-11-13T14:52:16.390Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b17：why / timeline 补齐 journal 里已有的数据：reviewer 花费、模型、用时、token、head_sha、裁定提交 CI

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/view.ts`（SPEC 13.23 前两段；timeline 的 `run_end` 与按版本汇总，`projectWhy` / `formatWhy` / `WhyAttempt`）：一次运行的花费 = worker + reviewer 的 `cost_usd`，只加有的，两者都没有才算缺数据；
   `why` 补 worker 的模型、用时、token，reviewer 的模型、轮数、花费、用时，`head_sha`，本次运行的 `ci.verdict_commit`，每个 attempt 一行 `cost: worker=… reviewer=… total=…`，以及对应的 `--json` 字段
2. 声称不符的结论行与 R2 的那一处（SPEC 13.23 后两段）：`view.ts` 里 reason 以「声称不符：」开头且没有 rule 时写 `结论：FIX，<reason>`；`src/run.ts` 的 `finish` 只在规则号 1~10 时写 `rule`。
   `run.ts` 只许改这一处，不改 sha 校验、仲裁和队列的任何逻辑
3. 测试：`test/why.test.ts` 与 `test/timeline.test.ts` 各加用例，至少一组数据用 `Sandbox` 让 fake runner 跑真实的 `collie run` 产生（fake runner 的 `result` 能脚本化 `costUsd` / `numTurns` / `durationMs` / `usage`）：
   timeline 的花费等于 worker 与 reviewer 之和、只有 worker 有花费时等于 worker 的；why 的四处与 `--json` 字段；sha 写错的那次运行结论行含「声称不符」、不含「规则 0」与「规则 —」。
   `test/report-sha.test.ts` 加断言：sha 解析不了时 `run.finished` 没有 `rule` 字段。`test/invariants.test.ts` 加「`src/view.ts` 含 `ci.verdict_commit`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 投影专项测试通过 | `npm test -- test/why.test.ts test/timeline.test.ts test/report-sha.test.ts` | exit 0 |
| why 显示裁定提交 CI（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "ci\.verdict_commit" && grep -qE "ci\.verdict_commit" test/why.test.ts` | exit 0 |
| why 显示模型（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "model=" && grep -qE "model=" test/why.test.ts` | exit 0 |
| timeline 测试覆盖 reviewer 花费 | `grep -qE "reviewer\.finished" test/timeline.test.ts` | exit 0 |
| 声称不符的结论行有测试 | `grep -qE "声称不符" test/why.test.ts` | exit 0 |
| sha 写错时 run.finished 不带 rule | `grep -qE "not\.toHaveProperty\(.rule.\)" test/report-sha.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "ci\.verdict_commit" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增事件或字段；读取 `stream.ndjson` 或 `report.md`；让四个命令写任何文件
- `run.ts` 除条目 3 那一处外的任何改动；改动规则 1~10、放行判定、各项阈值；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b17/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b17` 为提交信息单独提交并推送该文件。
