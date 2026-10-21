---
schema_version: 1
run_id: r-20261021-112601
batch_id: v02-b04-tests
base_sha: 61e581a07b5dc28b7ccbd70e3b18f1f0a7fd76d4
created_at: 2026-10-21T11:26:01.335Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b04-tests：测试去真实定时器

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. `test/scenario-g.test.ts` 与 `test/ladder.test.ts` 全部改用注入的假时钟：同时注入 `livenessNow` 与 `livenessSetTimer`，
   fake worker 发事件改为由假时钟驱动，文件内不再出现任何真实的 `setInterval` / `setTimeout`（包括用于让出事件循环的 `setTimeout(r, 0)`，
   改用 `await Promise.resolve()` 或 vitest 的假定时器推进）。断言只看事件序列，不看耗时
2. `test/reviewer-isolation.test.ts` 的 ESLint 用例：`ESLint` 实例移到 `beforeAll` 只建一次，并给该用例显式 `timeout`（60 秒）。
   不改测试的断言内容

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 无真实定时器 | `! grep -qE "setInterval\|setTimeout\(" test/scenario-g.test.ts` | exit 0 |
| ladder 无真实定时器 | `! grep -qE "setInterval\|setTimeout\(" test/ladder.test.ts` | exit 0 |
| 场景 G 注入了定时器 | `grep -qE "livenessSetTimer" test/scenario-g.test.ts` | exit 0 |
| ESLint 只建一次 | `grep -qE "beforeAll" test/reviewer-isolation.test.ts` | exit 0 |
| 未改动 src | `test -z "$(git log --format=%H -n 1 --grep='issue v02-b04-tests' -- .collie/batches/v02-b04-tests/task.md)" \|\| git diff --quiet "$(git log --format=%H -n 1 --grep='issue v02-b04-tests' -- .collie/batches/v02-b04-tests/task.md)"..HEAD -- src/` | exit 0 |

## 本批次额外禁止

- 改动 `src/` 下任何文件（需要改源码就停下来在 report 里说明，不要动手）
- 改动任何受保护路径
- 为了让测试过而删除或跳过（`skip` / `todo`）任何测试

## 汇报要求

完成后写 `.collie/batches/v02-b04-tests/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b04-tests` 为提交信息单独提交并推送该文件。
