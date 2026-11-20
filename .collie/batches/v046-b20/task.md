---
schema_version: 1
run_id: r-20261120033243
batch_id: v046-b20
base_sha: 33775301fa37b4ebd3de8f106f6b291cccc091c9
created_at: 2026-11-20T03:32:44.616Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b20：v046-b17 改签：测试 agent 动过的被跟踪文件恢复原样、heartbeat 与墙钟补测试、放宽超时，把主分支修绿

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 先读 SPEC 16.17 与 14.30 里讲主分支 CI 的那一段，再 `git show bbdf673` 看主分支上已有的半成品。`src/run.ts` 的 `tester_touched_main_tree` 路径：去掉 `git checkout -- .` 与 `git clean -fd`，换成 16.17 的做法：
   测试 agent 动过的被跟踪文件（改了内容的、删掉的）恢复成 HEAD 的样子；未跟踪的文件一个都不动；不执行 `git clean`；`tester.md` 分两节列出「恢复了的被跟踪文件」与「留在工作区的未跟踪文件」（哪一节没有就写「无」）。
   **假测试 agent 往主工作区被跟踪的 `docs/progress.md` 加一行，又新建一个未跟踪的 `rogue.txt`：以 `tester_touched_main_tree` 上报、退出码 20；`git log -p` 里没有任何提交含它加的那一行；`rogue.txt` 还在工作区、不在任何提交里；`tester.md` 两节各列出对应的那个文件**
   **现有用例 `tester writes to main workspace → escalated with tester_touched_main_tree` 一个字都不改，重新通过**
2. 半成品里另外三处是对的，留着，核对一遍并补上测试：`limits.worktree_secs`（`src/schema/index.ts`、`templates/collie.toml`；`test/config.test.ts` 的期望对象与内联配置、`test/schema.test.ts` 的夹具已经在半成品里加了这一项，
   这几处是点名允许的改写，照常在「偏离或疑问」里列出）；测试 agent 这一步的墙钟用 `worktree_secs`；测试 agent 这一步结束之后 heartbeat 的 `phase` 改回 `worker`。本仓库的 `.collie/collie.toml` 不许动。
   **带情形的批次：假 worker 在它的场景里读 `.collie/heartbeat.json`，`phase` 是 `worker`；`worktree_secs = 0` 的配置被拒绝，报错点名 `limits.worktree_secs`；不写这一项的配置能加载，值是 1800**
3. 测试。`test/tester-step.test.ts` 新加一组 `describe('tester step: heartbeat and tracked-file safety', …)`：条目 1、2 加粗的情形（配置的两条放 `test/config.test.ts` 新加的一组 `describe('config: worktree_secs', …)` 里）；
   再加一条：测试 agent 只删掉了一个被跟踪的文件 → 那个文件被恢复，`tester.md` 列在「恢复了的被跟踪文件」里。
   `test/queue-limit.test.ts` 第 188 行与 `test/follow.test.ts` 第 121 行两处 `describe` 自带的超时 `120_000` 改成 `300_000`（只改这两个数值）。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `worktree_secs`」与「`src/run.ts` 的非注释行里没有 `'clean'`（不在主仓库里执行 `git clean`）」。
   R1 查过现有用例：`test/view.test.ts` 里断言 `phase` 的用例用的是不带情形的批次，不受影响；`test/tester-step.test.ts` 现有 9 条里只有上面点名的那一条现在是红的，别的不受影响；
   `src/run.ts` 的非注释行里现在只有半成品那一处用到 `'clean'`。已有断言除条目 2 点名处外一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线那一步与配置的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "tester step: heartbeat and tracked-file safety" test/tester-step.test.ts && grep -qF "config: worktree_secs" test/config.test.ts` | exit 0 |
| 不在主仓库里执行 git clean（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^worktree_secs = 1800" templates/collie.toml && ! grep -qE "worktree_secs" .collie/collie.toml` | exit 0 |
| 不变量同步 | `grep -qF "worktree_secs" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/backlog.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 在主仓库里执行 `git clean`，或用任何别的办法删除、移动测试 agent 留下的未跟踪文件；改变不带情形的批次的任何行为
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言（条目 3 的超时只改那两个数值）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b20/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b20` 为提交信息单独提交并推送该文件。
