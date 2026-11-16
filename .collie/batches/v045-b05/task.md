---
schema_version: 1
run_id: r-20261116102240
batch_id: v045-b05
base_sha: 8572394c95d3c7d5a7313d551f553622bffcba67
created_at: 2026-11-16T10:22:41.060Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b05：collie follow 加固：已处理落在仓库里、失败只通知一次并退避、通知不带路径、子进程与汇报附录

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 「已处理」与推送（SPEC 14.9 第 1 条）：汇报提交信息加 `(base <基准提交前 12 位>)`；「已处理」= 本地 `git log <基准提交>..HEAD` 里有这样一条提交，或 `follow.json` 的 `handledBase` 等于它；
   起了 `run --continue` 之后不论后面哪一步失败都记 `handledBase`；本地领先远端时每圈先推送，失败通知一次，推上去之后不再提。
   **连续 3 圈、第 1 圈推送失败的情形下，`run --continue` 只起 1 次，仓库里只有 1 份汇报**
2. 失败只通知一次并退避、通知内容、子进程（SPEC 14.9 第 2~4 条）：按 14.9 的通知键去重；preflight 或固定版本目录失败后退避 5 分钟起、每次翻倍、最长 60 分钟，退避期内不起子进程；
   preflight 用 `--json` 只列失败项名字；队列结束的原因取 journal 的 `queue.finished.reason`；注入的子进程函数收完整命令行，`npm ci` 不经 `npx tsx`；缺省实现边跑边转发输出、内存里只留末 200 行。
   **preflight 连续失败 3 圈（间隔 60 秒）时：`preflight` 起 1 次、通知 1 条；假时钟推进到 5 分钟之后的那一圈才起第 2 次，通知仍是 1 条**
3. 汇报附录、目录注入与测试（SPEC 14.9 第 5~7 条）：汇报末尾加 `## 运行环境（follow 记录）`；固定版本目录的父目录可注入；`test/support/sandbox.ts` 生成配置时去掉 `webhook_file` 一行。
   `test/follow.test.ts` 改写并补齐：上面两条加粗的情形各一条，必须真的走多圈并断言子进程与通知的次数；基准提交不是祖先连续 3 圈只通知 1 条、不起子进程；`follow.json` 删掉后同一个基准不再跑；
   preflight 失败的通知不含 `/`；通知里的原因来自 journal（`limit` 不得写成 `exhausted`）；锁文件不同时子进程收到的命令行第一个词是 `npm`；汇报里有附录一节；
   跑完后注入的父目录之外没有新建固定版本目录。`test/invariants.test.ts` 加「`src/follow.ts` 不含 `execFileSync`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0 |
| 专项测试不少于 16 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(1[6-9]\|[2-9][0-9])$"` | exit 0 |
| 专项测试不在系统临时目录留下固定版本目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` | exit 0 |
| 退避进了代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "notBefore" && grep -qE "notBefore" test/follow.test.ts` | exit 0 |
| 汇报提交带基准提交、汇报带附录（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "\(base " && grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "follow 记录"` | exit 0 |
| 子进程不再用带缓冲上限的同步调用（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "execFileSync"` | exit 0 |
| 沙箱不读真实机器的通知地址 | `grep -qE "webhook_file" test/support/sandbox.ts` | exit 0 |
| 不变量同步 | `grep -qE "execFileSync" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`
- 为了让测试过而删除或跳过任何测试（改写 `test/follow.test.ts` 里与新行为冲突的旧用例不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 `npx` 子进程或真实网络请求；自己在工作区里运行不带 `--dry-run` 的 `collie follow`
- 让 `follow` 写 `docs/ops/queue-*.md` 之外的仓库文件、改 backlog、改结论；改动 `handoff.ts`、`run.ts`、`gate.ts`、`arbiter.ts`；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b05/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b05` 为提交信息单独提交并推送该文件。
