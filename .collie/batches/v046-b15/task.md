---
schema_version: 1
run_id: r-20261119035517
batch_id: v046-b15
base_sha: 9e4884ebb1b53f406161a290d6eb5e61086c0289
created_at: 2026-11-19T03:55:18.675Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b15：接线第一块：带情形的批次在写 task 信封之前先拉起测试 agent

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.14 的「接线第一块」六条（`prepareAcceptance` 的参数与返回值在 `src/acceptance.ts`，流程的来历在 16.12）。`src/run.ts`：照那六条做。几处写明：
   配置检查在写 heartbeat 之前，报错走配置无效时的同一条路径（退出码 1）；`RunContext` 加可选的 `redCheck`（原样交给 `prepareAcceptance`，测试用）与 `testerSignal`（给了就用它代替内部的计时，做法照 `workerSignal`）；
   测试 agent 的事件流用 `appendStream` 写进 `tester.stream.ndjson`；信封提交与上报的裁定提交都经 v046-b14 的那个辅助函数（记 `r2.commit`）；
   上报时的说明文字写「上报：验收测试没有准备好 — <原因>」，不带「无 report」。
   `src/heartbeat.ts` 的阶段加 `tester`；`src/schema/index.ts` 与 `templates/collie.toml` 加 `limits.redcheck_secs`（正整数，可选，缺省 600，写法照 `tester_max`；模板里写 `redcheck_secs = 600` 带一行注释）。本仓库的 `.collie/collie.toml` 不许动。
   **带情形的批次、红检查一次就过：运行器被调用的先后是 tester、worker、reviewer；`docs: issue` 那一个提交里同时有 `task.md`、`new.test.ts`、`MAP.md`；journal 里 `tester.started`、`tester.finished`、`redcheck.result` 都在 `batch.task_written` 之前；这次运行的结论与不带情形时一样由 worker 与 reviewer 决定**
   **不带情形的批次：运行器只被调用 worker、reviewer 两次，journal 里没有 `tester.` 与 `redcheck.` 开头的事件，没有 `tester.stream.ndjson`**
2. 没过与越界的三种结局，都不拉起 worker 与 reviewer：
   红检查两次都不过 → 退出码 20，`escalated` 的原因以 `red_check_failed` 开头，`.collie/batches/<批次>/tester.md` 在裁定提交里，`--continue` 下批次记 `blocked`、队列以 `blocked` 结束；
   测试 agent 声明了类别标错 → 只拉起 1 次，原因以 `misclassified` 开头，`tester.md` 里有它的回复与声明的清单；
   测试 agent 往主工作区写了文件 → 原因以 `tester_touched_main_tree` 开头并列出那个文件，`git log` 里没有任何提交含验收测试或那个文件，那个文件还留在工作区里。
   另：`testerSignal` 中止 → 原因以 `tester_failed` 开头；配置里没有 `[agent.tester]` → 退出码 1，标准错误点名 `[agent.tester]`，没有新提交，批次状态不变；
   **同一个批次先 FIX 再 PASS：测试 agent 只在第 1 次被拉起，整个队列里运行器被调用的先后是 tester、worker、reviewer、worker、reviewer**
3. 新文件 `test/tester-step.test.ts`，用 `Sandbox`、`FakeRunner` 与注入的 `redCheck`（沙箱里的 backlog 自己写一个带情形的批次并提交；假测试 agent 在它拿到的工作目录里写文件），三组：
   `describe('tester step: runs before the task envelope', …)`（条目 1 加粗的两种情形）；
   `describe('tester step: failures stop the batch', …)`（条目 2 的五种结局各一条）；
   `describe('tester step: skipped when the tests are already in the tree', …)`（条目 2 加粗的情形；HEAD 的树里事先就有 `new.test.ts` 时一次也不拉起）。
   允许改写的旧用例只有下面四处，每处在「偏离或疑问」里列出原断言与现断言：
   `test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `redcheck_secs: 600`）与内联配置 `VALID_TOML`（跟着模板加一行）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这个字段，类型要求）；
   `test/invariants.test.ts` 的 `src/run.ts non-comment lines do not contain acceptance.js (v046-b08)`：改成断言 `src/run.ts` 引用了 `acceptance.js`，名字相应改掉。
   R1 查过：`test/heartbeat.test.ts` 没有钉死阶段的清单；`test/cli.test.ts` 比较 `limits` 的那条两边都取自模板；现有测试的沙箱 backlog 都不带情形，所以现有的场景测试都走不到新的一步。
   钉死完整清单的用例 R1 也查过：`test/exit-codes.test.ts` 的 `records the v0.1 event sequence in order` 跑的是不带情形的批次，它的事件序列一个都不许变；本批次不加事件类型，变异清单的项数不变。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 另加「`src/run.ts` 里有 `tester.stream.ndjson`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线、配置、事件类型的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts test/heartbeat.test.ts` | exit 0 |
| 三组用例在 | `grep -qF "tester step: runs before the task envelope" test/tester-step.test.ts && grep -qF "tester step: failures stop the batch" test/tester-step.test.ts && grep -qF "tester step: skipped when the tests are already in the tree" test/tester-step.test.ts` | exit 0 |
| 队列用上了这个模块（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 模板里有新配置项，本仓库的配置没有被动 | `grep -qE "^redcheck_secs = 600" templates/collie.toml && ! grep -qE "redcheck_secs\|agent\.tester" .collie/collie.toml` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "tester.stream.ndjson" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-tester.md`、`AGENT-worker.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/backlog.ts`、`src/view.ts`、`src/follow.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 改变不带情形的批次的任何行为；在仓库里建 `test/acceptance/` 目录；替测试 agent 还原或删除它写到主工作区里的文件
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 vitest 子进程或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b15/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b15` 为提交信息单独提交并推送该文件。
