# 批次 v04-b06 汇报

## 做了什么

### 条目 1：token 文件读取整合 + 启动失败

- 在 `src/run.ts` 中新增 `expandTokenPath()` 和 `readCiTokenChecked()` 两个导出函数，将 token 读取逻辑收归一处。`readCiTokenChecked` 在配置了 `ci.token_file` 但文件不存在、不可读或去空白后为空时抛 Error，错误信息包含 `ci.token_file`、展开后的绝对路径和原因。
- 原 `readCiToken()` 保留为内部函数，内部调用 `readCiTokenChecked` 并吞掉异常（供 evidence 取证路径使用——取证路径已有自己的容错，不需要 fail-fast）。
- `src/evidence.ts` 的 `collectEvidence` 不再自行读 token 文件，改为通过 `EvidenceInput.ciToken` 接收预解析好的 token。移除了 evidence.ts 对 `node:os` homedir 和 `readFileSync` 的直接使用。
- `src/cli.ts` 的 `run()`（单批次模式）和 `runContinue()`（--continue 模式）在调用 `runBatch`/`runQueue` 前用 `readCiTokenChecked` 检查 token 文件，失败则 stderr 一行 + exit 1，不签发 task、不拉起 worker。
- 沙盒 (`test/support/sandbox.ts`) 的配置去掉了 `token_file`（替换为注释行），确保测试不依赖真实 home 目录。`test/evidence.test.ts` 中两个 token 测试改为通过 `ciToken` 参数传入 token 值。

### 条目 2：`collie smoke` CI 查询

- `smoke()` 函数重构：先加载配置，用 `readCiTokenChecked` 检查 token 文件（失败 → exit 1，不花模型费用），再调用 runner，runner 成功后用 token 对当前 `HEAD` 调一次 `queryCi`：
  - 请求成功 → stdout 输出 `ci ok`
  - 请求失败（网络/认证/限流）→ stderr 输出原因 + exit 1
  - 没有配置 `token_file` 时跳过 CI 查询（行为不变）
- 报错/输出中不出现 token 内容（queryCi 的错误信息本身不含 token；stderr 只显示异常 message）。

### 条目 3：证据取不到 → evidence_unavailable

- 在 `src/run.ts` 的仲裁后逻辑中，当 rule 9（RULE_EVIDENCE_MISSING）被触发且存在以下任一环境故障时，在 `verdict.downgraded` 事件上追加 `cause: "evidence_unavailable"` 和 `detail`（截断至 300 字）：
  1. `collected.remoteError`（git fetch 失败）
  2. `collected.ci` 含 `error`（CI 查询 HTTP/网络/限流/JSON 错误）
  3. `collected.ciWait?.lastState === 'rate_limited'`（等待期间最后一次轮询是限流）
- `RunOutcome` 新增可选字段 `evidenceUnavailableCause`，单批次模式在总结行尾部追加 `[evidence_unavailable: ...]`。
- `runQueue` 中 FIX 分支增加 evidence_unavailable 判定：不重跑、不计 fix_max、不改 backlog 状态，记 `escalated`（reason=evidence_unavailable）和 `queue.finished`（reason=evidence_unavailable），stderr 输出 detail，返回 exit 20。
- 对照情况（CI failure/no_runs/pending/未推送/分支不符）不触发 cause，仍按普通 FIX 处理。

### 测试

- 新建 `test/scenario-m.test.ts`（6 个 `it` 用例）：
  1. token 文件缺失 → `collie run` exit 1，无 task 签发
  2. 限流 → 单批次 FIX + verdict.downgraded 带 cause
  3. `--continue` + 限流 → 一次运行后停止，backlog 仍 pending，exit 20
  4. CI failure（非环境故障）→ 正常 FIX 重跑至 fix_max
  5. smoke + token 文件缺失 → exit 1，stderr 含 token_file
  6. smoke + CI 查询网络错误 → runner 成功后 exit 1
- `test/invariants.test.ts` 新增 `src/run.ts contains evidence_unavailable` 不变量。

## 测试结果

```
npm run lint    → exit 0 (eslint + prettier all clean)
npm run typecheck → exit 0 (tsc strict)
npm test        → 44 files, 882 tests passed, 0 failed (13.5s)
npm test -- test/scenario-m.test.ts        → 6 passed
HOME=$(mktemp -d) npm test -- test/scenario-m.test.ts → 6 passed
grep -cE "^\s+it\(" test/scenario-m.test.ts → 6 (≥6 ✓)
```

## 偏离或疑问

无。所有验收命令均已通过。

## 下一步建议

- `collie smoke` 的 CI 查询目前只在有 `token_file` 时触发。如果将来希望支持无 token 的匿名查询（受限于 GitHub 60 次/小时配额），需要在 SPEC 中明确决策。
- evidence_unavailable 路径的队列日志事件类型用的是现有的 `escalated` 和 `queue.finished`（带 reason 字段区分），没有新增事件类型。如果需要单独的事件类型，需 SPEC 变更。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b06",
  "head_sha": "e54af6e",
  "claims": {
    "commits": ["01f4fc6", "e54af6e"],
    "tests_passed": 882,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
