# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：6c466c2
固定版本：61d5ee2
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3）。

## 本轮：第三十五次队列由 `collie follow` 来跑，应依次选中 v046-b49、v046-b50

第三十四次队列的汇报我核过了，两批的 PASS 都成立，裁定记在 SPEC 14.45。v046-b44 的修复在真实运行里成立：跑过超时之后它自己推送了汇报再退出，你没有伸手。
**所有者据此把第 14 章「收掉操作员」记为收口了**（D15）。你在克隆里查「reviewer 听谁的」那一次，正好说明了手册和提示词要一起换。

你汇报里的几条：
- **`why`、`report` 看不到 `test_gaps` 的内容：** 就是 **v046-b50**。
- `testGapsCount` 做成了可选、两节之间多一个空行：记一笔，不改。

**这一轮的两件事：**
1. **我重写了 `AGENT-reviewer.md`**（需求审查，所有者 2026-11-24 同意）。固定版本前移到 `61d5ee2` 之后，提示词也不再要求重跑。所以从这一轮起，**reviewer 应该不再重跑验收命令、不查推送与 CI，结论里不写 `evidence`，测试的缺口写进 `test_gaps`**。这一条请重点看。
   同时改了铁律 6 的「只看」清单、`ROLES.md` 的 R4 一节。
2. **v046-b49** 是需求审查第 3 批：reviewer 可以有 `Write`、`Edit`，在自己的临时工作目录里写实验；它结束之后 R2 查主工作区，不干净就上报。本项目配置里给 reviewer 加写工具，要等这一批进了固定版本之后由我改，这一轮 reviewer 仍然没有写工具。

`--timeout` 这一轮设 8 小时。

## 步骤

1. `git pull --ff-only`。只看、不改：`git status --porcelain` 应为空；`.collie/heartbeat.json` 应不存在；没有残留的 Collie 进程。有一条不对就停下报告，不起 `follow`。`.collie/follow.json` 的内容、`df -h / /data` 两行抄一下。
2. 在主仓库根起 `follow`（日志放 `/data/tmp`）：
   `nohup sh -c 'npx tsx src/cli.ts follow --timeout 28800; echo "exit=$?"' > /data/tmp/follow-$(date +%Y%m%d-%H%M).log 2>&1 &`
3. 它在跑的时候只读地观察，不碰主仓库。起了 2 个小时队列还没开始：中断它，写汇报、推送，等 next.md。
4. 看到远端有了 `ops: report queue <q_run_id> (base …)` 的提交，再让它空转两圈，然后 `kill -INT`。它退出之后你才可以往主仓库写东西。
5. 之后做下面的核对、写汇报。

## reviewer 用新手册的第一轮（最要紧）

两次运行的 reviewer 各看一遍：
- 它的工具调用清单原样抄（命令截到 200 字）：**还重跑验收命令吗**；查推送、CI 吗；读了哪些文件。
- 它的结论 JSON 原样抄：有没有 `evidence`；`test_gaps` 写了什么。
- 「条目要求与额外禁止」表、「情形与验收测试」表原样抄；每个打勾有没有附 `文件:行号`。
- 用时与轮数，和前几轮比。
- 它查出了什么你也查出了、什么你查出了它没查出来：写进「判 PASS 之后查出来的问题」那张表的「谁没发现」一栏。

**有一种情况要停下：** 结论里出现 `test_gaps` 而结论是 PASS，队列会停下（退出码 30，`queue.paused` 的 `reasons` 含 `test_gaps`）。这是设计如此：`follow` 照样会交汇报。不要重跑，把 `test_gaps` 原样抄进汇报，由我定要不要签一批把测试补硬。

## 结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b49。**
  - 验收测试：实现整个撤掉，`new.test.ts` 必须全红、`keep.test.ts` 必须全绿；「事后查主工作区」那一处单独撤，S2、S3、S6 必须红；提示词那一句单独撤，S5 必须红。
  - 测试 agent 那一步「动了主工作区」的检查是不是和 reviewer 共用一个函数（读代码）；共用之后测试 agent 那一步的行为有没有变（`test/tester-step.test.ts` 照常通过，有一次性用例更好）。
  - 一次性实验（独立克隆，HEAD 的 cli，真实运行器）：克隆的配置里给 reviewer 加 `Write`、`Edit`，跑一个小批次。reviewer 有没有真的在自己的目录里写临时文件做实验、写了什么；主工作区干不干净；它的结论与 `audit` 的结果。
    （这一次不加探针让它故意写主仓库；那一条靠验收测试。）
- **v046-b50。**
  - 验收测试：实现整个撤掉，`new` 全红、`keep` 全绿。
  - 没有 `test_gaps` 的运行一个字节都不变：上几轮你比过的那几个批次的 `why`（文字与 `--json`）、几个队列的 `report --queue`，这一批之前的提交与 HEAD 上逐字节比较。
- **两批的验收测试：** 逐条情形对一遍用例；红检查的 `problems`；有没有 `misclassified`。
- **这一轮被删、被改的断言，请逐条过一遍**；v046-b49 点名允许改的只有 `reviewer-isolation` 里 `it.each` 的清单。
- **判 PASS 之后查出来的问题，照前几轮那样单列成表**，末尾写合计。
- 偶发失败、reviewer 读了什么、照旧读代码找问题：照常。

## 常规项（写进汇报）

- `follow` 这一次：逐圈的表、固定版本目录、开跑前检查的 `runner` 一行、队列的退出码与标准输出、汇报在哪一步提交与推送、通知几条与结果、`.collie/follow.json` 最后的内容、**有没有哪一步是你不得不伸手的**。
- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、测试 agent / worker / reviewer 的轮数与用时。
- 每批：`tester.started` 到 `batch.task_written` 的先后；信封提交里的文件；`test/acceptance/<批次>/` 下三个文件的全文和测试 agent 的最终回复全文贴进批次汇报的附录；worker 有没有碰 `test/acceptance/`。测试 agent 这一步没过、或者 worker 声明了 `disputed_tests`：照以前的办法记，不要重跑。
- 每次取证里变异检查的结果与 `acceptance_passed` / `acceptance_total`；每个会话里接口重试的次数与状态码；worker「偏离或疑问」与 reviewer「被改写或删去的断言」原样抄。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报；真实队列里的 `reviewer.skipped`；通过但有 `test_gaps` 的停表。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）。队列汇报 `docs/ops/queue-<q_run_id>.md` 由 `follow` 写。
提交 `ops: report queue 35`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
