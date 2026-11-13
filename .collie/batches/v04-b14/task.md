---
schema_version: 1
run_id: r-20261113071037
batch_id: v04-b14
base_sha: 612f68cc91d9cf9d7d0cf4b7ff16d95ec0af09ec
created_at: 2026-11-13T07:10:38.545Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b14：裁定提交的 CI 在取证后补查一次

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 补查（SPEC 13.18；启动核查是 `src/run.ts` 里记 `ci.verdict_commit` 的那一段，原条文在 12.1）：启动核查得到 `pending` 或 `no_runs` 时记住这个 sha，本次运行取证结束后再 `queryCi` 一次；
   有结论照 12.1 记事件，`failure` / `cancelled` 打印同一行 `warning: previous verdict commit …`；同一个 sha 一次运行至多记一次；上报路径不补查
2. 事件字段（SPEC 13.18、3.6）：`ci.verdict_commit` 加可选字段 `when`，启动时查到的写 `startup`，补查到的写 `after_evidence`。补查只记事件与警告：不改结论、不影响放行判定、不停队列
3. 新建 `test/verdict-ci-recheck.test.ts`，用 `Sandbox` 加测试注入的 `fetch`（按 sha 与调用次数返回不同结果）：启动时 pending、取证后 success → 一条 `when: after_evidence` 的事件；
   取证后 failure → 有事件、输出含 `previous verdict commit`、本次运行的结论与退出码不变；两次都 pending → 不记；启动时已有结论 → 只有一条 `when: startup`；上报路径不补查。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `after_evidence`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 补查专项测试通过 | `npm test -- test/verdict-ci-recheck.test.ts` | exit 0 |
| 专项测试不少于 5 个 | `grep -cE "^\s+it\(" test/verdict-ci-recheck.test.ts \| grep -qE "^([5-9]\|[1-9][0-9])$"` | exit 0 |
| 补查标记进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "after_evidence" && grep -qE "after_evidence" test/verdict-ci-recheck.test.ts` | exit 0 |
| 测试断言了警告文字 | `grep -qE "previous verdict commit" test/verdict-ci-recheck.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "after_evidence" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 让补查改变任何结论、放行判定或退出码；改动规则 1~10、各项阈值；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b14/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b14` 为提交信息单独提交并推送该文件。
