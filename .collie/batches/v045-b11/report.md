# 批次 v045-b11 汇报

## 做了什么

### 条目 1：同步失败要通知（SPEC 14.15 第 1 条）

在 `src/follow.ts` 中：

- 在 `FollowJson` 接口中新增可选字段 `syncFailures?: number`，用于持久化连续同步失败的计数。
- 新增常量 `SYNC_FAILURE_THRESHOLD = 3`（带 SPEC 14.15 注释和 eslint-disable）。
- 修改 `SyncResult` 接口，增加 `syncFailed: boolean` 字段。
- 修改 `syncWithRemote` 函数：
  - 在 `git fetch` 失败时设置 `syncFailed = true`。
  - 当本地落后（需要拉取）且 `git pull --ff-only` 失败时返回 `syncFailed: true`。
  - 所有返回路径都携带 `syncFailed` 状态。
- 在主循环中（sync 之后、读 next.md 之前）：
  - 若 `syncFailed`：递增 `syncFailures`，达到 3 且未通知过时发送 `[Collie] git pull 连续失败`（键 `pull`）。
  - 若 `!syncFailed`：清零 `syncFailures` 并从已通知列表中移除 `pull` 键（让下次连续失败能再次通知）。

### 条目 2：汇报没提交成（SPEC 14.15 第 2 条）

在 `executeRun` 函数中：

- 提交操作之后，用 `git status --porcelain -- <汇报文件>` 检查提交是否成功。
- 若文件仍在暂存区（输出不为空），说明提交失败：
  - 不设置 `pendingReport`，避免后续发送"到对话里说「看」"通知。
  - 以键 `commit:<qRunId>` 立即发送通知，文本包含"汇报没能提交"、队列号和退出码，不含"到对话里说"。
  - 基准照样标记为已处理（`handled: true`），队列不重跑。

### 条目 3：测试

**新增测试 3 条：**

1. **测试 31**：远端不可达 5 圈（1 条 `git pull 连续失败` 通知出现在第 3 圈）→ 恢复远端走 1 圈（`syncFailures` 清零）→ 再让远端不可达 3 圈（第 2 条通知），共 2 条。每阶段都断言了实际圈数。
2. **测试 32**：本地落后，快进被未跟踪的同名文件挡住 3 圈，1 条 `git pull 连续失败`。断言了 3 圈。
3. **测试 33**：用 pre-commit 钩子（`exit 1`）让汇报提交失败，走 3 圈：`run --continue` 只起 1 次，通知 1 条（含"汇报没能提交"，不含"到对话里说"），`pendingReport` 为 undefined，`handledBase` 已设置。断言了 3 圈。

**改写旧用例 2 条：**

1. **测试 20**（注释 `// 20. SPEC 14.9 item 2`）：从"broken remote 4 cycles → no crash"改为断言 `git pull 连续失败` 通知恰好 1 条。
2. **测试 22**（"队列期间远端多一个提交"）：从两个 `once: true` 调用改为 `timeoutSecs` 驱动的 4 圈循环，在 sleep 中注入远端额外提交，增加了 `expect(sleepCount).toBe(CYCLES)` 圈数断言。

**不变量：** 在 `test/invariants.test.ts` 中添加 `src/follow.ts` 含 `syncFailures` 的检查。

## 测试结果

```
$ npm run lint
eslint . && prettier --check . → exit 0

$ npm run typecheck
tsc -p tsconfig.json → exit 0

$ npm test
Test Files  58 passed (58)
Tests  1144 passed (1144)

$ npm test -- test/follow.test.ts
Test Files  1 passed (1)
Tests  33 passed (33)
```

## 偏离或疑问

1. **测试 20**（`// 20. SPEC 14.9 item 2`）：原断言 `endNotifs.length === 0`（只验 queue-end notification 为 0）；现断言 `pullNotifs.length === 1`（`git pull 连续失败` 恰好 1 条）+ `endNotifs.length === 0`（queue-end 仍为 0）。原因：v045-b08 删掉了同步失败通知，本批次补回，该用例需要验证通知确实发出。
2. **测试 22**（"remote extra commit during queue → rebase"）：原来用两个 `follow({ once: true })` 调用；现改为一个 `timeoutSecs` 驱动的 4 圈循环，在 sleep 回调中注入远端额外提交。原断言（remote log 含 ops: report queue 和 extra commit、local == remote、diverged 通知为 0）全部保留，新增 `sleepCount === 4` 圈数断言。用例名从 "no diverged notification" 改为 "no diverged notification, 4 cycles"。
3. `SYNC_FAILURE_THRESHOLD = 3` 硬编码在代码中（带 `eslint-disable` 和 SPEC 14.15 注释），与现有 `BACKOFF_INITIAL_MS`、`SPAWN_TAIL_LINES` 等常量处理方式一致。本批次不允许改 `.collie/collie.toml`，但铁律 11 要求阈值集中。若需要后续迁移到 collie.toml，请 R1 评估。

## 下一步建议

- 本批次的 3 个条目全部完成，可进入审核。
- 后续可以考虑将 `SYNC_FAILURE_THRESHOLD` 迁移到 `collie.toml` 以满足铁律 11 的集中管理要求。
- `follow` 功能现在同步失败通知和提交失败通知都已补全，可以准备 `follow` 的首次真实运行。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b11",
  "head_sha": "613b95cb7684f5e1ddaf4362813b7cc8f7b32367",
  "claims": {
    "commits": ["47dac0748998c4804c87f555a36e5dd561fa08ee", "613b95cb7684f5e1ddaf4362813b7cc8f7b32367"],
    "tests_passed": 1144,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
