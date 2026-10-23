---
schema_version: 1
run_id: r-20261023-082524
batch_id: v02-e-drill
base_sha: 83faebb4bb86828dd63454f03edbebf8f59ada4e
created_at: 2026-10-23T08:25:24.050Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-e-drill：stream.ndjson 密钥屏蔽（场景 E 真实 kill 演练）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/runner/claude.ts` 落盘 `stream.ndjson` 前，把屏蔽集合中的每个值（非空且长度 ≥ 8）替换为 `***`；
   屏蔽集合由 R2 用 `token_file` 文件内容与 `GITHUB_TOKEN` / `GH_TOKEN` 环境变量的值构造，
   以 runner 选项 `redact: readonly string[]` 传入，runner 不读配置也不读环境变量
2. `test/runner-claude.test.ts`：注入 fake query 产出含密钥字样的事件，断言落盘文件无原文、有 `***`；`redact` 为空时原样落盘
3. `test/invariants.test.ts` 加一条：`src/runner/claude.ts` 含 `redact`，且 `src/run.ts`、`src/evidence.ts` 之外无任何文件读取 `token_file`。
   顺带修场景 C 的随机 ENOTEMPTY（v02-b05-fix 裁定提交 Run 113）：`test/support/sandbox.ts` 的全局 gitconfig 加
   `[gc]\n\tauto = 0`，`dispose()` 的 `rmSync` 加 `maxRetries: 5, retryDelay: 100`；不改任何场景测试的断言

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| redact 选项存在 | `grep -qE "redact" src/runner/index.ts && grep -qE "redact" src/runner/claude.ts && grep -qE "redact" src/run.ts` | exit 0 |
| 屏蔽有测试 | `grep -qE "redact" test/runner-claude.test.ts && grep -qE "\*\*\*" test/runner-claude.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "redact" test/invariants.test.ts` | exit 0 |
| 沙箱清理不再裸删 | `grep -qE "maxRetries" test/support/sandbox.ts && grep -qE "auto = 0" test/support/sandbox.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- runner 读取配置文件或环境变量来决定屏蔽什么（屏蔽集合只能来自 `redact` 选项）

## 汇报要求

完成后写 `.collie/batches/v02-e-drill/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-e-drill` 为提交信息单独提交并推送该文件。
