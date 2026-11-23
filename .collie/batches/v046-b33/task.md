---
schema_version: 1
run_id: r-20261123044708
batch_id: v046-b33
base_sha: dc99ca62cb0f973bd89c820c72c47b540720049f
created_at: 2026-11-23T04:47:09.551Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b33：测试时限提到 300 秒（第一个用批次授权的批次）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（1 个）

1. 读 SPEC 16.22 的第一段。`vitest.config.ts`：`testTimeout` 与 `hookTimeout` 都改成 `300_000`，那一行的注释相应改成说明现在的值与原因（慢机器上钩子要 160 秒左右；没有断言依赖这个值）。别的配置项不动。
   在「偏离或疑问」里列出你对这个文件做的每一处改动。

## 本批次可改的受保护路径

- vitest.config.ts

只做条目要求的改动，并在「偏离或疑问」里列出改了什么。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个时限都是 300 秒 | `grep -qE "testTimeout: 300_000" vitest.config.ts && grep -qE "hookTimeout: 300_000" vitest.config.ts` | exit 0 |

## 本批次额外禁止

- 改动授权小节点名之外的任何受保护路径（含 `.github/`、`eslint.config.js`）；改动 `vitest.config.ts` 里两个时限与那一行注释之外的任何内容
- 改动 `src/`、`test/`、`scripts/`、`templates/`、`package.json`
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b33/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b33` 为提交信息单独提交并推送该文件。
