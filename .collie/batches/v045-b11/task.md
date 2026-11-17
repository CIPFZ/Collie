---
schema_version: 1
run_id: r-20261117051758
batch_id: v045-b11
base_sha: cf4e02bc517ea8b16ce79fdde87fd9dbe23a74ea
created_at: 2026-11-17T05:17:58.894Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b11：collie follow 的同步失败与汇报没提交成：补回连续失败通知、没提交成不说「看」

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 同步失败要通知（SPEC 14.15 第 1 条）：一圈里 `git fetch` 失败、或需要拉取而 `git pull --ff-only` 失败，`follow.json` 的 `syncFailures` 加 1；连续 3 圈时通知一次（键 `pull`，文本 `[Collie] git pull 连续失败`）；
   哪一圈同步成功就把 `syncFailures` 清零并去掉 `pull` 这个已通知的键。推送失败的通知不变。
   **远端不可达 5 圈：「git pull 连续失败」只有 1 条，出现在第 3 圈；恢复远端走 1 圈后 `syncFailures` 为 0；再让远端不可达 3 圈：又通知 1 条，一共 2 条；**
   **本地落后而快进被一个未跟踪的同名文件挡住 3 圈：「git pull 连续失败」1 条**
2. 汇报没提交成（SPEC 14.15 第 2 条）：提交之后 `git status --porcelain -- <汇报文件>` 不为空，就不记 `pendingReport`，按键 `commit:<队列号>` 通知一次，
   文本含「汇报没能提交」、队列号与退出码，不含「到对话里说」；基准照样记为已处理，队列不重跑。提交成功时的行为不变
3. `test/follow.test.ts`：条目 1 两处加粗的情形各一条；条目 2 一条（用一个退出码 1 的 `pre-commit` 钩子让提交失败，走 3 圈：`run --continue` 只起 1 次，通知 1 条）。**每条都要断言实际走了几圈。**
   允许改写的旧用例只有三种：注释是 `// 20. SPEC 14.9 item 2` 的那条，改回断言「git pull 连续失败」的条数；「队列期间远端多一个提交」那条，补上圈数的断言；
   因为多了一条「git pull 连续失败」而通知总条数变了的断言。每一处都在「偏离或疑问」里列出用例名、原断言、现断言。
   `test/invariants.test.ts` 加「`src/follow.ts` 含 `syncFailures`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0 |
| 专项测试不少于 33 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(3[3-9]\|[4-9][0-9])$"` | exit 0 |
| 专项测试不在系统临时目录留下固定版本目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` | exit 0 |
| 同步失败有计数，且有测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "syncFailures" && grep -qE "syncFailures" test/follow.test.ts` | exit 0 |
| 连续失败的通知补回来了，且有测试断言它（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "git pull 连续失败" && grep -vE "^\s*(//\|\*\|/\*)" test/follow.test.ts \| grep -qE "git pull 连续失败"` | exit 0 |
| 汇报没提交成有通知，且有测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "汇报没能提交" && grep -vE "^\s*(//\|\*\|/\*)" test/follow.test.ts \| grep -qE "汇报没能提交"` | exit 0 |
| 不变量同步 | `grep -qE "syncFailures" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 `npx` / `npm` 子进程或真实网络请求；自己在工作区里运行不带 `--dry-run` 的 `collie follow`
- 改动 SPEC 14.12 的推送、rebase 与「汇报上了远端才通知」的行为；改动 `src/handoff.ts`、`src/run.ts`、`src/view.ts`、`src/preflight.ts`；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b11/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b11` 为提交信息单独提交并推送该文件。
