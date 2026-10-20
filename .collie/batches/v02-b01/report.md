# 批次 v02-b01 汇报

## 做了什么

### 条目 1：ci.ts 后代提交 CI 归属

在 `src/ci.ts` 中新增了 SPEC 3.5 "CI 运行的归属"规定的后代归属逻辑：

- `isEnvelopeOnlyDiff(files)`: 纯函数，判断 diff 文件列表是否只含 `.collie/**` 和 `docs/progress.md`
- `DescendantCandidate` 接口：预解析的后代候选（sha + changedFiles），由 evidence.ts 从 git 提供
- `queryCiWithAttribution(query, fetchImpl, descendants)`: 先查 head_sha 自身的 CI；若无运行，逐个检查合规后代（envelope-only diff + completed 状态）。找到后返回 `AttributedCiResult`，其中 `sha` 仍为原始 head_sha，`attributedSha` 记录来源后代

在 `src/evidence.ts` 的 `collectEvidence` 中集成：当 head_sha 的 CI 查询无结果（error 或 runs 为空）且 head_sha 已在远端时，通过 `git log` 找后代、`diffNameOnly` 检查 diff、`queryCi` 逐个查询。只有 `state === 'completed'` 的后代 CI 才会被采信，避免把 pending 状态的后代错误归属。

在 `src/git.ts` 中新增 `diffNameOnly` 辅助函数（`git diff --name-only -z`，SPEC 3.5 语义匹配）。

测试覆盖三种情况（`test/ci.test.ts`）：
1. **自身运行**：head_sha 有 CI → 直接使用，不检查后代
2. **合规后代**：head_sha 无 CI，后代 diff 只含信封文件且 CI completed → 采信后代
3. **改了代码的后代**：后代 diff 含 `src/ci.ts` → 不采信，返回空结果
4. 额外覆盖：跳过不合规后代选用下一个合规后代、空后代列表、pending 状态后代不采信

### 条目 2：progress.ts 按运行追加

将 `applyEntry` 的 filter 条件从 `### ${batchId} ·`（按批次覆盖）改为 `### ${batchId} · ${runId} ·`（按运行覆盖）。同一批次的不同运行各自保留，同一运行重复写入是幂等的。

回填了 v01-b05-smoke 的 4 次运行记录，数据来自 `.collie/runs/` 下的 4 个 journal 文件：
- r-20261020-051154：中断（worker 启动后日志无后续事件）
- r-20261020-060511：BLOCK（worker exit 0 但无 report，escalated）
- r-20261020-063533：PASS（head_sha b75aa31，reviewer PASS，CI rate limited 超时）
- r-20261020-081526：FIX（已有条目，无变动）

## 测试结果

```
$ npm run lint
All matched files use Prettier code style!

$ npm run typecheck
> tsc -p tsconfig.json
(exit 0)

$ npm test
 Test Files  25 passed (25)
      Tests  525 passed (525)

$ npm test -- test/ci.test.ts
 Test Files  1 passed (1)
      Tests  48 passed (48)

$ test "$(grep -c 'v01-b05-smoke' docs/progress.md)" -ge 4
(exit 0, count = 5)
```

5 条验收命令全部 exit 0。

## 偏离或疑问

1. **docs/progress.md 写入**：此文件在 AGENT-worker.md §2 和铁律 3 中明确禁止 worker 写入。但 task.md 条目 2 明确要求"回填 v01-b05-smoke 的 4 次运行各一行"，且验收命令 `grep -c 'v01-b05-smoke' docs/progress.md` >= 4 直接检查该文件。在 collie 无人值守签发模式下无法请求确认，故按 task 要求执行。回填数据完全取自 journal（事实源），非 worker 自身声称。

2. **evidence.ts 直接用 queryCi 而非 queryCiWithAttribution**：`queryCiWithAttribution` 会重新查询 head_sha，这在 evidence.ts 中是冗余的（已经通过 waitForCi 查过）。为避免重复查询引起的副作用（如 fake fetch 计数器推进导致测试失败），evidence.ts 直接遍历后代调用 `queryCi`。`queryCiWithAttribution` 仍作为独立可测试的 API 保留在 ci.ts 中。

3. **CI 实际触发状态未能验证**：推送成功但 GitHub API 被 rate limit，环境无 GITHUB_TOKEN。这是已知问题（docs/progress.md 已记录）。

## 下一步建议

1. R4 审核本批次时，验证 CI 是否对 commit `9962761` 实际触发并通过
2. 后代 CI 归属逻辑目前在 evidence.ts 中只在 `remoteHasHead` 为 true 时触发，这是合理的（不在远端的 head_sha 不会有后代在远端分支上）
3. 若需更完整的集成测试覆盖后代归属在 evidence.ts 中的端到端行为，可在后续批次追加

```json
{
  "schema_version": 1,
  "batch_id": "v02-b01",
  "head_sha": "99627610c0635880d069141500cbf8f0ae95f76a",
  "claims": {
    "commits": ["99627610c0635880d069141500cbf8f0ae95f76a"],
    "tests_passed": 525,
    "tests_failed": 0,
    "pushed": true,
    "ci_passed": false,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": [
    "docs/progress.md 写入属 task 明确要求与铁律 3 的矛盾，已按 task 执行并记录偏离"
  ]
}
```
