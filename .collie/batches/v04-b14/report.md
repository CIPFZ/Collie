# 批次 v04-b14 汇报

## 做了什么

### 条目 1：补查逻辑（SPEC 13.18）
在 `src/run.ts` 的 `runBatch` 函数中，启动 CI 检查区域新增逻辑：当 `queryCi` 返回 `pending`（CI 还在跑）或 `no_runs`（还没触发 CI）时，将该 sha 保存到 `verdictCiRecheckSha` 变量。在 `withHeadWorktree` 返回（即取证结束）后、仲裁器运行前，如果 `verdictCiRecheckSha` 不为 undefined，对同一个 sha 再查一次 CI：
- 有结论（completed）→ 记 `ci.verdict_commit` 事件（failure/cancelled 额外打印 stderr 警告）
- 仍无结论 → 不记事件
- 查询失败 → 不影响运行

走上报路径（`escalate()`）的运行不会到达补查代码，因为上报在 `withHeadWorktree` 之前就返回了。同一个 sha 一次运行至多记一次：如果启动时已经记了（state=completed），就不设 `verdictCiRecheckSha`，不会补查。

### 条目 2：事件字段 `when`
所有 `ci.verdict_commit` 事件记录都增加了 `when` 字段：
- 启动时查到的：`when: 'startup'`
- 补查查到的：`when: 'after_evidence'`

### 条目 3：测试
新建 `test/verdict-ci-recheck.test.ts`，8 个用例：
1. 启动 pending → 补查 success → 一条 `when: after_evidence` 事件
2. 启动 pending → 补查 failure → 事件 + 输出含 `previous verdict commit`
3. 启动 pending → 补查仍 pending → 不记事件
4. 启动 completed → 只有一条 `when: startup`，不补查
5. 上报路径（无 report）→ 不补查
6. 启动 no_runs → 补查 success → 一条 `when: after_evidence` 事件
7. 启动 no_runs → 补查仍 no_runs → 不记事件
8. 补查 failure 不改变运行结论和退出码

`test/invariants.test.ts` 新增一条：`src/run.ts` 含 `after_evidence`。

## 测试结果

```
npm run lint   → exit 0
npm run typecheck → exit 0
npm test       → 50 test files, 955 tests passed, 0 failed
npm test -- test/verdict-ci-recheck.test.ts → 8 tests passed
```

grep 验收全部 exit 0（逐条在本地验证通过）。

## 偏离或疑问

无。

## 下一步建议

本批次的三个条目全部完成。可继续队列后续批次。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b14",
  "head_sha": "0a0ef2a233956f5a53d239513fe7477c07187fc1",
  "claims": {
    "commits": ["0a0ef2a233956f5a53d239513fe7477c07187fc1"],
    "tests_passed": 955,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
