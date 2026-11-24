---
schema_version: 1
run_id: r-20261124080901
batch_id: v046-b43
base_sha: 920a9194beb3220c300d7f87671afb8bf22e41f1
created_at: 2026-11-24T08:19:02.796Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b43：先取证再审核：取证没过就不拉起 reviewer（需求审查第 1 批，带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.29「第 1 批（v046-b43）的做法」一段（方案在 16.24）。`src/run.ts`：读到有效的汇报、核过提交之后先取证，再假定 reviewer 判了 PASS、拿 R2 自己的证据调用现有的 `arbitrate`。
   结果不是 PASS：不拉起 reviewer，记 `reviewer.skipped`（`rule`、`reason`），其余事件、裁定、退出码、progress 与「reviewer 判了 PASS 而被仲裁改判」时相同，`verdict.downgraded` 多带 `assumed: true`；不写 `verdict.md`，不做 audit。
   结果是 PASS：拉起 reviewer，拿它真实的结论再仲裁一次，与现在相同。`src/schema/index.ts` 的事件类型加 `reviewer.skipped`。`src/arbiter.ts` 不许改。
2. 旧测试。取证没过的那些运行里 reviewer 不再被拉起，一些旧用例要跟着动。**只许做下面三类改动**，每一处都在「偏离或疑问」里列出文件、用例名、改了什么：
   (a) 一个假运行器的脚本跨了几次运行、中间排着不会再被调用的 reviewer 场景：把那些场景拿掉；
   (b) 断言这类运行里「reviewer 被调用过」或「有 `reviewer.started` / `reviewer.finished` / `reviewer.verdict` 事件」的：改成断言没有，并断言有 `reviewer.skipped`；
   (c) 钉死事件先后的：`test/exit-codes.test.ts` 的 `records the v0.1 event sequence in order` 里 `ci.resolved`、`evidence.collected` 挪到 `reviewer.started` 之前；`test/schema.test.ts` 的事件类型个数 44 改成 45。
   **别的断言一条都不许动**：这些用例里的退出码、规则号、`verdict.downgraded`、`acceptance.failed`、`claim.mismatch`、队列停下的原因，都必须原样通过。哪一条不动就过不了，停下，在「偏离或疑问」里写明。
   `test/rule9-same-head.test.ts`、`test/scenario-l.test.ts`、`test/queue-limit.test.ts` 在做完 (a) 之后必须照常通过：它们守着「没有 reviewer 的规则 9 降级照样被队列认得」与返工次数的计数。
3. `scripts/mutation.ts`：只在 `npm run test:mutation` 报 `stale` 时，把那一项的原文同步成新的代码，不删项。`test/invariants.test.ts` 加一条，用例名 `src/run.ts records reviewer.skipped (v046-b43)`。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 沙箱的全局验收命令里多一条 `sh fail.sh`（什么都不打印、以 1 退出）；假 worker 如实提交并推送；假运行器的脚本里有 worker、reviewer（判 PASS）两个场景；单批次跑一次：假运行器只被调用了 1 次，角色是 worker；journal 里有 `reviewer.skipped` 事件，它的 `rule` 是 8；journal 里没有 `reviewer.started`
- S2 [新] S1 那一次运行：`verdict.downgraded` 事件的 `assumed` 是 true
- S3 [新] 沙箱没有 `fail.sh`；假 worker 的代码提交另外改了 `SPEC.md`；脚本里有 worker、reviewer（判 PASS）两个场景；单批次跑一次：假运行器只被调用了 1 次；`reviewer.skipped` 事件的 `rule` 是 2
- S4 [新] 沙箱没有 `fail.sh`，假 worker 如实，假 reviewer 判 PASS，单批次跑一次：journal 里 `evidence.collected` 排在 `reviewer.started` 之前
- K1 [保持] S1 那一次运行：退出码 10；`verdict.downgraded` 的 `from` 是 `PASS`、`to` 是 `FIX`、`rule` 是 8；有 `cmd` 为 `sh fail.sh` 的 `acceptance.failed` 事件；`run.finished` 的 `verdict` 是 `FIX`
- K2 [保持] S3 那一次运行：退出码 20；`evidence.collected` 的 `spec_diff_lines` 大于 0；`run.finished` 的 `verdict` 是 `BLOCK`、`rule` 是 2
- K3 [保持] S4 那一次运行：退出码 0；假运行器被调用的先后是 worker、reviewer；journal 里没有 `reviewer.skipped`，也没有 `verdict.downgraded`
- K4 [保持] 沙箱没有 `fail.sh`，假 worker 如实，假 reviewer 判 FIX，单批次跑一次：退出码 10；`run.finished` 的 `rule` 是 10

## 本批次接口

- 沙箱与场景用 `test/support/sandbox.ts` 导出的 `Sandbox`（`run(runner)` 是单批次；`events()`、`eventTypes()`、`read`、`write`、`commitAll`）、`workerScene`、`fooledReviewerScene(box, 'PASS' | 'FIX')`、`honestClaims`。
  如实的假 worker：`workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) })`；让它在代码提交里另外改 `SPEC.md`：计划里加 `editSpec: true`
- 往全局验收命令里加一条的办法，照 `test/acceptance/v046-b35/new.test.ts` 里的 `addNoisyScript`（那里的脚本叫 `noisy.sh`）
- 假运行器是 `src/runner/fake.ts` 的 `FakeRunner`；它被调用了几次、各是什么角色，读它的 `calls`（每项有 `role`）。脚本里没用到的场景不算错
- 本批次起多一种事件 `reviewer.skipped`（字段 `rule`：数字，`reason`：字符串）；`verdict.downgraded` 在没有拉起 reviewer 的运行里多带 `assumed: true`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含各批次的验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b43` | exit 0 |
| R2 认得新事件（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "reviewer.skipped" && grep -qF "reviewer.skipped" src/schema/index.ts` | exit 0 |
| 不变量同步 | `grep -qF "records reviewer.skipped (v046-b43)" test/invariants.test.ts` | exit 0 |

`test/acceptance/v046-b43/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`CONSTRAINTS.md`、`ROLES.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`src/follow.ts`；改任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件、收尾、上报路径
- reviewer 被拉起之后的任何行为（它拿到什么、R2 怎么读它的结论）：那是下一批的事
- 为了让测试过而删除或跳过任何测试；改写条目 2 三类之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b43/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b43` 为提交信息单独提交并推送该文件。
