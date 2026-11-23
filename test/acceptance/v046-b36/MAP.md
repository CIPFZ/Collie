# MAP — v046-b36

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | new | `S1: parsing a report with one valid disputed_tests item succeeds and preserves data` |
| S2 | new | `S2: escalated event reason starts with acceptance_disputed and contains S1: x, has disputed array; progress has worker message` |
| S3 | new | `S3: runner calls are worker then reviewer, exit code 0` |
| K1 | keep | `K1: runner calls are worker then reviewer, exit 0, no escalated event` |
| K2 | keep | `K2: test is empty string → parse fails`, `K2: why is empty string → parse fails`, `K2: extra note key → parse fails` |
| K3 | keep | `K3: exit 20, runner called once as worker, no reviewer.started, no evidence.collected` |
| K4 | keep | `K4: exit 20, backlog blocked, queue.batch_started once, queue.finished reason blocked` |

## 假定的名字

- `disputed_tests`: ReportSchema 的新可选字段，数组，每项含 `test`（非空字符串）和 `why`（非空字符串），严格对象（不允许多余的键）
- `escalated` 事件的 `disputed` 字段：数组，等于汇报里的 `disputed_tests`
- `escalated` 事件的 `reason` 字段：以 `acceptance_disputed: ` 开头
- `docs/progress.md` 中的文本：包含 `worker 认为验收测试有错`

## 无法写成测试的情形

无
