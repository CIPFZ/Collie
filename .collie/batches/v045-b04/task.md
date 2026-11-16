---
schema_version: 1
run_id: r-20261116083629
batch_id: v045-b04
base_sha: 480a537bff0c9777386e553334676b323418ea78
created_at: 2026-11-16T08:36:30.178Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b04：collie follow：常驻循环，按 next.md 开跑、交汇报、发通知

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 新建 `src/follow.ts`（SPEC 14.4）：循环与 `--once` / `--dry-run` / `--interval` / `--timeout`；每圈 pull、读 `docs/ops/next.md`、用 `handoff.ts` 判定、执行动作；状态落在 `.collie/follow.json`。
   时钟、睡眠、起子进程（一个 `(参数, cwd) → 退出码与输出` 的函数）、发通知都由参数注入，缺省实现才用真实的。`--dry-run` 只打印 `action: …`，不 pull、不起子进程、不写文件、不发通知
2. 「跑一轮」的八步（SPEC 14.4）与边界（SPEC 14.5）：固定版本目录按 sha 一个一个建、不在原地切换；`preflight --smoke` 没过不记为已处理；汇报只提交 `docs/ops/queue-<q_run_id>.md` 这一个文件、提交信息 `ops: report queue <q_run_id>`；
   `report` 失败时写最小汇报；推送失败下一圈先重试。`collie follow` 接线进 `cli.ts`；`.collie/follow.json` 加进 `.gitignore` 与 `collie init` 的忽略清单
3. 新建 `test/follow.test.ts`，用 `Sandbox`，起子进程一律用注入的假函数（可以在进程内调用 `box.cli`），时钟与睡眠用注入的，不用真实定时器：`开跑` → 依次起 `preflight`、`run`、`report`，仓库里出现汇报文件与 `ops:` 提交且已推送、
   发了「队列结束」通知、`handledBase` 已记；同一个 `基准提交` 第二圈不再跑；preflight 没过 → 只通知一次、下一圈重试；`等所有者裁定` 只通知一次；`收工` 通知后退出；格式错只通知一次；
   `基准提交` 不是 `HEAD` 的祖先不跑；`--dry-run` 什么副作用都没有；`report` 失败时有最小汇报。`test/invariants.test.ts` 加「`src/follow.ts` 存在且用了 `handoff.ts`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0 |
| 专项测试不少于 9 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(9\|[1-9][0-9])$"` | exit 0 |
| 专项测试用 Sandbox | `grep -qE "Sandbox\.create" test/follow.test.ts` | exit 0 |
| 专项测试不用真实定时器 | `test -f test/follow.test.ts && ! grep -qE "setInterval\|setTimeout\(" test/follow.test.ts` | exit 0 |
| 命令已接线且有 dry-run | `npx tsx src/cli.ts follow --help 2>&1 \| grep -qE "dry-run"` | exit 0 |
| 汇报用 ops 前缀提交（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "ops: report queue"` | exit 0 |
| 状态文件不进仓库 | `grep -qE "follow\.json" .gitignore` | exit 0 |
| 不变量同步 | `grep -qE "follow\.ts" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 `npx` 子进程或真实网络请求；自己在工作区里运行不带 `--dry-run` 的 `collie follow`（它会按 next.md 再起一个队列）
- 让 `follow` 写 `docs/ops/queue-*.md` 之外的仓库文件、改 backlog、改结论；改动 `run.ts`、`gate.ts`、`arbiter.ts`；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b04/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b04` 为提交信息单独提交并推送该文件。
