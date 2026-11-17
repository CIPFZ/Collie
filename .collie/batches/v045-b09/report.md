# 批次 v045-b09 汇报

## 做了什么

本轮是第 2 次尝试，只修上一轮的缺口：

上一轮 9 个 `protected:*` 变异全部返回 `invalid`（期望 `caught`），原因是 `runMutation()` 的 `toCopy` 列表缺少 `.collie/` 目录。这些变异修改 `src/evidence.ts`，其测试文件 `test/evidence.test.ts` 需要加载 `.collie/collie.toml` 读取配置。临时目录里缺少该文件夹导致测试进程崩溃、0 个用例执行，被 `judgeExecResult` 判为 `invalid`。

修复：在 `scripts/mutation.ts` 的 `toCopy` 数组中加入 `'.collie'`，使临时目录包含项目配置。

## 测试结果

```
$ npm run lint       → exit 0
$ npm run typecheck  → exit 0
$ npm test           → 57 files, 1135 passed, 0 failed
$ npm test -- test/mutation.test.ts → 22 passed, 0 failed
$ npx tsx scripts/mutation.ts → caught 44 survived 0 invalid 0 timeout 0 stale 0
```

末行：`mutation: caught 44 survived 0 invalid 0 timeout 0 stale 0`，无 `.vitest` 目录残留。

## 偏离或疑问

无

## 下一步建议

v045-b09 三个条目在上一轮已全部实现，本轮只补了 `.collie` 拷贝缺口。44 项变异全部 caught，可以继续推进后续批次。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b09",
  "head_sha": "4f74ffb98016df23886abf961cf79da18c315d9c",
  "claims": {
    "commits": ["4f74ffb98016df23886abf961cf79da18c315d9c"],
    "tests_passed": 1135,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
