---
schema_version: 1
run_id: r-20261025-083535
batch_id: v02-e-fix
base_sha: 55f8f54935e96982cc15150858a29c65481a98c5
created_at: 2026-10-25T08:35:35.662Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v02-e-fix：worker 随 R2 死、取证沿用首次 base_sha、interrupted_at

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. worker 随 R2 死（11.3）：runner spawn 时 `detached: true`；R2 注册 `exit` / `SIGTERM` / `SIGINT` 对 `-worker_pid` 发 `SIGTERM`；
   R2 另起守护进程（`node -e`，脱离 R2 进程组）持有 R2 pid 与 worker_pid，每 2 秒探测，R2 消失即 `SIGKILL` worker_pid 后自退；
   `guard_pid` 写进心跳，孤儿检测三个 pid 任一存活即拒绝启动；reviewer 阶段开始时清掉心跳的 `worker_pid`。
   测试：fake 子进程（`node -e 'setInterval(()=>{},1000)'`）+ 真实守护进程，`SIGKILL` 父进程替身后断言子进程 5 秒内消失；
   `test/heartbeat.test.ts` 加 `guard_pid` 存活拒绝启动用例
2. 取证范围（11.7）：`run.ts` 的 evidence 与 reviewer 输入用 frontmatter 沿用的首次 `base_sha`，不再用 `taskSha`；
   `test/scenario-e.test.ts` 加断言：attempt 2 的 `commits_actual` 含 attempt 1 的提交，且 attempt 1 偷改 SPEC 时 attempt 2 被规则 2 BLOCK
3. `interrupted_at`（11.7）：结束原因按 `worker_stop_reason → result → orphaned → unknown` 取；journal 无 `run.finished` 时最后事件取
   `stream.ndjson` 末行；「上一轮中断」一节无 `rescue_sha` 时也要写「上一轮未留下救援提交，请从 `git log` 核实已完成到哪一步」。
   `test/scenario-e.test.ts` 断言 `interrupted_at` 含 `orphaned` 且事件类型不是 `worker.started`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 子进程随父死有测试 | `grep -qE "detached: true" src/runner/claude.ts && grep -qE "guard_pid" src/heartbeat.ts && grep -qiE "parent.*(killed\|dies\|SIGKILL)" test/runner-claude.test.ts test/guard.test.ts` | exit 0 |
| 取证不再用 taskSha 做 base | `! grep -qE "baseSha: taskSha" src/run.ts && grep -qE "commits_actual" test/scenario-e.test.ts` | exit 0 |
| interrupted_at 取 orphaned | `grep -qE "orphaned" test/scenario-e.test.ts && grep -qE "stream\.ndjson\|appendStream\|readStream" src/run.ts` | exit 0 |
| 不变量同步 | `grep -qE "detached: true\|baseSha: taskSha" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 守护进程读取配置或仓库；它只认两个 pid

## 汇报要求

完成后写 `.collie/batches/v02-e-fix/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v02-e-fix` 为提交信息单独提交并推送该文件。
