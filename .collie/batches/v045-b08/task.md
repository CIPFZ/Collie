---
schema_version: 1
run_id: r-20261116162606
batch_id: v045-b08
base_sha: 99baf56044fc2f7537bcbcb8dd80adea50a117ea
created_at: 2026-11-16T16:26:06.873Z
attempt: 2
interrupted_at: null
issued_by: collie
---

# 批次 v045-b08：collie follow 的推送与收尾：每圈先同步、分叉时 rebase、汇报上了远端才通知、完整输出、npm ci 失败清目录

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 每圈先同步、通知等汇报上了远端才发（SPEC 14.12 第 1、2 条）：每圈在读 next.md 之前 `git fetch`，按「不领先 / 领先 / 分叉」三种情况处理，`fetch` / `pull` / `push` 都写明 `origin` 与 `main`、不依赖上游配置；分叉时只有本地多出来的全是 `ops: report queue` 提交才 `pull --rebase`，
   冲突就 `rebase --abort`；「队列结束」通知记进 `follow.json` 的 `pendingReport`，本地不再领先时才发、只发一次；删掉 `pendingPush`。
   **推送失败 3 圈 → 恢复远端 → 再走 3 圈之后：远端有汇报提交，本地不领先，`run --continue` 一共只起 1 次，「队列结束」通知只有 1 条、且出现在恢复之后；**
   **队列期间远端多了一个提交时：下一圈之后远端同时有那个提交与汇报提交，本地不领先也不落后，不发 `diverged` 通知**
2. 完整输出、固定版本目录、子进程起不来（SPEC 14.12 第 3、4 条）：注入的子进程函数多一个参数说明要完整输出还是只留末尾，留哪些行的逻辑写成不起子进程的函数；`report`、`report --json`、`preflight --json` 用完整输出；
   `npm ci` 退出码不是 0 时删掉固定版本目录、按 `pinned:<固定版本>` 通知一次并退避，下一次尝试重新建目录；缺省的子进程实现在程序不存在时返回退出码 127，不抛出
3. 小处与测试（SPEC 14.12 第 5 条与末段）：退避状态随基准提交清零；附录里写 `preflight：ok`。`test/follow.test.ts` 补齐：条目 1 两处加粗的情形各一条；
   本地有一个不是汇报的未推送提交且远端前进 → 不 rebase，3 圈只通知 1 条 `diverged`；rebase 冲突 → 放弃、仓库回到 rebase 之前、通知 1 条；留行的函数喂 500 行：完整模式 500 行都在、末尾模式只剩末 200 行；注入的子进程函数收到的模式：`report` / `report --json` / `preflight --json` 是完整，`run --continue` / `npm ci` 是末尾；
   远端有新提交而本地不领先 → 一圈之后本地 `HEAD` 等于远端、没有 `pull` 通知；
   `npm ci` 失败后目录不存在、之后成功能接着跑；用一个不存在的程序名调缺省的子进程实现（不会起任何进程）得到退出码 127；换了基准提交后不沿用上一个基准的退避。
   **每条多圈的用例都要断言实际走了几圈**（例如数注入的 `sleep` 被调了几次）。`test/invariants.test.ts` 加「`src/follow.ts` 不含 `pendingPush`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0 |
| 专项测试不少于 28 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(2[8-9]\|[3-9][0-9])$"` | exit 0 |
| 专项测试不在系统临时目录留下固定版本目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` | exit 0 |
| 分叉时会 rebase，且有测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "rebase" && grep -qE "rebase" test/follow.test.ts` | exit 0 |
| 通知等汇报上了远端才发（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "pendingReport" && grep -qE "pendingReport" test/follow.test.ts` | exit 0 |
| 不再用的状态已删掉（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "pendingPush"` | exit 0 |
| 不变量同步 | `grep -qE "pendingPush" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`、`eslint.config.js`、`vitest.config.ts`
- 为了让测试过而删除或跳过任何测试（改写 `test/follow.test.ts` 里与新行为冲突的旧用例不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 `npx` / `npm` 子进程或真实网络请求；自己在工作区里运行不带 `--dry-run` 的 `collie follow`
- 让 `follow` rebase 或改写汇报提交之外的任何提交；让它写 `docs/ops/queue-*.md` 之外的仓库文件；改动 `handoff.ts`、`run.ts`、`gate.ts`、`arbiter.ts`；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b08/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b08` 为提交信息单独提交并推送该文件。

## 上一轮判 FIX

### Gaps

- 验收命令 #1 (npm run lint) 退出码 1：src/follow.ts 有 2 处 Prettier 格式不一致（第 35 行 SpawnFn 类型签名、第 646 行链式调用）。运行 npx prettier --write src/follow.ts 即可修复。
- test #29 未测试真正的 defaultSpawn：条目 3 要求「用一个不存在的程序名调缺省的子进程实现得到退出码 127」，当前测试创建 fake 返回 127 然后验证返回 127，同义反复。需重写为调用实际 defaultSpawn（export 后直接调用，或不注入 spawn 走 follow 路径触发 ENOENT）。

### 未通过的验收命令

- `npm run lint` → exit 1

### 上一轮代码提交

- `132bf2f91590c10f843c9aa5ea97dfcdc1acb604`
- `7bf4a6d4a5c4b75181f6cf9e6b87d93775833b1d`
- `572836a93a1fdcfa20cce29bb5c00fd081f5e597`

这些提交已在审核范围内，只补缺口，不要重做。
