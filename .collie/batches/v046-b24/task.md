---
schema_version: 1
run_id: r-20261120094203
batch_id: v046-b24
base_sha: 419ee096a084aa370389ea3ec8332411cb1d8a12
created_at: 2026-11-20T09:42:03.920Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b24：小修：reviewer 读这一次运行的信封；两处守不住的测试改实

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.18 的「小修」一段。`src/run.ts` 给 reviewer 准备工作目录的地方（现在只留本批次的 `task.md`）：那份 `task.md` 换成主工作区里这一次运行的信封（`.collie/batches/<批次>/task.md`），不用 `head_sha` 的树里的。目录里仍然只有 `task.md`，别的批次的目录不动。
   **同一个批次第 1 次判 FIX，第 2 次 worker 没有新的代码提交、只重写了 report：第 2 次 reviewer 的工作目录里，`task.md` 的 frontmatter `attempt` 是 2，正文有「上一轮判 FIX」一节；目录里只有 `task.md`**
2. 测试。`test/reviewer-rerun.test.ts` 新加一组 `describe('reviewer-rerun: task.md comes from the current run', …)`（条目 1 的情形；怎样记下 reviewer 工作目录里的东西，照这个文件现有的做法）。
   `test/tester-step.test.ts` 的 `tester only deletes a tracked file → that file is restored, listed in tester.md`：它删的是 `docs/progress.md`，R2 上报时本来就会重写这个文件，所以恢复被撤掉它也通过。
   改成删 `SPEC.md`，并断言恢复之后的内容与 HEAD 上的相同。这是点名允许的改写，在「偏离或疑问」里列出。
   同一个文件新加一条 `tester wallclock uses worktree_secs`：沙箱配置里 `worktree_secs = 1`、`wallclock_secs` 不动、不注入 `testerSignal`，假测试 agent 一直等到中止信号才结束 → 以 `tester_failed` 上报，退出码 20。
   假测试 agent 的场景拿不到中止信号时，可以给 `src/runner/fake.ts` 的场景上下文加上它，在「偏离或疑问」里写明。
   `test/reviewer-rerun.test.ts` 的 `reviewer-rerun: FIX then PASS` 一组的 `beforeEach` 在慢机器上两次到了 120 秒的钩子超时（SPEC 14.31、14.32）：给这一组的 `describe` 加 `{ timeout: 300_000 }`（钩子跟着用例的时限走），新加的一组同样加上。只改时限。
   R1 查过：`test/reviewer-rerun.test.ts` 现有用例断言的是目录里只有 `task.md`、`task.md` 存在、别的批次的目录没有被动，不看 `task.md` 的内容，不受影响。已有断言除点名的那一条外都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个文件的测试通过 | `npm test -- test/reviewer-rerun.test.ts test/tester-step.test.ts` | exit 0 |
| 新的一组与新的一条在 | `grep -qF "reviewer-rerun: task.md comes from the current run" test/reviewer-rerun.test.ts && grep -qF "tester wallclock uses worktree_secs" test/tester-step.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/schema/index.ts`；改任何判定
- 让 reviewer 的工作目录里出现 `task.md` 之外的信封文件（`report.md`、`verdict.md`、`tester.md`）
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b24/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b24` 为提交信息单独提交并推送该文件。
