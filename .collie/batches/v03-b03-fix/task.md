---
schema_version: 1
run_id: r-20261026-161002
batch_id: v03-b03-fix
base_sha: 0f38ae27859f29723c39f5ed94b322c2d470ede2
created_at: 2026-10-26T16:10:03.044Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v03-b03-fix：head_sha 按首次 base_sha、取证排除 R2 提交、续接成本判断、中断原因、CLI 总结行、audit

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `run.ts` `head_sha` 检查改为「是首次 `base_sha` 的后代且是 `HEAD` 的祖先或等于 `HEAD`」，错误文案相应改；
   `src/evidence.ts` 的 `commits_actual` 与规则 2 / 3 的 diff 按提交逐个取、跳过提交信息以 `docs: issue ` / `progress: ` / `report(collie): ` / `ops: ` 开头的提交。
   场景测试（`scenario-e` 或新 `scenario-k`，fake runner）：attempt 1 提交代码并推送后被中断（无 report）；attempt 2 的 fake worker 只写 report、
   `head_sha` 填 attempt 1 的提交 → 不上报、reviewer 被拉起、`commits_actual` 等于 attempt 1 的代码提交且不含 task / progress 提交
2. 续接成本判断（11.7）：`batchHistory` 增加「上一轮是否已推送代码且工作区干净」的判断（journal 里上一轮有 `worker.finished` 且远端含上一轮最后一个
   非 R2 提交、无 `worker.rescued`），为真则 `session_id: null`；`scenario-f` 加一组：已推送只缺 report 时不续接
3. `run.ts`：本轮有 `worker.signaled` 时，`worker.finished` 的 `stop_reason` 记阶梯 reason（`wallclock` / `stalled` / `idling`），SDK 原值放 `sdk_stop_reason`；
   `batchHistory` 构造 `interrupted_at` 时按 SPEC 11.7 顺序（`worker.signaled.reason` 最优先）。场景测试断言 soft 中断后 `interrupted_at` 含 `wallclock` 且不含 `error`。
   `cli.ts` 总结行：上报路径不打印 `rule 0:`，打印 `上报：无 report — <原因>`；`collie audit` 无 reviewer 事件流时输出
   `no reviewer in run <run_id> (escalation path or worker crash); nothing to audit`，退出码仍 2。`test/cli.test.ts` 断言两处文案；
   `test/invariants.test.ts` 加「`src/cli.ts` 不含 `rule 0`」「`src/evidence.ts` 含 `report(collie)`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| head_sha 按首次 base_sha | `! grep -qE "does not descend from the task commit" src/run.ts && grep -qE "commits_actual" test/scenario-*.test.ts` | exit 0 |
| 取证排除 R2 提交 | `grep -qE "report\(collie\)" src/evidence.ts && grep -qE "progress: " src/evidence.ts` | exit 0 |
| 续接成本判断有测试 | `grep -qE "session_id.*null\|sessionId.*undefined" test/scenario-f.test.ts` | exit 0 |
| stop_reason 取阶梯 | `grep -qE "sdk_stop_reason" src/run.ts && grep -qE "wallclock" test/scenario-*.test.ts` | exit 0 |
| CLI 无 rule 0 | `! grep -qE "rule 0" src/cli.ts && grep -qE "rule 0" test/cli.test.ts` | exit 0 |
| audit 文案 | `grep -qE "nothing to audit" src/cli.ts && grep -qE "nothing to audit" test/cli.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "rule 0\|sdk_stop_reason" test/invariants.test.ts && grep -qE "report\(collie\)" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动信号阶梯的触发条件或 soft / hard / kill 的实现
- 放宽 `head_sha` 检查到「任意已存在的提交」：必须同时满足首次 `base_sha` 的后代与 `HEAD` 的祖先

## 汇报要求

完成后写 `.collie/batches/v03-b03-fix/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v03-b03-fix` 为提交信息单独提交并推送该文件。
