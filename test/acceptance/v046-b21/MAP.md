# MAP — v046-b21 情形 ↔ 用例对照表

| 情形 | 类别 | 用例 | 文件 |
|---|---|---|---|
| S1 | 新 | `S1: attempt object has no "tester" key when journal lacks tester events` | new.test.ts |
| S1 | 新 | `S1: cost object has no "tester" key when journal lacks tester events` | new.test.ts |
| S1 | 新 | `S1: JSON.stringify of projectWhy result contains no "tester:" substring` | new.test.ts |
| S2 | 新 | `S2: batchRows entries have no "testerCost" key when journal lacks tester events` | new.test.ts |
| S2 | 新 | `S2: JSON.stringify of projectReport result contains no "testerCost:" substring` | new.test.ts |
| K1 | 保持 | `K1: attempt.tester has turns 21, costUsd 0.29, durationMs 123000, invocations 1` | keep.test.ts |
| K1 | 保持 | `K1: cost.tester is 0.29` | keep.test.ts |
| K1 | 保持 | `K1: formatWhy text has a line starting with "tester:"` | keep.test.ts |
| K2 | 保持 | `K2: projectReport batchRow testerCost is 0.29` | keep.test.ts |
| K2 | 保持 | `K2: formatReport text contains "tester 花费" column` | keep.test.ts |
| K3 | 保持 | `K3: formatWhy text has no line starting with "tester:"` | keep.test.ts |
| K3 | 保持 | `K3: formatReport text has no "tester 花费" when no tester events` | keep.test.ts |

## 假定

- 所有测试直接使用 `src/view.ts` 已有的导出函数（`projectWhy`、`projectReport`、`formatWhy`、`formatReport`），签名不变。
- `Event` 类型来自 `src/schema/index.ts`。
- 手工构建的事件数据足以覆盖情形，不需要通过真实的 `loadRuns` 加载 journal 文件。

## 写不成测试的情形

无
