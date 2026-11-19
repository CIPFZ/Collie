---
schema_version: 1
run_id: r-20261119092654
batch_id: v046-b17
base_sha: 31f16e21026c25cf304a54b9406c8a0ec3fcc2e1
created_at: 2026-11-19T09:26:55.401Z
attempt: 2
interrupted_at: r-20261119083439 stalled run.finished@2026-11-19T09:26:54.604Z
issued_by: collie
rescue_sha: bbdf6730cb1f10d58abc0f36a4c39c464422cdf6
---

# 批次 v046-b17：接线收尾一：被跟踪文件不进提交、heartbeat 阶段改回、测试 agent 单独墙钟、放宽超时

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.16 的「v046-b17」一段与 14.28「b15 查出两处」。`src/run.ts`：上报原因是 `tester_touched_main_tree` 时，走上报路径之前先把主工作区恢复干净
   （在 `root` 里 `git checkout -- .` 再 `git clean -fd`，只在这一条路径上做），这样测试 agent 动过的被跟踪文件不会进 R2 的 `progress.md` / backlog 提交；被动过的文件名写进 `tester.md`（这条路径现在不写 `tester.md`，补上）。
   未跟踪的新文件照旧由「只提交点名路径」挡住。
   **假测试 agent 除了写验收测试还往主工作区被跟踪的 `docs/progress.md` 加一行：批次以 `tester_touched_main_tree` 上报、退出码 20；`git log` 里 R2 的提交都不含测试 agent 加的那一行；`tester.md` 列出了被动过的文件**
   同一处还有 heartbeat：测试 agent 这一步结束、拉起 worker 之前，`phase` 从 `tester` 改回 `worker`（worker 真正开始时本就有一处写 `worker`，现在的问题是它在测试 agent 之前；补一处即可）。
   **带情形的批次，worker 工作期间读 heartbeat，`phase` 是 `worker`，不是 `tester`**
2. `src/schema/index.ts` 与 `templates/collie.toml`：`[limits]` 加可选的 `worktree_secs`（正整数，缺省 1800，写法照 `tester_max`；模板写 `worktree_secs = 1800` 带一行注释）。
   测试 agent 这一步的墙钟（`src/run.ts` 里现在用 `wallclock_secs` 建的那个 `AbortSignal.timeout`）改用 `worktree_secs`。本仓库的 `.collie/collie.toml` 不许动。
   允许改写的旧用例只有：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `worktree_secs: 1800`）与内联 `VALID_TOML`；`test/schema.test.ts` 的夹具 `validConfig.limits`；每处在「偏离或疑问」里列出（这几处由本条点名）。
3. `test/queue-limit.test.ts`、`test/scenario-n.test.ts` 等真实跑多轮队列或真实起子进程的用例，`describe` / `it` 自带的超时从 120 秒放宽到 300 秒（只改数值，不改断言；慢机器高负载下 120 秒会到点）。
   `test/tester-step.test.ts` 新加一组 `describe('tester step: heartbeat and tracked-file safety', …)`：条目 1、2 加粗的情形；测试 agent 改未跟踪的新文件时照旧上报、文件留在工作区（和现有那条对比）。
   R1 查过现有用例：`test/view.test.ts` 的 `phase` 断言用的是不带情形的批次，不受影响；`tester step: failures stop the batch` 里 `tester writes to main workspace` 那条写的是未跟踪文件、只断言文件还在，本批次把它移进新组并补「被跟踪文件」的情形，原断言保留。
   已有断言除上面点名处外一条都不改；别的现有用例因为本批次的新行为而失败时的处理见下。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `worktree_secs`」
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线那一步的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "tester step: heartbeat and tracked-file safety" test/tester-step.test.ts` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^worktree_secs = 1800" templates/collie.toml && ! grep -qE "worktree_secs" .collie/collie.toml` | exit 0 |
| 不变量同步 | `grep -qF "worktree_secs" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/backlog.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 把 `git checkout -- .` / `git clean` 用在 `tester_touched_main_tree` 以外的任何路径上；改变不带情形的批次的任何行为
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言（条目 4 只改超时数值）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b17/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b17` 为提交信息单独提交并推送该文件。

## 上一轮中断

中断信息：`r-20261119083439 stalled run.finished@2026-11-19T09:26:54.604Z`
救援提交：`bbdf6730cb1f10d58abc0f36a4c39c464422cdf6`

请先核实 `bbdf6730cb1f10d58abc0f36a4c39c464422cdf6` 中的半成品是否完整，不要把它当作已完成。
