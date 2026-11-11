# 批次 v04-b05 汇报

## 做了什么

**1. `src/watch.ts`（SPEC 13.5，当前段落取 13.2，事件字段取 3.6）**

新增 `watch(deps): Promise<number>`，`WatchDeps` 把 `now`、`sleep`、`load`（数据源）全部作为参数注入，
因此测试里没有真实定时器。实现要点：

- 初次 `load` 作为基线：启动前就在磁盘上的事件算历史，不打印；之后每个轮询周期打印「新事件」，
  每个事件一行（`ts run_id event k=v ...`），多个值与含换行的值用 `JSON.stringify` 转义，保证一条事件就是一行。
- 跟随目标：`activeRuns` 取「有 `run.started` 且没有终态事件」的运行，队列运行（`q-` 前缀）的终态是
  `queue.finished`，批次运行的终态是 `run.finished`。`pickFollow` 优先队列（队列存活期间它拥有批次运行），
  同类里取 `run.started` 最晚的一个。
- 退出条件：跟到 `run.finished` 且没有活跃队列 → 退出 0；跟到 `queue.finished` → 退出 0；
  `--once` → 打印一帧后退出 0；`--timeout` 到期 → 退出 0。批次运行结束但仍有活跃队列时改跟队列，不退出。
- 阶段变化打印 `status` 的 current 段落：`frameKey` 只由 state / runId / phase / lastRunId / lastVerdict
  组成，且用固定时间戳计算，所以每轮变化的 elapsed 秒数不会造成每轮都刷屏。
- 静默标注：两条路径。(a) 新事件的 ts 与上一事件 ts 间隔 ≥ `stall_secs` 时，在该事件行尾加 `  [silent Ns]`；
  (b) 跟随中连续无新事件、距最后事件 ≥ `stall_secs` 时，单独打一行
  `<now ISO> silent Ns (> stallSecs s)`，每个静默段只打一次，来新事件后重置。
- 只读：不写 journal、不碰 heartbeat、不发信号（`src/watch.ts` 里没有 `writeFileSync` / `appendFileSync` /
  `process.kill`）。

**2. `collie watch [--once] [--interval <秒>] [--timeout <秒>]`**

`cli.ts` 只做接线：解析选项、校验 `--interval` / `--timeout` 为正有限数（否则 `EXIT_CODES.ERROR`），
从 `loadConfig(deps.cwd).limits.stall_secs` 取阈值（ConfigError 同样返回 ERROR），然后把
`loadRuns`、`deps.now`、真实 sleep 传给 `watch`。默认定时 2 秒来自 `watch.ts` 导出的 `DEFAULT_INTERVAL_SECS`
（SPEC 13.5 的默认值，非可调阈值）。真实 `setTimeout` 封装只存在于 `cli.ts` 的 `watchSleep` 依赖里，
`watch.ts` 本身不含该字面量。

**3. `src/view.ts`**

抽出 `formatCurrentSection(current: CurrentStatus): string`（`== current ==` 段：运行中显示
`running: <batch> (<run>) attempt N phase <phase>` 与 elapsed / since-last，空闲时显示
`idle (last: <run> <verdict>)` 或 `idle`，末尾空行）。`formatStatus` 改为复用该函数，输出不变；
`watch` 也调它，保证两处帧一致。`view.ts` 依旧不 import `run.ts` / `runner` / `roles`。

**4. `test/watch.test.ts`（7 个 `it`）**

注入时钟（`sleep` 只推进虚拟时间）与 `load`：`--once` 打印帧且不 sleep、`--once` 空仓库打印
`no runs recorded`、跟批次运行到 `run.finished`、跟队列运行到 `queue.finished`、等待启动后新出现的运行、
`--timeout` 到期退出、静默超过 `stall_secs` 打标注。文件里没有 `setInterval` / `setTimeout(`。

**5. `test/invariants.test.ts`**

新增两条：`test/watch.test.ts` 不含真实定时器；`src/watch.ts` 不含文件写与 `process.kill`。

## 测试结果

```
$ npm run lint && npm run typecheck && npm test
eslint . && prettier --check .   →  All matched files use Prettier code style!
tsc -p tsconfig.json             →  无输出
 Test Files  43 passed (43)
      Tests  875 passed (875)
   Duration  14.41s

$ npm test -- test/watch.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  287ms
```

验收命令本地实跑：

```
$ npx tsx src/cli.ts watch --once
== current ==
running: v04-b05 (r-20261111093302) attempt 1 phase worker
  elapsed 19m45s since-last 19m44s
exit=0
```

其余几条 grep 均通过：`it(` 计数 7（匹配 `^([6-9]|[1-9][0-9])$`）、watch 测试无真实定时器、
`src/watch.ts` 无非注释的写文件/信号调用、`test/invariants.test.ts` 含 `watch.ts`。

说明：主仓库里有本批次的 journal，所以 `--once` 打的是运行帧；R2 在 `head_sha` 干净 worktree 里跑时
`.collie/runs/` 不存在，`loadRuns` 返回空，会打 `no runs recorded` 并同样退出 0（已按此路径核对过
`.collie/collie.toml` 被跟踪、`.collie/runs/` 被 gitignore）。

## 偏离或疑问

- `--interval` / `--timeout` 用 `parseInt` 解析；非数字时 zod/parseInt 会得到 `NaN`，由 `Number.isFinite`
  与正数检查拦下并返回 ERROR。SPEC 13.5 只规定了两个选项的名字，没有规定非法值的行为，这里选择报错而非静默取默认值。
- 队列运行期间批次运行结束：按 SPEC 13.5「队列运行以 `queue.finished` 为终点」改跟队列而不是退出，
  这样一次 `collie w` 覆盖整条队列。
- 静默标注实现了两种形式（事件行后缀 + 独立行）。SPEC 13.5 只说「超过 `stall_secs` 的空档要标注秒数」，
  两种都标了秒数；若 R2 认为应只保留一种，删除独立行即可，不影响其他条目。
- 无新增依赖，未改动 `run.ts` / `gate.ts` / `arbiter.ts` / 规则 1–10，未触碰任何受保护文件。

## 下一步建议

- v04-b06 之后若要给 `watch` 加颜色或 `--json`，建议先扩 `formatCurrentSection` 的返回结构而不是在
  `watch.ts` 里另起渲染，保持 view 与 watch 同源。
- `pickFollow` 目前对「同一时刻启动」的两个队列取后者；若将来允许并发队列，需要 SPEC 明确择一规则。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b05",
  "head_sha": "9873af79b1270679c9e8a4f61681d206229e0483",
  "claims": {
    "commits": [
      "4b6febdbadf60add6262c005ff2b077913f1e543",
      "9873af79b1270679c9e8a4f61681d206229e0483"
    ],
    "tests_passed": 875,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": [
    "SPEC 13.5 未规定 --interval/--timeout 非法值的行为；本轮选择报错退出（EXIT_CODES.ERROR）。",
    "静默标注同时实现了事件行后缀与独立行两种形式，是否需要保留其中一种待确认。"
  ]
}
```
