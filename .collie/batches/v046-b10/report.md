# 批次 v046-b10 汇报

## 做了什么

**条目 1：返回值加 `reports` 和 `reason`，misclassified 提前退出。**
- `AcceptanceOk` 和 `AcceptanceFail` 都加了 `reports: string[]`，记录每次拉起测试 agent 的 `finalText`，没有的用空串。
- `AcceptanceFail` 加了 `reason: AcceptanceFailReason`，三种取值：`red_check`、`tester_failed`、`misclassified`。
- 新增 `extractMisclassified(text)` 辅助函数：从回复的最后一个 JSON 围栏块里提取 `misclassified` 字段。非空数组时返回它，否则返回 `undefined`。
- 红检查没过时检查 misclassified：非空 → 立即返回 `{ ok: false, reason: 'misclassified', ... }`，不再重拉。
- JSON 解析失败、没有围栏块、没有 misclassified 字段、空数组，都按没有声明处理，照常重拉。

**条目 2：CONSTRAINTS.md、worktree 清理、退出码进 previousProblems。**
- `spec_paths` 从 `['SPEC.md']` 改成 `['SPEC.md', 'CONSTRAINTS.md']`。
- `addWorktree` 失败时，在 catch 里调 `removeWorktree`（如果也失败，再 `rmSync`），然后 rethrow。保证 `git worktree list` 干净、私有临时目录里没有残留。
- 测试 agent 以非零退出时，把 `tester exited with code <N>` 追加进 `previousProblems`，下一次拉起时提示词里有这条。

**条目 3：测试。**
- 新增 `describe('prepareAcceptance: reports and early stop', …)` 共 9 条用例，覆盖：
  - misclassified 非空 → 只拉起 1 次，reason=misclassified，reports 有 1 条
  - 没有 JSON 块 → 照常重拉（2 次）
  - 成功时 reports 长度等于拉起次数
  - 三种 reason 各一条（red_check、tester_failed、misclassified）
  - misclassified 是空数组 → 照常重拉
  - 非零退出后第 2 次提示词包含退出码
  - 提示词包含 SPEC.md 和 CONSTRAINTS.md
  - 建工作目录失败（不存在的 headSha）→ 抛错，worktree list 只有 1 行，私有临时目录无残留
- `test/invariants.test.ts` 加了 `src/acceptance.ts` 里有 `misclassified` 的检查。
- 已有用例一条都没有改动。

## 测试结果

```
npm run lint     → exit 0
npm run typecheck → exit 0
npm test         → 64 test files passed, 1327 tests passed (0 failed)

# 无 git 全局身份：
GIT_CONFIG_GLOBAL=$(mktemp) GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts
  → 1 test file passed, 19 tests passed
```

所有验收命令均通过。

## 偏离或疑问

无

## 下一步建议

- v046-b11（R2 两处诊断信息）可以签发。
- 之后就是接线批次：把 `prepareAcceptance` 接进 `src/run.ts` 的队列流程里。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b10",
  "head_sha": "41dd2bdb0183a5e044818961a35c6fca2a968324",
  "claims": {
    "commits": ["41dd2bd"],
    "tests_passed": 1327,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
