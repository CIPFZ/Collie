---
schema_version: 1
run_id: r-20261111051219
batch_id: v04-b02
base_sha: 7f9158beee07d5b31236a55a48c46bdc4260767c
created_at: 2026-11-11T05:12:20.400Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b02：投影模块 view.ts 与 collie status

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/view.ts` 读取层 `loadRuns(root)`：扫全部运行目录并重放；单个运行的 journal 校验失败不抛出，记为 `unreadable` 带原因，其余照常
2. `src/view.ts` 投影层 `projectRuns` / `projectBatches`：纯函数，`now` 由参数传入，不 import `run.ts` / `runner/` / `roles/`；
   13.1 的字段缺失时给 `null`。`collie status [--json]` 按 13.2 的三段输出，`cli.ts` 只做接线；没有 journal 时打印 `no runs recorded` 退出码 0
3. `test/view.test.ts`：夹具至少覆盖一次 PASS、FIX 后 PASS、进行中的运行、旧格式 run_id 目录、含坏行的 journal、一次队列运行、不含 13.1 字段的旧 journal；
   `test/invariants.test.ts` 加「`src/view.ts` 不 import `run.ts` / `runner/` / `roles/`」。
   另：`vitest.config.ts` 加 `hookTimeout`，与 `testTimeout` 同值（SPEC 13.11：`test/journal-fields.test.ts` 的 `beforeAll` 跑完整一轮，
   默认的 10 秒在有负载的机器上会超时，一超时整个文件的用例被跳过、`npm test` 失败）；本批次新写的测试若在钩子里跑完整一轮，同样受它保护

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 投影专项测试通过 | `npm test -- test/view.test.ts` | exit 0 |
| 专项测试不少于 8 个 | `grep -cE "^\s+it\(" test/view.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| 投影模块不依赖运行逻辑 | `test -f src/view.ts && ! grep -qE "from '\./(run\|runner\|roles)[./]" src/view.ts` | exit 0 |
| 坏 journal 有处理且有测试 | `grep -qE "unreadable" src/view.ts && grep -qE "unreadable" test/view.test.ts` | exit 0 |
| status 命令已接线 | `npx tsx src/cli.ts status` | exit 0 |
| status --json 输出合法 JSON | `npx tsx src/cli.ts status --json \| node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` | exit 0 |
| 不变量同步 | `grep -qE "view\.ts" test/invariants.test.ts` | exit 0 |
| 钩子超时已配置（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" vitest.config.ts \| grep -qE "hookTimeout"` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；让 `status` 写任何文件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b02/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b02` 为提交信息单独提交并推送该文件。
