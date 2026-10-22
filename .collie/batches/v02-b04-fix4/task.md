---
schema_version: 1
run_id: r-20261022-114309
batch_id: v02-b04-fix4
base_sha: 2648a76648eac9bfeb6432904b15f1234ce3d567
created_at: 2026-10-22T11:43:09.573Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b04-fix4：spawn 钩子按 SDK 签名、类型来自 SDK、collie smoke

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `claude.ts` 钩子改为 `(options) => spawn(options.command, options.args, { cwd: options.cwd, env: 去密钥后的 options.env, signal: options.signal })`，
   返回值满足 SDK 的 `SpawnedProcess`；`test/runner-claude.test.ts` 里所有调用钩子的地方改为传单个对象，
   并加一条断言：钩子收到 `{ command, args, env: { GITHUB_TOKEN: 'fake-token', PATH: '/x' } }` 时，`spawn` 替身收到的 `env` 无 `GITHUB_TOKEN`、有 `PATH`
2. `ClaudeQueryOptions` 及钩子、`SpawnOptions`、`SpawnedProcess` 相关类型全部 `import type` 自 `@anthropic-ai/claude-agent-sdk` 并用
   `Pick` / 索引类型派生，删除手写的 `SpawnHookOptions` / `SpawnHookResult`；`test/invariants.test.ts` 加一条：
   `src/runner/claude.ts` 含 `import type .* from '@anthropic-ai/claude-agent-sdk'`，且不含 `interface SpawnHook`
3. `collie smoke` 子命令：用配置的真实 runner、`maxTurns: 1`、`allowedTools: []`、prompt「Reply with the single word ok.」拉起 worker 角色，
   收到 `RunResult` 即退出码 0 并打印 `exitCode / sessionId / usage`；拉不起来或 runner 抛出则退出码 1 并打印错误。
   不写 journal、不碰 `.collie/batches`。`test/cli.test.ts` 用 fake runner 覆盖成功与失败两条路径；
   `AGENT_KICKOFF.md` 由 R1 事后把「跑批次前先 `collie smoke`」写进操作员流程

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 钩子不再是三参数 | `! grep -qE "spawnClaudeCodeProcess\?: \($" src/runner/claude.ts && ! grep -qE "command: string,$" src/runner/claude.ts` | exit 0 |
| 类型来自 SDK | `grep -qE "import type .* from '@anthropic-ai/claude-agent-sdk'" src/runner/claude.ts && ! grep -qE "interface SpawnHook" src/runner/claude.ts` | exit 0 |
| 不变量已加 | `grep -qE "claude-agent-sdk" test/invariants.test.ts` | exit 0 |
| 测试按单对象调用钩子 | `grep -qE "spawnClaudeCodeProcess\(\{" test/runner-claude.test.ts \|\| grep -qE "spawnClaudeCodeProcess\?\.\(\{" test/runner-claude.test.ts` | exit 0 |
| smoke 子命令存在且有测试 | `grep -qE "'smoke'" src/cli.ts && grep -qE "smoke" test/cli.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|spawnClaudeCodeProcess" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改变 soft / hard 的现有实现

## 汇报要求

完成后写 `.collie/batches/v02-b04-fix4/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b04-fix4` 为提交信息单独提交并推送该文件。
