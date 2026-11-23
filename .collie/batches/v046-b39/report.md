# 批次 v046-b39 汇报

## 做了什么

**条目 1：** 新建 `test/output-tail.test.ts`，包含一组 `describe('output_tail: per-stream tail and fence width (SPEC 16.25)', …)` 下的九条用例，覆盖 S1–S4 和 K1–K5 全部情形：

- **S1：** 标准输出打印 `result: 1 survived`，标准错误打印 `progress 1` 到 `progress 30`，exit 1。断言 `output_tail` 第一行是 `result: 1 survived`，第二行是 `--- stderr ---`。
- **S2：** 标准输出打印 `o1`–`o25`，标准错误打印 `e1`–`e25`。断言 `output_tail` 恰好 41 行，第 1 行 `o6`，第 21 行 `--- stderr ---`，第 22 行 `e6`。
- **S3：** 只向标准错误打印 `e1`、`e2`、`e3`。断言 `output_tail` 恰好 4 行，第 1 行 `--- stderr ---`，第 2 行 `e1`。
- **S4：** `renderFixSection` 拿到 `output_tail` 为 `before\n\`\`\`\nafter`。断言代码块以恰好四个反引号的一行开头，收尾找与开头那一行完全相同的下一行（也是恰好四个反引号），中间依次是 `before`、三个反引号、`after`。
- **K1：** 只向标准输出打印 `out 1` 到 `out 30`。断言恰好 20 行，第 1 行 `out 11`，最后一行 `out 30`，没有 `--- stderr ---`。
- **K2：** 同 S1 的脚本。断言事件有 `cmd`、`exit_code`、`expect`；`output_tail` 包含 `progress 30` 但不包含 `progress 10`（后者被 20 行截断丢弃）。
- **K3：** 环境变量 `GITHUB_TOKEN` 设为 `tok-secret-12345`（用完还原），标准错误打印 `token=tok-secret-12345`。断言 `output_tail` 包含 `token=***` 且不包含 `tok-secret-12345`。
- **K4：** `renderFixSection` 拿到 `output_tail` 为 `line A\nline B`（无反引号）。断言代码块以恰好三个反引号开头，收尾找与开头相同的行（三个反引号），中间依次是 `line A`、`line B`。
- **K5：** `split.sh` 什么都不打印、以 1 退出。断言 `acceptance.failed` 事件没有 `output_tail` 这个键。

搭法参照 `test/acceptance/v046-b35/new.test.ts`（`addNoisyScript` → `addSplitScript`，`noisy.sh` → `split.sh`，`>&2` 写标准错误）。

**条目 2：** 在工作区里逐一撤销 `src/run.ts` 四处改动并跑测试，确认每处都会让新用例失败（详见"测试结果"段）。撤完后 `git diff src/run.ts` 确认无残留。

**条目 3：** 没有改任何现有测试。全量测试 1556 个全过。

## 测试结果

**正常运行（全量）：**
```
npm run lint       → exit 0
npm run typecheck  → exit 0
npm test           → 80 passed, 1556 tests passed
npm test -- test/output-tail.test.ts test/acceptance/v046-b35 → 3 files, 17 tests passed
npm run test:mutation → caught 46 survived 0 invalid 0 timeout 0 stale 0
```

**四处撤销验证：**

1. **两个输出流分开取（改回合起来取）：** 把 `buildOutputTail` 中 `processStream(stdout)` / `processStream(stderr)` 分别调用改成合并后一次调用 → **S1、S2、S3 红**（separator 不存在、行数与内容不对）。
2. **`--- stderr ---` 那一行：** 删掉 `parts.push('--- stderr ---')` → **S1、S2、S3 红**（找不到 separator）。
3. **标准错误那一段的 20 行上限：** 把 `lines.slice(-OUTPUT_TAIL_MAX_LINES)` 改成 `lines`（取全部） → **S2、K1、K2 红**（行数不是 20/41、progress 10 没被截掉）。
4. **围栏按内容加长（改回永远三个）：** 把 fence 长度计算改成固定 `'```'` → **S4 红**（开头不是四个反引号）。

## 偏离或疑问

无

## 下一步建议

v046-b39 通过后，固定版本可以前移到包含 v046-b37 实现的提交，`output_tail` 的新取法与围栏加长随之进 R2。v046-b38（三处上报合成一个）可以继续。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b39",
  "head_sha": "8838cd4cda72d42004791ebe1d3cda75220ceddf",
  "claims": {
    "commits": ["8838cd4cda72d42004791ebe1d3cda75220ceddf"],
    "tests_passed": 1556,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
