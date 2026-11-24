# v046-b42 情形 ↔ 用例 对照表

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | 新 | `S1: exit code is not 0, output has FAIL runner line, last line is preflight: failed (runner)` |
| S2 | 新 | `S2: exit code is 0 and output has ok runner line` |
| S3 | 新 | `S3: JSON checks.runner.ok is false and top-level ok is false` |
| K1 | 保持 | `K1: exit code is 0 and output has ok runner line with secs=60` |
| K2 | 保持 | `K2: output has FAIL runner with exitCode=1 and last line is preflight: failed (runner)` |
| K3 | 保持 | `K3: exit code is 0 and output has no ok runner or FAIL runner lines` |

## 假定的名字

- `preflightNow`：`CliDeps` 上已存在的可选字段，`() => number`（毫秒级单调时钟），传进 `runPreflight` 的 `now` 参数。
- `smoke_max_secs`：TOML `[limits]` 一节中的可选正整数键；缺省时默认上限 60 秒。

## 写不成测试的情形

无
