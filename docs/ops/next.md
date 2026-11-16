# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：7182fd8
固定版本：60e9017
批次上限：4

上面四行是以后给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读就行。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第六次队列 `--continue --max 4`，固定版本 `60e9017`（应依次选中 v045-b01 到 v045-b04）

所有者选定了下一步：把你每轮手工做的事做进 Collie（SPEC 第 14 章「收掉操作员」）。四个批次：
- **v045-b01**（14.1，改 R2）：`collie preflight`；队列开头自动检查；reviewer 结束后自动 audit，工具清单不符就停表。
- **v045-b02**（14.2）：`collie report`，把一次队列运行写成你现在手写的那种汇报。
- **v045-b03**（14.3）：通知模块，以及读懂这份 next.md 开头键值行的纯函数。
- **v045-b04**（14.4）：`collie follow`，常驻循环：读 next.md → 检查 → 开跑 → 生成汇报并推送 → 通知。

这四批通过、固定版本前移之后，你这一侧只需要起一条 `collie follow`。所以这是你照旧手工跑的最后一两轮。
你做而 `follow` 做不了的那部分（读代码、找 Collie 本身的问题）我在 SPEC 14.5 里如实写了：暂时落到我读汇报和复核代码上。

v0.4 是否记为收口，所有者这次没有答复，仍待裁定；不影响这一轮。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. 磁盘：`df -h / /data`，两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。`/data` 上一轮少了 1.2G，能顺手看出是谁占的就写一句，不用深查。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. `notify "[Collie] 第六次队列开跑（v045-b01 起）"`，输出写进汇报。
5. 固定版本：`git -C /tmp/collie-r2 checkout -q --detach 60e9017 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `60e9017`（依赖没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 60e9017 && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v045-b01`，确认状态是 pending。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts smoke`，输出原样抄进汇报（应有 `ci ok`），非 0 就停。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 4`。中途不干预、不重跑。
9. 结束后每个 run_id 跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，有 reviewer 时必须 0。
10. 退出码是 20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

固定版本 `60e9017` 里没有本轮做的任何东西：队列开头不会自动检查，audit 仍要你手工跑。

## 重点看（写进汇报）

- **新命令在真实数据上对不对**（队列结束后，用主仓库 HEAD 的代码，做出来几个跑几个）：
  - `npx tsx src/cli.ts preflight` 和 `preflight --smoke`：原样抄输出。和你第 1~3、7 步手工查的结果对一下，哪一项它查了而结论不同、哪一项你查了而它没查，逐条写。
  - `npx tsx src/cli.ts report`（缺省取最近一次队列）：把输出存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。
    然后照常手写你自己的队列汇报，并列一张表：你手写的汇报里有、而生成的那份没有的每一处事实（不含你的判断与建议）。**这张表决定 `report` 能不能替你写汇报**，是本轮最要紧的产出。
  - `npx tsx src/cli.ts notify "[Collie] 通知命令测试"`：原样抄输出（没配 webhook 应是 `skipped (no webhook)`）。
  - **不要运行 `collie follow`**，带不带 `--dry-run` 都不要：next.md 现在是「开跑」，它一旦真跑起来会在你那台机器上再起一个队列。`follow` 我用 fake runner 在沙箱里验，第一次真实使用放到下一轮。
- **v045-b01 改了队列的入口**：现有 `--continue` 测试有没有因为新检查而被改；reviewer 核对表里「不变量数值变化」那一行原样抄。worker 有没有碰 `.collie/collie.toml` 或 `templates/collie.toml`（条目写明不许碰）。
- **v045-b04**：worker 在开发过程中有没有在工作区里运行不带 `--dry-run` 的 `collie follow`（条目写明禁止）。事件流里搜一下 `cli.ts follow`，命中的原样抄。
- **新固定版本里还没在真实运行中触发过的**（出现了原样抄，没触发写没触发）：sha 写错判 FIX 并自动重跑；BLOCK 后重跑的 task 写「上一轮结论：」；中断后自动续跑；`ci.verdict_commit` 的 `when: after_evidence`。
  这一轮是四批连跑，第 2 批起启动时上一条裁定提交刚推送，`after_evidence` 应该会出现。
- 常规项：每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`tool.denied`、backlog 状态列每次只动一格、每批花费（worker / reviewer 分开，可以直接用 `timeline` 和 `why` 的数）、
  开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、`npm test` 有没有零散失败、放行与打扰计数（每次打扰写上你的判断：该不该）。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md` 和生成的那一份。
提交 `ops: report v045 queue 6`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
