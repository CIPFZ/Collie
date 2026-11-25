# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：2f372aa
固定版本：fcfc76f
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3）。

## 本轮：第三十四次队列由 `collie follow` 来跑，应依次选中 v046-b47、v046-b48

第三十三次队列的汇报我核过了，三批的 PASS 都成立，裁定记在 SPEC 14.44。`/tmp` 会被定期清理这一条是你顺手删旧目录时查出来的，以前谁都没发现；我记进了 `AGENT_KICKOFF.md` 的「已知环境问题」。你第 6 段的几条：

- **第 1 条，固定版本前移到 `fcfc76f`：** 就是这一轮。
- **第 2 条，`/tmp` 被清理：** 已记。`follow` 在系统临时目录就是 `/tmp` 的机器上会有同样的问题，记在后续计划里，拿外部项目试用之前处理。
- **第 3 条，CI 查不到的环境里一律跳过 reviewer：** 记进了 14.44，不改（那种环境里本来也没有批次能通过）。
- 取证等 CI 变长、`follow` 汇报里的空代码块、`evidence` 是「补默认值」而不是字面上的可选：都记了，不改。

**我的一处疏漏，和这一轮的两批有关：** 我原来写的是「v046-b46 通过后我重写 reviewer 手册」。动手之前我去读了 R2 拼给 reviewer 的提示词，「验收命令」一节自己写着「逐条原样实跑」。只改手册，两份会说相反的话。
所以这一轮手册不动，先签 **v046-b47** 改提示词；**v046-b48** 是结论里多一栏 `test_gaps`（通过但有测试缺口时队列停下）。两批进了固定版本之后我一次重写手册。两批都带情形。

## 这一轮顺便真跑一次 v046-b44 的修复

`follow` 用的是主仓库 HEAD 的代码，v046-b44 从这一次启动起生效。**这一次故意把 `--timeout` 设成 1800 秒**，比队列短：队列结束时已经过了超时，照修复之后的做法，它应当先把汇报推上去、试着发通知，然后打印 `follow: timeout reached`、自己退出，退出码 0。

所以这一轮你不用 `kill`：
- 它自己退出之后，先只读地看：`git log origin/main..HEAD --oneline` 应为空（汇报已经在远端）；日志最后几行原样抄；进程的退出码（起的时候用 `; echo "exit=$?" >> <日志>` 接在命令后面记下来）。
- **汇报没有被推上去**（`origin/main..HEAD` 里还有 `ops: report queue` 的提交）：原样记下，手工 `git push`，在汇报里写明。这就说明修复在真实运行里不成立，我下一轮处理。
- 日志里现在每圈应该有一行 `follow: action=<动作>`，照抄。

## 步骤

1. `git pull --ff-only`。只看、不改：`git status --porcelain` 应为空；`.collie/heartbeat.json` 应不存在；没有残留的 Collie 进程。有一条不对就停下报告，不起 `follow`。`.collie/follow.json` 的内容、`df -h / /data` 两行抄一下。
2. 在主仓库根起 `follow`（日志放 `/data/tmp`，不要放 `/tmp`）：
   `nohup sh -c 'npx tsx src/cli.ts follow --timeout 1800; echo "exit=$?"' > /data/tmp/follow-$(date +%Y%m%d-%H%M).log 2>&1 &`
3. 它在跑的时候只读地观察，不碰主仓库。起了 2 个小时队列还没开始：这一次它会因为超时自己退出，照实记，写汇报、推送，等 next.md。
4. 它退出之后，照上面一节核对，然后做下面的核对、写汇报。

## 新固定版本 `fcfc76f` 里第一次生效的东西

- reviewer 的提示词里有「R2 的取证结果」一节（它这一轮仍会重跑验收命令：改提示词的正是这一轮的 v046-b47）。任一次运行的 reviewer 提示词里那一节原样抄一份。
- `why` 对跳过了 reviewer 的运行显示 `reviewer: skipped (rule N)`；重跑的 task 里「声称不符」有数。这一轮真的出现了 `reviewer.skipped`：那一次运行的事件名序列、`why` 的输出、重跑的 task 里讲上一轮的那一节原样抄。

## 结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b47。**
  - 验收测试：实现整个撤掉，`new.test.ts` 必须全红、`keep.test.ts` 必须全绿。
  - 输入不带 `evidence` 时提示词逐字节不变：同一份输入，这一批之前的提交与 HEAD 各生成一次，比较。
  - 带 `evidence` 的提示词全文抄一份进批次汇报（我重写手册时要对着它写）。
  - 独立克隆里用 HEAD 的 cli 真跑一个小批次：reviewer 这一次还重跑验收命令吗（手册没改、提示词改了，两边现在说法相反，我想知道它听谁的）；它输出的结论里还有没有 `evidence`。照实写，哪种结果都不算这一批的错。
- **v046-b48。**
  - 验收测试：实现整个撤掉，`new` 全红、`keep` 全绿；放行判定里新加的那一项单独撤，S2、S3 必须红；`reviewer.verdict` 带 `test_gaps` 的那一处单独撤，S4 必须红。
  - 变异检查：副本里跑一次，末行原样抄（预期 `caught 48 survived 0 …`）。
  - 一次性用例（`Sandbox` + `FakeRunner`，放仓库外）：
    结论是 FIX、带 `test_gaps`：预期照常返工，重跑的 task 里**没有** `test_gaps` 的内容；
    结论是 PASS、`gaps` 与 `test_gaps` 都非空：`queue.paused` 的 `reasons` 两个都有；
    单批次模式、PASS 带 `test_gaps`：退出码 0。
  - 固定版本 `fcfc76f` 碰到带 `test_gaps` 的结论是什么表现（预期：结论无法解析，规则 1）。原样抄。所以手册要等这一批进了固定版本才能让 reviewer 写这一栏。
  - `why`、`report` 对带 `test_gaps` 的运行显示成什么样（这一批没有改查看命令；看不出来就照实写，我再签）。
- **两批的验收测试：** 逐条情形对一遍用例（每个期望有没有断言、有没有只在 `catch` 里断言的、临时目录有没有清掉）；红检查的 `problems`；有没有 `misclassified`；reviewer 的「情形与验收测试」表与「测试缺口：」。
- **这一轮被删、被改的断言，请逐条过一遍**；v046-b48 点名允许改的只有 `test/gate.test.ts` 的夹具那一行。
- **判 PASS 之后查出来的问题，照前几轮那样单列成表**，末尾写合计。
- 偶发失败、reviewer 读了什么、照旧读代码找问题：照常。

## 常规项（写进汇报）

- `follow` 这一次：逐圈的表、固定版本目录的名字、开跑前检查的 `runner` 一行、队列的退出码与标准输出、汇报在哪一步提交与推送、通知几条与结果、`.collie/follow.json` 最后的内容、**有没有哪一步是你不得不伸手的**。
- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI（主分支红过的话，从哪个提交到哪个提交、多久）、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、测试 agent / worker / reviewer 的轮数与用时。
- 每批：`tester.started` 到 `batch.task_written` 的先后；信封提交里的文件；`test/acceptance/<批次>/` 下三个文件的全文和测试 agent 的最终回复全文贴进批次汇报的附录；worker 有没有碰 `test/acceptance/`。
  测试 agent 这一步没过、或者 worker 声明了 `disputed_tests`：照以前的办法记，不要重跑。
- 每次取证里变异检查的结果与 `acceptance_passed` / `acceptance_total`；每个会话里接口重试的次数与状态码；worker「偏离或疑问」与 reviewer「被改写或删去的断言」原样抄。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报；真实队列里的 `reviewer.skipped`。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）。队列汇报 `docs/ops/queue-<q_run_id>.md` 由 `follow` 写。
提交 `ops: report queue 34`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
