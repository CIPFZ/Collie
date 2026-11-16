# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：e8455ff
固定版本：f901a8f
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第七次队列 `--continue --max 3`，固定版本前移到 `f901a8f`（应依次选中 v045-b05、b06、b07）

第六次队列的汇报我核过了，四批 PASS 都成立，裁定记在 SPEC 14.8。你这一轮的汇报分量很重，逐条说去向：

- **`follow` 的 3 处问题：全部属实，先修再用。** 我用假时钟、假子进程、假通知驱动真实的循环实测了一遍：
  preflight 一直失败时 3 圈起了 3 次 `--smoke`、发了 3 条通知，正文里带着 token 文件的绝对路径；推送失败一次之后，3 圈里 `run --continue` 起了 2 次；
  `npx tsx npm ci` 单独试是退出码 1、什么也没装。我还多找到一处：`follow` 的测试每跑一次在 `$TMPDIR` 留下 2 个 `collie-r2-sandbox-*` 目录不清理（你那边在 `/data/tmp`，可以直接删）。
  修法是 **v045-b05**（SPEC 14.9）：「已处理」改成从仓库里的汇报提交判断，失败只通知一次并退避。
- **`report` 的开始与墙钟、你那张 19 行的对照表：** 数据在 journal 里的进 **v045-b06**（SPEC 14.10）；第 2、3 行由 `follow` 附在汇报末尾（v045-b05）；
  第 15、16 行（worker 的「偏离或疑问」、reviewer 的核对表）在仓库里的 `report.md` / `verdict.md`，我审的时候直接读；第 12、13、17 行只在事件流里，不做。
- **b01 用满 200 轮：** 不放宽上限，先把上限记进 journal 并在 `why` 里标出来（v045-b06）。这一批是我拆得太大，已经写进签发自查。
- **`.token_file` 不变量连注释也算：** 改成不看注释行（v045-b07）。
- **固定版本前移到 `f901a8f`：** 同意，就是这一轮。
- v0.4：所有者已裁定记为收口。磁盘、通知地址、token 轮换三件事转给所有者了，记在 `docs/decisions/OPEN.md`。

第三批 **v045-b07** 是另一条线（SPEC 第 15 章）：我把仲裁规则、放行条件、受保护清单里的判断逐个删掉试了 44 处，有 6 处删了之后全量测试仍然全绿。这一批补测试，并加一个 `npm run test:mutation`。

## 固定版本 `f901a8f` 里第一次生效的东西

- **队列开头自动做一次不带 `--smoke` 的 preflight。** 没过的话队列直接退出码 1，stderr 是 `preflight failed: <失败项>`，一个批次都不跑。出现了就停下，把 stderr 和队列 journal 原样抄给我。
- **reviewer 结束后自动 audit**，结果记在批次 journal 的 `audit.result`；不符（`mismatch`）时队列停表，退出码 30。
- 你手工的检查这一轮照做，用来和它对照。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报（我这边高负载时会超时，想知道你那边整套要跑多久）。
5. 固定版本：`git -C /tmp/collie-r2 checkout -q --detach f901a8f && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `f901a8f`（依赖没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 f901a8f && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。它顶替以前的 `smoke`。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v045-b05`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里那次运行的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。它的第一次真实使用放在下一轮，届时我会改写 `AGENT_KICKOFF.md` 里你这一节。

## 重点看（写进汇报）

- **新固定版本第一次生效的两项**：队列 journal 里的 `queue.preflight` 原样抄；四项结果和你第 1~3 步手工查的是否一致。每个运行的 `audit.result` 原样抄，和第 9 步手工 audit 的退出码是否一致。
- **v045-b05**（最要紧）：
  - reviewer 的核对表里，对条目里两处加粗的「连续 3 圈」情形给的证据原样抄。它有没有读测试正文、确认真的走了多圈并断言了次数（reviewer 手册这次加了这一条）。
  - worker / reviewer 的事件流里搜 `cli.ts follow`，命中的原样抄（只允许 `--help` 与 `--dry-run`）。
  - 队列跑之前、跑之后各数一次 `ls -d "${TMPDIR:-/tmp}"/collie-r2-sandbox-* 2>/dev/null | wc -l`，两个数都写上。
- **v045-b06**：队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。
  看「开始」「墙钟」有没有值、合计行对不对、有没有 `tool.denied` 与批次状态两行。上次那张对照表这次只列**还缺的**。
  新 journal 里 `worker.started` 应该还没有 `max_turns`（这一批的代码要到固定版本再前移才生效），`why` 应只显示轮数、不报错。
- **v045-b07**：队列结束后在主仓库 HEAD 上跑一次 `npm run test:mutation`，把末尾的汇总和用时原样抄；再跑一次 `npm test`，抄 `Tests` 与 `Duration` 两行。
  worker 有没有碰 `.github/`（条目写明不许碰）。reviewer 核对表里「不变量数值变化」一行原样抄（`.token_file` 那条改成不看注释行是条目允许的）。
- **还没在真实运行里触发过的**（出现了原样抄，没触发写没触发）：sha 写错判 FIX 并自动重跑；BLOCK 后重跑的 task 写「上一轮结论：」；中断后自动续跑；audit 不符停表。
- 常规项：每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`tool.denied`、backlog 状态列每次只动一格、每批花费（worker / reviewer 分开）、
  worker 轮数（接近 200 的标出来）、开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 你读代码看到的任何问题照旧写在各批次汇报的第 4 段。这部分 `follow` 以后做不了，现在多一条是一条。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`）和生成的那一份。
提交 `ops: report v045 queue 7`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
