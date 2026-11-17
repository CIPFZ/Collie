# 批次 v045-b11 汇报

## 做了什么

本批次第 4 次运行。前 3 轮的代码提交已完成所有三个条目的实现。
第 3 轮被 BLOCK 的原因是 reviewer 基础设施问题（"verdict unparseable: reviewer returned no final text"），与代码无关。
本轮确认所有代码和测试无需变更，所有验收标准通过。

三个条目的实现概述：

1. **同步失败通知**（条目 1，SPEC 14.15 第 1 条）：`src/follow.ts` 中 `FollowJson` 新增 `syncFailures` 字段追踪连续同步失败次数。`git fetch` 失败或需要拉取而 `git pull --ff-only` 失败时 +1，连续达 3 次时以键 `pull` 通知一次（文本 `[Collie] git pull 连续失败`）。同步成功时清零并移除 `pull` 键（之后再坏还会再通知）。run action 保存状态时保留 `syncFailures` 字段。

2. **汇报没提交成的通知**（条目 2，SPEC 14.15 第 2 条）：提交后检查 `git status --porcelain -- <汇报文件>`，不为空时不记 `pendingReport`，以键 `commit:<队列号>` 通知一次，文本含「汇报没能提交」、队列号与退出码，不含「到对话里说」。基准照样记为已处理，队列不重跑。

3. **测试**（条目 3）：
   - 测试 31：远端不可达 5 圈 → 1 条通知（第 3 圈）；恢复 1 圈 → syncFailures=0；再断 3 圈 → 第 2 条通知，共 2 条。断言 sleepCount
   - 测试 32：本地落后但 pull 被未跟踪文件挡住 3 圈 → 1 条「git pull 连续失败」。断言 sleepCount
   - 测试 33：pre-commit 钩子让提交失败，走 3 圈 → run --continue 只起 1 次，通知 1 条含「汇报没能提交」。断言 sleepCount
   - `test/invariants.test.ts` 加「`src/follow.ts` 含 `syncFailures`」

## 测试结果

```
$ npm run lint       → exit 0
$ npm run typecheck  → exit 0

$ npm test
 Test Files  58 passed (58)
      Tests  1144 passed (1144)

$ npm test -- test/follow.test.ts
 Test Files  1 passed (1)
      Tests  33 passed (33)
```

全部 9 条验收命令逐项通过。

## 偏离或疑问

改写的旧用例（均在条目 3 允许范围内）：

1. **测试 20**（`broken remote 4 cycles → 1 "git pull 连续失败" notification at cycle 3, no queue-end`）：
   - 原断言：无 git pull 连续失败相关断言（v045-b08 改掉了该断言）
   - 现断言：`pullNotifs.length === 1`（恢复断言通知条数）

2. **测试 22**（`remote extra commit during queue → rebase, remote has both commits, no diverged notification, 4 cycles`）：
   - 原断言：无圈数断言
   - 现断言：`expect(sleepCount).toBe(CYCLES)`（补上圈数断言）

无其他偏离。

## 下一步建议

v045-b11 的三个条目已全部实现并通过验收。可以继续推进后续批次。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b11",
  "head_sha": "658a0700f2abc4ee34d4527c3dbb943453cbc1d8",
  "claims": {
    "commits": [
      "47dac0748998c4804c87f555a36e5dd561fa08ee",
      "613b95cb7684f5e1ddaf4362813b7cc8f7b32367",
      "658a0700f2abc4ee34d4527c3dbb943453cbc1d8"
    ],
    "tests_passed": 1144,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
