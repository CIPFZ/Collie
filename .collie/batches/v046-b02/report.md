# 批次 v046-b02 汇报

## 做了什么

逐条对应 task.md 的三个条目：

1. **角色与配置**：
   - `src/runner/index.ts` 的 `AgentRole` 加了 `'tester'`
   - `src/schema/index.ts` 新增 `TesterAgentConfigSchema`，结构与 `ReviewerAgentConfigSchema` 相同（含 `bash_deny`）；抽取了共用的 `BashDenyField` 避免重复代码；`CollieConfigSchema` 的 `agent` 段加了可选的 `tester` 字段
   - `templates/collie.toml` 新增 `[agent.tester]` 段：`model = "claude-opus-4-6"`、六个工具（含 Write/Edit）、`max_turns = 100`、`permission_mode = "bypassPermissions"`、`bash_deny` 与 reviewer 相同
   - 本仓库的 `.collie/collie.toml` 未改动（task 明确禁止）

2. **`src/runner/claude.ts` 改造**：
   - 角色查找从 worker/reviewer 二分改为 switch，tester 从 `agent.tester` 取配置；配置缺失时抛出点名 `[agent.tester]` 的错误
   - `bash_deny` 钩子对 tester 同样生效（reviewer 和 tester 共用同一路径）
   - reviewer 专有的 `disallowedTools`（Write/Edit/MultiEdit/NotebookEdit）不套到 tester 上
   - worker 和 reviewer 的行为完全不变

3. **`src/roles/tester.ts` 新文件**：
   - 导出 `TESTER_MANUAL`（值 `'AGENT-tester.md'`）
   - 导出 `TesterInputSchema`：严格对象，只有 `batch_id`、`items`、`spec_paths`、`out_dir` 四个字段
   - 导出 `buildTesterPrompt(input)`：提示词包含批次号、条目原文、SPEC 路径、输出目录与三个文件名、两条 vitest 自检命令
   - 导出 `runTester(runner, cfg, input, cwd)`：以角色 `tester`、`agent.tester` 的白名单与轮数、`AGENT-tester.md` 作系统提示词拉起；配置缺失时抛 `TesterError` 点名 `[agent.tester]`
   - `test/tester.test.ts`：15 个用例，覆盖常量、schema 验证（4 个含额外字段拒绝）、提示词构建（5 个）、runTester 运行（3 个含缺失配置）、源码不含 report.md（1 个）
   - `test/runner-claude.test.ts`：新增 5 个用例覆盖 tester 的配置取用、无 disallowedTools、bash_deny 拦截、Write/Edit 在工具清单里、缺失配置报错
   - `test/config.test.ts`：`VALID_TOML` 内联配置加了 tester 段（断言不变，task 允许的唯一改写处）；新增两条用例：「有 tester 段」和「没有 tester 段的配置能加载」
   - `test/invariants.test.ts`：新增「`src/roles/tester.ts` 源码里不出现 `report.md`」

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
All matched files use Prettier code style!  → exit 0

$ npm run typecheck
tsc -p tsconfig.json  → exit 0

$ npm test
Test Files  61 passed (61)
     Tests  1219 passed (1219)
  Duration  21.19s  → exit 0

$ npm test -- test/tester.test.ts test/config.test.ts test/runner-claude.test.ts
Test Files  3 passed (3)
     Tests  124 passed (124)  → exit 0
```

## 偏离或疑问

- `test/config.test.ts` 的 `equals the inline SPEC 3.1 fixture used by the error tests` 所用的内联配置 `VALID_TOML` 被改写，加上了 `[agent.tester]` 段（task 点名允许的唯一改写处）。断言本身不变：仍然比较 `parseConfig(VALID_TOML, 'inline.toml')` 与 `templateConfig()` 的相等性。
- `src/schema/index.ts` 中抽取了 `BashDenyField` 变量以避免 reviewer 和 tester 之间的代码重复。`ReviewerAgentConfigSchema` 的行为完全不变（同一个 zod schema 对象）。

## 下一步建议

- v046-b03（红检查模块 `src/redcheck.ts`）可在此基础上实现，它依赖 vitest 的 JSON 报告格式
- 本仓库的 `.collie/collie.toml` 在包含此批次的版本成为固定版本后由 R1 加 `[agent.tester]` 段
- v046-b04 将测试 agent 接进队列（尚未签发），需要先确定条目里「情形」的写法和 FIX 重跑策略

```json
{
  "schema_version": 1,
  "batch_id": "v046-b02",
  "head_sha": "4450833b558d9d88eb64a8d8e102cc74055d8ae6",
  "claims": {
    "commits": ["4450833b558d9d88eb64a8d8e102cc74055d8ae6"],
    "tests_passed": 1219,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
