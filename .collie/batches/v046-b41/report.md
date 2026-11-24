# 批次 v046-b41 汇报

## 做了什么

**条目 1：status、why、report 不再吞掉批次清单的错误。**

在 `src/cli.ts` 中新增共用函数 `tryLoadBacklog(cwd)`（SPEC 16.28），它：
- 先用 `existsSync` 检查 `docs/backlog.md` 是否存在；不存在时返回 `{ ok: true, batches: [] }`，保持原有行为（当成没有批次）。
- 存在时调用 `loadBacklog(root)`；成功返回 `{ ok: true, batches }`，失败返回 `{ ok: false, error: message }`。

三条命令 `status`、`why`、`report` 在最前面调用 `tryLoadBacklog`：
- `ok === false` 时写 `collie: <error>\n` 到标准错误（与 `show` 在 `main()` 外层 catch 里的写法相同），返回 `EXIT_CODES.ERROR`（即 1），不输出其他内容（`--json` 也一样）。
- `ok === true` 时用 `batches` 替代原来的 `loadBacklog()` 调用或 try/catch。

三条命令原来各自的 `try { loadBacklog } catch { batches = [] }` 全部移除，改为共用 `tryLoadBacklog`。`show`、`run`、`timeline`、`preflight` 未改动。

导入了 `BACKLOG_RELATIVE_PATH`（从 `./backlog.js`），用于 `existsSync` 检查。

**条目 2：mutation.ts 注释项数更新。**

`scripts/mutation.ts` 中 `Protected paths (11)` 改成 `Protected paths (14)`，只改了这一个数字。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
All matched files use Prettier code style!
# exit 0

$ npm run typecheck
tsc -p tsconfig.json
# exit 0

$ npm test
Test Files  84 passed (84)
Tests  1581 passed (1581)

$ npm test -- test/acceptance/v046-b41
Test Files  2 passed (2)
Tests  8 passed (8)

$ npm run test:mutation
All mutations caught ✓
mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0

$ grep -qF "Protected paths (14)" scripts/mutation.ts
# exit 0
```

## 偏离或疑问

无。

## 下一步建议

v046-b42（`preflight --smoke` 的用时上限）可以继续签发。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b41",
  "head_sha": "052d6800a55d134910430d6f364bc75077283941",
  "claims": {
    "commits": ["052d6800a55d134910430d6f364bc75077283941"],
    "tests_passed": 1581,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
