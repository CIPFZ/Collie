---
schema_version: 1
run_id: r-20261117104317
batch_id: v045-b17
base_sha: 605b07aa368b5662c01618b98159bb7e1ed932b7
created_at: 2026-11-17T10:43:17.837Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b17：测试：去掉低于全局值的局部超时

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（1 个）

1. `test/` 下所有写给 `describe` / `it` / `beforeAll` / `beforeEach` 的显式超时，数值小于 120 秒的，去掉，让它们用全局值。
   现有两种写法：`{ timeout: 60_000 }`（27 处，11 个文件）与写在钩子、用例末尾的 `}, 60_000);`（5 处，3 个文件）。
   不是超时的数字不动：夹具里的 `duration_ms: 60000`、`test/invariants.test.ts` 里的 `toBeGreaterThanOrEqual(30_000)`、`test/watch.test.ts` 里的 `advance(100_000)`。
   120 秒及以上的不动；除此之外不改任何测试内容。
   在「偏离或疑问」里列出每个文件改了几处；上面点名之外你还碰到别的数值的，写明是什么、动没动。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| describe 上没有 60 秒或 30 秒的局部超时 | `! grep -nE "timeout: (30\|60)_000" test/*.test.ts` | exit 0 |
| 钩子与用例末尾没有 60 秒或 30 秒的局部超时 | `! grep -nE "^\s*\}, (30\|60)_000\);" test/*.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`；改动 `src/` 与 `scripts/` 下任何文件
- 删除或跳过任何测试；改写任何断言；改动夹具里的数据
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b17/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b17` 为提交信息单独提交并推送该文件。
