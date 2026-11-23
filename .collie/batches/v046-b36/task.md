---
schema_version: 1
run_id: r-20261123091042
batch_id: v046-b36
base_sha: 64da7d1db122cdeeeab172afe712981f1ecf3747
created_at: 2026-11-23T09:27:59.818Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b36：worker 认为验收测试写错了：汇报里声明，R2 不拉审核、不计返工、上报停下（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.23 的「worker 认为验收测试写错了」一段。`src/schema/index.ts`：`ReportSchema` 加可选的 `disputed_tests`（数组，每项是只有 `test`、`why` 两个非空字符串的严格对象）。
2. `src/run.ts`：读到有效的汇报而 `disputed_tests` 非空时，照那一段上报（不拉 reviewer、不取证；`escalated` 的 `reason` 与 `disputed`；progress 的说明文字「上报：worker 认为验收测试有错 — …」；`--continue` 下记 `blocked`；裁定提交经 `r2Commit` 并按 12.1 推送；BLOCK、退出码 20）。
   做法照现有的 `escalate` 与 `testerEscalate`；能合成一个带说明文字参数的函数就合，不要再抄一份。队列的循环不用改：它走现有 BLOCK 那一支，停下之前照常收尾。
   `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)`：你新加了一处推送时上限 8 改成 9（点名允许的改写）；复用现有函数、没有新加推送就不改。在「偏离或疑问」里写明是哪一种。
3. 不许变的：没有这个字段或它是空数组时的全部行为；`escalated` 在别的上报路径上的字段；事件类型的个数（复用 `escalated`，不加新类型）。`test/support/` 不许改。
   R1 查过：`test/envelope.test.ts`、`test/worker.test.ts` 与 `test/support/sandbox.ts` 里的汇报都不带这个字段，加一个可选字段不影响它们。已有断言除上面点名的那一处外都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] `ReportSchema` 解析一份别的字段都合法、另带 `disputed_tests` 的汇报，`disputed_tests` 是只有一项的数组，那一项的 `test` 为 `test/acceptance/v99-b01/new.test.ts: S1: x`、`why` 为 `情形要的是 A，测试断言的是 B`：解析成功，结果里这一项原样在
- S2 [新] 单批次运行（`run <批次>`），假 worker 照常提交代码与汇报，汇报的 JSON 里 `disputed_tests` 有 S1 的那一项，脚本里只给了 worker 一个场景：journal 里 `escalated` 事件的 `reason` 以 `acceptance_disputed: ` 开头并含 `S1: x`，它的 `disputed` 等于汇报里那个数组；`docs/progress.md` 里有「worker 认为验收测试有错」
- S3 [新] 汇报的 JSON 里 `disputed_tests` 是空数组，假 worker 如实、验收全过、假 reviewer 判 PASS：运行器被调用的先后是 worker、reviewer，退出码 0
- K1 [保持] 汇报的 JSON 里没有 `disputed_tests` 这个键，其余同 S3：运行器被调用的先后是 worker、reviewer，退出码 0，journal 里没有 `escalated`
- K2 [保持] `ReportSchema` 解析带 `disputed_tests` 的汇报，其中那一项的 `test` 是空串，或 `why` 是空串，或多出一个 `note` 键：三种都解析失败
- K3 [保持] S2 那一次运行：退出码 20；运行器只被调用 1 次、角色是 worker；journal 里没有 `reviewer.started`，也没有 `evidence.collected`（现在这样的汇报会被当成格式不对而上报，这几样已经如此；实现之后上报的原因变了，这几样不变）
- K4 [保持] 队列运行（`run --continue`），同 S2 的假 worker：退出码 20；`docs/backlog.md` 里这个批次的状态是 `blocked`；队列 journal 里这个批次的 `queue.batch_started` 只有 1 条；`queue.finished` 的 `reason` 是 `blocked`

## 本批次接口

- `src/schema/index.ts` 已有的导出 `ReportSchema`（zod 的严格对象，用 `safeParse`）；本批次起多一个可选字段 `disputed_tests`，实现之前带这个键的汇报会被拒绝
- 汇报是 `.collie/batches/<批次>/report.md` 末尾的围栏 JSON 块；一份合法的汇报怎么写、假 worker 怎么提交它，照 `test/support/sandbox.ts` 的 `workerScene`。它不支持多出来的键：要带 `disputed_tests` 时在测试文件里自己写一个假 worker 的场景，JSON 用不带类型标注的对象拼
- 沙箱与两种运行方式照 `test/support/sandbox.ts` 导出的 `Sandbox`（`run(runner)` 是单批次，`cli(['run', '--continue'], runner)` 是队列）、`fooledReviewerScene`、`honestClaims`、`BATCH`；运行器被调用了几次、各是什么角色，读 `FakeRunner` 的 `calls`
- `escalated` 事件本批次起在这条路上多带 `disputed`（数组）；读事件用 `Sandbox` 的 `events()`，队列 journal 的读法照 `test/queue-limit.test.ts`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b36` | exit 0 |

`test/acceptance/v046-b36/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`test/support/`；改任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件、收尾
- 在这条路上拉起 reviewer 或自动重跑；让 worker 的声明改动、删除或跳过任何验收测试
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b36/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b36` 为提交信息单独提交并推送该文件。
