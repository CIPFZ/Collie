# 批次 v046-b43 汇报

## 做了什么

本批次第 3 次运行。前两次已完成条目 1（`src/run.ts` 先取证再审核、`reviewer.skipped` 事件）、条目 2 的 (a)(b)(c) 大部分改动、条目 3（不变量测试）。

本次修了 R2 指出的唯一缺口：

**`test/exit-codes.test.ts` 第 413 行 `reviewer.stream.ndjson masks secrets with redact`：**
该测试用 `writeFileSync` 修改了 `.collie/collie.toml`（添加 `token_file`）和写入 `.collie/github-token`，但没有提交这些变更。`workerScene` 的 `git add -A` 把它们带进了代码提交，导致 `collectEvidence` 检测到 `spec_diff_lines > 0` → 规则 2 → 预仲裁 BLOCK → reviewer 被跳过 → 没有 `reviewer.stream.ndjson` 文件。

修法：在 `workerScene` 之前用 `box.commitAll` + `git push` 把配置变更提交到 base（与 `addFailScript` 的做法相同），使预仲裁不会看到 `collie.toml` 的改动，reviewer 正常运行。同时恢复了上一轮误删的注释 `// The secret should be masked by the redact mechanism.`。

这属于条目 2 的 (b) 类改动：测试 setup 因新行为（SPEC 16.29 预仲裁）使得 reviewer 不再被调用，需要调整 setup 使预仲裁仍给 PASS。

## 测试结果

```
npm run lint       → exit 0
npm run typecheck  → exit 0
npm test           → exit 0 (88 test files passed, 1599 tests passed)
npm test -- test/acceptance/v046-b43 → exit 0 (2 files, 8 tests)
npm run test:mutation → caught 47 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

本次改动的测试用例（条目 2 的 (b) 类）：
- `test/exit-codes.test.ts`: `reviewer.stream.ndjson masks secrets with redact (SPEC 12.1)` — setup 增加了 `box.commitAll('chore: add token_file for redact test')` + `git push` 以提交 collie.toml 和 token 文件的变更到 base，使预仲裁不检测到受保护路径改动，reviewer 仍被调用。恢复了上一轮误删的注释 `// The secret should be masked by the redact mechanism.`。新增了 `import { git } from '../src/git.js'`（push 需要）。断言本身未改（仍检查 streamContent 不含 secret 且含 `***`）。

上一轮误删的注释已恢复（gap 第 2 条指出不属于三类改动之一）。

前两轮已做的完整改动列表（已在审核范围内，不重做）见上一轮汇报。

## 下一步建议

本批次所有条目已实现并通过全部验收。建议继续推进 SPEC 16.29 第 2 批（reviewer 输入输出改造）。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b43",
  "head_sha": "ffada9a247ee3e047b69d9ea7f6d15b48f302713",
  "claims": {
    "commits": ["ffada9a"],
    "tests_passed": 1599,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
