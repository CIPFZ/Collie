# 批次 v01-b05-smoke 汇报

## 做了什么

1. **在 README.md 末尾追加一行**：`Collie 用 Collie 跑过的第一个批次：v01-b05-smoke`
   - 在文件最后一行（"永不做"段落结尾）之后，空一行追加该行
   - 使用 Edit 工具精确追加，未触碰其他内容
   - 提交信息：`docs: append first Collie-run batch marker to README`
   - 提交后立即推送至 origin/main

## 测试结果

验收标准逐项核实：

| 说明 | 命令 | 结果 |
|---|---|---|
| README 已追加该行 | `grep -q "第一个批次：v01-b05-smoke" README.md` | exit 0 ✓ |
| 只改了 README | `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"` | exit 0 ✓ |
| CI 实际触发并通过 | GitHub Actions run #50, commit b75aa31, branch main | success ✓ |
| 全部测试通过 | `npm test` | exit 1（66 failed / 434 passed）⚠ 见下 |

`npm test` 在 base_sha `02e79d7`（本批次变更之前）已经同样 66 failed / 434 passed。
失败均为 `TypeError: Cannot read properties of undefined (reading 'dispose')` ——
`box.dispose()` 在 `afterEach` 中触发，涉及 test/exit-codes.test.ts、test/scenario-a.test.ts、
test/scenario-b.test.ts、test/scenario-c.test.ts、test/cli.test.ts、test/evidence.test.ts、test/git.test.ts。
这是 **pre-existing** 的失败，不是本批次引入的。

lint（eslint + prettier）和 typecheck（tsc）均通过，exit 0。
CI workflow 的 `verify` job 通过（45 秒），说明 CI 配置可能只运行 lint + typecheck 而非完整 npm test。

## 偏离或疑问

1. **验收标准「npm test exit 0」无法达成**：这 66 个测试在 base commit 就已失败，
   且本批次明确禁止改动 README 以外的任何文件，因此无法修复。
   这不是本批次引入的回归。CI 已确认绿（CI 的 verify job 通过）。
2. **无 `gh` CLI 且 GitHub API 被 rate limit（403）**：通过 WebFetch 抓取 GitHub Actions 页面
   确认了 CI 状态。这是 progress.md 中已知的问题。
3. **scope 选择**：提交信息用 `docs` 作为 scope，因为改动的是 README.md 文档文件。
   CONSTRAINTS.md 铁律 20 的 scope 列表中 `docs` 是合法取值。

## 下一步建议

1. **修复 66 个 pre-existing 测试失败**：这些失败均源于 `box` 变量在 `afterEach` 中为 undefined。
   应在下一个正式批次中优先解决，否则 `npm test` exit 0 的验收标准将持续无法满足。
2. **配置 GitHub token**：解决 `gh` CLI 和 API rate limit 问题，让后续批次能可靠地查询 CI 状态。

```json
{
  "schema_version": 1,
  "batch_id": "v01-b05-smoke",
  "head_sha": "b75aa31f1d9e9e24ccf1d78ec319ea81d0283bfa",
  "claims": {
    "commits": ["b75aa31f1d9e9e24ccf1d78ec319ea81d0283bfa"],
    "tests_passed": 434,
    "tests_failed": 66,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": [
    "66 个测试在 base commit 即失败（pre-existing），本批次禁止改 README 以外文件，无法修复"
  ]
}
```
