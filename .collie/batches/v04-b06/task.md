---
schema_version: 1
run_id: r-20261111095852
batch_id: v04-b06
base_sha: 737296dbe13f8da651876db03960767f179a1257
created_at: 2026-11-11T09:58:53.141Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b06：环境故障不当成 worker 的 FIX：token 读不到就启动失败、证据取不到时队列不重跑

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. token 文件（SPEC 13.9）：读 token 的代码收成一处；配了 `ci.token_file` 但文件不存在、读不了或为空时，`collie run`（两种模式）在签发 task 之前退出码 1，
   stderr 含 `ci.token_file`、展开后的路径与原因。测试不得依赖真实 home 目录：凡是会走到 `run` 的夹具，配置要么不配 `token_file`，要么指向临时目录里的文件
   （GitHub 的 CI 机器上没有这个文件，直接读仓库里 toml 的现有用例在本批次之后会在 CI 上失败，要一并改）
2. `collie smoke`（SPEC 13.9）：先查 token 文件再调 runner；runner 通过后用 token 对当前 `HEAD` 查一次 CI，请求失败退出码 1 并打印原因，成功打印 `ci ok`；
   报错、事件与输出里不得出现 token 内容
3. 证据取不到（SPEC 13.9）：规则 9 触发且属于 13.9 列的三种情况时，`verdict.downgraded` 加 `cause: "evidence_unavailable"` 与 `detail`；
   `--continue` 遇到它不重跑、不计 `fix_max`、不改 backlog 状态，记 `escalated` 与 `queue.finished`（reason 都是 `evidence_unavailable`），退出码 20。
   新建 `test/scenario-m.test.ts`：token 文件缺失时启动失败且没有签发 task；限流时单批次模式的 FIX 带 `cause`；`--continue` 只跑一次就停、backlog 状态仍是 `pending`、退出码 20；
   对照组 CI `failure` 仍按普通 FIX 重跑；smoke 的两种失败。`test/invariants.test.ts` 加「`src/run.ts` 含 `evidence_unavailable`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 M 通过 | `npm test -- test/scenario-m.test.ts` | exit 0 |
| 场景 M 不依赖真实 home 目录 | `HOME=$(mktemp -d) npm test -- test/scenario-m.test.ts` | exit 0 |
| 场景 M 不少于 6 个用例 | `grep -cE "^\s+it\(" test/scenario-m.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 原因码进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "evidence_unavailable" && grep -qE "evidence_unavailable" test/scenario-m.test.ts` | exit 0 |
| token 文件缺失时 smoke 报错并指出配置项 | `HOME=$(mktemp -d) npx tsx src/cli.ts smoke --runner fake 2>&1 \| grep -qE "token_file"` | exit 0 |
| 不变量同步 | `grep -qE "evidence_unavailable" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 的判定（规则 9 的结论仍是 FIX）、放行判定、`fix_max` 的默认值；让报错、事件或输出里出现 token 内容；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b06/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b06` 为提交信息单独提交并推送该文件。
