# MAP — v046-b48

| 情形 | 类别 | 用例 | 文件 |
|------|------|------|------|
| S1 | 新 | `S1: parse succeeds and test_gaps is preserved verbatim` | new.test.ts |
| S2 | 新 | `S2: pass is false and reasons is exactly ["test_gaps"]` | new.test.ts |
| S3 | 新 | `S3: exit code is 30`, `S3: backlog status becomes passed`, `S3: queue.paused event has reasons containing test_gaps` | new.test.ts |
| S4 | 新 | `S4: reviewer.verdict event has test_gaps array with one item` | new.test.ts |
| K1 | 保持 | `K1: parse succeeds for a valid verdict with no test_gaps field` | keep.test.ts |
| K2 | 保持 | `K2: pass is true and reasons is empty` | keep.test.ts |
| K3 | 保持 | `K3: exit code is 0`, `K3: no queue.paused event in journal`, `K3: reviewer.verdict event has no test_gaps key` | keep.test.ts |
| K4 | 保持 | `K4: exit code is 30`, `K4: queue.paused reasons contain gaps but not test_gaps` | keep.test.ts |

## 假定

- `VerdictSchema` 目前是 `z.strictObject`，不接受 `test_gaps` 键。S1 要求它接受，所以 S1 在实现前会失败（safeParse 返回 `success: false`）。
- `GateInput` 目前没有 `testGapsCount` 字段。S2 通过 `as unknown` 绕过类型，直接传进去；在实现之前 `gateDecision` 不会检查这个字段，所以 S2 的断言（pass 为 false、reasons 含 test_gaps）会失败。
- S3、S4 依赖 S1（VerdictSchema 解析 test_gaps）和 S2（gateDecision 检查 testGapsCount）的实现；在实现之前，reviewer 返回带 test_gaps 的结论会被 VerdictSchema 拒绝（strict object），导致 reviewer.verdict 事件是 error 形式，不会出现 queue.paused 事件含 test_gaps 的情况。

## 无法写成测试的情形

无
