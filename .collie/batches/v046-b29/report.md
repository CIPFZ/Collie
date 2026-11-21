# 批次 v046-b29 汇报

## 做了什么

1. **条目 1：`src/run.ts` 队列循环中加入 rule9_same_head 检测逻辑。**
   在 evidence_unavailable 检查之后、fix_max 计数之前，新增一段：当批次判 FIX 且降级规则是 9（RULE_EVIDENCE_MISSING）时，调用 `findRule9CiHeadShas()` 扫描本机 journal 中该批次此前所有运行的 `ci.resolved` 事件，收集被规则 9 降级过的 head_sha。若同一个 head_sha 出现 ≥ 2 次，说明 CI 对同一提交连续失败两次，不会自愈——记 `escalated`（reason: `rule9_same_head`，带 batch_id 和 head_sha），批次在 backlog 记为 `blocked`，走超过 fix_max 的那条路（提交、推送、batchCleanup），`queue.finished` 的 reason 为 `rule9_same_head`，退出码 20。head_sha 不同时照旧按 fix_max 计数重跑。

2. **条目 2：不改 schema，复用 `escalated` 事件类型。**
   `test/invariants.test.ts` 的 push 上限从 7 改成 8（新增了一处 rule9_same_head 路径上的 push 调用）。新增 `rule9_same_head` 不变量检查。

3. **条目 3：新建 `test/rule9-same-head.test.ts`。**
   describe 组 `'queue: rule 9 twice on the same head_sha escalates'`，包含三个用例：
   - same head_sha：两次 CI failure 同一 sha → exit 20，journal 有 escalated（rule9_same_head）和 queue.finished（rule9_same_head），backlog 记 blocked。
   - different head_sha：三次 CI failure 但每次 worker 有新提交（不同 sha）→ fix_max 重跑，不触发 rule9_same_head。
   - first rule 9 then PASS：第 1 次 no-push 被 rule 9 降级，第 2 次 push 且 CI 成功 → 正常通过，exit 0。

   CI 结论用注入的假 `FetchLike` 实现（参照 scenario-l 和 verdict-ci-recheck 的做法）。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(exit 0, no errors)

$ npm test
 Test Files  72 passed (72)
      Tests  1474 passed (1474)
   Duration  25.73s

$ e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  3.29s
```

## 偏离或疑问

- `test/invariants.test.ts` 的 push 上限从 7 改为 8（原值 7，新值 8），理由：条目 1 在 rule9_same_head 路径新增了一处 `push(root, ...)` 调用（提交 blocked backlog 和 rescue commit 后推送），符合条目 2 的许可「上限 7 改成 8，前提是新加的推送恰好一处」。

## 下一步建议

- 本批次完成，三个条目全部实现并通过验收。无需后续改动。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b29",
  "head_sha": "a11f950de89876bb60be1873db49a701a6394f7a",
  "claims": {
    "commits": ["25e142f368a1c9de66a2b25bc0dce7be9c463169", "a11f950de89876bb60be1873db49a701a6394f7a"],
    "tests_passed": 1474,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
