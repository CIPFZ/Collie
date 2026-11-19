# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：a020ea1
固定版本：86b3cad
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十九次队列 `--continue --max 3`，固定版本前移到 `86b3cad`（应依次选中 v046-b17、b18、b19）

第十八次队列的汇报我核过了，两批的 PASS 都成立，裁定记在 SPEC 14.28。你在克隆里把接线后那一步真跑三组，做得很细，正是我要的。你第 7 段的几条：

- **第 1 条，测试 agent 改了被跟踪文件会被一起提交：** 在带情形的批次正式跑之前修，就是 **v046-b17**。上报前先把主工作区恢复干净，测试 agent 动过的被跟踪文件不进 R2 的提交。
- **第 2 条，push 上限 5→6：** 算数。它正好等于现在的 6 处，没有多放，worker 和两个 reviewer 都列了，是「新行为直接要求的最小改动」。
- **第 3 条，heartbeat 的 `phase` 停在 `tester`：** 并进 v046-b17。那 153 个残留目录你可以删了（我不需要看，原因不明、HEAD 上没复现）。
- **第 4 条，固定版本前移到 `86b3cad`：** 就是这一轮。本仓库的配置这一轮仍不加新配置项：v046-b17 还要再加一个 `worktree_secs`，等接线第二块进了固定版本一起加。
- 你问的「接口错误算不算可续跑的中断」记成了 D11，等所有者定；队列跑着时只在仓库外写东西，已照办。

这三批是接线第二块（收尾，SPEC 16.16）：b17 修上面两处 + 给测试 agent 单独的墙钟 + 放宽两条高负载下会超时的用例；b18 让带情形的 worker 任务书多出情形与接口两节；b19 让 `why`/`report` 显示测试 agent 的花费、审核手册补一句。
三批都**不带情形**，所以队列本身走不到新的那一步；带情形的批次要等这三批进了固定版本、`[agent.tester]` 加进本仓库配置之后，由我签第一个。

**v046-b19 有一处要注意：** 它经条目点名改 `AGENT-reviewer.md`（受保护路径）。取证时这处改动会被算进 `spec_diff_lines`，所以 b19 大概率会判 FIX 或 BLOCK（规则 2）——**这是预期的**。
它的代码和手册改动都在主分支上，CI 绿、验收过时，按 v04-b01 的先例由我采纳、改状态格。你照常把结论、`spec_diff_lines`、reviewer 的 gaps 原样抄回来就行，不用自己处理。

## 固定版本 `86b3cad` 里第一次生效的东西

- 带情形的批次会在写 task 信封之前先拉起测试 agent（现有批次都不带情形，不受影响）。
- 不带情形的批次：journal 里每次运行多 2 条 `r2.commit`；受保护路径的计数只认 journal 里的提交号；活性指纹不碰 git 索引。这些上一轮已验证不会误拦。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`、没有 `test/acceptance/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach 86b3cad && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `86b3cad`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 86b3cad && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b17`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    b19 如果因为改了 `AGENT-reviewer.md` 被规则 2 判 FIX / BLOCK，那是预期的；按第 10 步写汇报、推送、停下，不要自己重跑。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b17（最要紧）。**
  - 你上一轮那条「测试 agent 改被跟踪的 `docs/progress.md`」的一次性用例，在 HEAD 上再跑一遍：现在它动过的那一行**不该**进 R2 的任何提交，`git log` 里查不到；`tester.md` 里列了被动过的文件。原样抄。
  - 在克隆里真跑一个带情形的小批次（就用上一轮那组 textutil），worker 工作期间每秒读一次 heartbeat：`phase` 应该是 `worker`，不再是 `tester`。抄几条。
  - 在副本里把「上报前恢复工作区」那一处撤掉，跑 `npm test -- test/tester-step.test.ts`：必须有用例失败。
  - 在副本的 `.collie/collie.toml` 里加 `worktree_secs = 60`，分别用固定版本 `86b3cad` 的 cli 和 HEAD 的 cli 跑 `preflight`：预期旧的报不认识的字段、新的正常。
- **v046-b18。** 在克隆里跑那个带情形的小批次，把 worker 拿到的 `task.md` 全文抄出来：应该有「本批次情形」「本批次接口」两节，以及「验收测试……你不能改」那句。
  再确认一个不带情形的批次的 `task.md` 和以前一样（可对比固定版本与 HEAD 各渲染一次，或读代码说明）。
- **v046-b19。**
  - 对一个带测试 agent 的运行（上一轮克隆里 `v099-t01` 的 journal 还能复刻，或新跑一个）跑 `why <run_id>`：输出里应有测试 agent 的轮数与花费。抄那几行。
  - 对一个不带测试 agent 的运行跑 `why`：输出应和固定版本一样（可两个 cli 各跑一次比对）。
  - `AGENT-reviewer.md` 补的那一句原样抄；这一批的 `spec_diff_lines` 是多少、结论与规则，原样抄（预期因改手册被规则 2 判非 PASS）。
- **这一轮被删、被改的断言，请逐条过一遍。** 三个批次各自的范围里，`test/` 下每一条被删或改的 `expect(`：是不是条目点名允许的、是不是「最小改动」、有没有被改松；不是点名的，把它原来守的那一处撤掉看变不变红。
- **新固定版本的几项**：每次运行 journal 里 `r2.commit` 的条数与 `spec_diff_lines`（带情形的批次正式跑之前，这几批都不带情形，应该都是 0，除了 b19 改手册那一处）。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；若有用例因自带超时到点（不是断言失败），写明是哪个文件、负载多少。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。b17 改的是 `src/run.ts` 的要紧处，请多看两眼：`git checkout -- . && git clean -fd` 只在 `tester_touched_main_tree` 这一条路径上，没有用在别处。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该；b19 因改手册被规则 2 拦下算一次预期的打扰）。
- 每个 worker、reviewer 会话里接口重试的次数。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.16、14.28）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 19`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
