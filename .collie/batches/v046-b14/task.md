---
schema_version: 1
run_id: r-20261118133242
batch_id: v046-b14
base_sha: fc004bd856dd1b2e6341595aeda1b5baacb3d276
created_at: 2026-11-18T13:32:43.278Z
attempt: 2
interrupted_at: null
issued_by: collie
---

# 批次 v046-b14：R2 凭提交号认自己的提交：规则 2 不再按提交说明的开头跳过

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.14 的「R2 凭提交号认自己的提交」一段。**先写测试，再改代码**：新文件 `test/r2-commits.test.ts`，第一组 `describe('rule 2 counts every commit that R2 did not make', …)`，用 `Sandbox` 与 `FakeRunner` 跑真实的 `run`：
   假 worker 的一个提交改了 `SPEC.md`，提交说明分别以四种开头之一起头（各一条）→ 结论是 BLOCK、规则 2；
   假 worker 用 `docs: issue v99-b01 task envelope` 这个说明提交了 `test/acceptance/v99-b01/new.test.ts` → BLOCK、规则 2。
   **这一组在现有代码上应该失败（结论不是规则 2）。它要是通过了，说明 R1 的推断不成立：停下，不要改 `src/`，在「偏离或疑问」里写明你看到的**
2. `src/run.ts`、`src/evidence.ts`、`src/schema/index.ts`：事件类型加 `r2.commit`（`sha`、`subject`）。R2 自己的每一次提交都经同一个辅助函数做「提交并记一条 `r2.commit`」；
   `src/run.ts` 里现在直接调 `commit(` 的 8 处都改用它，之后整个文件里直接调 `commit(root` 的只剩辅助函数里的一处。救援提交（`wip(collie):`）不经过它、不记这个事件。
   取证：受保护路径的改动行数对 `base_sha..head_sha` 里的每个提交都数，只跳过 `r2Shas` 里的提交；`r2Shas` 由 `src/run.ts` 从本机全部 journal 里收集：
   `r2.commit` 的 `sha`、`batch.task_written` 的 `commit`、`verdict.pushed` 与 `verdict.push_failed` 的 `sha`。提交说明以什么开头不再影响这个数。`commits_actual` 的列法不变。
   **同一个批次先 FIX 再 PASS：范围里有 R2 自己的裁定提交（它改了 `docs/progress.md`，是受保护路径），第 2 次的 `spec_diff_lines` 仍是 0、结论 PASS**
3. 同一个测试文件第二组 `describe('R2 own commits stay out of the count', …)`：条目 2 加粗的情形；规则 1 自动重跑、中断后自动重跑这两条路径各一条（重跑的那一次不被规则 2 拦）；
   一次运行结束后，`git log` 里 R2 的提交个数等于 journal 里 `r2.commit` 的条数；两次运行之间把 `.collie/runs/` 删掉 → 第 2 次被规则 2 拦下（记下这是已知的保守行为）。
   允许改写的旧用例只有一处：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`，个数 41 改成 42，并加一条 `toContain`；在「偏离或疑问」里写明。
   R1 查过：`test/evidence.test.ts` 没有用例手工造带这四种开头的提交再期望它被跳过；`test/invariants.test.ts` 的 `src/evidence.ts contains report(collie) in R2 commit prefixes (v03-b03-fix)` 仍然成立（开头的清单留着给 `commits_actual` 用）；
   FIX 重跑、规则 1 重跑、中断重跑的现有场景测试用的都是真实的 journal，应当照常通过。你发现有别的现有用例因此失败，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/run.ts` 的非注释行里直接调 `commit(root` 的恰好一处」与「`src/schema/index.ts` 里有 `r2.commit`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 新测试与取证、事件类型的测试通过 | `npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts` | exit 0 |
| 两组用例在 | `grep -qF "rule 2 counts every commit that R2 did not make" test/r2-commits.test.ts && grep -qF "R2 own commits stay out of the count" test/r2-commits.test.ts` | exit 0 |
| R2 的提交都走同一处（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cE "\bcommit\(root" \| grep -qx 1` | exit 0 |
| 新事件进了类型清单 | `grep -qF "r2.commit" src/schema/index.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "r2.commit" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`scripts/mutation.ts`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/acceptance.ts`、`src/ladder.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`src/follow.ts`；改动受保护路径的清单、任何一条规则的判定、`commits_actual` 的列法
- 把救援提交记成 R2 的提交；让提交说明的开头继续影响受保护路径的计数
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b14/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b14` 为提交信息单独提交并推送该文件。

## 上一轮判 FIX

### Gaps

- test/exit-codes.test.ts:134 'records the v0.1 event sequence in order' fails: the new r2.commit events (task commit + verdict commit) change the event sequence from 12 to 14 entries. Worker must flag this in '偏离或疑问' per task instructions ('你发现有别的现有用例因此失败，停下'), then request R1 guidance on whether to update this test (since only test/schema.test.ts was explicitly allowed to be changed). npm test must pass for the batch to be accepted.

### 未通过的验收命令

- `npm test` → exit 1

### 上一轮代码提交

- `ee156545c47f1a095ecfd5b7f8f53efee7e786b8`

这些提交已在审核范围内，只补缺口，不要重做。
