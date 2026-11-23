# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：4ca7fd6
固定版本：d19d890
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十七次队列 `--continue --max 2`，固定版本前移到 `d19d890`（应依次选中 v046-b35、v046-b36）

第二十六次队列的汇报我核过了，两批的 PASS 都成立，裁定记在 SPEC 14.37。你用替身命令让全局命令不过一次、去看 R2 留下了什么，查出「只留最后一行」，这正是我漏想的。你第 8 段的几条：

- **第 1 条，验收命令没过时留下输出的末尾：** 就是 **v046-b35**。最后 20 行进 `acceptance.failed` 事件与重跑的 task，带截断与脱敏（task 是要推送的）。
- **第 2 条的两处，我直接改了手册：**
  - `AGENT-tester.md` 加了「断言会抛错时先断言真的抛了，不把断言只写在 `catch` 里」，另加一条「情形要用到现有类型上还没有的字段时怎么写」（这一轮的两个批次都会碰到）。
  - `AGENT-reviewer.md` 加了带情形的批次要填的一张「情形与验收测试」表。查出的问题它写进 `reason`（以「测试缺口：」开头），不写进 `gaps`、不因此判 FIX：worker 改不了验收测试。
- **第 3 条，固定版本：** 前移到 `d19d890`，R2 的行为没有变。
- R2 不记每条命令的用时、reviewer 用 `ls-remote | grep` 查提交：记一笔，不改。
- 我的机器上默认时限的全量测试现在 2 次都全过，没有钩子超时了（v046-b33 起作用了）。

**这一轮两批都带情形，而且测的是 R2 的流程**（前两个带情形的批次测的都是纯函数）。测试 agent 要用 `Sandbox` 与 `FakeRunner` 搭出整次运行，这是第一次。它的经过请写细，尤其是没走通的时候：

- 每批：`tester.started` 到 `batch.task_written` 的先后与字段；测试 agent 拉起了几次、每次红检查的结果（`redcheck.result` 的 `problems` 原样抄）；信封提交里的文件；
  **`test/acceptance/<批次>/` 下三个文件的全文和测试 agent 的最终回复全文贴进批次汇报的附录**；worker 有没有碰 `test/acceptance/`；`why <批次>` 里 `tester:` 那一行。
- **测试 agent 这一步没过**（`red_check_failed`、`misclassified`、`tester_failed`、`tester_touched_main_tree`）：队列会以 `blocked` 停下。`.collie/batches/<批次>/tester.md` 全文抄进汇报；有 `misclassified` 的，它说哪一条、为什么，原样抄，这是我写情形写错了的证据。
  是 `tester_touched_main_tree` 的话，主工作区里会留着它新建的未跟踪文件：列进汇报，然后删掉。不要重跑。
- **worker 一侧超过 `fix_max`：** 固定版本有收尾，队列停下时会多一个 `progress: <批次> cleanup` 提交把 `test/acceptance/<批次>/` 从树里拿掉。`git show --stat` 原样抄。不要重跑。
- v046-b36 的 worker 这一轮**不能**在自己的汇报里用 `disputed_tests`（固定版本还不认，会被当成格式不对）。它要是用了，原样抄出来。

每次取证仍然跑变异检查（约 5 分半），和上一轮一样。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/` 下有被跟踪的 `v046-b21`、`v046-b34` 是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。主仓库的 `node_modules` 要在（又被清了就 `npm ci`，记一笔）。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线，两条都必须过，末尾几行原样抄进汇报：
   - `npm test`：必须是绿的。
   - `npm run test:mutation`：末行必须是 `mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0`，跑完 `git status --porcelain` 仍为空。这一条不过就不开跑，写汇报、推送，等 next.md。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach d19d890 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `d19d890`（锁文件没变，不用 `npm ci`；`/tmp/collie-r2/node_modules` 要在）。
6. 模型接口：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。三次都是退出码 0、整条命令在 60 秒以内，才算过。
   没过：等 30 分钟，重做第 1 步的检查和这一步，最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b35`，确认状态是 pending，输出里有 `== scenarios ==` 一节（8 条）。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
   每批开头有几分钟是测试 agent 在系统临时目录里干活（这一轮它要写的测试比以前大，可能要十分钟以上），这段时间 heartbeat 的 `phase` 是 `tester`，主工作区应该一直是干净的。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本或独立克隆里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **两批的验收测试够不够硬（这一轮最要紧）。** 对每一批：
  - 把 worker 的实现整个撤掉，跑 `npm test -- test/acceptance/<批次>`：`new.test.ts` 的用例必须全红，`keep.test.ts` 的必须全绿。
  - 逐条情形对一遍用例：情形里的每个期望有没有断言；有没有断言只写在 `catch` 里、只断言「不报错」的；`MAP.md` 里有没有它说写不成的。
  - v046-b35 逐个撤一次：取最后 20 行的那一处（改成不截行数）；每行截到 300 字符的那一处；脱敏的那一处；重跑 task 里渲染代码块的那一处。各自必须有验收用例变红；哪一处撤了没有用例红，写明。
  - v046-b36 逐个撤一次：`disputed_tests` 每一项的校验（改成任意对象都收）；「非空就上报」的判断（改成永远不成立）；`escalated` 里的 `disputed` 字段。
- **v046-b35 的效果。** 你上一轮 2.1 最后那个替身实验在 HEAD 上再做一遍（`fake-mutation.sh` 打两行后以 1 退出）：`acceptance.failed` 事件原样抄；第 2 次运行的 `task.md` 里「未通过的验收命令」一节原样抄，应该看得到 `… survived` 那一行。
  再试一条输出里带 `GITHUB_TOKEN` 值的命令：事件与 task 里都应该是 `***`。
- **v046-b36 的效果。**
  - 一次性用例，用带情形的沙箱（照 `test/tester-step.test.ts` 的搭法），队列模式：假 worker 在汇报里声明一条 `disputed_tests`。预期：不拉 reviewer；退出码 20；批次 `blocked`；
    队列停下之前的收尾提交把 `test/acceptance/<批次>/` 从树里拿掉。`git log --format='%h %s' -n 5`、收尾提交的 `git show --stat`、journal 里的 `escalated` 原样抄。
  - 固定版本 `d19d890` 碰到带 `disputed_tests` 的汇报是什么表现（预期：按「没有有效汇报」上报，退出码也是 20）。原样抄。我要等固定版本带上这一批之后才去改 worker 的手册。
- **两份手册的改动管不管用。**
  - 测试 agent：这一轮的测试里还有没有断言只写在 `catch` 里的；v046-b35 的 S1 要往现有类型里塞一个还没有的字段，它是怎么过类型检查的。
  - reviewer：两批的「情形与验收测试」表原样抄；`reason` 里有没有「测试缺口：」开头的条目，说的对不对（拿上面第一项你自己查出来的比）。
- **这一轮被删、被改的断言，请逐条过一遍。** 是不是条目点名的、是不是最小改动、有没有改松；不是点名的，撤掉它守的那一处看变不变红。
- **判 PASS 之后查出来的问题，请在队列汇报里单列一段数清楚**：是哪一批、谁没发现（测试 agent / worker / reviewer / 我的条目）、算不算实质问题。从这一次队列起我要拿这个数和旧流程比。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例或钩子因为超时到点而失败的，写明是哪个文件。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄（别的批次的文件被 `Grep` 带出来的，分开写）。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、测试 agent / worker / reviewer 的轮数与用时。
- 每次取证里变异检查的结果（`docs/progress.md` 里那一行原样抄）与 `acceptance_passed` / `acceptance_total`。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.23、14.37）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；队列里的收尾提交；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 27`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
