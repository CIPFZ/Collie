# 批次 v046-b42 汇报

## 做了什么

1. **schema `smoke_max_secs`**：在 `src/schema/index.ts` 的 `LimitsSchema` 里新增可选字段 `smoke_max_secs`，正整数，缺省 60（`DEFAULT_SMOKE_MAX_SECS` 常量）。写法与 `api_retry_wait_secs` 一致。

2. **preflight runner 用时上限**：修改 `src/preflight.ts` 的 `checkRunner` 函数，新增第四个参数 `smokeMaxSecs`。当运行器退出码为 0 且用时秒数大于 `smokeMaxSecs` 时，该项判不过，`detail` 格式为 `exitCode=0 secs=<N> exceeds smoke_max_secs=<M>`。不大于时保持原样（`ok: true, detail: exitCode=0 secs=<N>`）。退出码非零和运行器抛错两种情况不变。调用处 `runPreflight` 把 `opts.config.limits.smoke_max_secs` 传入。

3. **模板注释行**：在 `templates/collie.toml` 的 `[limits]` 末尾加了一行注释 `# smoke_max_secs = 60   # 可选；preflight --smoke 调一次模型超过这么多秒就算不过（SPEC 16.28）`。没有加成真的键。`.collie/collie.toml` 没有改动。

4. **测试夹具更新**（条目 3 点名）：
   - `test/config.test.ts` 的 `has the limits of SPEC 3.1`：期望对象加了 `smoke_max_secs: 60`。
   - `test/schema.test.ts` 的 `validConfig.limits`：加了 `smoke_max_secs: 60`。

## 测试结果

```
npm run lint       → exit 0
npm run typecheck  → exit 0
npm test           → 86 test files, 1587 tests passed, 0 failed
npm test -- test/acceptance/v046-b42 → 2 test files, 6 tests passed
npm run test:mutation → caught 47 survived 0 invalid 0 timeout 0 stale 0
```

模板验收命令：
```
grep -qE "^# smoke_max_secs = 60" templates/collie.toml && ! grep -qE "^smoke_max_secs" templates/collie.toml && ! grep -qF "smoke_max_secs" .collie/collie.toml → exit 0
```

## 偏离或疑问

条目 3 点名的两处改写：

1. `test/config.test.ts`：`has the limits of SPEC 3.1` — 原断言 `config.limits` 不含 `smoke_max_secs`，现加了 `smoke_max_secs: 60`。原因：新增的可选字段有缺省值 60，解析结果里多了这个键。
2. `test/schema.test.ts`：`validConfig.limits` 夹具 — 原无 `smoke_max_secs`，现加了 `smoke_max_secs: 60`。原因同上，`strictObject` 要求夹具里有所有字段才能通过 round-trip。

除此之外无偏离。

## 下一步建议

`smoke_max_secs` 已就绪，`collie follow` 每圈的 `preflight --smoke` 现在会自动拦截接口变慢的情形，与操作员手工按 60 秒判断的做法一致（SPEC 16.28）。后续可以考虑在 `follow` 真实使用中观察这个阈值是否需要调整。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b42",
  "head_sha": "aaf78da04b075436c53333fbd120bb8bde615683",
  "claims": {
    "commits": ["aaf78da04b075436c53333fbd120bb8bde615683"],
    "tests_passed": 1587,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
