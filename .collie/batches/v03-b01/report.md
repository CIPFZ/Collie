# 批次 v03-b01 汇报

## 做了什么

### 条目 1：R2 推送裁定提交与启动核查（SPEC 12.1）

1. **`src/git.ts`** — 新增 `push(cwd, remote, branch)` 函数，执行 `git push --quiet --end-of-options`。
2. **`src/schema/index.ts`** — EVENT_TYPES 增加 `verdict.pushed`、`verdict.push_failed`、`ci.verdict_commit` 三个事件。
3. **`src/run.ts`** — 四处推送逻辑：
   - **正常路径**：在 progress 提交后推送裁定提交，成功记 `verdict.pushed`（含 sha/remote/branch），失败记 `verdict.push_failed`（含 error）且不改变结论、不抛出。
   - **escalation 路径**：同样的推送/记录逻辑。
   - **异常 fallback 路径**：best-effort 推送，失败静默。
   - **启动阶段**：若本地领先远端先推送一次（catch 忽略错误）；取最近一条 `verdict.pushed` 事件的 sha 用 `queryCi` 查一次（不等待），`failure`/`cancelled` 打 `ctx.err?.()` 警告并记 `ci.verdict_commit`，`success` 只记事件。
4. **辅助重构**：提取 `readCiToken()` 替代 run.ts 和 evidence.ts 中重复的 token 读取；新增 `findLastVerdictPushedSha()` 扫描所有 run journal；`appendStream()` 增加可选 `fileName` 参数。
5. **`src/cli.ts`** — 传入 `err: deps.err`。
6. **测试**（`test/exit-codes.test.ts`）：3 个推送测试（records verdict.pushed、remote contains commit、push_failed on broken remote）；2 个启动核查测试（warns on failure、records ci.verdict_commit on success）。

### 条目 2：reviewer 事件流落盘（SPEC 12.1）

1. **`src/run.ts`** — 新增 `REVIEWER_STREAM_FILE_NAME = 'reviewer.stream.ndjson'`（已 export）；创建 `reviewerOnEvent` 回调，通过 `appendStream` 写入 reviewer 专属流文件。
2. **`src/roles/reviewer.ts`** — `runReviewer()` 签名增加 `onEvent` 和 `redact`，透传给 `runner.run()`。
3. **`src/runner/fake.ts`** — FakeRunner 新增 `redactFakeEvent()` 实现 `RunOptions.redact` 契约，与 claude.ts 逻辑一致（JSON 序列化后替换，≥8 字符阈值）。不加此实现，测试中 redact 无效。
4. **测试**（`test/exit-codes.test.ts`）：2 个 reviewer stream 测试（file exists with events、masks secrets with redact）。

### 条目 3：场景 H（SPEC 12.1 rule 9 回归测试）

1. **`test/scenario-h.test.ts`** — 新文件，4 个测试：
   - exits 10 (FIX) although reviewer said PASS
   - records `verdict.downgraded` with rule=9, no `claim.mismatch`
   - `run.finished` carries verdict=FIX and exit_code=10
   - progress shows `已推送：否`
2. **`test/invariants.test.ts`** — 新增 2 条不变量：
   - `src/git.ts exports push function (v03-b01)`
   - `scenario-h.test.ts exists (v03-b01)`

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
（无输出，退出码 0）

$ npm test
 Test Files  35 passed (35)
      Tests  695 passed (695)
   Duration  12.82s

$ npm test -- test/scenario-h.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

全部 695 测试通过，0 失败，lint 零错误，类型检查零错误。

## 偏离或疑问

1. **FakeRunner 缺少 redact 实现**：发现 `FakeRunner` 未实现 `RunOptions.redact` 契约——它将原始事件直接传给 `onEvent`，而 claude.ts 的真实 runner 会先用 `redactEvent()` 屏蔽密钥。因此在 `fake.ts` 中添加了 `redactFakeEvent()` 函数，逻辑与 `claude.ts` 完全一致（JSON 序列化后字符串替换，≥8 字符阈值，REDACT_MASK = `***`）。这是对 fake runner 的修补，不影响 SPEC 或真实 runner。
2. **`readCiToken` 提取**：原本 run.ts 和 evidence.ts 各有一份 token 文件读取逻辑。为避免重复（且 run.ts 新增的启动 CI 核查也需要用），提取为 `readCiToken()` 私有函数。evidence.ts 的现有调用未改动（它有自己的 token 读取，后续可统一，但不在本批次范围）。
3. **`appendStream` 泛化**：给 `appendStream(root, runId, event, fileName?)` 加了可选的 `fileName` 参数（默认 `STREAM_FILE_NAME`），而非创建重复函数。这使 reviewer stream 和 worker stream 共用同一写入逻辑。
4. **event sequence 更新**：`verdict.pushed` 自然出现在 `ci.resolved` 和 `run.finished` 之间，已更新 exit-codes.test.ts 中的事件序列断言。

## 下一步建议

1. 批次 v03-b01 的三个条目全部完成，建议进入审核。
2. SPEC 12.1 的「启动核查」只查一次不等待——如果需要更积极的行为（如 CI pending 时等待），需要后续批次处理。
3. evidence.ts 中仍有独立的 token 读取逻辑，可在后续批次统一为共用的 `readCiToken`。
4. 后续可考虑条目 12.2（队列）和 12.3（gating），属于 v03 的后续批次。

```json
{
  "schema_version": 1,
  "batch_id": "v03-b01",
  "head_sha": "7f876e8309f383148053a7c3bc7df81c3ee7733b",
  "claims": {
    "commits": [
      "5101f67",
      "49a3181",
      "7f876e8"
    ],
    "tests_passed": 695,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
