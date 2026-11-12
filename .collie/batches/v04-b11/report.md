# 批次 v04-b11 汇报

## 做了什么

本批次的 3 个条目已在上一轮（attempt 1）的代码提交 `049854d` 中全部完成，上一轮因超时被 BLOCK，没有及时写 report。本轮验证代码完整性后直接提交报告。

1. **`src/git.ts` 的 `git()` 加 `GIT_OPTIONAL_LOCKS=0`**（SPEC 13.15）：在 `spawn('git', ...)` 的选项中传入 `env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }`。用展开运算符继承所有已有环境变量，只覆盖这一个字段。只读命令不再短暂占用 `index.lock`，`add` / `commit` 该占的锁照常占。没有改动任何调用方，没有改动取指纹的算法。

2. **`test/git.test.ts` 加两个用例**：
   - 通过 `git -c alias.optlocks='!printenv GIT_OPTIONAL_LOCKS' optlocks` 执行，断言输出为 `'0'`
   - 同样打印 `GIT_CONFIG_GLOBAL`（由测试夹具 `beforeAll` 设置），验证已有环境变量在子进程中仍可见

3. **`test/invariants.test.ts` 加两个不变量**：
   - `src/git.ts` 包含 `GIT_OPTIONAL_LOCKS` 字符串
   - `src/` 下只有 `src/git.ts` 直接 `spawn('git'`（保证统一入口）

## 测试结果

```
$ npm run lint
> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
# exit 0

$ npm run typecheck
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
# exit 0

$ npm test
> collie@0.1.0 test
> vitest run
 Test Files  48 passed (48)
      Tests  926 passed (926)
   Duration  14.92s
# exit 0
```

全部 6 条验收命令逐一验证通过（exit 0）。

## 偏离或疑问

无。代码在 attempt 1 已全部完成并推送，本轮仅补交 report。

## 下一步建议

- v04-b11 是 v0.4「看见」阶段最后一个批次，通过后该阶段收尾
- 可在后续队列运行中搜事件流的 `index.lock` 相关报错，验证修复效果

```json
{
  "schema_version": 1,
  "batch_id": "v04-b11",
  "head_sha": "049854da9e872dce3ef52d5239fe5b87be5dd5d6",
  "claims": {
    "commits": ["049854da9e872dce3ef52d5239fe5b87be5dd5d6"],
    "tests_passed": 926,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
