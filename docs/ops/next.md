# 下一轮指令（R1 → 操作员）

状态：开跑

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：第四次队列 `--continue --max 5`，固定版本前移到 `5b132fd`（应依次选中 v04-b12 到 v04-b16）

v04-b11 第 2 次的汇报我核过了：PASS 成立，这次是 R2 自己取到的证据。我已把它在 backlog 里改为 `passed`（单批次模式不写状态列），裁定记在 SPEC 13.16。
你第 4 段的两条都采纳：
- task 对上报 BLOCK 只写 `unknown`、worker 靠运气才写对 → 进 **v04-b13**（SPEC 13.17），连同「sha 不存在却报成祖先关系」和单批次 run_id 带 `-` 一起改。
  「sha 解析不了改判为 FIX 自动重跑」所有者已同意（2026-11-13），签为 **v04-b16**（SPEC 13.21），排在最后；b13 只把原因写对，b16 再改它的去向。
- worker 手册已加：sha 一律抄 git 的输出，不许把 7 位补成 40 位；task 没说清上一轮原因时去读 progress.md 里本批次最后一条，不要猜。

所有者同一天裁定 v0.3 记为收口（SPEC 第 12 章开头）。

另外四批：
- **v04-b12**（SPEC 13.19，只改测试，排最前）：场景 G 随机失败的原因我用对照实验验证了。让 fake worker 在冻结指纹之前多让出事件循环 40 万次，旧假时钟必然走到 300012 毫秒、记成 `worker.stalled`；
  改成「冻结之前时钟不走」后恰好在 1000 毫秒判空转。`76a8622` 那次 CI 红就是它。
- **v04-b14**（SPEC 13.18）：裁定提交的 CI 在取证后补查一次，就是你说的那个反例。
- **v04-b15**（SPEC 13.20）：`why` 的结论行在缺 `rule` 时不再留一个空逗号。
- **v04-b16**（SPEC 13.21，依赖 b13）：上面说的改判。它要到固定版本再前移之后才生效：本次队列里如果又有 worker 写错 sha，仍然是 BLOCK 停下。

你上次连续等满了 12 小时，问题不在你这边：我只在所有者来说话时才能行动。等待上限已改成 48 小时（KICKOFF「不用人传话」）。

## 固定版本前移：`e042215` → `5b132fd`

`5b132fd` 是 v04-b11 的裁定提交，和现在 main 上的 `src/` 完全相同。v04-b01、b06、b07、b10、b11 对 R2 的改动从这一轮起**第一次真实生效**，这是本轮最需要盯的地方：
- `collie smoke` 会先查 token 文件，runner 通过后再用 token 查一次 CI，成功时多打印一行 `ci ok`；
- `collie run` 启动时 token 文件读不到会直接退出码 1（以前是悄悄退回匿名）；
- `queue.batch_started` 落在队列的 `q-` journal 里，字段是 `batch_run_id`；PASS 后放行会记 `queue.gate_passed`；
- FIX 重跑的 task 会写「降级原因」；R2 实测失败的验收不论裁决都记 `acceptance.failed`；
- 被判空转 / 卡死 / 墙钟到点且没有 report 的运行，队列会自动续跑一次（`batch.retried`，cause `interrupted`）；
- CI 证据因环境取不到时队列直接停（`evidence_unavailable`），不再重跑；
- journal 开始带轮数、花费、token、`evidence.collected`、`run.finished.rule`。

固定版本里仍然有的问题（v04-b12 到 b16 修的就是它们，出现了照常记一笔）：
- 场景 G 可能随机失败。它要是让某个 worker 代码提交的 CI 变红，规则 9 会把 PASS 降为 FIX、自动重跑一次，属预期；连续红才是问题。
- sha 解析不了仍会报成「不是后代或不是祖先」；BLOCK 之后重跑的 task 仍写 `unknown`；
- 裁定提交的 CI 仍只在启动时查一次。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. 磁盘：`df -h / /data`，把两行抄进汇报。任一个分区可用空间不足 1G 就停下报告，不开跑。
3. token 检查（两条都不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 通知通道再测一次：`notify "[Collie] 第四次队列开跑（v04-b12 起）"`，把输出写进汇报（上次是 `no webhook, skipped`）。
5. 固定版本前移（依赖没有变化，不用重新 `npm ci`）：
   `git -C /tmp/collie-r2 checkout -q --detach 5b132fd && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `5b132fd`。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 5b132fd && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v04-b12`，确认读得到批次且状态是 pending。读不到就停下抄输出。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts smoke` 一次，把输出原样抄进汇报（应该有 `ci ok`），非 0 就停。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 5`。中途不干预、不重跑。
9. 结束后不管退出码是多少，每个 run_id 各跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，有 reviewer 时必须 0。
10. 退出码是 20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
11. worktree 先不删。

## 重点看（写进汇报）

- **这一次的队列汇报先用四个命令写**（SPEC 13.7，v0.4 自己的验证）。队列结束后，用主仓库 HEAD 的代码：
  `status`、`timeline --since <今天>`、`timeline --by version`、`why <每个批次>`、`show --queue <q-run_id>`。
  「实际经过」那张表（attempt、结论、规则、用时、花费、轮数）和每个批次为什么是这个结论，尽量只从这些命令的输出里取。
  不得不去翻 `events.ndjson` / `stream.ndjson` / progress.md 才知道的事，每一处单列出来：你想知道什么、哪个命令本该告诉你。这张清单是本轮最有价值的产出。
- **新 R2 第一次生效的各项**（上一节列的七条）：逐条写「出现了 / 没触发 / 出现了但不对」，出现的把那一行事件原样抄下来。
  队列 journal 请全文原样抄：这是第一次有 `queue.batch_started` 和 `queue.gate_passed` 落在里面。
- **attempt**：`--continue` 下每个批次第一次运行的 task 里 `attempt` 应该是 1、`interrupted_at` 是 null。出现 2 或「上一轮中断」就停在汇报里重点写，这是 v04-b07 那处改动的真实验证。
- **批次之间的放行与打扰计数**：`queue.paused` 与 BLOCK 各几次，`reasons` 原样抄，每一次写上你的判断：该不该打扰。
- **CI**：每个批次 `ci.resolved` 的结论；本次队列所有提交里有没有红的，红的是哪个用例。v04-b12 通过之后场景 G 还红，原样抄断言。
- **worker 的 sha**：每个 report 的 `head_sha` 是几位、能不能解析、worker 是怎么得到它的（有没有运行 `git rev-parse`）。
- **v04-b16**：它要把 v04-b13 刚写的一条断言（不存在的 sha → 退出码 20）改成新行为，这是条目允许的。reviewer 若把它当成「为过测试改断言」，把 gaps 原样抄下来。
- **开局**：每个 worker 第一次文件改动距启动多少秒、那时的上下文大小、压缩几次。
- **花费与墙钟**：每批花费与合计（新 R2 的 journal 里应该有 `cost_usd`，和你从事件流里数的对一下）；单批超过 $30 标出来。
- 常规项：audit、`tool.denied`、backlog 状态列是否每次只动一格、`npm test` 有没有零散失败。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加一份队列汇报 `docs/ops/queue-<开跑当天日期>.md`。
提交 `ops: report v04 queue 4`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。

基准提交：cb7b7dc
