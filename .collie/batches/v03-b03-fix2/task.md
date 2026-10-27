---
schema_version: 1
run_id: r-20261027-033610
batch_id: v03-b03-fix2
base_sha: b19db3599614b19d39b0e50363435c037bb9db03
created_at: 2026-10-27T03:36:11.125Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v03-b03-fix2：补两条断言、bash_deny 正反用例、tool.denied 进 journal、测试超时

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 两条缺失断言：`test/scenario-e.test.ts` 的 attempt 2 用例断言 `commits_actual`（从 verdict 输入或 progress）**不含**本批次的 task / progress / `report(collie)` 提交
   （task、progress、`report(collie)` 三个提交各一条独立的 `not.toContain`，不要用循环合成一条）；`test/scenario-f.test.ts` 的「只缺 report 不续接」用例断言 journal 里 `worker.resumed` 事件的 `session_id` 为 `null`
2. `bash_deny` 正反用例（`test/runner-claude.test.ts`，用仓库 toml 里的正则）：放行 `git merge-base --is-ancestor a b`、`git branch -v`、`git log --oneline`、`npm test`；
   拒绝 `git merge x`、`git push origin main`、`git  push`、`git branch -D x`、`git stash`、`gh api repos`
3. `tool.denied` 进 journal：runner 已通过 `onEvent` 发出该事件，R2 在 `onEvent` 回调里识别 `event === 'tool.denied'` 并 `rec.record('tool.denied', {role, tool, command, pattern})`
   （journal 自带 ts / run_id）；`collie show` 的「中断链」之后列出 `tool.denied` 条数与命令。测试：注入 fake runner 发一条 `tool.denied`，断言 journal 含它。
   顺带：`vitest.config.ts` 的 `testTimeout` 10 秒 → 30 秒（真实 git 的 cli / scenario-j 用例全量运行时 6~8 秒，随机超时），删掉 `scenario-f` 里单独的 30 秒；
   `test/invariants.test.ts` 加「`src/run.ts` 含 `tool.denied`」「`vitest.config.ts` 的 testTimeout ≥ 30000」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 全量连跑 3 次稳定 | `for i in 1 2 3; do npm test \|\| exit 1; done` | exit 0 |
| commits_actual 排除断言（现有 2 处 + 新增 3 处） | `grep -cE "not\.toContain" test/scenario-e.test.ts \| grep -qE "^([5-9]\|[1-9][0-9])$"` | exit 0 |
| session_id null 断言 | `grep -qiE "session_id.{0,40}null" test/scenario-f.test.ts` | exit 0 |
| bash_deny 正反用例 | `grep -qE "merge-base" test/runner-claude.test.ts && grep -qE "branch -D" test/runner-claude.test.ts` | exit 0 |
| tool.denied 进 journal | `grep -qE "tool\.denied" src/run.ts && grep -qE "tool\.denied" test/*.test.ts` | exit 0 |
| 测试超时 | `grep -qE "testTimeout: 30_?000" vitest.config.ts` | exit 0 |
| 不变量同步 | `grep -qE "tool\.denied\|testTimeout" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让 grep 通过而加注释或改字面：验收 grep 的是断言，不是字符串

## 汇报要求

完成后写 `.collie/batches/v03-b03-fix2/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v03-b03-fix2` 为提交信息单独提交并推送该文件。
