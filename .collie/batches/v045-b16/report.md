# 批次 v045-b16 汇报

## 做了什么

**条目 1：`src/run.ts` 的 `withHeadWorktree` 改为清理整个批次目录**

原来只删除 `report.md` 一个文件，现在遍历 `.collie/batches/<batchId>/` 目录，删除所有非 `task.md` 的文件（含 `verdict.md`、`report.md` 等）。别的批次的目录不动。
注释里的小节号从 14.17 改为 14.18 & 14.20，JSDoc 也一并更新。

代码使用已有的 `readdirSync`（已在 imports 中），对每个 entry 判断是否为 `task.md`，不是则 `rmSync`。

**条目 2：`test/reviewer-rerun.test.ts` 新增断言**

- `ReviewerCapture` 接口新增 `batchFiles`（reviewer 工作目录中批次目录的文件清单）和 `otherBatchReportExists`（v99-other 目录的 report.md 是否存在）。
- 两个 reviewer scene helper 都改为在 effect 中采集这两个新字段。
- 两个 describe 块的 `beforeEach` 里都先提交一个 `.collie/batches/v99-other/report.md`。
- FIX-then-PASS 场景新增 3 个 `it()`：
  1. 对照断言：第 2 次的 head_sha 树里有 `verdict.md`（证明 worktree 清理确实在工作）。
  2. 两次 reviewer cwd 的文件清单都恰好是 `['task.md']`。
  3. 两次 reviewer cwd 里 `v99-other/report.md` 都在。
- first-PASS 场景新增 2 个 `it()`：
  1. reviewer cwd 的文件清单恰好是 `['task.md']`。
  2. `v99-other/report.md` 在。
- 现有断言全部保留未改动。
- 总计 10 个 `it()` 块（≥ 7）。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(exit 0, no errors)

$ npm test
 Test Files  60 passed (60)
      Tests  1184 passed (1184)
   Duration  20.75s

$ npm test -- test/reviewer-rerun.test.ts
 Test Files  1 passed (1)
      Tests  10 passed (10)
   Duration  7.83s

$ npm test -- test/reviewer-isolation.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)
   Duration  2.94s

$ grep -cE "^\s+it\(" test/reviewer-rerun.test.ts
10  (≥ 7, pass)

$ grep -qF "v99-other" test/reviewer-rerun.test.ts
(exit 0, pass)
```

## 偏离或疑问

无

## 下一步建议

v045-b17（去掉测试里低于全局值的局部超时）可以继续。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b16",
  "head_sha": "c59f919f5d7601c48e0b569156879c3426ecd01a",
  "claims": {
    "commits": ["c59f919f5d7601c48e0b569156879c3426ecd01a"],
    "tests_passed": 1184,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
