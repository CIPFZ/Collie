# 批次 v046-b22 汇报

## 做了什么

### 条目 1：batchCleanup 函数实现

在 `src/run.ts` 中实现了 `batchCleanup` 函数（SPEC 16.18），当批次在队列里最终被拦时执行收尾：

1. 检查工作区是否有被跟踪文件的未提交改动（有则记 `batch.cleanup_failed` 并退出）
2. 从 journal 收集该批次所有运行的 `worker.rescued` 事件里的 sha，筛选在 `firstBaseSha..HEAD` 范围内的
3. 从新到旧 `git revert --no-commit` 每个救援提交；若有冲突则 `revert --abort` + `reset HEAD` + `checkout .` 恢复工作区，记 `batch.cleanup_failed`
4. 检查 `test/acceptance/<batchId>/` 是否存在，存在则删除
5. 有改动则 `git add -A` 后通过 `r2Commit` 提交（`progress: <batchId> cleanup`），推送（成功记 `verdict.pushed`，失败记 `verdict.push_failed`），最后记 `batch.cleanup`

在 `runQueue` 的两处调用：
- BLOCK 结束且规则 1 重跑与中断重跑都已用过时（`queue.finished` reason=blocked 之前）
- 超过 `fix_max` 时（`queue.finished` reason=fix_max 之前）

单批次模式（`run <批次>`）不调用此函数。

### 条目 2：事件类型

在 `src/schema/index.ts` 的 `EVENT_TYPES` 数组中增加了 `batch.cleanup` 和 `batch.cleanup_failed` 两个事件类型。

### 条目 3：测试文件

新建 `test/blocked-cleanup.test.ts`，包含三组共 6 个用例：

- **`blocked cleanup: rescue commits are reverted`**（1 个用例）：idle 两次 → exit 20；`git log` 最上面是 `progress: v99-b01 cleanup`；`git diff <baseSha> HEAD -- feature.txt` 为空；journal 有 `batch.cleanup`（`reverted` 非空）；救援提交仍在历史中；r2.commit 和 verdict.pushed 都存在
- **`blocked cleanup: acceptance tests are removed`**（2 个用例）：fix_max 超限时带验收测试 → cleanup 删掉 `test/acceptance/<批次>/`（`removed_acceptance=true`）；救援提交后 worker 覆写同一文件 → revert 冲突 → `batch.cleanup_failed`（reason 含 `revert_conflict`）、`git status --porcelain` 无跟踪文件改动、验收测试仍被删除
- **`blocked cleanup: when it must not act`**（3 个用例）：单批次模式有救援提交 → 无 cleanup 提交；无救援无验收 → 无 cleanup 无 cleanup_failed；evidence_unavailable → 无 cleanup

### 允许改写的旧用例

- `test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`：长度 42→44，增加两条 `toContain`（`batch.cleanup` 和 `batch.cleanup_failed`）
- `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above`：上限 6→7（新增了一处 cleanup 推送），注释更新说明来源
- `test/invariants.test.ts` 新增 `src/run.ts has batch.cleanup (v046-b22)` 不变量

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(no errors)

$ npm test
 Test Files  70 passed (70)
      Tests  1437 passed (1437)
   Duration  24.44s

$ e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  4.60s
```

## 偏离或疑问

- `test/schema.test.ts`：事件类型个数从 42 改成 44，新增 `expect(EVENT_TYPES).toContain('batch.cleanup')` 和 `expect(EVENT_TYPES).toContain('batch.cleanup_failed')`。原断言：`toHaveLength(42)`，现断言：`toHaveLength(44)`。原因：新增了两个事件类型。
- `test/invariants.test.ts`：push 上限从 `toBeLessThanOrEqual(6)` 改成 `toBeLessThanOrEqual(7)`。原断言限制最多 6 处 `await push(`，现在新增了 batchCleanup 里的一处推送。注释也更新为 `7 push calls after v046-b22`。
- `test/invariants.test.ts`：新增不变量 `src/run.ts has batch.cleanup (v046-b22)`。
- cleanup 函数中使用了 `git revert --no-commit` + `git revert --abort` + `git reset HEAD` + `git checkout .` 来处理撤销和冲突恢复。这些 git 命令通过 `git()` helper 执行，不直接 spawn git。

## 下一步建议

- 本批次的三个条目全部完成，可以继续 v046-b23（模型接口出错的会话算可续跑的中断）和 v046-b24（小修）。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b22",
  "head_sha": "6f7f657e663cfdca74c168fa130fa7cb9cc6bce6",
  "claims": {
    "commits": ["f777664d031e983dd2aa6e7acd7257a14f390c32", "6f7f657e663cfdca74c168fa130fa7cb9cc6bce6"],
    "tests_passed": 1437,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
