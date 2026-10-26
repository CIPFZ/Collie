# 批次 v03-b02 汇报

## 做了什么

**条目 1：`claude.ts` 工具白名单与 disallowedTools**

在 `ClaudeRunner.run()` 中，`queryOptions` 现在同传 `tools: [...opts.allowedTools]` 和 `allowedTools: [...opts.allowedTools]`，前者限制 SDK 可用工具集，后者绕过权限提示。reviewer 角色额外传 `disallowedTools: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']`，物理阻止写工具。`ClaudeQueryOptions` 的 Pick 类型新增 `tools`、`disallowedTools`、`hooks` 三个字段，均来自 SDK 的 `Options` 类型。

测试（`test/runner-claude.test.ts`）断言注入的 `query()` 收到的 `options.tools` 等于白名单、reviewer 的 `options.disallowedTools` 包含 Write 和 Edit、worker 的不含 `disallowedTools`。共 4 个新测试。

**条目 2：reviewer Bash 黑名单**

`src/schema/index.ts` 中 `ReviewerAgentConfigSchema` 新增 `bash_deny: string[]`（可选，默认空数组，解析时用 `new RegExp` 校验正则合法性）。`CollieConfigSchema` 的 `agent.reviewer` 使用新 schema。

`claude.ts` 中 runner 为 reviewer 注册 `hooks.PreToolUse`（matcher `Bash`），命令匹配任一 bash_deny 正则即返回 `permissionDecision: 'deny'`，并通过 `opts.onEvent` 追加 `tool.denied` 事件（含 role、tool、command、pattern 字段）。bash_deny 为空或角色非 reviewer 时不注册钩子。

事件类型 `tool.denied` 加入 `EVENT_TYPES`（共 26 个）。

测试（`test/runner-claude.test.ts`）6 个新测试：有 bash_deny 时存在 hooks、worker 不注册、空 bash_deny 不注册、`git push origin main` 被拒并 emit tool.denied、`npm test` 放行、`git  push`（多空格）被拒。`test/schema.test.ts` 3 个新测试：合法正则通过、非法正则报错、缺省为空数组。

**条目 3：不变量测试与 collie audit**

`test/invariants.test.ts` 加两条不变量：(1) `src/runner/claude.ts` 同时含 `tools:` 与 `allowedTools:`；(2) 含 `disallowedTools`。

`src/cli.ts` 新增 `collie audit <run_id>` 子命令：读 `.collie/runs/<run_id>/reviewer.stream.ndjson`，寻找 `{ type: 'system', subtype: 'init', tools: [...] }` 初始化消息，将其 tools 数组与配置文件 reviewer 白名单排序比较。退出码 0 = 匹配，1 = 不匹配（打印差集 extra/missing），2 = 无事件流或无初始化消息。

`test/cli.test.ts` 4 个新测试覆盖三种退出码：匹配（exit 0）、不匹配有多余工具（exit 1）、文件不存在（exit 2）、无 init 消息（exit 2）。

**额外修复：** `src/schema/index.ts` 中 `tool.denied` 的注释原文含 `PreToolUse` 字样，被验收标准的 SDK 泄漏检查捕获。改写为 `a bash-deny hook denied a tool call`，消除泄漏。

## 测试结果

```
npm run lint    -> exit 0 (eslint + prettier 全通过)
npm run typecheck -> exit 0 (tsc 无报错)
npm test        -> exit 0

 Test Files  36 passed (36)
      Tests  724 passed (724)
   Duration  25.65s
```

7 项验收 grep 均 PASS。

## 偏离或疑问

1. `src/schema/index.ts` 的注释中提到了 SDK 概念 `PreToolUse`，导致验收标准「SDK 概念不泄漏」检查失败。已将注释改为不含 SDK 术语的描述。这属于本轮新增代码的修复，不涉及 SPEC 偏离。

2. `AUDIT_EXIT` 的退出码直接使用 0/1/2 而非复用 `EXIT_CODES`（后者是 `collie run` 专用且值为 0/10/20/1），task 要求 audit 用 0/1/2，所以单独定义了 `AUDIT_EXIT` 常量并加了 `no-magic-numbers` eslint-disable。

## 下一步建议

1. R1 在 PASS 后可在 `.collie/collie.toml` 补写 `bash_deny` 正则（如 `['^\\s*git\\s+push\\b', '^\\s*gh\\s']`），实际生效。
2. 后续批次可考虑 worker 的工具限制（当前仅 reviewer 有 disallowedTools 和 bash_deny）。
3. `collie audit` 目前只检查 reviewer 白名单；如需扩展可检查 worker 的 `stream.ndjson`。

```json
{
  "schema_version": 1,
  "batch_id": "v03-b02",
  "head_sha": "f26a67ba8c400d0090f6f150e67146344dfae46f",
  "claims": {
    "commits": ["f010b23", "8f36e86", "f26a67b"],
    "tests_passed": 724,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
