# 批次 v045-b10 汇报

## 做了什么

### 条目 1：`src/run.ts` 的队列循环——到数判断改为只数 PASS 的批次

在 `runQueue` 的 PASS 分支中，把原来的 `batchesRun.length >= ctx.max`（数运行总次数）改为 `batchesRun.filter((b) => b.verdict === 'PASS').length >= ctx.max`（只数 PASS 的批次）。
这样 FIX 重跑、规则 1 重跑、中断续跑都不占名额。`fix_max` 的计数与处理完全不变，`queue.finished.batches` 仍照旧列出每一次运行。

### 条目 2：新文件 `test/queue-limit.test.ts` + 不变量

创建了 `test/queue-limit.test.ts`，用 `FakeRunner` 跑真实的 `run --continue --max N`，共 4 条用例：

1. `--max 2`，两个批次，第一个先 FIX 再 PASS，第二个 PASS：两个批次都通过，reason 是 `limit`，`batches` 有 3 项。还断言了 `queue.batch_started` 的 why 值。
2. `--max 1`，同样的安排：第一个批次通过后停下，第二个仍是 `pending`，`batches` 有 2 项。
3. `--max 1`，一个批次的 FIX 次数超过 `fix_max`：退出码 20，记了 `escalated`（reason `fix_max`），不是 `limit`。
4. 不带 `--max`，两个批次都一次通过：退出码 0，reason `exhausted`，两个都是 `passed`。

在 `test/invariants.test.ts` 加了一条：`src/run.ts` 非注释代码行不含 `batchesRun.length >= ctx.max`。

## 测试结果

```
$ npm run lint && npm run typecheck && npm test

> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

> collie@0.1.0 typecheck
> tsc -p tsconfig.json

> collie@0.1.0 test
> vitest run

 Test Files  58 passed (58)
      Tests  1140 passed (1140)
   Duration  19.80s
```

专项测试：

```
$ npm test -- test/queue-limit.test.ts

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  4.47s
```

## 偏离或疑问

无

## 下一步建议

v045-b10 完成后固定版本可以前移到本提交（因为 `--max` 的行为改变了，之前的固定版本里 `--max` 还是按运行次数计）。这对第九次队列的 `--max` 值选取有影响：用新版 R2 时可以直接按批次数设 `--max`，不需要再乘以最大重试数。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b10",
  "head_sha": "bfaec1bbc11e8a2a18e0b1e801fd92981f5a0fe6",
  "claims": {
    "commits": ["bfaec1bbc11e8a2a18e0b1e801fd92981f5a0fe6"],
    "tests_passed": 1140,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
