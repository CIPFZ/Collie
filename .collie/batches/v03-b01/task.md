---
schema_version: 1
run_id: r-20261026-045805
batch_id: v03-b01
base_sha: bd1b1e7f70f9c78bd10f8ac32a7c0e29e32dfc11
created_at: 2026-10-26T04:58:05.805Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v03-b01：收回人工动作：R2 推送裁定提交、启动核查其 CI、reviewer 流落盘、场景 H

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. R2 推送裁定提交与启动核查（12.1）：`git.ts` 加 `push(cwd, remote, branch)`；`run.ts` 在 progress 提交之后推送，记 `verdict.pushed`，
   失败记 `verdict.push_failed` 且不改变结论、不抛出；启动阶段若本地领先远端先推送一次；启动阶段取最近一条 `verdict.pushed.sha`
   用 `queryCi` 查一次（不等待），`failure` / `cancelled` 打印 `warning: previous verdict commit ...` 并记 `ci.verdict_commit`，
   `success` 只记事件，其余不记。`schema` 加三个事件。测试：fake 场景里断言推送后远端含裁定提交；注入 fetch 替身返回 failure 时 stderr 有 warning
2. reviewer 事件流落盘（12.1）：`reviewer.stream.ndjson`，复用 worker 的写入与 `redact`；`test/reviewer-isolation.test.ts` 或新测试断言文件存在、
   含 reviewer 的事件、密钥已屏蔽
3. 场景 H（12.1）：`test/scenario-h.test.ts`，fake worker `pushed=false` 且远端无 head、reviewer PASS → arbiter FIX、`verdict.downgraded` rule=9；
   `test/invariants.test.ts` 加「`src/git.ts` 有 `push`」「`scenario-h.test.ts` 存在」两条

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 H | `npm test -- test/scenario-h.test.ts` | exit 0 |
| 三个事件进 schema | `grep -qE "verdict\.pushed" src/schema/index.ts && grep -qE "verdict\.push_failed" src/schema/index.ts && grep -qE "ci\.verdict_commit" src/schema/index.ts` | exit 0 |
| R2 推送且失败不抛 | `grep -qE "export async function push\(" src/git.ts && grep -qE "verdict\.push_failed" src/run.ts` | exit 0 |
| 启动核查有警告 | `grep -qE "previous verdict commit" src/run.ts && grep -qE "previous verdict commit" test/*.test.ts` | exit 0 |
| reviewer 流落盘 | `grep -qE "reviewer\.stream\.ndjson" src/run.ts && grep -qE "reviewer\.stream\.ndjson" test/*.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "scenario-h" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 推送失败时重试、抛出或改变本轮退出码
- 改动规则 1~10 的实现（场景 H 只是测试）

## 汇报要求

完成后写 `.collie/batches/v03-b01/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v03-b01` 为提交信息单独提交并推送该文件。
