---
schema_version: 1
run_id: r-20261121062915
batch_id: v046-b28
base_sha: 1e14cb6dcb1657e66041131d2f8fd87e2befd39c
created_at: 2026-11-21T06:29:16.110Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b28：测试改实：reviewer 信封、收尾的未跟踪文件与内容冲突三处造出真正的情形

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 14.34「判 PASS 之后才查出的测试缺口」与 16.20。`test/reviewer-rerun.test.ts` 的 `describe('reviewer-rerun: task.md comes from the current run', …)`：第 2 次 worker 改成**不提交任何代码**，只重写 `.collie/batches/<批次>/report.md` 并以 `report(collie): <批次>` 提交、推送，`head_sha` 仍写第 1 次的代码提交。
   这一组现有的 4 条断言不改，都应当照常通过。
   **把 `src/run.ts` 里「reviewer 的 `task.md` 用主工作区这一次的信封」那几行撤掉：这一组的 `attempt 2 reviewer sees task.md with attempt: 2 frontmatter` 必须失败**
2. `test/blocked-cleanup.test.ts` 的 `describe('blocked cleanup: only its own paths', …)` 里两条：
   `idle workers with note.txt → cleanup only commits rescue paths; note.txt stays`：去掉把 `note.txt` 放进 `.gitignore` 的做法，改成在救援之后、收尾之前的一个场景里（最后一个 reviewer 场景）往主工作区写一个真正未跟踪的 `note.txt`；
   `content conflict → revert_conflict; no merge markers; workspace clean`：改成真正的内容冲突，沙箱基准里先有 `feature.txt`（两行），救援提交改第 1 行，之后 worker 的提交又改同一行，`fix_max = 1`。
   两条用例名与现有断言不变，可以加断言。这两处是点名允许的改写，在「偏离或疑问」里列出改了什么。
   **把 `batchCleanup` 改回提交前 `git add -A`：`note.txt` 那条必须失败；把冲突处理里 `git revert --abort` 之后补上 `git checkout -- .` 与提交：`content conflict` 那条仍要守住「没有任何提交里出现 `<<<<<<<`」**
3. 不改 `src/`；不改 `test/invariants.test.ts`。R1 查过：这三条用例之外的现有用例不受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个文件的测试通过 | `npm test -- test/reviewer-rerun.test.ts test/blocked-cleanup.test.ts` | exit 0 |
| 不再用 .gitignore 绕开未跟踪文件 | `! grep -qE "gitignore.*note\.txt\|note\.txt.*gitignore" test/blocked-cleanup.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `src/`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 用 `.gitignore`、改配置或跳过步骤的办法绕开要造的情形
- 为了让测试过而删除或跳过任何测试；删去或改松任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b28/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b28` 为提交信息单独提交并推送该文件。
