# 批次 v046-b27 汇报

## 做了什么

**条目 1：`src/preflight.ts` 的 runner 检查判断退出码（SPEC 14.33）。**
修改 `checkRunner` 函数：
- 运行器返回 `exitCode !== 0` → `ok` 为 `false`，`detail` 写 `exitCode=<N>`；有 `stopReason` 时追加 `stopReason=<原因>`。
- 通过与不过的 `detail` 末尾都带 `secs=<用时秒数，取整>`。
- 新增 `PreflightOpts.now` 可选字段（`() => number`，缺省 `Date.now`），用于注入时钟；测试里用确定性的假时钟，不真的等。
- 新增 `MS_PER_SEC` 常量用于毫秒到秒转换。
- 运行器抛错时仍旧不过，`detail` 是错误信息（无 `secs`，因为计时不完整）。
- 新增 `CliDeps.preflightNow` 可选字段，从 CLI 层传递到 `runPreflight`。

**条目 2：`src/cli.ts` 的 `collie smoke` 判断退出码（SPEC 14.33）。**
修改 `smoke` 函数：
- 运行器返回 `exitCode !== 0` → 标准错误写 `smoke failed: exitCode=<N>`（有 `stopReason` 时带上），退出码 1，不查 CI，不写 `smoke ok`。

**条目 3：测试。**
- `test/preflight.test.ts`：新增 `describe('preflight: runner check judges the exit code', …)` 组，5 条用例：
  - exitCode=1 + stopReason → FAIL 行、preflight 失败
  - exitCode=0 → ok 行 + secs=
  - exitCode=1 无 stopReason → FAIL 行无 stopReason
  - 运行器抛错 → FAIL runner + 错误消息
  - --json + exitCode=1 → ok=false
- `test/cli.test.ts`：新增 `smoke exits 1 when the runner returns a non-zero exit code` 用例，验证退出码 1、输出含 `smoke failed: exitCode=1`、无 `smoke ok`、CI 未被查询。

## 测试结果

```
npm run lint    → exit 0 (0 errors, 0 warnings)
npm run typecheck → exit 0
npm test        → 70 test files, 1459 tests passed, 0 failed
npm test -- test/preflight.test.ts test/cli.test.ts test/scenario-m.test.ts test/follow.test.ts
                → 4 test files, 76 tests passed, 0 failed
```

验收命令全部通过：
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test` → exit 0
- 目标测试文件 → exit 0
- `grep -qF` 新测试名 → exit 0
- `grep -vE` 代码字面 → exit 0

## 偏离或疑问

无。已有测试全部不改，全部通过。

## 下一步建议

- 本批次只把用时写出来（`secs=`），未设阈值。SPEC 14.33 明确说这一批不定阈值；后续批次可在 `follow` 真实使用前加阈值配置项。
- `collie smoke` 的用时目前不输出；如果操作员需要在 `smoke` 命令也看到用时，可在后续批次补充。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b27",
  "head_sha": "00e6cec188ff9c228976ffc82bff271d6ed6b2c4",
  "claims": {
    "commits": ["00e6cec188ff9c228976ffc82bff271d6ed6b2c4"],
    "tests_passed": 1459,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
