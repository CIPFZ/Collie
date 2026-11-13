# 批次 v04-b16 汇报

## 做了什么

1. **改判（SPEC 13.21）**：在 `src/run.ts` 中，将 sha 解析失败（步骤 1）从原来的 `escalate()` (BLOCK, exit 20) 改为 `claim.mismatch` + FIX (exit 10)。具体实现：
   - 收集所有无法解析的 sha（head_sha 和 commits[i]），每个记一条 `claim.mismatch` 事件（field / claimed / actual=`unresolvable`，不带 rule）
   - 不拉起 reviewer，不查 CI，不跑验收
   - 通过 git 实测获取 evidence（提交清单和推送状态），写 progress 记录
   - 结论 FIX，退出码 10，`run.finished` 的 reason 以「声称不符」开头
   - 推送裁定提交
   - 步骤 2（不是后代）和步骤 3（不是祖先）及 git 命令失败仍走 BLOCK 上报路径

2. **重跑（SPEC 13.21 重跑段）**：
   - `batchHistory` 改为 async（需要 `git log` 取提交清单），在 FIX 分支中新增 `claimMismatches` 收集逻辑：从 journal 的 `claim.mismatch` 事件提取 field/claimed/actual
   - 当上一轮无 `reviewer.verdict` 事件时，不读 `verdict.md`（可能是更早一轮残留），gaps 为空，提交清单取 `base_sha..HEAD` 中排除 R2 提交后的 worker 代码提交
   - `FixInfo` 新增 `claimMismatches` 可选字段
   - `renderFixSection` 在有 claimMismatches 时输出「声称不符」子节，逐条列出 field/claimed/actual，并写「sha 一律抄 git rev-parse 的输出」
   - `--continue` 下按普通 FIX 计入 `fix_max`，`queue.batch_started.why` 为 `fix_retry`

3. **测试**：
   - `test/report-sha.test.ts` 共 10 个 `it()` 测试：
     - 不存在的 head_sha → exit 10 FIX，journal 有 claim.mismatch（actual=unresolvable），无 reviewer.started 和 escalated
     - 不存在的 commits[i] → exit 10 FIX，claim.mismatch for commits[0]
     - 不是后代 → 仍 exit 20 BLOCK（保留原行为）
     - BLOCK 重跑 task 含「上一轮结论」（原有测试保留）
     - BLOCK 重跑 interrupted_at 含 escalated（原有测试保留）
     - 信号阶梯中断保持旧中断节（原有测试保留）
     - runIdAt 格式（原有测试保留）
     - `--continue` 下第 1 次写错 sha → FIX，第 2 次写对 → PASS，queue.batch_started.why=fix_retry，task 含「声称不符」
     - stale verdict.md 不被 FIX 任务引用
     - 连续写错超过 fix_max → exit 20
   - `test/invariants.test.ts` 新增 `unresolvable` 检查，push 数量上限从 4 调为 5
   - `test/scenario-e.test.ts` 和 `test/scenario-f.test.ts` 中 `batchHistory()` 调用改为 `await`（因函数签名变更）

## 测试结果

```
npm run lint → exit 0
npm run typecheck → exit 0
npm test → 50 files, 965 passed, 0 failed
npm test -- test/report-sha.test.ts → 1 file, 10 passed, 0 failed
```

所有 9 项验收命令均通过。

## 偏离或疑问

- `batchHistory` 从同步函数改为 async，因为 SPEC 13.21 要求在无 reviewer.verdict 时用 `git log` 取提交清单，这是一个 async 操作。这导致 `test/scenario-e.test.ts` 和 `test/scenario-f.test.ts` 中的调用也需要加 `await`（两个非 async 的 `it()` 回调改为 async）。这不改变任何现有行为，只是类型签名的必要调整。
- 新的 FIX 路径中的 `ArbiterDecision` 使用 rule=0（与 escalation 路径一致），因为 SPEC 13.21 说「不带 rule」。
- `run.finished` 的 reason 由 `decision.reason` 自动写入（通过 `finish` 函数），格式为「声称不符：report <field> <sha> does not resolve to a commit」，符合 SPEC 13.21。

## 下一步建议

- `collie show` / `collie why` 可能需要在显示声称不符 FIX 时用特殊格式（当前会显示 rule=0，可能需要改为「声称不符」）
- progress.md 的裁定栏写「声称不符：sha 不存在」这一描述目前由 `writeProgress` 基于 `decision.reason` 生成，可确认格式是否需要调整

```json
{
  "schema_version": 1,
  "batch_id": "v04-b16",
  "head_sha": "9437943164b2a3a7dd2b04c13e2082126d1d0e46",
  "claims": {
    "commits": ["9437943164b2a3a7dd2b04c13e2082126d1d0e46"],
    "tests_passed": 965,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
