# 下一轮指令（R1 → 操作员）

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：`--continue --max 6`，R2 仍用固定版本 `e042215`（应依次选中 v04-b02 到 v04-b07）

上一轮你的判断都成立：停是对的，零误放行，但晚了两轮，`fix_max` 这个原因会误导人。五条问题我逐条对过代码，全部属实。裁定：
- **v04-b01**：保持 `blocked`，`7600a4c` `89288a6` `e0dcdcf` 采纳，不重跑（SPEC 13.11）。没有选「改回 pending 重跑」：那要我在两次运行之间改 backlog，正是你有权拒绝的那种 next.md。
  v04-b02 的依赖改成了 v03-b04-fix。
- **你第 4 段的五条全部采纳**：第 1、2 条进 v04-b06（SPEC 13.9），第 3、4、5 条进 v04-b07（SPEC 13.10），排在 b05 之后。
  `queue.batch_started` 那条是规格的错，不是实现的错：我在 12.2 里把批次运行号也叫 `run_id`，和信封键重名。已改名 `batch_run_id`。
- **token**：所有者已把文件放回 `~/.config/collie/github-token`。上一轮我写的开跑前检查里漏了它，这次补上（第 2 步），KICKOFF「已知环境问题」也加了一条。

步骤：
1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. token 检查，两条都不要把 token 打印出来，任一条不对就停下报告、不开跑：
   - `test -s ~/.config/collie/github-token`
   - `curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $(cat ~/.config/collie/github-token)" "https://api.github.com/repos/CIPFZ/Collie/actions/runs?per_page=1"` 应输出 `200`
   另把 `stat -c %a ~/.config/collie/github-token` 的结果写进汇报（只报告，不改）。
3. 固定版本：`/tmp/collie-r2` 还在就确认 `git -C /tmp/collie-r2 rev-parse --short HEAD` 是 `e042215`；不在就 `git worktree add /tmp/collie-r2 e042215 && (cd /tmp/collie-r2 && npm ci)`。
4. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v04-b02`，确认读得到批次且状态是 pending。读不到就停下抄输出。
5. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts smoke` 一次，非 0 就停。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 6`。中途不干预、不重跑。
7. 结束后不管退出码是多少，每个 run_id 各跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，有 reviewer 时必须 0。
8. 退出码是 20 或 30 时停下写汇报，不要自己再 `--continue`。
9. worktree 先不删，等确认。

固定版本的已知问题（都在 `e042215` 里，v04-b07 / b06 修好后要等固定版本前移才生效；出现了照常记一笔，不用当新问题分析）：
- `queue.batch_started` 仍会落在批次 journal 里；
- FIX 重跑的 task 仍不写降级原因，提交清单仍可能混进信封提交；
- `fix_max` 的 backlog 提交仍不推送，出现了就随汇报提交一起推；
- CI 证据取不到时仍会当成 FIX 重跑。所以第 2 步的 token 检查是这次唯一的防线；
- 本次队列的 journal 不会有 SPEC 13.1 的新字段。

重点看（写进汇报）：
- **批次之间的放行**：到现在它还没有在两个批次之间真实做过一次决定。每次 PASS 之后有没有 `queue.paused`，原样抄。
- **打扰计数**：`queue.paused` 与 BLOCK 各几次，`reasons` 原样抄，每一次写上你的判断：该不该打扰。
- **CI 证据**：每个批次 `ci.resolved` 的 `conclusion` / `waited_secs` / `polls` 原样抄。这次有 token，应该都取得到；
  再出现 `rate_limited` 或 `ci.wait_timeout`，原样抄，并用 token 查一次 `/rate_limit` 把剩余额度写上。
- **误放行检查**：队列结束后，用主仓库 HEAD 的代码在真实的 `.collie/runs/` 上各跑一次
  `status`、`timeline`、`timeline --by version`、`why v03-b04-fix`、`why v04-b01`、`watch --once`（做出来几个跑几个）。
  任何一个报错或输出明显不对，原样抄。R2 的验收在 `head_sha` 的独立 worktree 里跑，那里没有历史 journal，这一步是验收测不到的。
  旧 journal 没有 13.1 的字段，命令应显示 `—`，不应报错。
- **`npm test` 的稳定性**：
  - v04-b01 新加的 `test/journal-fields.test.ts` 在 `beforeAll` 里跑完整一轮，钩子超时只有默认的 10 秒。我这台机器有负载时它会超时（默认超时下 9 次全量运行里 3 次），
    v04-b02 会把 `hookTimeout` 加上。b02 通过之前，R2 或 reviewer 的 `npm test` 如果因 `Hook timed out` 失败，属已知，原样抄。
  - 我这边还见过 4 次零散失败（`scenario-a`、`scenario-l` 各一次，`cli.test` 两次，都是期望的退出码变成了 20），和钩子超时无关，单独跑不复现，原因没有查清。
    你那边和 CI 上至今没出现过。见到同类失败，把用例名和断言原样抄下来，能拿到那次临时仓库里的 journal 更好。
- **v04-b06 与 CI**：GitHub 的 CI 机器上没有 token 文件。b06 之后凡是走到 `run` 的测试都不能依赖真实 home 目录，这件事的真正验收是 CI。
  b06 的代码提交 CI 红了，把失败的用例名抄下来。
- **花费与墙钟**：每批花费与合计；单批超过 $30 标出来（不中断）。有没有批次跑到 3600 秒被 soft 停。
- 常规项：audit、`tool.denied`、推送到信封的间隔、backlog 状态列是否每次只动一格、`ci.verdict_commit`（这次有 token，启动时应该有这条事件）。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加一份 `docs/ops/queue-<日期>.md`。提交 `ops: report v04 queue 2`，推送，
对话里回「已写 docs/ops/queue-<日期>.md」。

基准提交：705c41c
