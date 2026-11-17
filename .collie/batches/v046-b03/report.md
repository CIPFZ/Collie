# 批次 v046-b03 汇报

## 做了什么

逐条对应 task.md 的三个条目：

1. **`src/redcheck.ts` — `judgeRedCheck(reports)`**：纯函数，输入 `newReport` 和可选的 `keepReport`（vitest JSON 报告），输出 `{ ok, problems }`。判据严格按 SPEC 16.10：
   - `new`：至少一条用例且每条都是 `failed`；有 `passed`/`skipped`/`pending`/`todo` 的点名报告；`numTotalTests === 0` 或报告为 null 视为文件加载失败。
   - `keep`：可以没有（undefined/null 均可）；有的话至少一条且全部 `passed`。
   不起子进程、不读写文件。

2. **`src/redcheck.ts` — `runRedCheck(tree, outDir, opts)`**：在 `tree` 目录里对 `<outDir>/new.test.ts` 和（存在时）`<outDir>/keep.test.ts` 各跑一次 vitest，JSON 报告用 `--outputFile` 写到系统临时目录（`collie-redcheck-` 前缀），读完后删掉整个临时目录。
   - `new.test.ts` 不存在直接返回失败。超时返回失败并写明是 timeout。
   - 超时毫秒数 `timeoutMs` 和子进程函数 `spawn` 都由调用方经 `opts` 传入，`src/` 里没有裸写数字。
   - 返回 `judgeRedCheck` 的结果，外加 `newTestCount` 和 `keepTestCount`。

3. **`test/redcheck.test.ts`**：共 16 条用例（grep 匹配 23 条，含模板字符串里的测试文件内容，vitest 实际收集到 16 条）。
   - `judgeRedCheck` 的每条判据各一条用例（11 条），包括 skipped、todo、null 报告、零用例、无 keep、keep 全通过、keep 有失败、keep 零用例。
   - `runRedCheck` 的四种加粗情形各一条（4 条）：两条都失败→过；一条通过一条失败→不过且点名；import 报错→不过且写 file load failed；new 全失败但 keep 有一条失败→不过且点名。
   - 超时一条（用注入的假 spawn）。
   - `afterAll` 钩子验证系统临时目录里不残留 `collie-redcheck-*`，仓库里不出现 `.vitest/`。
   - `test/invariants.test.ts` 加了「`src/redcheck.ts` 用了 `--outputFile`」。

## 测试结果

```
$ npm run lint && npm run typecheck && npm test
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

> tsc -p tsconfig.json
(no output = zero errors)

> vitest run
 Test Files  62 passed (62)
      Tests  1236 passed (1236)
   Duration  20.95s
```

```
$ npm test -- test/redcheck.test.ts && ! test -e .vitest
 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  3.94s
(no .vitest directory)
```

```
$ d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1
 Test Files  1 passed (1)
      Tests  16 passed (16)
CLEANUP PASS
```

所有 8 条验收标准均通过。

## 偏离或疑问

无

## 下一步建议

- v046-b04 可将红检查接入 R2 队列流程，同时把 `test/acceptance/` 加入受保护路径、定义重试上限配置项。
- `runRedCheck` 的 `spawn` 参数类型目前是 `typeof execFile`，接入时直接传 `node:child_process.execFile` 即可。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b03",
  "head_sha": "adf4d6e45bd47f5303f0d912152a9e2d8d153c58",
  "claims": {
    "commits": ["adf4d6e45bd47f5303f0d912152a9e2d8d153c58"],
    "tests_passed": 1236,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
