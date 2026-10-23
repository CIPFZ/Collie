---
schema_version: 1
run_id: r-20261023-060802
batch_id: v02-b05-fix
base_sha: a213416e368ed84ca6b10ace126a37d8f950799f
created_at: 2026-10-23T06:08:02.668Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-b05-fix：规则 9、worker_pid 时序、CI 未取证措辞

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. arbiter 规则 9：`remote_has_head=false` 或 `ci_conclusion≠success` 或 `ci_branch_matched≠true` 时，PASS 降为 FIX，
   记 `verdict.downgraded`（字段 rule=9 / reason）；原「采用 verdict 原值」改为规则 10。`src/arbiter.ts` 的常量、
   progress 与 `collie show` 的规则编号文字同步；`test/arbiter.test.ts` 加三个用例（未推送 / unknown / branch 不一致），
   并断言 FIX 原判不被改动、BLOCK 不被改动
2. worker_pid 时序：runner 选项加 `onPid?: (pid: number) => void`，spawn 钩子拿到 `child.pid` 时立刻回调；
   R2 在回调里 `updateHeartbeat({ worker_pid })`，不再依赖 `onStarted` 时读 `handle.pid`。
   `test/runner-claude.test.ts` 的真实顺序用例：`onStarted` 先触发、钩子后触发，断言心跳最终含 `worker_pid`
3. CI 未取证措辞：`evidence.ts` 在 `remote_has_head=false` 或根本没查 CI 时 `ci_branch_matched` 为 `null`、`ci_run_url` 为空；
   `progress.ts` 对 `null` 渲染「未能取证」，`false` 才渲染「监听分支不一致」。`test/evidence.test.ts` 加「未推送 → branch_matched 为 null」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 规则 9 进 arbiter 与测试 | `grep -qE "RULE_DEFAULT = 10" src/arbiter.ts && grep -qE "remote_has_head: false" test/arbiter.test.ts` | exit 0 |
| onPid 接口存在且 R2 使用 | `grep -qE "onPid" src/runner/index.ts && grep -qE "onPid" src/runner/claude.ts && grep -qE "onPid" src/run.ts` | exit 0 |
| 真实顺序有测试 | `grep -qE "onPid" test/runner-claude.test.ts` | exit 0 |
| 未推送时 branch_matched 为 null 有测试 | `grep -qE "remote_has_head" test/evidence.test.ts && grep -qE "toBeNull" test/evidence.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "RULE_DEFAULT" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 放宽规则 1~8 的任何一条

## 汇报要求

完成后写 `.collie/batches/v02-b05-fix/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-b05-fix` 为提交信息单独提交并推送该文件。
