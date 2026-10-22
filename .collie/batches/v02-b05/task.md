---
schema_version: 1
run_id: r-20261022-161827
batch_id: v02-b05
base_sha: 58d7c1dc09864bc39f9ecc7fa7fd636b48474dc5
created_at: 2026-10-22T16:18:27.473Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b05：中断标记与 resume

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 中断判定与 `task.md` 注入（11.7）：`attempt` 递增、`interrupted_at`、`rescue_sha`、正文「上一轮中断」一节；
   `TaskFrontmatterSchema` 加可选 `rescue_sha`，不升版本。
   同一批次后续 attempt 沿用第 1 次的 `base_sha`（4.3「上报」段）；
   上报路径用 git 实测 `base_sha..HEAD` 与推送状态写入 progress，措辞「上报：无 report」，不再出现「规则 0」
2. resume 策略（11.7）：按 `resume_max` 决定是否传 `resumeSessionId`；新增事件 `worker.resumed`；
   仲裁 PASS 的运行不算中断、`attempt` 不递增（11.7 第一段）；
   `claude.ts` 的 `turns_exhausted` 映射已在 b03 提前落地，本批次只需测试覆盖。
   顺带两处 R2 取证侧（3.5、3.6）：CI 取证成功时记 `ci.resolved` 事件，`collie show` 能据此还原 R2 等了多久；
   取证前用 `git rev-parse` 把 report 的 `head_sha` 与 `commits[]` 展开为 40 位再查 CI、再校验，
   等待逻辑连续 3 次 `no_runs` 即转后代归属。`test/ci.test.ts` 覆盖「短 sha 展开」与「3 次 no_runs 转后代」
3. 场景 E 后半段（attempt / interrupted_at / rescue_sha）与场景 F：
   `test/scenario-e.test.ts` 补全，`test/scenario-f.test.ts` 新增；
   `collie show` 按顺序还原 E / F / G 的事件链

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 场景 F | `npm test -- test/scenario-f.test.ts` | exit 0 |
| show 还原事件链 | `npm test -- test/show.test.ts` | exit 0 |
| ci.resolved 进 schema 与 R2 | `grep -qE "ci\.resolved" src/schema/index.ts && grep -qE "ci\.resolved" src/run.ts && grep -qE "ci\.resolved" test/invariants.test.ts` | exit 0 |
| 场景 F 覆盖 resume 上限 | `grep -qE "resume_max" test/scenario-f.test.ts` | exit 0 |
| 后续 attempt 沿用首次 base_sha 有测试 | `grep -qE "base_sha" test/scenario-e.test.ts` | exit 0 |
| 短 sha 展开与 no_runs 转后代有测试 | `grep -qE "rev-parse\|revParse" src/evidence.ts && grep -qE "no_runs" test/ci.test.ts && grep -qiE "short sha\|expands" test/ci.test.ts test/evidence.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- resume 的 session 内容进入 journal（只记 session_id）
- 为了让测试过而删除或跳过任何测试

## 汇报要求

完成后写 `.collie/batches/v02-b05/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b05` 为提交信息单独提交并推送该文件。
