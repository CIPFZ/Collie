# MAP — v046-b41

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | 新 | `S1: exits 1 and output contains v00-x99` |
| S2 | 新 | `S2: exits 1 and output contains v00-x99` |
| S3 | 新 | `S3: output contains v00-x99 and does not contain "is not in docs/backlog.md"` |
| S4 | 新 | `S4: exits 1 and output contains v00-x99` |
| K1 | 保持 | `K1: exits 0 and output contains "no runs recorded"` |
| K2 | 保持 | `K2: exits 1 and output contains "batch v99-b99 is not in docs/backlog.md"` |
| K3 | 保持 | `K3: exits 1 and output contains v00-x99` |
| K4 | 保持 | `K4: returns 3 batches, first two statuses are blocked and passed` |

## 假定

- S1–S4 和 K3 的沙箱修改方式：用 `box.read` 读出 `docs/backlog.md`，把总览表里 `| — |` 替换成 `| v00-x99 |`，把小节里 `依赖：无` 替换成 `依赖：v00-x99`，再 `box.write` 写回。
- K4 的两批次归档文件按 v046-b40 的 `archiveText` 格式拼接两组批次内容。

## 无法写成测试的情形

无
