# MAP — v046-b45

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | new | `S1: formatWhy has a line "reviewer: skipped (rule 8)" and no line "reviewer: —"` |
| S2 | new | `S2: verdict.downgraded line contains "PASS (assumed) → FIX"` |
| S3 | new | `S3: first run exits 10; second run task.md has {"passed":47,"failed":0} and "failed":3` |
| K1 | keep | `K1: formatWhy has reviewer: PASS line, no skipped, no (assumed); JSON has no reviewerSkipped nor assumed` |
| K2 | keep | `K2: output has line exactly "- head_sha：claimed \`abc1234\`，actual \`unresolvable\`"` |
| K3 | keep | `K3: first run exits 10, journal has claim.mismatch with rule 6 and field tests` |

## 假定

- S1/S2: `formatWhy` 在 reviewer 被跳过时渲染 `reviewer: skipped (rule <N>)` 而不是 `reviewer: —`；`verdict.downgraded` 行在 `assumed` 为 true 时在 `from` 值后附加 ` (assumed)`。
- S3: task.md 里包含上一轮 claim.mismatch 的信息：原始 claimed 值（JSON 格式）和实际测量的 failed 值。第二次运行用的假 worker 只读 task.md，不写 report，因此 R2 会上报，但读到的数据足够断言。

## 不可写的情形

无

## 类别可能标错的情形

无
