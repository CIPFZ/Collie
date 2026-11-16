---
schema_version: 1
run_id: r-20261116070603
batch_id: v045-b01
base_sha: 71112d0c76027555c01692b9566d7d831e731924
created_at: 2026-11-16T07:06:03.961Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b01：开跑前检查与 audit 并进队列：collie preflight、queue.preflight、audit 不符停表

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `collie preflight [--smoke] [--json]`（SPEC 14.1 第一段）：新建 `src/preflight.ts`，检查项 `worktree_clean` / `remote_in_sync` / `ci_token` / `disk_free`，`--smoke` 时加 `runner` / `ci_query`（复用现有 `smoke` 的两步，不要另写一套）；`ci_token` 复用 `run.ts` 的 `readCiTokenChecked`（现有不变量：只有 `run.ts` 与 `evidence.ts` 访问 `.token_file`，不要为此放宽它）；
   `limits.min_free_mb` 进配置 schema（可选，缺省 1024；**不要改** `.collie/collie.toml` 与 `templates/collie.toml`，它们是受保护路径 / 由 R1 同步）；可用空间的取数函数经 `CliDeps` 注入。`cli.ts` 只做接线
2. 队列与 audit（SPEC 14.1 后两段）：`run --continue` 在选第一个批次之前做不带 `--smoke` 的检查，记 `queue.preflight`，没过记 `queue.finished`（reason `preflight_failed`）、退出码 1、不签发 task；单批次模式不自动检查。
   把 `cli.ts` 里 `audit` 的核对逻辑抽成两处共用的函数，reviewer 结束后记 `audit.result`（批次 journal）；`--continue` 下 `mismatch` 记 `queue.paused`（reasons 含 `audit_mismatch`）并停，退出码 30。`collie audit` 的输出与退出码不变
3. 测试：新建 `test/preflight.test.ts`（每个检查项的通过与失败、心跳存在时脏工作区不算失败、本地落后于远端、`--smoke` 两项、`--json`、队列开头没过时没有 `batch.task_written` 且退出码 1、单批次模式不检查）与
   `test/queue-audit.test.ts`（`match` 放行、`mismatch` 在 PASS 与 FIX 两种裁决下都停且退出码 30、`no_init` 不停、没有 reviewer 的运行不记）。用 `test/support/sandbox.ts` 的 `Sandbox`，不得依赖真实 home 目录与真实磁盘余量。
   现有 `--continue` 测试若因工作区不干净而失败，改它的准备步骤（先提交），不得为此放宽检查。`test/invariants.test.ts` 加「`src/run.ts` 含 `queue.preflight`」「`src/schema/index.ts` 含 `audit.result`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个专项测试通过 | `npm test -- test/preflight.test.ts test/queue-audit.test.ts` | exit 0 |
| preflight 测试不少于 8 个 | `grep -cE "^\s+it\(" test/preflight.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| audit 入队列测试不少于 4 个 | `grep -cE "^\s+it\(" test/queue-audit.test.ts \| grep -qE "^([4-9]\|[1-9][0-9])$"` | exit 0 |
| 命令已接线并列出检查项 | `npx tsx src/cli.ts preflight 2>&1 \| grep -qE "worktree_clean"` | exit 0 |
| 队列开头记检查结果（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "queue\.preflight" && grep -qE "queue\.preflight" src/schema/index.ts` | exit 0 |
| audit 不符会停表（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "audit_mismatch" && grep -qE "audit_mismatch" test/queue-audit.test.ts` | exit 0 |
| 磁盘阈值进配置 schema | `grep -qE "min_free_mb" src/schema/index.ts` | exit 0 |
| 不变量同步 | `grep -qE "queue\.preflight" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 与放行判定的六项；让 audit 的结果改变任何结论或 backlog 状态；改动单批次模式的启动条件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b01/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b01` 为提交信息单独提交并推送该文件。
