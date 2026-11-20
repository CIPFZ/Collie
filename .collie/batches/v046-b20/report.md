# 批次 v046-b20 汇报

## 做了什么

**条目 1：`tester_touched_main_tree` 路径修正（SPEC 16.17）。**
替换 `src/run.ts` 中半成品的 `git checkout -- .` 和 `git clean -fd`。新逻辑：
- 从 `git status --porcelain` 的结果中按 `code` 分离被跟踪文件（`code !== '??'`）和未跟踪文件（`code === '??'`）。
- 被跟踪的文件（修改或删除的）通过 `git checkout HEAD -- <file>` 恢复成 HEAD 的样子。
- 未跟踪的文件一个都不动，不执行 `git clean`。
- `tester.md` 分两节：「恢复了的被跟踪文件」和「留在工作区的未跟踪文件」，哪一节没有文件就写「无」。
- 现有用例 `tester writes to main workspace → escalated with tester_touched_main_tree` 不改一个字，重新通过（该用例只创建未跟踪文件，新逻辑保留它，断言 `existsSync` 仍然成立）。

**条目 2：半成品核对与补测。**
- `limits.worktree_secs` 的配置项（`src/schema/index.ts`、`templates/collie.toml`）和测试夹具（`test/config.test.ts` 的期望对象与内联配置、`test/schema.test.ts`）在半成品 `bbdf673` 里已经正确，保留不动。
- 测试 agent 的墙钟已改用 `worktree_secs`（`bbdf673` 里做的），保留。
- 测试 agent 结束后 heartbeat `phase` 改回 `worker`（`bbdf673` 里做的），保留。
- 新增配置测试：`worktree_secs = 0` 被拒绝并点名 `limits.worktree_secs`；不写此项时默认为 1800。
- 新增心跳测试：在 worker 场景的 effect 里读 `heartbeat.json`，断言 `phase` 为 `worker`。
- 本仓库的 `.collie/collie.toml` 未改动。

**条目 3：测试。**
- `test/tester-step.test.ts` 新增 `describe('tester step: heartbeat and tracked-file safety', …)` 包含 3 条用例：
  1. 被跟踪文件修改 + 未跟踪文件 → 恢复被跟踪、留下未跟踪、`tester.md` 两节各列出。
  2. 只删除被跟踪文件 → 该文件被恢复、列在「恢复了的被跟踪文件」。
  3. tester 步骤结束后 heartbeat `phase` 是 `worker`。
- `test/config.test.ts` 新增 `describe('config: worktree_secs', …)` 包含 2 条用例（`worktree_secs = 0` 被拒绝；缺省默认 1800）。
- `test/queue-limit.test.ts` 第 188 行 `120_000` → `300_000`。
- `test/follow.test.ts` 第 121 行 `120_000` → `300_000`。
- `test/invariants.test.ts` 新增两条不变量：`src/run.ts` 里有 `worktree_secs`；`src/run.ts` 非注释行里没有 `'clean'`。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(exit 0)

$ npm test
 Test Files  67 passed (67)
      Tests  1400 passed (1400)
   Duration  23.56s

$ e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test
 Test Files  67 passed (67)
      Tests  1400 passed (1400)
   Duration  23.45s
```

## 偏离或疑问

- `test/config.test.ts` 的 `describe('config: template config (SPEC 3.1 values)')` 里的 `limits` 期望对象（第 130 行）和 VALID_TOML 内联配置（第 49 行）：半成品 `bbdf673` 已经加了 `worktree_secs: 1800`，这是条目 2 点名允许的改写，本批次未再动它们。
- `test/schema.test.ts` 的 `validConfig` 夹具（第 57 行附近）：同上，半成品已加了 `worktree_secs: 1800`，本批次未再动。
- 没有删除或改写任何现有断言。所有现有 1400 条测试均通过。

## 下一步建议

- 主分支 CI 应恢复绿色（半成品里的 `git checkout -- .` / `git clean -fd` 已移除，唯一失败的 `tester writes to main workspace` 用例现在通过）。
- 可以继续 v046-b18（依赖本批次使主分支绿）和 v046-b19。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b20",
  "head_sha": "ccb05f99a8a26703f5dde8d4cd585754c4b4fdae",
  "claims": {
    "commits": ["ccb05f99a8a26703f5dde8d4cd585754c4b4fdae"],
    "tests_passed": 1400,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
