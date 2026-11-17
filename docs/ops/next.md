# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：97147e5
固定版本：cf4e02b
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十次队列 `--continue --max 3`，固定版本前移到 `cf4e02b`（应依次选中 v045-b12、b13、b14）

所有者已经把未决的事一次定完了（SPEC 14.17，`docs/decisions/OPEN.md`「已裁定」）。和你有关的几条：

- **v045-b11：采纳代码，状态保持 `blocked`。** 不重跑。
- **所有者与 R1 都只做方案设计和每个阶段的审核，不再动手。** 我以前审队列时自己写探针复测，以后不做了。
  需要读代码、做实验才能核对的事，从这一轮起都写在下面请你做；分工改造之后由需求审查做。所以这一轮「队列结束后」那一段比以前长，也比以前要紧。
- **分工要改**（SPEC 第 16 章，这一轮还不动）：验收测试由一个新的测试 agent 在 worker 之前写好，worker 只写实现，reviewer 改做需求审查。
- 花费不设额度；铁律不合理的，所有者和我讨论定了就改。

这一轮修的是你上一轮发现的那一处（SPEC 14.18）。有一点和你建议的不同：只把 report.md 从 reviewer 的 worktree 里删掉不够。
重跑时交给 reviewer 的 diff 从第一次的基准算起，上一轮的汇报就在 diff 里。所以分成两层：

- **v045-b12**：worktree 里没有汇报，取证范围的命令排除 `.collie/batches/`。
- **v045-b13**：删掉规则 4。reviewer 本来就不该拿得到 worker 的声称；就算它读到了什么，也改不了裁定。变异清单从 44 项变成 42 项。
- **v045-b14**：你第 4 条（reviewer 到轮数上限时花费没进 journal）。原因是我读代码推断的，没有实跑，见步骤 4。

**reviewer 的手册这一轮已经改了，这次队列就生效**（手册取自 `head_sha` 的工作目录）：不读 `.collie/batches/` 下任何一轮的汇报，`claim_mismatches` 固定填 `[]`，去掉了「声称与实测的差异」一节。
这一轮的 R2 还是旧的，规则 4 还在。**如果某个批次重跑时又被规则 4 降成 FIX，那是已知的缺陷**：照常写汇报，把那次 reviewer 读了哪些文件原样抄出来。

`--max 3`：固定版本 `cf4e02b` 里 `--max` 已经只数 PASS（v045-b10），这是它第一次在真实运行里计数。FIX 重跑不占名额，三批都通过才会以 `limit` 结束。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. **替我核对 v045-b14 的推断**（不影响开跑，结果写进汇报第一段）：上一轮 v045-b11 第 3 次运行（`r-20261117060404`）的 reviewer 事件流里，
   最后一条结果消息的 `subtype`、`total_cost_usd`、`num_turns` 原样抄出来；它之后还有没有别的消息；journal 里那次运行的 `reviewer.finished` 和它后面一条事件原样抄。
   我的推断是：SDK 给出结果消息之后又抛了错，`src/runner/claude.ts` 的出错分支把结果消息丢了。你看到的要是对不上，写明实际是怎么回事。
5. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。
6. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach cf4e02b && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `cf4e02b`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 cf4e02b && (cd /tmp/collie-r2 && npm ci)`。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v045-b12`，确认状态是 pending。
9. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
10. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
11. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对（原来由我做的那部分）

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v045-b12，修复是不是真的在起作用。** 在副本里把 `src/run.ts` 中拿掉汇报的那几行去掉（恢复成不拿掉），跑 `npm test -- test/reviewer-rerun.test.ts`：必须有用例失败。
  哪几条失败、失败信息原样抄。一条都不失败，说明这份测试守不住这次修复，这是这一轮最要紧的发现。
- **v045-b13，同样的做法。** 在副本里把 `src/arbiter.ts` 的规则 4 那一段加回去，跑 `npm test -- test/no-rule4.test.ts`：必须有用例失败。
  另外在主仓库 HEAD 上 `npm run test:mutation`：末行应是 `mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0`，用时抄上；跑完 `git status --porcelain` 为空。
- **v045-b14。** 读一遍 `src/runner/claude.ts` 的改动和新加的那组测试：新用例是不是真的「先给结果消息、再抛错」，还是只换了个结果类型。
- **reviewer 这一轮读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`git show`、`git log -p`，命中的原样抄；每份 `verdict.md` 里的 `claim_mismatches` 原样抄（应全是 `[]`）。
  有重跑的批次，写明第 2 次及以后的 reviewer 有没有碰上一轮的汇报。
- **`--max 3`。** `queue.finished` 原样抄。有 FIX 重跑的话，写明它有没有占名额。
- **照旧读代码找问题。** 三个批次改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。在分工改造落地之前，「判 PASS 之后查问题」只有你在做。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- worker 汇报里「偏离或疑问」关于改写或删去断言的内容原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
  v045-b13 点名允许删改的用例比较多，逐条对一下有没有动到点名之外的。
- 还没在真实运行里触发过的（出现了原样抄，没触发写没触发）：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report v045 queue 10`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
