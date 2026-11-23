# MAP — v046-b35

| 情形 | 类别 | 用例 | 文件 |
|------|------|------|------|
| S1 | 新 | `S1: fenced code block after the command line contains line A and line B in order` | new.test.ts |
| S2 | 新 | `S2: acceptance.failed for sh noisy.sh has output_tail of exactly 20 lines, out 11 to out 30` | new.test.ts |
| S3 | 新 | `S3: output_tail line is exactly 300 x characters` | new.test.ts |
| S4 | 新 | `S4: output_tail is exactly "token=***"` | new.test.ts |
| S5 | 新 | `S5: second run worker task.md contains standalone lines out 11 and out 30` | new.test.ts |
| K1 | 保持 | `K1: output contains the command line and no fenced code block in the acceptance section` | keep.test.ts |
| K2 | 保持 | `K2: acceptance.failed has cmd, exit_code, expect; verdict is FIX rule 8 exit 10` | keep.test.ts |
| K3 | 保持 | `K3: journal has no acceptance.failed event when all commands pass` | keep.test.ts |

所有情形均已覆盖，无无法测试的情形。
