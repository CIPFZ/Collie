# MAP — v046-b40

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | new | `S1: returns exactly two batches in order, with depends_on populated` |
| S2 | new | `S2: loadBacklog throws BacklogError with batch id and archive filename` |
| S3 | new | `S3: pending status in archive throws BacklogError with batch id`, `S3: running status in archive throws BacklogError with batch id` |
| S4 | new | `S4: exit 0, backlog shows v99-b01 as passed` |
| S5 | new | `S5: exit 20, evidence.collected spec_diff_lines > 0` |
| K1 | keep | `K1: loadBacklog returns exactly one batch` |
| K2 | keep | `K2: loadBacklog throws BacklogError with unknown batch id v00-x99` |
| K3 | keep | `K3: backlog-archive.md content is identical before and after the run` |

## 假定

- `loadBacklog` 读取归档文件的路径为 `<root>/docs/backlog-archive.md`，格式与 `docs/backlog.md` 完全相同（如「接口」一节所述）。
- 归档文件里的批次在合并结果里排在 `docs/backlog.md` 里的批次前面（S1 断言顺序依据：先归档、后活跃）。
- 归档批次只允许 `passed` 状态，`pending` 和 `running` 均视为非法（S3）。
- `docs/backlog-archive.md` 属于受保护路径，worker 修改它会被计入 `spec_diff_lines`（S5）。
- K2 中 backlog.md 里写 `depends: v00-x99`，两个文件里都没有这个批次，`loadBacklog` 应抛错。
- K3 断言在 S4 场景（queue 模式跑完后）归档文件不被改动。

## 写不成测试的情形

无
