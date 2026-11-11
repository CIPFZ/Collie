# 批次 v04-b09 汇报

## 做了什么

逐条对应 task.md 的 3 个条目：

1. **`src/view.ts` 加 `projectWhy`**：实现了按 attempt 摊开一个批次每次运行的证据链的投影函数。按 SPEC 13.4 规定的顺序：worker 结束状态 → evidence.collected → acceptance.failed → claim.mismatch → reviewer 结论与 gaps → CI → verdict.downgraded / escalated → 中断与恢复 → tool.denied → 推送。使用 v04-b08 的 `computeAttempt` 函数推算 attempt。字段缺失时显示 `—`。放行依据：有 `queue.gate_passed` 时引用它（目前通过 string cast 兼容，因为该事件类型尚未加入 schema enum），没有时列出放行判定六项的事件事实。每个 attempt 末尾生成结论行，由规则号对应的固定中文模板加 `reason` 组成，不调用模型。还实现了 `formatWhy` 用于文本输出。

2. **`collie why <batch_id> [--attempt <n>] [--json]`**：在 `src/cli.ts` 中接线。退出码 0 有数据 / 1 批次不在 backlog / 2 批次在 backlog 但本机没有 journal。`--json` 输出 `projectWhy` 的完整结构。`--attempt` 过滤到指定 attempt。CLI 只做接线，所有逻辑在 `src/view.ts`。

3. **`test/why.test.ts`**：共 14 个测试（`it(`），分三组：
   - A. 真实 Sandbox 运行（3 个）：PASS 场景（evidence chain、结论行、gate facts）；
   - A. FIX→PASS 真实运行（2 个）：两个 attempt 的 verdict 正确、`--attempt` 过滤有效；
   - B. 手写夹具（5 个）：rule 8 FIX（acceptance.failed）、rule 2 BLOCK（protected files）、rule 1 format error（unparseable）、escalation（no report）、interrupted+resumed；
   - C. 退出码（4 个）：exit 0/1/2 三个退出码、`--json` 输出合法 JSON。
   事件字段只用 SPEC 3.6 与第 11~13 章写明的字段。
   `test/invariants.test.ts` 加了「`src/cli.ts` 含 `why` 命令」。

## 测试结果

```
npm run lint     → exit 0（zero errors）
npm run typecheck → exit 0
npm test         → 47 test files, 913 tests passed, 0 failed
npm test -- test/why.test.ts → 14 tests passed
```

验收命令验证：
- `grep -cE "^\s+it\(" test/why.test.ts` → 14（≥ 8）✓
- `grep -qE "Sandbox\.create" test/why.test.ts` → exit 0 ✓
- `npx tsx src/cli.ts why v03-b04-fix; test $? -ne 1 && ! npx tsx src/cli.ts why no-such-batch` → exit 0 ✓
- `grep -qE "why" test/invariants.test.ts` → exit 0 ✓

## 偏离或疑问

- `queue.gate_passed` 事件类型尚未加入 `src/schema/index.ts` 的 `EVENT_TYPES` enum（因为 13.14 批次尚未实现），所以在 `projectWhy` 中用 `(e.event as string) === 'queue.gate_passed'` 做兼容。当前所有 journal 都走 `gateFacts` 的回退路径。等 13.14 实现后将该事件加入 enum 即可自然支持。
- FIX→PASS 的 Sandbox 测试需要第二轮 worker 写不同内容（否则 git commit 因无差异失败）。因此新增了本地 `secondWorkerScene` 辅助函数，不修改 `sandbox.ts`。`view-real.test.ts` 中的同模式第二轮也是 BLOCK（但该测试只检查 attempt 计数，不检查 verdict），这是已有行为。

## 下一步建议

- 13.14（v04-b10）实现 `queue.gate_passed` 后，将其加入 EVENT_TYPES enum，`why` 的 gatePassedCount 路径自然启用。
- `view-real.test.ts` 的 FIX→PASS 测试也可考虑改用 distinct content，使第二轮确实产生 PASS（当前第二轮其实是 BLOCK，只是断言没覆盖到 verdict）。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b09",
  "head_sha": "ab8bdf0",
  "claims": {
    "commits": ["2299370", "ab8bdf0"],
    "tests_passed": 913,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
