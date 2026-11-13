---
schema_version: 1
run_id: r-20261113075508
batch_id: v04-b16
base_sha: 261918b97a747036eee033f227785c036bfaa68c
created_at: 2026-11-13T07:55:09.044Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b16：report 里的 sha 解析不了改判为声称不符：FIX 并自动重跑

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 改判（SPEC 13.21「判定」一段；仲裁原文在 4.3；现有检查是 v04-b13 在 `src/run.ts` 里报 `does not resolve to a commit` 的那一处）：解析不了时记 `claim.mismatch`
   （field / claimed / actual 为 `unresolvable`，不带 rule），不拉起 reviewer，结论 FIX、退出码 10，progress 写一条记录并照常提交推送；「不是后代」「不是祖先」与 git 命令失败仍是上报 BLOCK
2. 重跑（SPEC 13.21「重跑」一段；`src/run.ts` 的 `batchHistory` FIX 分支与 `renderFixSection`）：「上一轮判 FIX」一节加小节「声称不符」，列出上一轮每条 `claim.mismatch`；
   上一轮没有 `reviewer.verdict` 时不读 `verdict.md`，提交清单取 `base_sha..HEAD` 的 worker 代码提交。`--continue` 下按普通 FIX 计入 `fix_max` 并重跑，不加新的队列分支
3. 测试：`test/report-sha.test.ts`（v04-b13 新建）里「不存在的 sha → 退出码 20」那一条改成新行为，并补：journal 有 `claim.mismatch`（actual 为 `unresolvable`）、没有 `reviewer.started` 与 `escalated`；
   `--continue` 下第 1 次写错、第 2 次写对 → PASS 且队列继续，第 2 次的 `queue.batch_started.why` 是 `fix_retry`、task 含「声称不符」与写错的那个 sha；
   仓库里留着更早一轮的 `verdict.md` 时 task 不引用它的 gaps；连续写错超过 `fix_max` → 退出码 20；「不是后代」仍是退出码 20。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `unresolvable`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| sha 校验专项测试通过 | `npm test -- test/report-sha.test.ts` | exit 0 |
| 专项测试不少于 9 个 | `grep -cE "^\s+it\(" test/report-sha.test.ts \| grep -qE "^(9\|[1-9][0-9])$"` | exit 0 |
| 改判进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "unresolvable" && grep -qE "unresolvable" test/report-sha.test.ts` | exit 0 |
| 测试断言了声称不符事件与自动重跑 | `grep -qE "claim\.mismatch" test/report-sha.test.ts && grep -qE "fix_retry" test/report-sha.test.ts` | exit 0 |
| 重跑说明进 task 生成与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "声称不符" && grep -qE "声称不符" test/report-sha.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "unresolvable" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（把 v04-b13 那条「不存在的 sha → 退出码 20」的断言改成新行为不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 的判定；让「不是后代」「不是祖先」或其他上报路径变成 FIX；改动放行判定、`fix_max` 与各项阈值；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b16/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b16` 为提交信息单独提交并推送该文件。
