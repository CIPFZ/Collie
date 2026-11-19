---
schema_version: 1
run_id: r-20261119033533
batch_id: v046-b16
base_sha: 9eb149295782fa3fd4cb604ccc4aab751e233d51
created_at: 2026-11-19T03:35:34.107Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b16：prepareAcceptance 里运行器抛错的两种情形；两条空过的测试改实（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.15 的「`prepareAcceptance` 里运行器抛错的两种情形」一段。`src/acceptance.ts`：照那四条做。顺手去掉没用的变量 `lastMisclassified`（没有声明类别标错时，失败返回值的 `misclassified` 仍是空数组）。
   **假测试 agent 在第 1 次运行中途让 `signal` 中止，`testerMax` 是 2：`prepareAcceptance` 不抛错，返回 `ok` 为 false、`attempts` 为 1、`reason` 为 `tester_failed`；运行器只被调用 1 次；**
   **`record` 收到 `tester.started` 与 `tester.finished` 各 1 条，后者带 `error`；私有临时目录里没有留下 `collie-accept-*`**
   **第 1 次运行器抛出普通错误（`signal` 没有中止）、第 2 次正常且红检查通过：返回 `ok` 为 true、`attempts` 为 2，第 2 次的提示词里有第 1 次的错误信息**
2. `test/prepare-acceptance.test.ts` 新加一组 `describe('prepareAcceptance: abort and runner errors', …)`：条目 1 加粗的两种情形；两次都抛普通错误 → `tester_failed`、`attempts` 为 2、`problems` 里有错误信息；
   `onTesterEvent` 在第 2 次拉起时第一个参数是 2（现在只测了第 1 次）。
   R1 查过现有用例：这个文件里没有一条让运行器抛错（假测试 agent 的场景都给的是返回值）；`signal aborted before next attempt → tester_failed, no second invocation` 用的是一开始就中止的信号，一次都不拉起，行为不变；
   `injected redCheck throws → …` 与 `addWorktree fails (bad headSha) → …` 两条仍然应当抛错；`record receives events in the right order for two attempts` 的两次都正常结束，事件序列不变。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里没有 `lastMisclassified`」
3. `test/r2-commits.test.ts` 的两条用例改实。这两条点名允许改写，在「偏离或疑问」里列出原断言与现断言：
   `interrupt auto-retry: second run is not blocked by R2 retry commit`：现在 worker 是崩溃、没有走到中断重跑，断言包在 `if` 里，空过。改成真的走到中断重跑
   （做法照 `test/scenario-n.test.ts` 的 `idle once → interrupt retry → PASS → queue continues (exit 0)`），去掉 `if`，断言：队列 journal 里有 `why` 为 `interrupt_retry` 的 `queue.batch_started`；重跑那一次的 `spec_diff_lines` 是 0、结论 PASS；退出码 0。
   `R2 commit count in git log equals r2.commit count in journal`：现在只断言大于 0。改成真的比较：`git log` 里提交说明以 `docs: issue ` 或 `progress: ` 开头的提交的 sha 集合，等于 journal 里 `r2.commit` 的 sha 集合。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时两个文件的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts test/r2-commits.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "prepareAcceptance: abort and runner errors" test/prepare-acceptance.test.ts` | exit 0 |
| 没用的变量去掉了 | `! grep -qF "lastMisclassified" src/acceptance.ts` | exit 0 |
| 中断重跑那条不再空过 | `grep -qF "interrupt_retry" test/r2-commits.test.ts && ! grep -qE "if \(passEvents\.length > 0\)" test/r2-commits.test.ts` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "lastMisclassified" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/roles/`、`src/runner/`、`src/schema/index.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 让红检查抛出的错误被吞掉；让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送
- 为了让测试过而删除或跳过任何测试；条目 3 点名的两条之外，删去或改松任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b16/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b16` 为提交信息单独提交并推送该文件。
