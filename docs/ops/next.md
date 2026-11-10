# 下一轮指令（R1 → 操作员）

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：`--continue --max 5`，R2 用固定版本（应依次选中 v04-b01 到 v04-b05）

v03-b04-fix 维持 PASS。你第 5 段的两条都采纳：
- 放行判定第 6 项按 (a) 删除：SPEC 12.3 已改成六项，代码进 v04-b01 条目 1。
- 不止 `--max 2`：v0.4 的五个批次一次签满（SPEC 第 13 章），这一轮跑 `--max 5`。它同时是 v0.3 的收口实验（连跑 5 批、零误放行）。

新规则（SPEC 13.6）：队列运行的 R2 从固定版本启动，不从 worker 正在改的工作树启动。固定版本是 `e042215`（v03-b04-fix 的裁定提交）。

步骤：
1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. `git worktree add /tmp/collie-r2 e042215 && (cd /tmp/collie-r2 && npm ci)`。
3. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v04-b01`，确认读得到批次且状态是 pending。读不到就停下抄输出。
4. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts smoke` 一次，非 0 就停。
5. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 5`。中途不干预、不重跑。
6. 结束后不管退出码是多少，每个 run_id 各跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，有 reviewer 时必须 0。
7. 退出码是 20 或 30 时停下写汇报，不要自己再 `--continue`。
8. worktree 先不删，等确认。

重点看（写进汇报）：
- **批次之间的放行**：这是放行判定第一次在两个批次之间做决定。每个批次之间队列 journal 的 `queue.batch_started` 原样抄
  （v03-b04-fix 的代码第一次在 R2 上生效）。
- **打扰计数**：`queue.paused` 与 BLOCK 各几次，`reasons` 原样抄，每一次写上你的判断：该不该打扰。
- **误放行**：队列结束后，用主仓库 HEAD 的代码在真实的 `.collie/runs/` 上把已经做出来的命令各跑一次
  （`status`、`timeline`、`why <某个 v03 批次>`、`watch --once`）。任何一个报错或输出明显不对，原样抄。
  R2 的验收命令在 `head_sha` 的独立 worktree 里跑，那里没有历史 journal，所以这一步是验收测不到的。
- **固定版本的副作用**：本次队列的 journal 不会有 SPEC 13.1 的新字段，属预期。四个命令遇到旧 journal 应显示 `—`，不应报错。
- **花费与墙钟**：每批花费与合计；单批超过 $30 标出来（不中断）。有没有批次跑到 3600 秒被 soft 停。
- 常规项：audit、`tool.denied`、推送到信封的间隔、backlog 状态列是否每次只动一格、`ci.verdict_commit`。

汇报：每个批次一份 `docs/ops/<batch>-r<attempt>.md`，外加一份 `docs/ops/queue-<日期>.md`。提交 `ops: report v04 queue`，推送，
对话里回「已写 docs/ops/queue-<日期>.md」。

基准提交：3461333
