---
schema_version: 1
run_id: r-20261117050330
batch_id: v045-b10
base_sha: 526aa1ec2a1dee9aab2d8ae47ad3fd91dba4b6fd
created_at: 2026-11-17T05:03:31.623Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b10：--max 只数通过的批次：FIX 重跑不占名额

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. `src/run.ts` 的队列循环：到数的判断改为「本次队列里结论是 PASS 的批次数达到 N」。FIX 重跑、规则 1 重跑、中断续跑都不占名额；
   `queue.finished.batches` 照旧列出每一次运行，`fix_max` 的计数与处理不变。
   **`--max 2`、两个批次、第一个先 FIX 再 PASS、第二个 PASS：两个批次都通过，`queue.finished` 的 reason 是 `limit`、`batches` 有 3 项；**
   **`--max 1`、同样的安排：第一个批次通过后停下，第二个仍是 `pending`，`batches` 有 2 项**
2. 新文件 `test/queue-limit.test.ts`：用 `FakeRunner` 跑真实的 `run --continue --max N`（照 `test/report.test.ts` 里「FIX then PASS」那一组的做法，不手写 journal），
   断言 backlog 的状态列、`queue.finished` 的 reason 与 `batches`、每条 `queue.batch_started` 的 why。条目 1 两处加粗的情形各一条；
   `--max 1`、一个批次的 FIX 次数超过 `fix_max` → 退出码 20、记了 `escalated`（reason `fix_max`），不是 `limit`；不带 `--max`、两个批次都一次通过 → 退出码 0、两个都是 `passed`。
   `test/invariants.test.ts` 加「`src/run.ts` 不含 `batchesRun.length >= ctx.max`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| --max 的专项测试通过 | `npm test -- test/queue-limit.test.ts` | exit 0 |
| 专项测试不少于 4 个 | `grep -cE "^\s+it\(" test/queue-limit.test.ts \| grep -qE "^([4-9]\|[1-9][0-9])$"` | exit 0 |
| 专项测试跑的是真实队列 | `grep -qE "FakeRunner" test/queue-limit.test.ts && grep -qE -e "--max" test/queue-limit.test.ts` | exit 0 |
| 不再按运行次数到数（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "batchesRun\.length >= ctx\.max"` | exit 0 |
| 不变量同步 | `grep -qE "batchesRun" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/follow.ts`、`src/view.ts`；改动 `fix_max` 的计数方式或 `queue.finished.batches` 的形状
- 为了让测试过而删除或跳过任何测试；改写已有用例的断言（本批次没有点名允许改写的旧用例；确实与 SPEC 14.14 冲突的，先在「偏离或疑问」里逐条列出）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b10/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b10` 为提交信息单独提交并推送该文件。
