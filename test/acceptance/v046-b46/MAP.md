# MAP — v046-b46

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | new | `S1: prompt has a line "## R2 的取证结果" and contains "Tests 12 passed (12)"` |
| S2 | new | `S2: safeParse succeeds for a verdict with no evidence, verdict PASS, gaps []` |
| S3 | new | `S3: exit 0, run.finished verdict is PASS` |
| S4 | new | `S4: reviewer prompt has line "## R2 的取证结果" and contains "受保护文件改动行数：0"` |
| K1 | keep | `K1: prompt does not contain "## R2 的取证结果"` |
| K2 | keep | `K2: safeParse succeeds and evidence.spec_diff_lines is 42` |
| K3 | keep | `K3: exit 0, calls are worker then reviewer` |
| K4 | keep | `K4: exit 0, evidence.collected spec_diff_lines is 0` |

## 假定

- S1: `buildReviewerPrompt` 在 `evidence` 存在时会渲染 `## R2 的取证结果` 段落，包含 verify_results 的 summary 文本。
- S4: R2 在调用 reviewer 之前把自己测量的 evidence 注入 `buildReviewerPrompt` 的 `evidence` 参数，prompt 中用 `受保护文件改动行数：<N>` 渲染 `spec_diff_lines`。
- K4: `evidence.collected` 事件里的 `spec_diff_lines` 是 R2 自己测量的值（0），不是 reviewer verdict 里的值（99）。

## 不可写的情形

无

## 类别可能标错的情形

无
