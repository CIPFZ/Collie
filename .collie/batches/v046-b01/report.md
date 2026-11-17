# 批次 v046-b01 汇报

## 做了什么

**条目 1：新建 `test/support/template-config.ts`，7 个测试文件改用它**

- 新建 `test/support/template-config.ts`，导出 `templateConfig()` 函数。它读取 `templates/collie.toml`，把 `{{name}}` 替换为 `test-project`、`{{repo}}` 替换为 `https://github.com/test-org/test-project`，然后通过 `parseConfig` 解析返回 `CollieConfig` 对象。
- 修改了 7 个测试文件，将 `loadConfig(repoRoot)` / `loadConfig(join(import.meta.dirname, '..'))` 替换为 `templateConfig()`：
  - `test/cli.test.ts`：`init template` 测试改为验证模板填上值后能通过校验，不再和本仓库配置比较；`init derives the repo from an SSH origin` 中 `config.limits` 改为和 `templateConfig().limits` 比较。
  - `test/config.test.ts`：原来的 "config: the repository .collie/collie.toml" 组（6 条）保留所有数值断言不变，只把数据源从 `loadConfig(repoRoot)` 换成 `templateConfig()`，组名改为 "config: template config (SPEC 3.1 values)"；`project` 那条按 `templateConfig()` 的固定值断言。保留一条 `loadConfig(repoRoot)` 用例，只验证加载通过校验，不断言数值。`VALID_TOML` 的 project 名改为 `test-project` 以匹配模板配置。
  - `test/evidence.test.ts`：模块级 `config` 改为 `templateConfig()`。
  - `test/reviewer-isolation.test.ts`：模块级 `config` 改为 `templateConfig()`。
  - `test/reviewer.test.ts`：模块级 `config` 改为 `templateConfig()`；`maxTurns: 60` 改为 `config.agent.reviewer.max_turns`。
  - `test/runner-claude.test.ts`：模块级 `config` 改为 `templateConfig()`。
  - `test/worker.test.ts`：模块级 `config` 改为 `templateConfig()`。

**条目 2：`scripts/mutation.ts` 复制 `templates/` 而非 `.collie/`**

- `toCopy` 数组中 `'.collie'` 改为 `'templates'`。因为 `test/evidence.test.ts` 已改为读模板配置，临时副本不再需要本仓库的 `.collie/collie.toml`。

**条目 3：`test/invariants.test.ts` 新增守卫**

- 新增不变量：「`test/` 下的测试文件里，从仓库根加载配置的只有 `test/config.test.ts` 里的一处」。排除 `test/invariants.test.ts` 自身（因其字符串字面量包含 `loadConfig` 模式）。

## 测试结果

```
npm run lint       → exit 0
npm run typecheck  → exit 0
npm test           → exit 0, 60 test files, 1186 tests passed, 0 failed
```

7 个修改过的测试文件单独运行：7 passed, 205 tests passed。
变异检查：caught 42, survived 0, invalid 0, timeout 0, stale 0。

## 偏离或疑问

改写的旧用例清单（条目 3 要求逐条列出）：

1. **`test/config.test.ts`** — 组 "config: the repository .collie/collie.toml" 重命名为 "config: template config (SPEC 3.1 values)"（6 条）：
   - `has schema_version 1 and the project section`：原断言 `config.project` 等于 `{ name: 'collie', repo: 'https://github.com/CIPFZ/Collie' }`，现断言等于 `{ name: 'test-project', repo: 'https://github.com/test-org/test-project' }`。原因：数据源从本仓库配置换成模板配置，project 值对应变化。
   - `has the worker agent of SPEC 3.1`、`has the reviewer agent of SPEC 3.1, without Write/Edit`、`has the limits of SPEC 3.1`、`has the verify commands and CI section of SPEC 3.1`：数据源换成 `templateConfig()`，所有数值断言一字不改。
   - `equals the inline SPEC 3.1 fixture used by the error tests`：数据源从 `loadConfig(repoRoot)` 换成 `templateConfig()`，`VALID_TOML` 的 project 值相应更新为 `test-project`。
2. **新增** "config: the repository .collie/collie.toml"（1 条）：只验证 `loadConfig(repoRoot)` 能通过校验且 schema_version 为 1，不断言数值。
3. **`test/cli.test.ts`** — `renders to exactly the SPEC 3.1 config the repository uses (no drift)`：原断言 `parseConfig(text, 'template')` 等于 `loadConfig(repoRoot)`，现改为 `expect(() => parseConfig(text, 'template')).not.toThrow()`，用例名改为 "template with name and repo passes schema validation"。原因：测试不再需要模板和本仓库配置一一对应，只需验证模板有效。
4. **`test/cli.test.ts`** — `init derives the repo from an SSH origin…`：`config.limits` 原来和 `loadConfig(repoRoot).limits` 比较，现改为和 `templateConfig().limits` 比较。
5. **`test/reviewer.test.ts`** — `launches role reviewer in root with the configured turns`：`maxTurns: 60` 改为 `config.agent.reviewer.max_turns`。原因：不再硬编码数值，取所用配置对象里的值。

无其他偏离。

## 下一步建议

本批次工作已完成。后续可以自由调整 `.collie/collie.toml` 中的运行阈值（如 `max_turns`、`wallclock_secs`）而不影响测试结果。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b01",
  "head_sha": "f4819c6c647d1e28fcda791ecbb210703ccbf689",
  "claims": {
    "commits": ["f4819c6c647d1e28fcda791ecbb210703ccbf689"],
    "tests_passed": 1186,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
