# 批次 v04-b02 汇报

## 做了什么

**条目 1：`src/view.ts` 读取层 `loadRuns(root)`**
实现了 `loadRuns(root)` 函数，扫描 `.collie/runs/*/events.ndjson`，逐个运行调用 `journal.replay()` 重放。
单个运行的 journal 校验失败时 catch 异常，将该运行标记为 `{ status: 'unreadable', reason }` 而不抛出，其余运行照常加载。
返回类型 `RunData[]`，每项是 `{ runId, status: 'ok', events }` 或 `{ runId, status: 'unreadable', reason }`。

**条目 2：`src/view.ts` 投影层与 `collie status [--json]`**
- `projectRun(events)` / `projectRuns(runDataList)` / `projectBatches(runDataList, batches)` / `projectQueueRun(events)` 全部是纯函数，
  不读文件、不读时钟（`buildStatus` 的 `now` 由参数传入）。
- 该模块不 import `run.ts`、`runner/`、`roles/`。
- 13.1 的可选字段（`num_turns`、`cost_usd`、`duration_ms`、`rule`、`tests_passed` 等）缺失时投影给 `null`。
- `buildStatus(runDataList, batches, now)` 组装三段结构：当前运行（进行中或 idle）、队列状态（pending 数量、下一个可执行批次、blocked 列表）、
  最近一次队列运行（reason、batches、paused_count）。
- `formatStatus(status)` 输出人类可读的三段文本。
- `cli.ts` 新增 `collie status [--json]` 命令，没有 journal 时打印 `no runs recorded` 退出码 0；
  `--json` 输出同一结构的 JSON。CLI 只做接线，逻辑全在 `view.ts`。

**条目 3：测试与配置**
- `test/view.test.ts`：15 个 `it()` 用例，覆盖 PASS 运行、FIX 后 PASS（两个运行）、进行中的运行、旧格式 run_id 目录、
  含坏行的 journal（标记为 unreadable）、坏 journal 不影响其他运行、队列运行投影、不含 13.1 字段的旧 journal（所有可选字段为 null）、
  idle 状态显示、队列段计算、last queue run、formatStatus 输出、projectBatches 聚合。
- `test/invariants.test.ts`：新增「`src/view.ts` 不 import `run.ts`/`runner/`/`roles/`」不变量。
- `vitest.config.ts`：添加 `hookTimeout: 30_000`，与 `testTimeout` 同值（SPEC 13.11）。

## 测试结果

```
npm run lint        → exit 0（All matched files use Prettier code style!）
npm run typecheck   → exit 0
npm test            → exit 0（41 passed / 846 tests passed）
npm test -- test/view.test.ts → exit 0（15 passed）
```

全部 11 项验收标准逐条验证通过：
1. `npm run lint` → exit 0
2. `npm run typecheck` → exit 0
3. `npm test` → exit 0（846 passed）
4. `npm test -- test/view.test.ts` → exit 0（15 passed）
5. `grep -cE "^\s+it\(" test/view.test.ts` = 15 ≥ 8 → exit 0
6. `test -f src/view.ts && ! grep -qE "from '\./(run|runner|roles)[./]" src/view.ts` → exit 0
7. `grep -qE "unreadable" src/view.ts && grep -qE "unreadable" test/view.test.ts` → exit 0
8. `npx tsx src/cli.ts status` → exit 0
9. `npx tsx src/cli.ts status --json | node -e "JSON.parse(...)"` → exit 0
10. `grep -qE "view\.ts" test/invariants.test.ts` → exit 0
11. `grep -vE "^\s*(//|\*|/\*)" vitest.config.ts | grep -qE "hookTimeout"` → exit 0

## 偏离或疑问

无。所有条目按 SPEC 13.2 的要求实现，无偏离。

## 下一步建议

本批次为 v04-b03（collie timeline）、v04-b04（collie why）、v04-b05（collie watch）打下了基础——
它们都可以复用 `loadRuns` 与投影函数。建议下一个批次实现 `collie timeline`，它的数据源与投影逻辑最简单。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b02",
  "head_sha": "23da11e85b1d10445c48e81ee3b8afc1d3f06bfc",
  "claims": {
    "commits": ["23da11e85b1d10445c48e81ee3b8afc1d3f06bfc"],
    "tests_passed": 846,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
