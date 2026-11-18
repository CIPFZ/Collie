---
schema_version: 1
run_id: r-20261118071451
batch_id: v046-b11
base_sha: 0ca669eeefde7fadd8aed06906fe5287b710cf55
created_at: 2026-11-18T07:14:51.966Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b11：R2 诊断信息：规则 9 重跑的 task 带 CI 链接；查裁定提交 CI 出异常时记事件

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.13 的「R2 的两处诊断信息」一段与 14.25 里关于后两次重跑的那一条。`src/run.ts`：上一次运行被规则 9 降级时，重跑的 task「降级原因」一节在规则与原因之后多两行，
   取自上一次运行 journal 里最后一条 `ci.resolved`：`- head_sha：<sha>` 与 `- CI 运行：<run_url>`（`run_url` 为空就不写这一行；没有 `ci.resolved` 就两行都不写）。别的规则降级时这一节不变。
   **上一次运行规则 9、`ci.resolved` 的 `conclusion` 是 `failure` 且带 `run_url`：重跑的 task 里有那个 `head_sha` 与那条链接**
2. `src/run.ts` 与 `src/schema/index.ts`：事件类型加 `ci.verdict_commit_error`。启动时查上一条裁定提交的 CI、取证之后复查，这两处捕获到异常时各记一条：
   `sha`、`when`（`startup` 或 `after_evidence`）、`error`（错误信息，限 500 字符）。别的行为不变：异常仍然不让这次运行失败，也不改它的结论与退出码。
   **启动时那次查询抛错：这次运行照常走完、结论与退出码和不抛错时相同，journal 里有 1 条 `ci.verdict_commit_error`、`when` 是 `startup`**
3. 测试。`test/queue-journal.test.ts` 加一条 `rule 9 FIX rerun task carries head_sha and CI run url`（条目 1 加粗的情形），再加一条 `run_url` 为空时没有「CI 运行」那一行；
   `test/verdict-ci-recheck.test.ts` 新加一组 `describe('verdict CI query errors are journaled', …)`：条目 2 加粗的情形；复查时抛错 → `when` 是 `after_evidence`，结论与退出码不变；两处都不抛错 → 没有这个事件。
   允许改写的旧用例只有一处：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`，个数 40 改成 41，并加一条 `toContain`；在「偏离或疑问」里写明。
   R1 查过：`test/queue-journal.test.ts` 的 `rule 9 FIX rerun task contains 降级原因 with rule and reason` 只断言含「降级原因」与「规则 9」，多两行不影响它；
   `test/verdict-ci-recheck.test.ts` 现有 8 条都没有让查询抛错，不会多出新事件。你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `ci.verdict_commit_error`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 队列日志、CI 复查、事件类型的测试通过 | `npm test -- test/queue-journal.test.ts test/verdict-ci-recheck.test.ts test/schema.test.ts` | exit 0 |
| task 带 CI 链接的用例在 | `grep -qF "rule 9 FIX rerun task carries head_sha and CI run url" test/queue-journal.test.ts` | exit 0 |
| 异常记事件的用例组在 | `grep -qF "verdict CI query errors are journaled" test/verdict-ci-recheck.test.ts` | exit 0 |
| 新事件进了类型清单与 R2（不看注释行） | `grep -qF "ci.verdict_commit_error" src/schema/index.ts && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "ci.verdict_commit_error"` | exit 0 |
| 不变量同步 | `grep -qF "ci.verdict_commit_error" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`src/follow.ts`；改动任何一条规则的判定、`fix_max` 的计数、重跑的条件
- 让 CI 查询的异常影响这次运行的结论或退出码
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局身份；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b11/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b11` 为提交信息单独提交并推送该文件。
