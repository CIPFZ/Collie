# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：32becb6
固定版本：3f3a833
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十九次队列 `--continue --max 2`，固定版本不动（应依次选中 v046-b39、v046-b38）

第二十八次队列的汇报我核过了，裁定记在 SPEC 14.39。你没有重跑、先去核对 worker 说的对不对，还用真的变异检查把实现试了两种，正是我要的。你第 7 段的几条：

- **第 1 条，v046-b37 的裁定：** 我读了测试原文、实现，并调用 `renderFixSection` 看了实际输出，结论和你一样：**S4 写错了，worker 对。** 代码采纳，留在主分支上，批次保持 `blocked`。
  不改签成带情形的批次：实现已经在了，情形会全是 [保持]，测试 agent 那一步要至少一条 [新]。补测试的是 **v046-b39**（只写测试，S4 照你的办法改成「找与开头相同的那一行」）。
- **第 2 条，v046-b38：** 依赖改成 v046-b39，这一轮跑。
- **第 3 条，红检查查不出「永远红」的测试：** 这一次 worker 用 `disputed_tests` 拦下了，路是通的。我在测试 agent 手册里加了一条（找结构的结尾要找和开头一样的那一行；写完想一遍对的实现能不能过）。要不要在红检查里多一步，放到第 5 步需求审查里一起看。
- **第 4 条，固定版本：** 不动。v046-b37 的实现要等 v046-b39 让它有测试守着之后再进固定版本。
- `output_tail` 开头被 npm 命令头占几行、`stale` 时的措辞：记一笔，不改。
- `/data` 连续两轮少 5～6G、不是 Collie 的：知道了，我会告诉所有者。

两批都不带情形，这一轮没有测试 agent 那一步。每次取证仍然跑变异检查。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/` 下有 `v046-b21`、`b34`、`b35`、`b36`，没有 `b37`，是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。主仓库的 `node_modules` 要在。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线，两条都必须过，末尾几行原样抄进汇报：`npm test` 必须是绿的；`npm run test:mutation` 末行必须是 `mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0`，跑完 `git status --porcelain` 仍为空。不过就不开跑，写汇报、推送，等 next.md。
5. 固定版本：`git -C /tmp/collie-r2 rev-parse --short HEAD` 应是 `3f3a833`，`/tmp/collie-r2/node_modules` 要在。
6. 模型接口：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。三次都是退出码 0、整条命令在 60 秒以内，才算过。
   没过：等 30 分钟，重做第 1 步的检查和这一步，最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b39`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。worker 声明了 `disputed_tests` 的，照上一轮那样核对它说的对不对。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b39（测试够不够硬）。** worker 在汇报里写了四处「撤一次」的结果，你自己再撤一遍对一下：两个输出流分开取；`--- stderr ---` 那一行；标准错误的 20 行上限；围栏按内容加长。各自都必须有 `test/output-tail.test.ts` 里的用例红。
  逐条情形对一遍用例：九条都在、每个期望有断言、S4 是不是找「与开头相同的那一行」、有没有只在 `catch` 里断言的。再拿上一轮那个真的变异检查（让一项 `stale`）的输出喂一遍，确认这些测试没有把它想错。
- **v046-b38（行为一个字都不变）。** 三条上报路径各做一个一次性用例（没有有效汇报；测试 agent 这一步上报，比如类别标错；worker 声明 `disputed_tests`），单批次与队列模式各一次。
  在 v046-b38 之前的提交与 HEAD 上各跑一遍，比较：journal 里事件的名字、先后与字段（去掉时间戳、提交号、运行号）；`docs/progress.md` 新增的那一段；裁定提交里的文件；退出码。应该全部相同，有任何一处不同原样抄。
  读一遍合并出来的函数：三处是不是都走它；`grep -n "await push(" src/run.ts` 是不是 7 处。reviewer 是怎么核对「行为不变」的（只跑了测试，还是逐条路径对了代码），原样写。
- **这一轮被删、被改的断言，请逐条过一遍。**
- **判 PASS 之后查出来的问题，照上两轮那样单列成表**，末尾写合计。
- **偶发失败、reviewer 读了什么、照旧读代码找问题**：照常。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数与用时。
- 每次取证里变异检查的结果（`docs/progress.md` 里那一行原样抄）与 `acceptance_passed` / `acceptance_total`。
- 每个会话里接口重试的次数与状态码；worker「偏离或疑问」与 reviewer「被改写或删去的断言」原样抄。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报；验收命令没过时的 `output_tail`。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 29`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
