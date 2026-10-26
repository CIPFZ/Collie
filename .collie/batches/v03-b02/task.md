---
schema_version: 1
run_id: r-20261026-091509
batch_id: v03-b02
base_sha: db7cb97bfb244cec27d66edede4785ae00016bd6
created_at: 2026-10-26T09:15:10.266Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v03-b02：工具白名单真正生效：tools 选项、reviewer Bash 黑名单

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `claude.ts`：`tools: [...allowed_tools]` 与 `allowedTools` 同传；reviewer 角色另传 `disallowedTools: ['Write','Edit','MultiEdit','NotebookEdit']`；
   类型按 11.2 来自 SDK 的 `Options`。`test/runner-claude.test.ts` 断言注入的 `query()` 收到的 `options.tools` 等于白名单、
   reviewer 的 `options.disallowedTools` 含 `Write` 与 `Edit`，worker 的不含 `disallowedTools`
2. reviewer Bash 黑名单：`ConfigSchema` 的 `[agent.reviewer]` 加可选 `bash_deny: string[]`（正则，解析时 `new RegExp` 校验）；
   runner 为 reviewer 注册 `hooks.PreToolUse`（matcher `Bash`），命令匹配任一正则即返回 `permissionDecision: 'deny'` 并在
   `reviewer.stream.ndjson` 追加 `tool.denied`（role / tool / command / pattern）；`bash_deny` 缺省为空数组、不注册钩子。
   测试：注入 fake `query()` 捕获 `options.hooks.PreToolUse`，手动调用钩子，`git push origin main` 被拒、`npm test` 放行、
   `git  push` （多空格）被拒；schema 测试覆盖非法正则报错
3. `test/invariants.test.ts` 加两条：`src/runner/claude.ts` 同时含 `tools:` 与 `allowedTools:`；`src/runner/claude.ts` 含 `disallowedTools`。
   另加一个只读的运行后检查工具 `collie audit <run_id>`（`src/cli.ts`）：读 `reviewer.stream.ndjson` 的初始化消息，工具清单不等于
   reviewer 白名单则退出码 1 并打印差集；没有事件流或没有初始化消息退出码 2。`test/cli.test.ts` 覆盖三种退出码

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| tools 与 allowedTools 同传 | `grep -qE "^\s+tools: \[" src/runner/claude.ts && grep -qE "disallowedTools" src/runner/claude.ts` | exit 0 |
| 白名单有测试 | `grep -qE "options\.tools\|\.tools\)" test/runner-claude.test.ts && grep -qE "disallowedTools" test/runner-claude.test.ts` | exit 0 |
| bash_deny 进 schema 且有钩子 | `grep -qE "bash_deny" src/schema/index.ts && grep -qE "PreToolUse" src/runner/claude.ts && grep -qE "tool\.denied" src/runner/claude.ts` | exit 0 |
| 钩子有测试 | `grep -qE "PreToolUse" test/runner-claude.test.ts && grep -qE "git push" test/runner-claude.test.ts` | exit 0 |
| audit 子命令 | `grep -qE "'audit'" src/cli.ts && grep -qE "audit" test/cli.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "disallowedTools" test/invariants.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|PreToolUse" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（`bash_deny` 的 toml 配置由 R1 在 PASS 后补写）
- 为了让测试过而删除或跳过任何测试
- 给 worker 加 `disallowedTools` 或 Bash 黑名单
- 改动 `permission_mode` 的处理

## 汇报要求

完成后写 `.collie/batches/v03-b02/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v03-b02` 为提交信息单独提交并推送该文件。
