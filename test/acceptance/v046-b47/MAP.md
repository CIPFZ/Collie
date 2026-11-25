# MAP — v046-b47

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | new | `S1: prompt does not contain "逐条原样实跑" and has exact R2-ran notice line` |
| S2 | new | `S2: prompt contains "JSON 块里不要写"` |
| S3 | new | `S3: reviewer (2nd call) prompt does not contain "逐条原样实跑"` |
| K1 | keep | `K1: has "逐条原样实跑", no "R2 已经实跑过", no "JSON 块里不要写"` |
| K2 | keep | `K2: prompt has "npm test -- test/x.test.ts", "## 验收命令" line, and "## R2 的取证结果" line` |
| K3 | keep | `K3: exit 0, calls are worker then reviewer` |

## 假定

- S1/S2: 使用与 v046-b46 S1 相同的 `evidence` 结构构造输入，经 `as unknown as ReviewerInput` 传入 `buildReviewerPrompt`。
- S3: 沙箱默认场景（`fooledReviewerScene`）会让 R2 在调用 reviewer 之前收集 evidence 并注入到 prompt；因此 reviewer 拿到的 prompt 应当反映 evidence 存在时的新行为。
- K2: `acceptance` 里的 `cmd` 为 `npm test -- test/x.test.ts`，同时 `evidence.verify_results` 里也包含对应命令，以模拟真实场景。

## 不可写的情形

无

## 类别可能标错的情形

无
