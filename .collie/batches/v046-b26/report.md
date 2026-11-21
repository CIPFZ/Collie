# 批次 v046-b26 汇报

## 做了什么

**条目 1：`RunResult.stopReason` 加 `api_error`，优先级 stopped > turns_exhausted > api_error > error**

- `src/runner/index.ts`：`stopReason` 类型联合加入 `'api_error'`。
- `src/runner/claude.ts`：`ResultMessage` 接口加可选 `terminal_reason?: string`。`aggregateResults` 里的 stopReason 判定改为 IIFE，按 stopped > turns_exhausted > api_error > error 的优先级返回。api_error 的匹配条件是 `subtype === 'success' && is_error === true && terminal_reason === 'api_error'`。

**条目 2：`api_retry_wait_secs` 配置项，队列 api_error 重跑前等待**

- `src/schema/index.ts`：`LimitsSchema` 加 `api_retry_wait_secs`（`z.number().int().nonnegative().optional().default(300)`），导出 `DEFAULT_API_RETRY_WAIT_SECS = 300`。
- `templates/collie.toml`：`[limits]` 加 `api_retry_wait_secs = 300` 及一行注释。
- `src/run.ts`：`INTERRUPT_STOP_REASONS` 集合加 `'api_error'`。`QueueContext` 加可选 `retryDelay?: (ms: number) => Promise<void>`。retry 分支里判断 `workerStopReason === 'api_error'` 时调用注入的 delay 函数（默认 `realDelay`），然后 `batch.retried` 事件带 `waited_secs`。
- `src/cli.ts`：`CliDeps` 接口加可选 `retryDelay`，`runContinue` 转发到 `runQueue`。

**条目 3：测试**

- `test/runner-claude.test.ts`：新 `describe('runner: api_error stop reason', …)` 三个用例——api_error 结果→stopReason api_error；中断+api_error→stopped；无 terminal_reason→error。
- `test/api-error-retry.test.ts`（新文件）：`describe('queue: api_error counts as a resumable interruption', …)` 三个用例——api_error→等 300s 重跑 PASS；双 api_error→blocked exit 20；idling→不等。
- `test/config.test.ts`：VALID_TOML 加 `api_retry_wait_secs = 300`，`has the limits of SPEC 3.1` 期望对象加 `api_retry_wait_secs: 300`。
- `test/schema.test.ts`：`validConfig.limits` 加 `api_retry_wait_secs: 300`。
- `test/invariants.test.ts`：加 `src/run.ts has api_error (v046-b26)` 不变量。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(exit 0)

$ npm test
 Test Files  71 passed (71)
      Tests  1470 passed (1470)
   Duration  24.35s

$ npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts
 Test Files  5 passed (5)
      Tests  212 passed (212)
```

所有验收命令均通过（exit 0）。

## 偏离或疑问

1. **改写的旧用例**（条目 3 允许范围内）：
   - `test/config.test.ts` VALID_TOML：加了 `api_retry_wait_secs = 300` 一行。`has the limits of SPEC 3.1`：期望对象加了 `api_retry_wait_secs: 300`。
   - `test/schema.test.ts` `validConfig.limits`：加了 `api_retry_wait_secs: 300`。
   这三处均为条目 3 点名允许的改动。

2. **runner-claude 中断测试的实现方式**：`stopped > api_error` 的用例中，构造了一个自定义的 `ClaudeQuery` 双替身（而非使用 `interruptableQuery` helper），使得 `onStarted` 回调在 `for await` 消费结果之前通过 `h.stop('soft')` 设置 interrupted 标志。这是因为 `interruptableQuery` 的异步迭代器在 `stop` 生效前就已把所有消息都吐完了，无法在循环中途触发中断。

3. **api-error-retry idling 用例的实现方式**：`idlingWorker` 场景使用 `fp.freeze()` + `await ctx.stopped` 模式（与 `scenario-n.test.ts` 的 `idleWorkerNoReport` 一致），等待活性监视器发现空转并触发信号阶梯，而非直接返回 `stopReason: 'error'`。

## 下一步建议

- 本批次功能完整，所有测试通过。可以继续下一批次。
- 未来可考虑在 `api_error` 重跑时使用指数退避而非固定等待时间。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b26",
  "head_sha": "4d17147d4f2856474e8bb052878793c07dd38cf7",
  "claims": {
    "commits": ["4d17147d4f2856474e8bb052878793c07dd38cf7"],
    "tests_passed": 1470,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
