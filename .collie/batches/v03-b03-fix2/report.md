# 批次 v03-b03-fix2 汇报

## 做了什么

逐条对应 task.md 的三个条目：

**条目 1（两条缺失断言）：**
- `test/scenario-e.test.ts`：在 "attempt 2 referencing attempt 1 code commit is accepted" 用例中，使用 `git log --oneline --all` 找到 task（`docs: issue`）、progress（`progress:`）、`report(collie):` 三类提交的短 SHA，然后用三条独立的 `expect(progress).not.toContain(...)` 断言 commits_actual 不含它们。
- `test/scenario-f.test.ts`：在 "does not resume when last run pushed code and only report is missing" 用例中，断言 journal 里 `worker.resumed` 事件的 `session_id` 为 `null`（`expect(resumed[0]?.session_id).toBeNull()`）。

**条目 2（bash_deny 正反用例）：**
- 在 `test/runner-claude.test.ts` 新增 `describe('runner-claude: bash_deny positive/negative with repo toml patterns')` 区块，10 个用例：
  - 放行：`git merge-base --is-ancestor a b`、`git branch -v`、`git log --oneline`、`npm test`
  - 拒绝：`git merge x`、`git push origin main`、`git  push`（双空格）、`git branch -D x`、`git stash`、`gh api repos`
- 使用 `loadConfig(...)` 加载仓库 collie.toml 中的 `bash_deny` 正则（`(?=\s|$)` 而非 `\b`），确保测试的是实际部署的模式。

**条目 3（tool.denied 进 journal + 超时 + 不变量）：**
- `src/run.ts`：在 worker 的 `onEvent` 回调中识别 `event === 'tool.denied'`，调用 `rec.record('tool.denied', {role, tool, command, pattern})` 写入 journal。
- `src/cli.ts`：`collie show` 在中断链之后增加 `tool.denied (<count>)` 段落，列出每条被拒命令。
- `test/show.test.ts`：新增测试用例，FakeRunner 发出一条 `tool.denied` 事件，断言 journal 含该事件且 `collie show` 输出包含相应信息。
- `vitest.config.ts`：`testTimeout` 从 10_000 改为 30_000。
- `test/scenario-f.test.ts`：移除 `describe` 级别的 `{ timeout: 30_000 }`（现在全局已是 30s）。
- `test/invariants.test.ts`：新增两条不变量——`src/run.ts` 包含 `tool.denied`、`vitest.config.ts` 的 `testTimeout ≥ 30000`。

## 测试结果

```
$ npm run lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
> tsc -p tsconfig.json
(exit 0, no errors)

$ npm test
 Test Files  37 passed (37)
      Tests  765 passed (765)
   Duration  14.72s

$ for i in 1 2 3; do npm test || exit 1; done
Run 1: 765 passed, 17.37s
Run 2: 765 passed, 17.32s
Run 3: 765 passed, 19.66s
(all 3 runs exit 0)
```

全部 10 条验收命令逐一执行均 exit 0。

## 偏离或疑问

无。所有实现严格按照 task.md 条目要求。

## 下一步建议

本批次覆盖了 v03-b03 系列的所有遗留项。bash_deny 的实际模式已有正反覆盖，tool.denied 从 runner 到 journal 到 show 的全链路均有测试。建议后续批次可以进入 v0.1 收尾阶段。

```json
{
  "schema_version": 1,
  "batch_id": "v03-b03-fix2",
  "head_sha": "1e00841a218883edda64b4c5078e8a09dc7c2942",
  "claims": {
    "commits": ["1e00841a218883edda64b4c5078e8a09dc7c2942"],
    "tests_passed": 765,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
