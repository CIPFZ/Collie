# 批次 v04-b12 汇报

## 做了什么

1. **假时钟重构（SPEC 13.19）**：将 `test/scenario-g.test.ts` 和 `test/scenario-n.test.ts` 中旧的每次调用 `now()` 就自增 `t += stepMs` 的假时钟，替换为耦合的 `fakeLivenessClock` + `setTimer` 对：
   - 指纹冻结之前：`now()` 始终返回同一个值（时间不走），防止真实 git I/O 期间监视器的 `now()` 调用把假时钟推过 `stall_secs`。
   - 指纹冻结之后：每次 `setTimer(cb, ms)` 调用将内部时钟前进 `ms` 毫秒，然后通过 `setImmediate` 触发回调。这样活性监视器在 20 次检查后（20 × 50ms = 1000ms ≥ progress_secs=1s）检测到空转。

2. **共享辅助模块**：将 `fakeLivenessClock`、`instantDelay`、`controllableFingerprint` 三个辅助函数提取到 `test/support/fake-clock.ts`，两个场景测试文件共用，消除代码重复。`controllableFingerprint` 新增 `isFrozen()` 方法供耦合时钟查询冻结状态。

3. **慢开局用例（场景 G）**：新增测试 `slow startup: 400k event-loop yields before freeze → idling, not stalled`。Fake worker 在冻结指纹前通过 `setImmediate` 让出事件循环 40 万次。由于新时钟在冻结前不走，监视器不会误判为卡死；冻结后正常检测空转。断言 journal 包含 `worker.idling` 且不包含 `worker.stalled`。

4. **不变量同步**：在 `test/invariants.test.ts` 新增检查：`scenario-g.test.ts` 和 `scenario-n.test.ts` 不得包含 `+= stepMs`。

## 测试结果

```
npm run lint        → exit 0
npm run typecheck   → exit 0
npm test            → 48 files, 938 passed, 0 failed (14.35s)

三次稳定性测试（场景 G + N）:
  Run 1: 10 passed (3.43s)
  Run 2: 10 passed (3.44s)
  Run 3: 10 passed (3.48s)
```

验收命令全部通过：
- `! grep -qE "\+= stepMs" test/scenario-g.test.ts test/scenario-n.test.ts` → exit 0
- `grep -qE "worker\.stalled" test/scenario-g.test.ts` → exit 0
- `grep -qE "stepMs" test/invariants.test.ts` → exit 0

## 偏离或疑问

无

## 下一步建议

假时钟改造完成，场景 G 的随机失败根因已消除。可继续其余队列批次。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b12",
  "head_sha": "b76f7358f92959d867104813b739e8970592ec3b",
  "claims": {
    "commits": ["b76f7358f92959d867104813b739e8970592ec3b"],
    "tests_passed": 938,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
