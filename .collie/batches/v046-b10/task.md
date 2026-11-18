---
schema_version: 1
run_id: r-20261118070005
batch_id: v046-b10
base_sha: 8ca27ad0914cff89586aa096e5698b8c47098074
created_at: 2026-11-18T07:00:05.939Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b10：prepareAcceptance 收尾：带回测试 agent 的回复、类别标错不再重拉（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.13 的「`prepareAcceptance` 的收尾」一段（流程在 16.12）。`src/acceptance.ts`：成功与失败两种返回值都加 `reports`（字符串数组，每次拉起的测试 agent 的最终回复原文，没有就是空串，按先后）；
   失败的返回值加 `reason`：`'red_check'`（红检查没过或缺文件）、`'tester_failed'`（最后一次是测试 agent 非零退出）、`'misclassified'`。
   红检查没过，而这一次测试 agent 最终回复的最后一个 JSON 围栏块里 `misclassified` 是非空数组时：不再拉起下一次，直接返回，`reason` 是 `'misclassified'`，`problems` 是这一次红检查的原因。
   最终回复里没有 JSON 块、解析不了、没有这个字段或是空数组，都按没有声明处理，照常重拉。红检查过了的，不看这个字段。
   **`testerMax` 是 2，第 1 次红检查没过且回复的 JSON 里 `misclassified` 列了一条：测试 agent 只被拉起 1 次，返回 `ok` 为 false、`attempts` 为 1、`reason` 为 `misclassified`，`reports` 有 1 条且就是那份回复；**
   **同样的红检查结果，但回复里没有 JSON 块：照常拉起第 2 次**
2. 同一文件：交给测试 agent 的要读的文件是 `SPEC.md` 与 `CONSTRAINTS.md` 两份；建工作目录的那一步失败时，已经建出来的目录与 git 里登记的 worktree 也要清理掉，错误照常抛出；
   测试 agent 以非零退出时，下一次拉起的「上一次没过的原因」里有一条写明上一次的退出码。
3. `test/prepare-acceptance.test.ts` 新加一组 `describe('prepareAcceptance: reports and early stop', …)`：条目 1 加粗的两种情形；`reports` 在成功时也有、条数等于拉起次数；
   三种 `reason` 各一条；JSON 里 `misclassified` 是空数组 → 照常重拉；非零退出之后第 2 次的提示词里有退出码；交给测试 agent 的提示词里两份文件都在；
   建工作目录失败（给一个不存在的 `headSha`）→ 抛错，`git worktree list` 只有 1 行，私有临时目录里没有 `collie-accept-*`。
   R1 查过现有用例：这个文件里的假测试 agent 返回的是 `{ exitCode: 0 }`，没有最终回复，所以现有的重拉用例（`first red check fails, second passes…`、`testerMax=2, both fail…`、`record receives events…`）不会被提前结束影响；
   现有用例对返回值都是逐个字段断言，多出两个字段不影响它们。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `misclassified`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时模块的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "prepareAcceptance: reports and early stop" test/prepare-acceptance.test.ts` | exit 0 |
| 两份要读的文件都给了（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "CONSTRAINTS.md"` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "misclassified" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/backlog.ts`、`src/schema/index.ts`、`src/evidence.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 按红检查的原因文字去猜类别标错（只看测试 agent 自己在 JSON 里的声明）；让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局身份；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b10/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b10` 为提交信息单独提交并推送该文件。
