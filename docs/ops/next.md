# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：a75ef45
固定版本：3f3a833
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十八次队列 `--continue --max 2`，固定版本前移到 `3f3a833`（应依次选中 v046-b37、v046-b38）

第二十七次队列的汇报我核过了，两批的 PASS 都成立，裁定记在 SPEC 14.38。你在副本里让一项 `stale`、把真的变异检查的输出交给 `buildOutputTail` 试，查出「结论行被挤掉」：这一条是我的规格和情形写错了，我写情形时只用了往一个输出流打印的脚本，没有拿真的变异检查对一遍。
把判 PASS 之后查出来的问题单列成表、写明谁没发现，也正是我要的，以后每轮照这样写。你第 8 段的几条：

- **第 1 条，`output_tail` 怎么改：** 改取法，不改变异脚本。两个输出流各取最后 20 行，标准错误有内容时中间加一行 `--- stderr ---`（SPEC 16.25）。就是 **v046-b37**；你说的两处小处（两边直接相接、三个反引号让代码块提前结束）一起改。
- **第 2 条，三处上报合起来：** 就是 **v046-b38**，这一次条目写的是「必须」，验收里有一条「推送恰好 7 处」。只重构，不带情形。
- **第 3 条，测试 agent 的 `max_turns`：** 我在本项目的 `.collie/collie.toml` 里从 100 提到了 150。
- **第 4 条，固定版本前移到 `3f3a833`：** 就是这一轮。worker 手册我已经加上了「你认为某条验收测试写错了」一段与 `disputed_tests` 的写法（`AGENT-worker.md` 第 5 节）。
- 模型接口两轮没过、你照指令等了两个 30 分钟再试：做得对，不用等我。
- `/data` 这一轮少了 5G、不在 Collie：知道了。

## 固定版本 `3f3a833` 里第一次生效的东西

出现了就原样抄，没触发写没触发：
- **验收命令没过时**，`acceptance.failed` 事件带 `output_tail`，重跑的 task 里「未通过的验收命令」一节下面有代码块。这一轮固定版本里还是旧取法（合起来取最后 20 行），v046-b37 通过之后要到下一轮才生效。
- **worker 在汇报里声明 `disputed_tests`：** 不拉 reviewer，退出码 20，批次 `blocked`，队列停下；停下之前的收尾提交会把 `test/acceptance/<批次>/` 从树里拿掉。
  这一轮真的出现了：把汇报里那一段、`escalated` 事件、`git log --format='%h %s' -n 5` 原样抄，**不要重跑**，由我裁定那条测试有没有错。
- 测试 agent 的轮数上限是 150（`tester.started` 的 `max_turns` 抄一下，确认是 150）。

每次取证仍然跑变异检查（约 5 分半）。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/` 下有被跟踪的 `v046-b21`、`b34`、`b35`、`b36` 是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。主仓库的 `node_modules` 要在（又被清了就 `npm ci`，记一笔）。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线，两条都必须过，末尾几行原样抄进汇报：
   - `npm test`：必须是绿的。
   - `npm run test:mutation`：末行必须是 `mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0`，跑完 `git status --porcelain` 仍为空。这一条不过就不开跑，写汇报、推送，等 next.md。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach 3f3a833 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `3f3a833`（锁文件没变，不用 `npm ci`；`/tmp/collie-r2/node_modules` 要在）。
6. 模型接口：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。三次都是退出码 0、整条命令在 60 秒以内，才算过。
   没过：等 30 分钟，重做第 1 步的检查和这一步，最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b37`，确认状态是 pending，输出里有 `== scenarios ==` 一节（9 条）。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
   v046-b37 开头有十来分钟是测试 agent 在系统临时目录里干活，这段时间 heartbeat 的 `phase` 是 `tester`，主工作区应该一直是干净的。v046-b38 不带情形，没有这一步。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本或独立克隆里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b37（最要紧）：真的变异检查。** 你上一轮那个实验在 HEAD 上再做一遍：副本里让一项 `stale`（再试一次让一项 `survived`），真跑 `npm run test:mutation`，把它的标准输出与标准错误交给 `buildOutputTail`。
  `output_tail` 全文原样抄：里面应该有没被发现的那一项的名字、结论行 `mutation: caught … `，然后是 `--- stderr ---` 与最后 20 项的进度。再把它放进 `renderFixSection`，那一节原样抄。
  还缺什么信息（比如挑一个排在前面的项，看得到看不到），照实写。
- **v046-b37 的验收测试够不够硬。** 把 worker 的实现整个撤掉：`new.test.ts` 必须全红、`keep.test.ts` 必须全绿。逐个撤一次，各自必须有验收用例变红，没有的写明：
  两个输出流分开取的那一处（改回合起来取）；`--- stderr ---` 那一行；标准错误那一段的 20 行上限；围栏按内容加长的那一处。
  逐条情形对一遍用例：每个期望有没有断言；有没有只在 `catch` 里断言的。
- **上一批的验收测试还在守着：** `npm test -- test/acceptance/v046-b35` 在 HEAD 上通过；只往标准输出打印的命令，`output_tail` 与 v046-b37 之前逐字节相同（用同一个脚本，两个版本的 `buildOutputTail` 各算一次比较）。
- **v046-b38：行为一个字都不变。** 三条上报路径各做一个一次性用例（没有有效汇报；测试 agent 这一步上报，比如类别标错；worker 声明 `disputed_tests`），单批次与队列模式各一次。
  在 v046-b38 之前的提交与 HEAD 上各跑一遍，比较：journal 里事件的名字、先后与字段（去掉时间戳、提交号、运行号）；`docs/progress.md` 新增的那一段；裁定提交里的文件（`git show --stat`）；退出码。应该全部相同，有任何一处不同原样抄。
  再读一遍合并出来的函数：三处是不是都走它；`grep -n "await push(" src/run.ts` 是不是 7 处，各是哪一条路径。
- **这一轮被删、被改的断言，请逐条过一遍。** 是不是条目点名的、是不是最小改动、有没有改松；不是点名的，撤掉它守的那一处看变不变红。
- **判 PASS 之后查出来的问题，照上一轮那样单列成表**：哪一批、什么问题、谁没发现（我的条目与规格 / 测试 agent / worker / reviewer）、算不算实质问题，末尾写合计。
- **reviewer 的两样：** v046-b37 的「情形与验收测试」表原样抄，`reason` 里有没有「测试缺口：」；v046-b38 是重构，它是怎么核对「行为不变」的（只跑了测试，还是逐条路径对了代码）。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例或钩子因为超时到点而失败的，写明是哪个文件。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄（别的批次的文件被 `Grep` 带出来的，分开写）。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报里。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、测试 agent / worker / reviewer 的轮数与用时。
- v046-b37：`tester.started` 到 `batch.task_written` 的先后与字段；红检查的 `problems`；信封提交里的文件；`test/acceptance/v046-b37/` 下三个文件的全文和测试 agent 的最终回复全文贴进批次汇报的附录；worker 有没有碰 `test/acceptance/`。
  测试 agent 这一步没过：`.collie/batches/v046-b37/tester.md` 全文抄进汇报，不要重跑。
- 每次取证里变异检查的结果（`docs/progress.md` 里那一行原样抄）与 `acceptance_passed` / `acceptance_total`。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.25、14.38）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；队列里的收尾提交；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报；worker 声明 `disputed_tests`；验收命令没过时的 `output_tail`。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 28`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
