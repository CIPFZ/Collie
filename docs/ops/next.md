# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：993adc7
固定版本：cca1f3b
批次上限：1

上面四行是给 `collie follow` 读的键值行（SPEC 14.3）。**这一轮它们第一次真的由 `collie follow` 来读。**

## 本轮：第三十二次队列由 `collie follow` 来跑（第一次真实使用），应选中 v046-b43

第三十一次队列的汇报我核过了，两批的 PASS 都成立，裁定记在 SPEC 14.42。你用真实的运行记录把我的归档核了一遍（22 条命令逐字节相同），这一条我自己做不了，谢谢。你第 8 段的两条：

- **固定版本前移到 `cca1f3b`：** 就是这一轮。
- 磁盘已知。ssh 被远端断开、配置报错带绝对路径：记一笔，不改。

**所有者今天定了三件事（SPEC 14.42）：**
1. 需求审查的方案同意了（D14）。分三批落地（SPEC 16.29），第 1 批是 **v046-b43**：R2 先取证，取证没过就不拉起 reviewer。它带情形。
2. reviewer 遇到模型接口出错时怎么办（D13）：照现在，不改。
3. **这一次队列就用 `collie follow` 跑。** 所有者会在旁边看着。企业微信群机器人还没建，通知会全部跳过，属于预期。

所以这一轮你的活变了：**不再手工做开跑前的检查、不手工起队列、不手工生成汇报。你只起一条命令，然后看着它，把它做了什么记下来。** 成不成的标准只有一条：从我推送这份指令到队列汇报进仓库，中间没有人动手。

我另外改了几处文档与配置，你不用处理：铁律 2、4 与 `ROLES.md`（加了 R6 测试 Agent）；本项目 `.collie/collie.toml` 加了 `[notify]`（地址文件不存在时跳过）。

## 步骤

1. `git pull --ff-only`。然后只看、不改，把下面几样记下来（写在仓库外，最后进汇报）：
   - `git status --porcelain` 应为空；`.collie/heartbeat.json` 应不存在；没有残留的 Collie worker、`cli.ts` 或 `node -e` 进程。有任何一条不对：停下报告，不起 `follow`。
   - **`.collie/follow.json` 应不存在**（主仓库里从来没有跑过 `follow`）。存在：把内容原样抄下来，停下报告，不起 `follow`。
   - `df -h / /data` 两行；`test -s ~/.config/collie/github-token` 的结果；`~/.config/collie/notify-webhook` 在不在（只写在或不在，不要打印内容）。
   - 这一次**不要**手工跑基线 `npm test`、`npm run test:mutation`、`preflight --smoke`，也不要自己准备 `/tmp/collie-r2`：这些正是要看 `follow` 自己做不做、做得对不对的。
2. 在主仓库根起 `follow`，放到后台，输出接到仓库外的文件里：
   `nohup npx tsx src/cli.ts follow --timeout 14400 > /data/tmp/follow-$(date +%Y%m%d-%H%M).log 2>&1 &`
   记下进程号和日志文件名。用的是主仓库 HEAD 的 `follow`；它自己会按「固定版本」去准备 R2 的目录、用那一份跑开跑前检查与队列。
   用 `--timeout`，不用 `--once`（汇报的推送发生在跑完之后的下一圈，SPEC 14.14）。
3. 之后只观察，**不要碰主仓库**（不提交、不推送、不在里面跑别的 Collie 命令；`follow` 每一圈都会动 git）。每隔一会儿只读地记：日志新增的行、`.collie/heartbeat.json` 的 `phase`、`git status --porcelain`、`.collie/follow.json` 的内容。
   - 它在开跑前检查上没过（比如接口慢）：它会自己退避重试（5 分钟起，逐次加倍），不用你管，照实记。**起了 2 个小时队列还没开始：中断它，写汇报、推送，等 next.md。**
   - 队列开头有十来分钟是测试 agent，之后是 worker、取证（含变异检查约 5 分半）、reviewer。这一批要改不少旧测试，worker 可能比平时久，返工也属正常。
4. 队列结束之后，`follow` 会在随后的一圈里把汇报 `docs/ops/queue-<q_run_id>.md` 提交并推送（提交说明是 `ops: report queue <q_run_id> (base …)`）。
   看到远端 `main` 上有了这个提交，再让它空转两圈，然后中断它（`kill -INT <进程号>`），记下它是怎么退出的。等它到点自己退出也可以。
   **`follow` 退出之后，你才可以往主仓库写东西。**
5. 退出之后：每个 run_id 手工跑一次 `npx tsx <固定版本目录>/src/cli.ts audit <run_id>`（固定版本目录是 `follow` 自己建的那个，名字在日志里）。然后做下面的核对、写汇报。

## `follow` 做了什么（这一轮最要紧，请写细）

- 日志全文贴进汇报的附录（太长就贴开头 60 行、结尾 60 行，中间每一圈留它打印的动作那一行）。
- 逐圈列一张表：第几圈、几点、它判断的动作是什么、做了什么、用了多久。
- 固定版本的目录：建在哪、叫什么、`node_modules` 是链接还是重新装的。
- 开跑前检查：它跑的命令与结果（`runner` 一行应带 `secs=`；超过 60 秒现在会判不过）。
- 队列：它起的命令、它看到的退出码、标准输出。
- 汇报：`docs/ops/queue-<q_run_id>.md` 的全文；与你事后在同一份 journal 上手工跑 `npx tsx src/cli.ts report --queue <q_run_id>` 的输出比较，哪里不同。
- 提交与推送：哪一圈提交的、哪一圈推上去的、提交里有哪些文件（应该只有 `docs/ops/` 下那一个）。
- 通知：它试着发了几条、各是什么内容、结果（预期都是跳过）。只写条数、文本和结果，不要写地址。
- `.collie/follow.json` 最后的内容原样抄。
- 它在工作区里还留下了什么（`git status --porcelain`、系统临时目录里以 `collie-` 开头的新目录）。
- **中间有没有哪一步是你不得不伸手的**（哪怕只是一次）。有：是什么、为什么。没有：写「没有」。
- 你看着觉得不对劲、或者以后没人看着时会出事的地方，都写下来。

## v046-b43 的核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。这一批用的固定版本还是旧顺序，新顺序要到下一轮才在真实运行里出现，所以这一次全靠副本里的实验：

- **验收测试够不够硬：** 把 worker 的实现整个撤掉，`new.test.ts` 必须全红、`keep.test.ts` 必须全绿；把「取证没过就不拉 reviewer」的判断改成永远拉起，S1、S3 必须红；把取证挪回 reviewer 之后，S4 必须红。逐条情形对一遍用例。
- **旧测试被改了哪些（最要紧）：** `git diff <信封提交>..<head_sha> -- test/`（不含 `test/acceptance/`）逐处过一遍，列成表：文件、用例名、改了什么、属于条目允许的三类里的哪一类（(a) 拿掉用不到的 reviewer 场景；(b) reviewer 事件由「有」改成「没有」并断言 `reviewer.skipped`；(c) 点名的两处）。
  **不属于这三类的改动，一处都要单独标出来**，并写明你的判断：改松了没有。被动过的用例里，退出码、规则号、`verdict.downgraded`、`acceptance.failed`、`claim.mismatch` 这些断言是不是一条没动。
- **队列模式（验收测试没有覆盖，请你补做）：** 一次性用例，
  - 全局验收命令一直失败：队列照 `fix_max` 重跑、每一次都是 `reviewer.skipped`、最后以 `fix_max` 停下；重跑的 task 里「降级原因」「未通过的验收命令」在，没有「Gaps」一节。
  - CI 失败（规则 9）：`reviewer.skipped` 的 `rule` 是 9；worker 没有新提交再来一次，以 `rule9_same_head` 停下。
  - 取证过了、reviewer 判 FIX 带 gaps：重跑的 task 里有「Gaps」。
  每种把队列 journal、各次运行 journal 的事件名序列、退出码原样抄。
- **前后对比：** 取证全过的运行（reviewer 判 PASS、判 FIX 各一），在这一批之前的提交与 HEAD 上各跑一遍：除了 `ci.resolved`、`evidence.collected` 挪到了 `reviewer.started` 之前，事件与字段、progress、裁定提交里的文件、退出码应该都相同。不同的原样抄。
- **没有 reviewer 的运行在查看命令里是什么样：** 对一次 `reviewer.skipped` 的运行跑 `why <批次>`、`status`、`report`（队列模式那次），输出原样抄；`collie audit <run_id>` 的退出码；批次目录里有没有 `verdict.md`。看着别扭或者会误导人的地方写下来（这一批没有改查看命令）。
- **变异检查：** 副本里跑一次，末行原样抄（预期 `caught 47 survived 0 …`）；worker 有没有动 `scripts/mutation.ts`，动了哪几项、为什么。
- **判 PASS 之后查出来的问题，照前几轮那样单列成表**，末尾写合计。
- 偶发失败、reviewer 读了什么、照旧读代码找问题：照常。

## 常规项（写进汇报）

- attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列只动一格、测试 agent / worker / reviewer 的轮数与用时。
- `tester.started` 到 `batch.task_written` 的先后与字段；红检查的 `problems`；信封提交里的文件；`test/acceptance/v046-b43/` 下三个文件的全文和测试 agent 的最终回复全文贴进批次汇报的附录；worker 有没有碰 `test/acceptance/`。
  测试 agent 这一步没过、或者 worker 声明了 `disputed_tests`：照以前的办法记（`tester.md` 全文；先核对 worker 说的对不对），不要重跑。
- 取证里变异检查的结果与 `acceptance_passed` / `acceptance_total`；每个会话里接口重试的次数与状态码；worker「偏离或疑问」原样抄（这一批它要列的东西多，全文都要）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报；验收命令没过时的 `output_tail`。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`），其中「`follow` 做了什么」单列一段、放在最前面。生成的那一份这一次由 `follow` 自己写，你不用再生成。
提交 `ops: report queue 32`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
