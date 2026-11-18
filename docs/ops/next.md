# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：5b8363c
固定版本：c475eaa
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十五次队列 `--continue --max 3`，固定版本前移到 `c475eaa`（应依次选中 v046-b09、b10、b11）

第十四次队列的汇报我核过了，裁定记在 SPEC 14.25。你查 CI 日志、在本机去掉全局身份复现的那一步是这一轮的关键，我用已有的测试照你的做法各跑了一遍，结论一样：
没有 git 全局身份时全量测试 1308 条里恰好 1 条失败。你第 8 段的几条：

- **第 1 条，先把主分支 CI 修绿：** 就是 **v046-b09**。它同时收掉你查出来的另外两处同类问题（两份测试断言整个系统临时目录；b07 那条测试又绑回本仓库配置），并给 `Sandbox` 加一个留 journal 的开关。
  **v046-b08 保持 `blocked`**，代码不回退；算不算数看 b09：b09 通过，就是 R2 在含这些代码的树上拿到了 CI 全过的证据。
- **第 2 条，规则 9 的重跑：** task 带上 `head_sha` 与 CI 运行的链接，是 **v046-b11**。「同一个 `head_sha` 再被规则 9 降级就直接上报」是改队列的规则，我转给所有者了（`docs/decisions/OPEN.md` 的 D10）。
  worker 的手册我加了一段：规则 9 的失败在 CI 的机器上，环境不同；查不出来就写明，不要只重写汇报。
- **第 3 条，固定版本：** 前移到 `c475eaa`（b07 的裁定提交，CI 最后一次成功的地方），不含 b08 的代码。本仓库的配置这一轮不加新配置项。
- **第 4 条，接线时带回测试 agent 的回复、类别标错不再重拉：** **v046-b10**。「不再重拉」我没有按红检查的原因文字判断，而是让测试 agent 在汇报的 JSON 里用 `misclassified` 自己声明
  （手册已加）：「本该失败的通过了」也可能只是它的断言写弱了，那种情况重写是有用的。
- `verdict-ci-recheck` 的偶发失败：你 60 次没有复现，我这边这一轮又出了两条别的（`no-rule4`、`queue-limit` 各一条，预期退出码 0、实际 20）。
  三条的共同点是沙箱里的一次运行意外地以上报结束。原因我仍然不知道。你建议的两处 `catch` 记事件并进了 v046-b11；b09 通过之后我在自己的机器上带着留 journal 的开关跑，拿到 journal 再说。

## 这一轮开跑时会看到、属于预期的

- **主分支的 CI 现在是红的**，包括我这次推送的两个提交。队列启动时会打印 `warning: previous verdict commit … CI failure`，这是预期的，不用停。
- v046-b09 自己的 `head_sha` 带着修复，它的 CI 应该是绿的。**如果 b09 仍然被规则 9 降级**：把那次 CI 运行的作业日志里失败的那几行抄进汇报（像上一轮那样），这是这一轮最要紧的信息。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`、没有 `test/acceptance/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach c475eaa && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `c475eaa`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 c475eaa && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b09`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b09（最要紧）。**
  - 主分支的 CI：b09 的代码提交之后的每一次 CI 运行的结论列出来。应该从它起回到成功。
  - 在副本的 `.collie/collie.toml` 里加 `tester_max = 3` 与 `static = ["npm run lint"]`，跑全量 `npm test`：必须全过（上一轮这样改会挂 1 条）。
  - 在副本里把 `test/prepare-acceptance.test.ts` 的身份修复撤掉，跑 `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts`：必须有用例失败。
  - 上一轮那个并发实验再做一遍：4 份全量 `npm test` 同时跑一轮，`prepare-acceptance` 与 `redcheck` 两个文件不应该再失败。
  - 留 journal 的开关：`d=$(mktemp -d) && COLLIE_TEST_KEEP_RUNS=$d npm test -- test/queue-limit.test.ts`，列出 `$d` 下的目录结构与一个 `TEST_NAME` 的内容。
    再带着这个开关加负载跑几轮全量测试（像上一轮那样）：有失败的用例，就把对应沙箱留下的 journal 原样抄出来。
- **v046-b10。** 用真实的运行器把上一轮的两组再调一遍：
  - 类别标错的那一组：预期只拉起 1 次，`ok` 为 false、`reason` 为 `misclassified`，`reports` 里有它请方案设计者改类别的那份回复。返回值与 `record` 的事件原样抄；它的 JSON 里 `misclassified` 填了什么。
    它要是没有在 JSON 里声明（于是照常被拉起第 2 次），把它的最终回复全文抄出来：那说明手册新加的那句话不够。
  - 正常的那一组：预期和上一轮一样 1 次过，`reports` 有 1 条。
  - 在副本里撤掉「声明了类别标错就不再重拉」那一处，跑新的那一组测试：必须有用例失败。
- **v046-b11。**
  - 在副本里撤掉 `src/run.ts` 这一批的改动，跑 `npm test -- test/queue-journal.test.ts test/verdict-ci-recheck.test.ts`：必须有用例失败。
  - 把新用例里那份规则 9 重跑的 task 打印出来，「降级原因」一节原样贴进汇报。
  - 这一批改的是 R2：reviewer 对两处加粗情形给的证据原样抄。
- **新固定版本第一次生效的几项**（出现了原样抄，没触发写没触发）：有 FIX 重跑的批次，`queue.finished` 原样抄；多于一条结果消息的会话。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 三个批次改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。
  请特别看一眼：这三批新加或改过的测试，还有没有用到「这台机器碰巧有」的东西（home 目录、全局配置、系统临时目录里的固定名字、固定端口）。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。b09 点名允许改写的只有 `test/config.test.ts` 的一条，b11 只有 `test/schema.test.ts` 的一条，b10 一条都不许改。
- worker 有没有去读条目里点名的 SPEC 小节（16.13、14.25、16.12）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 15`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
