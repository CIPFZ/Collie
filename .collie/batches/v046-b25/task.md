---
schema_version: 1
run_id: r-20261120095844
batch_id: v046-b25
base_sha: d352068ea6732a8bb56d86115d4755f9cc307b3f
created_at: 2026-11-20T09:58:45.270Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b25：收尾只提交自己改的路径：不提交未跟踪文件、冲突时只用 revert --abort

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.19（16.18 的收尾一段是背景）。`src/run.ts` 的 `batchCleanup`：只提交它自己改的路径（撤销了的救援提交改过的文件，与 `test/acceptance/<批次>/` 下被删的文件），经 `r2Commit` 传这些路径；
   去掉 `git add -A` 与提交 `.`；没有撤销任何救援提交、树里也没有本批次验收测试时，不提交、不推送、不记 `batch.cleanup`。
   **队列里一个带情形的批次以 `tester_touched_main_tree` 上报，主工作区留着测试 agent 新建的未跟踪 `rogue.txt`：没有 `cleanup` 提交，没有 `batch.cleanup` 事件；`rogue.txt` 还在工作区、不在任何提交里**
   **队列里假 worker 留下未提交的改动、两次被判空转（有救援提交），工作区里另有一个未跟踪的 `note.txt`：`cleanup` 提交只含救援提交改过的文件，`note.txt` 不在任何提交里、还在工作区**
2. 同一个函数的冲突处理：只执行 `git revert --abort`，不执行 `git reset`、`git checkout .`；放弃之后被跟踪的文件仍有改动时，记 `batch.cleanup_failed`（`reason: abort_left_changes`），什么都不提交；
   放弃干净了，记 `batch.cleanup_failed`（`reason` 以 `revert_conflict` 开头），树里有本批次验收测试时照常只提交删掉那个目录。
   **内容冲突（救援提交改了 `feature.txt` 的第 1 行，之后 worker 的提交又改了同一行）：没有任何提交里出现 `<<<<<<<`；`git status --porcelain` 里没有被跟踪文件的改动；journal 有 `batch.cleanup_failed`，`reason` 以 `revert_conflict` 开头**
3. 测试。`test/blocked-cleanup.test.ts` 新加一组 `describe('blocked cleanup: only its own paths', …)`：条目 1、2 加粗的三种情形（第一种照 `test/tester-step.test.ts` 让假测试 agent 写主工作区，第二、三种照这个文件第一组让假 worker 被判空转）。
   这个文件里现有的 6 条不改，都应当照常通过（R1 查过：它们的工作区里没有未跟踪文件，收尾提交里的路径不变）。
   `test/invariants.test.ts` 加两条：「`src/run.ts` 的非注释行里没有 `'reset'`」与「`src/run.ts` 的非注释行里 `['add', '-A']` 恰好一处（救援提交那一处）」。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时收尾的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "blocked cleanup: only its own paths" test/blocked-cleanup.test.ts` | exit 0 |
| 不再 reset（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'reset'"` | exit 0 |
| `add -A` 只剩救援那一处（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cF "['add', '-A']" \| grep -qx 1` | exit 0 |
| 不变量同步 | `grep -qF "'reset'" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `batchCleanup` 被调用的位置与条件、任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件；改动 `src/` 下 `src/run.ts` 以外的文件
- 执行 `git reset`、`git clean`、`rebase`、强推；提交未跟踪文件；改写或删除历史里的提交
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b25/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b25` 为提交信息单独提交并推送该文件。
