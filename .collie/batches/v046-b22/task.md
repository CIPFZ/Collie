---
schema_version: 1
run_id: r-20261120064055
batch_id: v046-b22
base_sha: ee938ff68ce0775e01c2a8312fbb17b6cf7e7738
created_at: 2026-11-20T06:40:56.962Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b22：批次在队列里最终被拦时的收尾：撤销救援提交的改动、拿掉本批次的验收测试

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.18 的「批次在队列里最终被拦时的收尾」一段（救援提交见 11.4）。`src/run.ts`：照那一段做，写成一个函数，在队列里两处调用：以 BLOCK 结束、规则 1 重跑与中断重跑都不适用（或已用过）、即将以 `blocked` 停下之前；超过 `fix_max`、即将以 `fix_max` 停下之前。
   提交经 `r2Commit`（记 `r2.commit`）。`src/schema/index.ts`：事件类型加 `batch.cleanup`、`batch.cleanup_failed`。单批次模式 `run <批次>` 不收尾。
   **队列里一个批次：第 1 次 worker 留下未提交的改动后被判空转（于是有救援提交），自动续跑的第 2 次又被判空转：队列以 `blocked` 结束，退出码 20；`git log` 最上面是 `progress: <批次> cleanup`，**
   **救援提交改过的文件恢复成开跑前的内容（`git diff <首次 base_sha> HEAD -- <那些文件>` 为空）；救援提交仍在历史里；journal 有 `batch.cleanup`，`reverted` 里是救援提交的 sha；这个提交记了 `r2.commit` 并推送了**
   **没有救援提交、树里也没有本批次验收测试的批次被拦：不多任何提交，journal 没有 `batch.cleanup`**
2. 同一个函数的另外几种情形：
   **带情形的批次超过 `fix_max`：收尾提交把 `test/acceptance/<批次>/` 从树里删掉（`removed_acceptance` 为 true）；worker 自己的代码提交一行不动**
   **撤销有冲突（救援提交之后，同一行又被 worker 后来的提交改过）：不留下半截的撤销，`git status --porcelain` 为空，记 `batch.cleanup_failed`；树里有本批次的验收测试时照样拿掉**
   **单批次模式 `run <批次>` 以 BLOCK 结束、有救援提交：不收尾，没有 `cleanup` 提交**
3. 新文件 `test/blocked-cleanup.test.ts`，用 `Sandbox` 与 `FakeRunner`，三组：
   `describe('blocked cleanup: rescue commits are reverted', …)`（条目 1 的情形；怎样让假 worker 被判空转，照 `test/scenario-n.test.ts` 的 `idle twice → exit 20 (BLOCK)`）；
   `describe('blocked cleanup: acceptance tests are removed', …)`（条目 2 第一条；带情形的沙箱批次、`[agent.tester]` 与注入的红检查照 `test/tester-step.test.ts`）；
   `describe('blocked cleanup: when it must not act', …)`（条目 2 后两条；以及队列以 `evidence_unavailable` 停下时不收尾）。
   允许改写的旧用例只有两处，在「偏离或疑问」里列出：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`（个数 42 改成 44，加两条 `toContain`）；
   `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)`（上限 6 改成 7，前提是新加的推送恰好一处）。
   R1 查过：队列以 `blocked` 或 `fix_max` 结束的现有用例在 `test/scenario-n.test.ts`（2 条）、`test/scenario-j.test.ts`、`test/scenario-m.test.ts`、`test/queue-limit.test.ts`、`test/r2-commits.test.ts`；
   其中假 worker 留下过未提交改动的，队列结束时会多出一个收尾提交和 `r2.commit`、`verdict.pushed`、`batch.cleanup` 三条事件。`test/r2-commits.test.ts` 比较提交 sha 集合的那一条，收尾提交以 `progress: ` 开头并记了 `r2.commit`，应当仍然相等。
   单批次模式的用例（`test/scenario-e.test.ts`、`test/scenario-i.test.ts`、`test/show.test.ts` 里有救援提交的那些）不应受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 另加「`src/run.ts` 里有 `batch.cleanup`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | exit 0 |
| 三组用例在 | `grep -qF "blocked cleanup: rescue commits are reverted" test/blocked-cleanup.test.ts && grep -qF "blocked cleanup: acceptance tests are removed" test/blocked-cleanup.test.ts && grep -qF "blocked cleanup: when it must not act" test/blocked-cleanup.test.ts` | exit 0 |
| 两个事件进了类型清单 | `grep -qF "batch.cleanup_failed" src/schema/index.ts && grep -qE "'batch\.cleanup'" src/schema/index.ts` | exit 0 |
| 不在主仓库里执行 git clean（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | exit 0 |
| 不变量同步 | `grep -qF "batch.cleanup" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/cli.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 撤销 worker 自己提交的代码；改写或删除历史里的提交（不许 `reset`、`rebase`、强推）；在主仓库里执行 `git clean`，或删除、移动未跟踪的文件；在单批次模式里收尾
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b22/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b22` 为提交信息单独提交并推送该文件。
