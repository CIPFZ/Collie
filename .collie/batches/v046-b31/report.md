# 批次 v046-b31 汇报

## 做了什么

1. **`src/evidence.ts` 的 `PROTECTED_PATHS` 加三项**：在数组末尾（`test/acceptance` 之后）加了 `'.github'`、`'eslint.config.js'`、`'vitest.config.ts'`，写法与现有各项一致，每项一行。这样 worker 的提交动了这三类文件时，`spec_diff_lines > 0`，按仲裁规则 2 拦停。

2. **`scripts/mutation.ts` 变异清单加三项**：加了 `protected:.github`、`protected:eslint.config.js`、`protected:vitest.config.ts`，写法照已有的 10 项（删除该行使路径不受保护，测试应捕获）。清单上方注释里的项数从 43 改为 46。

3. **测试**：
   - `test/evidence.test.ts`：加了一组 `it.each`，用例名 `counts %s as protected (SPEC 16.21)`，三个路径是 `.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts`。每个用例写入对应路径、提交、验证 `spec_diff_lines` 为 1。
   - `test/mutation.test.ts`：`every protected path is in the mutation list` 用例里的 `10` 改为 `13`。
   - `test/invariants.test.ts`：加了一条不变量，用例名 `src/evidence.ts has .github, eslint.config.js and vitest.config.ts in PROTECTED_PATHS (v046-b31)`，检查 `evidence.ts` 包含这三个字符串。

## 测试结果

```
npm run lint      → exit 0（ESLint + Prettier 均通过）
npm run typecheck → exit 0（tsc 零错误）
npm test          → exit 0
  Test Files  72 passed (72)
       Tests  1486 passed (1486)
    Duration  25.51s
```

## 偏离或疑问

- **`test/mutation.test.ts` 断言改写**（条目 3 点名允许）：`every protected path is in the mutation list` 用例中，原断言 `expect(protectedNames.length).toBe(10)`，改为 `expect(protectedNames.length).toBe(13)`。原因：新增了 3 项受保护路径对应的变异条目，受保护路径的变异项总数从 10 变为 13。

## 下一步建议

- 本批次完成后，v046-b32（批次授权 D9）可继续推进，使得后续批次可以通过授权机制修改这三类受保护文件（如把 `vitest.config.ts` 的 `testTimeout`/`hookTimeout` 提到 300 秒）。
- 变异检查（`npx tsx scripts/mutation.ts`）可在 R2 验收时运行以确认 46 项全部被捕获。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b31",
  "head_sha": "3eab3fe4833f7fc14549ae3067b2c68b74d02178",
  "claims": {
    "commits": ["3eab3fe4833f7fc14549ae3067b2c68b74d02178"],
    "tests_passed": 1486,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
