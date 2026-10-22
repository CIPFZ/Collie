# 批次 v02-b04-fix 汇报

## 做了什么

本批次是 v02-b04-fix 的第 2 次尝试（FIX 修复）。上一次尝试（attempt 1）实现了全部 3 个条目的核心逻辑，但 reviewer 判定 FIX，原因是 `test/scenario-g.test.ts` 未注入假指纹（条目 3 的测试侧要求）。

本次仅修复遗漏项：在 `test/scenario-g.test.ts` 中注入假指纹，使事件、时钟、指纹三者全部由测试代码控制。

**条目 1（interrupt this 绑定）**：上一次已完成（commit `ad7ad75`），本次无需改动。验收通过。

**条目 2（R2 异常兜底与阶梯容错）**：上一次已完成（commit `857e378`），本次无需改动。验收通过。

**条目 3（产出指纹）**：上一次实现了 `computeFingerprint`、`LivenessConfig.fingerprint?` 注入口和 `computeFingerprint` 单测（commit `dbe276b`），但缺少在 scenario-g 集成测试中注入假指纹。本次新增：

1. `controllableFingerprint()` 辅助函数：返回一个每次调用自增的指纹函数（模拟 setup 阶段文件变化），和一个 `freeze()` 方法（调用后指纹不再变化，模拟 idle 阶段）。指纹通过 `setTimeout(resolve, 0)` 解析，模拟真实 `computeFingerprint` 的 git 子进程让出事件循环的行为。

2. `idleWorkerScene` 新增 `onEnterIdle` 回调：worker 完成 setup（提交代码和报告）后、进入 idle 阶段前调用，测试将其绑定到 `fp.freeze()`。

3. 两个集成测试用例均通过 `livenessFingerprint: fp.livenessFingerprint` 注入假指纹。

**关键技术取舍**：假指纹不能用 `Promise.resolve()` 或 `setImmediate` 解析：
- `Promise.resolve()`：让检查周期完全在微任务中运行，形成无限循环，饿死 worker
- `setImmediate`：每事件循环 tick 触发一次（~1us），检查周期在一次 `await git()` 期间运行数万次，假时钟快速推进到 `stall_secs`，触发误判
- `setTimeout(resolve, 0)`：~1ms 最小延迟，检查频率合理，setup 阶段假时钟不会超过 `stall_secs`，idle 阶段能正确检测

## 测试结果

```
$ npm run lint
All matched files use Prettier code style!

$ npm run typecheck
> tsc -p tsconfig.json
（exit 0，无错误）

$ npm test
 Test Files  30 passed (30)
      Tests  583 passed (583)

$ for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts || exit 1; done
5 次全部 exit 0（3 passed 每次）

$ test "$(grep -cE "livenessFingerprint" test/scenario-g.test.ts)" -ge 2
count=4, exit 0
```

全部 10 项验收命令通过。

## 偏离或疑问

无。本次修改严格限于 `test/scenario-g.test.ts`，未触碰 src/ 或任何受保护文件。

## 下一步建议

本批次 3 个条目均已完成并验收通过。建议签发 v02-b04-fix2（惰性 interrupt 抛错、原子心跳、worker_pid 等）。

````json
{
  "schema_version": 1,
  "batch_id": "v02-b04-fix",
  "head_sha": "6fe4d740796ebb306be5c5c7a84203103423ab57",
  "claims": {
    "commits": ["6fe4d740796ebb306be5c5c7a84203103423ab57"],
    "tests_passed": 583,
    "tests_failed": 0,
    "pushed": false,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
````
