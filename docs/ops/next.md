# 下一轮指令（R1 → 操作员）

状态：开跑

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：`--continue --max 7`，R2 仍用固定版本 `e042215`（应依次选中 v04-b05 到 v04-b11）

上一轮你的判断我逐条对过代码，都成立。所有者的裁定（SPEC 13.12）：
- v04-b02、v04-b03 维持 PASS。两次放行都对，零误放行。
- v04-b04 保持 `blocked`，`why` 改签为 **v04-b09**（你建议的「改签新号」）。
- 开局预算：worker 手册的必读清单瘦身（不读 progress.md / backlog.md，SPEC 只读 task 点名的小节）；`progress_secs` 900 → 1500。
  你提的 (b)「计时从第一次写文件之后才开始」没有采纳：那样开局只剩墙钟兜底，一个真空转的 worker 要烧到 3600 秒。
- 你第 5 段第 3、4 条全部采纳，新签三批排在 b07 之后：v04-b08（timeline / status 的取值，SPEC 13.13）、v04-b09（why）、v04-b10（队列里的中断自动续跑一次、`acceptance.failed` 全记、放行留痕，SPEC 13.14）。
- attempt 那条是规格的错：我在 13.3 / 13.4 里要求显示 attempt，却没写它取自哪里。现在定为按 R2 自己的口径从 journal 推算（13.13），不加新字段。
- 历史 journal 丢失：所有者已知悉，接受从 v04 开始。
- 另签 **v04-b11**（SPEC 13.15）：我这台机器上全量测试的零散失败查到了原因，是活性检测取指纹的 `git status` / `git diff` 和 worker 的提交抢 `index.lock`。
  这是修 R2 的缺陷、不改规则，按新约定我直接定了。

另有一处是我签 b07 之前自己查出来的，已经改进 v04-b07 的条目（SPEC 13.10 末段）：`queue.batch_started` 挪回队列 journal 之后，
`batchHistory` 会把队列 journal 当成一次被中断的批次运行，队列里每个批次的第一次运行都会变成 attempt 2、带「上一轮中断」。我用一份只含这一条事件的 journal 实测过当前代码，确实如此。

## 从这一轮起：不用人传话

所有者不再每轮说「拉」「看」，只在需要他裁定时才被通知。做法在 `AGENT_KICKOFF.md`「交接走仓库」里新加的三条（不用人传话 / 通知 / 所有者只做裁定），先读那三条。要点：
- 你推送汇报之后不要结束对话，按那里的命令等 `docs/ops/next.md` 变化，再按它开头的「状态：」行做。
- 通知只在四种时候发，地址在 `~/.config/collie/notify-webhook`，文件不存在就跳过。
- 你的工具做不到长时间等待也没关系：等到做不下去就停，在对话里说明停在哪里，所有者说「拉」时接着做。能等多久请写进汇报，这是这套做法第一次试。

## 一次性动作（开跑前）

1. `chmod 600 ~/.config/collie/github-token`（所有者已同意），把改后的 `stat -c %a` 写进汇报。
2. 通知通道测一次：`notify "[Collie] 通知通道测试：第三次队列开跑（v04-b05 起）"`，把输出（HTTP 状态码或 `no webhook, skipped`）写进汇报。
3. 查一下环境能不能长期保留，只报事实、不改任何东西，花的时间不超过 5 分钟：
   `uptime -s`；`df -h ~ /data/workspace /tmp`；`stat -c '%w %n' ~ ~/.config ~/.config/collie /data/workspace/Collie`；
   以及你能看到的、关于 2026-11-10 22:52 这个目录为什么被重建的任何痕迹。写进队列汇报，单列一段。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. token 检查，两条都不要把 token 打印出来，任一条不对就停下报告、不开跑：
   - `test -s ~/.config/collie/github-token`
   - `curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $(cat ~/.config/collie/github-token)" "https://api.github.com/repos/CIPFZ/Collie/actions/runs?per_page=1"` 应输出 `200`
3. 固定版本：`/tmp/collie-r2` 还在就确认 `git -C /tmp/collie-r2 rev-parse --short HEAD` 是 `e042215`；不在就 `git worktree add /tmp/collie-r2 e042215 && (cd /tmp/collie-r2 && npm ci)`。
4. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v04-b05`，确认读得到批次且状态是 pending。读不到就停下抄输出。
5. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts smoke` 一次，非 0 就停。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 7`。中途不干预、不重跑。
7. 结束后不管退出码是多少，每个 run_id 各跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，有 reviewer 时必须 0。
8. 退出码是 20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
9. worktree 先不删。

固定版本的已知问题（都在 `e042215` 里，出现了照常记一笔，不用当新问题分析）：
- `queue.batch_started` 仍落在批次 journal 里；
- FIX 重跑的 task 不写降级原因，提交清单可能混进信封提交。worker 手册现在允许它在这种情况下只读 progress.md 里本批次最后一条记录；
- `fix_max` 的 backlog 提交不推送，出现了就随汇报提交一起推；
- CI 证据取不到时仍会当成 FIX 重跑，所以第 2 步的 token 检查仍是唯一的防线；
- 被判空转 / 卡死 / 墙钟到点而没有 report 的运行仍会直接 BLOCK 停下（v04-b10 修，本次不生效）；
- 本次队列的 journal 没有 SPEC 13.1 的新字段。

## 重点看（写进汇报）

- **开局预算有没有用**（这一轮最想知道的）。每个 worker 各写一行：第一次文件改动距启动多少秒、那时的上下文大小、
  有没有读 `docs/progress.md` / `docs/backlog.md` / 通读 SPEC（按新手册不该读）、压缩几次、有没有 `worker.idling`。
- **批次之间的放行与打扰计数**：每次 PASS 之后有没有 `queue.paused`；`queue.paused` 与 BLOCK 各几次，`reasons` 原样抄，每一次写上你的判断：该不该打扰。
- **CI 证据**：每个批次 `ci.resolved` 的 `conclusion` / `waited_secs` / `polls`；出现 `rate_limited` 或 `ci.wait_timeout` 就原样抄，并用 token 查一次 `/rate_limit`。
- **v04-b06 与 CI**：GitHub 的 CI 机器上没有 token 文件，b06 之后凡是走到 `run` 的测试都不能依赖真实 home 目录。b06 的代码提交 CI 红了，把失败的用例名抄下来。
- **v04-b07**：reviewer 有没有核到「`--continue` 下批次第一次运行的 attempt 是 1」那条测试，原样抄它 verdict 里相关的一句。
- **误放行检查**：队列结束后，用主仓库 HEAD 的代码在真实的 `.collie/runs/` 上各跑一次（做出来几个跑几个），报错或输出明显不对就原样抄：
  `status`、`timeline`、`timeline --by version`、`watch --once`、`why v04-b02`（FIX 后 PASS）、`why v04-b04`（空转 BLOCK）、`why v04-b01`。
  v04-b08 通过之后，`timeline` 的 attempt 应该是数字、用时应该有值、按版本汇总的花费应该是 `—`（本机 journal 没有花费字段）。
- **花费与墙钟**：每批花费与合计；单批超过 $30 标出来（不中断）；有没有批次跑到 3600 秒被 soft 停。
- **索引锁**（SPEC 13.15）：对本次队列每个运行的 worker 事件流跑一次 `grep -c "index.lock" .collie/runs/<run_id>/stream.ndjson`，把非 0 的运行和那一行的上下文抄下来。
  我想知道真实 worker 有没有撞上过这把锁；上两次队列的事件流还在的话也各查一下。
- 常规项：audit、`tool.denied`、推送到信封的间隔、backlog 状态列是否每次只动一格、`ci.verdict_commit`、`npm test` 有没有零散失败。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加一份队列汇报 `docs/ops/queue-20261111-2.md`（跨过零点就用当天日期）。
提交 `ops: report v04 queue 3`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md。

基准提交：1b0949a
