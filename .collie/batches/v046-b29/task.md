---
schema_version: 1
run_id: r-20261121065526
batch_id: v046-b29
base_sha: f6936747f29e816040cfe678e58fa9775d048fc9
created_at: 2026-11-21T06:55:27.570Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b29：同一个 head_sha 第二次被规则 9 降级就上报，不再自动重跑（D10）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.20 的「v046-b29」一段（规则 9 见 12.3，超过 `fix_max` 的那条路与收尾见 16.18）。`src/run.ts` 的队列循环：批次判 FIX、降级规则是 9，而本批次此前（本机 journal 里）已有一次规则 9 降级、两次 `ci.resolved` 的 `head_sha` 相同：
   不再 `fix_retry`；记 `escalated`（`reason: rule9_same_head`、`batch_id`、`head_sha`），批次记 `blocked`，照超过 `fix_max` 那条路提交、推送、收尾，`queue.finished` 的 `reason` 是 `rule9_same_head`，退出码 20。
   `head_sha` 不同时照旧按 `fix_max` 计数重跑。以 `evidence_unavailable` 停下的判断仍在它之前。
   **队列里一个批次：第 1 次 CI 失败被规则 9 降成 FIX，自动重跑的第 2 次 worker 没有新提交、CI 仍失败：只重跑了一次，第 2 次之后队列以 `rule9_same_head` 停下，退出码 20，backlog 记 `blocked`，journal 有 `escalated`（`reason: rule9_same_head`，带 `head_sha`）**
   **同样两次规则 9，但第 2 次 worker 有新的代码提交（`head_sha` 不同）：照常第 3 次重跑（`fix_max` 是 2）**
2. `src/schema/index.ts` 不加新事件类型（复用 `escalated`）。允许改写的旧用例：`test/invariants.test.ts` 的 `every await push( …` 上限 7 改成 8，前提是新加的推送恰好一处（复用现有那条路就不用改）；在「偏离或疑问」里列出。
3. 新文件 `test/rule9-same-head.test.ts`，一组 `describe('queue: rule 9 twice on the same head_sha escalates', …)`：条目 1 的两种情形，再加一条：第 1 次规则 9 之后第 2 次 PASS → 照常放行、队列继续。
   CI 结论用注入的假 `fetch` 给（做法照 `test/scenario-l.test.ts` 的 `scenario L group c` 与 `test/verdict-ci-recheck.test.ts`）。
   R1 查过：`test/scenario-l.test.ts` 的 group c 是两个不同批次各一次规则 9（`rule9_twice`），不受影响；`test/queue-limit.test.ts`、`test/scenario-j.test.ts` 超过 `fix_max` 的用例里没有规则 9 降级，不受影响。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `rule9_same_head`」。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "queue: rule 9 twice on the same head_sha escalates" test/rule9-same-head.test.ts` | exit 0 |
| 队列认得这条原因（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "rule9_same_head"` | exit 0 |
| 不变量同步 | `grep -qF "rule9_same_head" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/roles/`、`src/runner/`、`src/schema/index.ts`；改动任何一条仲裁规则的判定、`rule9_twice` 的判断
- 在单批次模式里加这条判断；`head_sha` 不同时也停下
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b29/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b29` 为提交信息单独提交并推送该文件。
