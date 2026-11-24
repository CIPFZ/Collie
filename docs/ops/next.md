# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：1423160
固定版本：5742906
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3）。

## 本轮：第三十三次队列仍由 `collie follow` 来跑，应依次选中 v046-b44、v046-b45、v046-b46

第三十二次队列的汇报我核过了，裁定记在 SPEC 14.43。**`follow` 第一次真实使用成了**：从我推送指令到汇报进远端，中间没有人动手。你逐圈拼出来的那张表、还有「超时检查在推送之前」这一条，正是我要的。你第 6 段的几条：

- **第 1 条，超时与推送：** 我读了主循环，属实。修它的是 **v046-b44**（超时之后先同步再退出；顺带每圈打印一行，日志里看得出它在做什么）。这一轮它还没生效，所以 `--timeout` 设 8 小时。
- **第 2 条，续接会话的花费是累计值：** 记下了，不改。所有者定过开发阶段不看花费；以后要用这个数时先修它。
- **第 3 条，「声称不符」渲染成空、`why` 不显示跳过：** 就是 **v046-b45**。
- **第 4 条，b43 的 worker 用满了 60 分钟：** 是我把批次签大了（9 个旧测试文件要跟着动）。墙钟不动；以后这类批次单独成批、只做一件事。这一轮三批都小。
- **第 5 条，固定版本前移到 `5742906`：** 就是这一轮。从这一轮起，取证没过的运行不再拉起 reviewer。
- **第 6 条，旧的固定版本目录：** `/tmp/collie-r2`（`ae932f8`）与 `/data/tmp/collie-r2-collie-cca1f3b` 都可以删，用 `git worktree remove`，在 `follow` 没在跑的时候做。
- `exit-codes` 那处不在三类里的改动：我读了，同意你的判断，没有改松。通知只写「结束：limit」：等群机器人建好、真的收到过通知再定写什么。

**v046-b46** 是需求审查的第 2a 批：把 R2 的取证结果放进 reviewer 的提示词。手册这一轮不改，reviewer 仍会照手册重跑验收命令，属于预期。

`AGENT_KICKOFF.md` 的「交接走仓库」一节我加了一段「由 `collie follow` 跑的轮次」，做法和上一轮相同，以后不在 next.md 里重复写。

## 步骤

1. `git pull --ff-only`。只看、不改：`git status --porcelain` 应为空；`.collie/heartbeat.json` 应不存在；没有残留的 Collie 进程。有一条不对就停下报告，不起 `follow`。
   `.collie/follow.json` 现在是存在的（上一轮留下的，`handledBase` 是 `993adc7`），内容抄一下；`df -h / /data` 两行抄一下。
2. 在主仓库根起 `follow`：
   `nohup npx tsx src/cli.ts follow --timeout 28800 > /data/tmp/follow-$(date +%Y%m%d-%H%M).log 2>&1 &`
3. 它在跑的时候只读地观察，不碰主仓库。起了 2 个小时队列还没开始（开跑前检查一直不过）：中断它，写汇报、推送，等 next.md。
4. 看到远端有了 `ops: report queue <q_run_id> (base …)` 的提交，再让它空转两圈，然后 `kill -INT`。它退出之后你才可以往主仓库写东西。
5. 之后做下面的核对、写汇报。

## `follow` 这一次（比上一轮简单记）

- 逐圈的表（第几圈、几点、动作、做了什么、用了多久）；固定版本目录的名字；开跑前检查的 `runner` 一行；队列的退出码与标准输出；汇报在哪一圈提交、哪一圈推上去；通知几条、结果；`.collie/follow.json` 最后的内容。
- **有没有哪一步是你不得不伸手的。**
- 这一次是三个批次连着跑：和上一轮比，有没有新出现的不对劲。

## 新固定版本 `5742906` 里第一次生效的东西

- 取证没过的运行不再拉起 reviewer：journal 里是 `reviewer.skipped`（带 `rule`），`verdict.downgraded` 带 `assumed: true`，没有 `verdict.md`，`audit` 对那一次运行退出码是 2。这一轮真的出现了：那一次运行的事件名序列、`reviewer.skipped` 与 `verdict.downgraded` 两条原样抄，重跑的 task 里讲上一轮的那一节原样抄。
- 取证过了的运行：`evidence.collected` 在 `reviewer.started` 之前。

## 结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b44。**
  - 验收测试：实现整个撤掉，`new.test.ts` 必须全红、`keep.test.ts` 必须全绿；把「超时之后先同步」那一处撤掉，S1、S2 必须红；把每圈那一行撤掉，S3 必须红。
  - `test/follow.test.ts` 原有的 33 条有没有被动过（`git diff` 应为空）。
  - 同步那一段是不是抽成了一个函数、两处调用（读代码）。
  - 一次性实验（副本里，假的子进程，不起真的队列）：照你上一轮说的情形，让队列结束时已经过了超时：汇报推上去了没有、通知发了没有、退出码。
- **v046-b45。**
  - 验收测试：实现整个撤掉，`new` 全红、`keep` 全绿；`why` 那两处、「声称不符」那一处各撤一次。
  - 这一轮队列里有 `reviewer.skipped` 的运行的话，对它跑 `why`，原样抄；没有就在副本里造一次。
  - **没有跳过 reviewer 的运行一个字节都不变：** 上几轮你比过的那几个批次的 `why`（文字与 `--json`）、几个队列的 `report --queue`（文字与 `--json`），在这一批之前的提交与 HEAD 上逐字节比较。
  - 上一轮 v046-b43 第 2 次到第 3 次之间那份重跑的 task，用 HEAD 的代码重新渲染一遍（或在副本里重现规则 6）：「声称不符」一节原样抄，应该看得到两边的数。
- **v046-b46。**
  - 验收测试：实现整个撤掉，`new` 全红、`keep` 全绿；把「把取证结果传给 reviewer」那一处撤掉，S4 必须红；把 `evidence` 改回必填，S2、S3 必须红。
  - 这一轮队列里 v046-b46 自己的那次运行用的还是旧固定版本，看不到新提示词。请在独立克隆里用 HEAD 的 cli 真跑一个小批次（上几轮用过的那种），把 reviewer 拿到的提示词里「R2 的取证结果」一节原样抄出来；它这次还重跑验收命令吗（手册没改，预期仍会重跑）；它输出的结论里还有没有 `evidence` 一块。
  - 读代码确认：reviewer 的输入里没有 worker 的汇报或 `claims` 的任何一部分。
- **三批的验收测试：** 逐条情形对一遍用例（每个期望有没有断言、有没有只在 `catch` 里断言的、临时目录有没有清掉）；红检查的 `problems`；有没有 `misclassified`；reviewer 的「情形与验收测试」表与「测试缺口：」。
- **这一轮被删、被改的断言，请逐条过一遍**；v046-b46 点名允许改的只有 `reviewer-isolation` 那一处。
- **判 PASS 之后查出来的问题，照前几轮那样单列成表**，末尾写合计。
- 偶发失败、reviewer 读了什么、照旧读代码找问题：照常。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI（主分支红过的话，从哪个提交到哪个提交、多久）、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、测试 agent / worker / reviewer 的轮数与用时。
- 每批：`tester.started` 到 `batch.task_written` 的先后；信封提交里的文件；`test/acceptance/<批次>/` 下三个文件的全文和测试 agent 的最终回复全文贴进批次汇报的附录；worker 有没有碰 `test/acceptance/`。
  测试 agent 这一步没过、或者 worker 声明了 `disputed_tests`：照以前的办法记（`tester.md` 全文；先核对 worker 说的对不对）。队列会停下，`follow` 照样会交汇报；不要重跑。
- 每次取证里变异检查的结果与 `acceptance_passed` / `acceptance_total`；每个会话里接口重试的次数与状态码；worker「偏离或疑问」与 reviewer「被改写或删去的断言」原样抄。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报；`reviewer.skipped`。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）。队列汇报 `docs/ops/queue-<q_run_id>.md` 由 `follow` 写。
提交 `ops: report queue 33`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
