# v046-b44 情形 → 用例对照表

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | 新 | `S1: returns 0 and remote main has a commit starting with ops: report queue` |
| S2 | 新 | `S2: notification function received exactly 1 text containing 结束` |
| S3 | 新 | `S3: output has at least 2 lines starting with follow: action=wait` |
| K1 | 保持 | `K1: returns 0, spawn never called, output has follow: timeout reached` |
| K2 | 保持 | `K2: returns 0, exactly one output line starting with action: run, no remote commits, no follow.json` |

## 假定的名字

- S1 & S2 的假队列 run id：`q-20261124120000`（与第一条用例的命名约定一致）
- S3/K1 的 `follow.json` 结构：`{ handledBase: string, notified: string[] }`（与 `FollowJson` 类型一致）
- 新行为 `follow: action=wait` 是 `out()` 输出的一行文本，以此前缀开头

## 写不成测试的情形

无
