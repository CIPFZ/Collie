# 下一轮指令（R1 → 操作员）

状态：开跑

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：单批次重跑 v04-b11 一次（`run v04-b11`，R2 仍用固定版本 `e042215`）

第三次队列的汇报我逐条对过，都成立：
- b05 到 b10 六批一次通过，六次放行都对，零误放行。我这边复测：lint、类型检查通过，七个批次的专项验收逐条通过，worker 提交没有碰受保护路径。
- v04-b11 拦得对：report 里的 `head_sha` 不存在（真实的是 `049854da9e87…`）。原因写错、路由偏重这两点也成立，`run.ts:1487-1494` 的 `.catch(() => false)` 我看到了。
- 开局预算有用，你那张对照表就是我要的证据。
- 场景 G 在 CI 上红的那一次，我这边抓到了直接原因：失败的两次里 journal 记的都是 `worker.stalled` 而不是 `worker.idling`（实测）。
  为什么会判成卡死是我读代码推断的，没有单独验证：假时钟每次调用走 1 毫秒，而 fake worker 开局的几次 `git commit` 是真实耗时；
  机器一慢，监视器空转的圈数就把假时钟推过了 `stall_secs`。会签一个只改测试的批次。

v04-b11 按你的建议收尾：**不改 backlog，用单批次模式让 attempt 2 重写 report，由 R2 自己取证。** 不走「不经 R2 取证直接采纳」。
这一轮我没有推任何受保护路径的改动（本次只有这个 `ops:` 提交），新批次与固定版本前移都等 b11 有了结果再推。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. token 检查（同上一轮，两条都不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
3. 按 KICKOFF「R1 的约束」核一次：`git log --oneline 9f6d593..HEAD -- SPEC.md CONSTRAINTS.md AGENT-*.md .collie/collie.toml docs/backlog.md`。
   应该只有 R2 自己的 `931c7c1 progress: v04-b11 BLOCK`；出现 `r1:` 提交就停下报告，不跑。
4. 确认 `git -C /tmp/collie-r2 rev-parse --short HEAD` 是 `e042215`（不在就按上一轮的办法重建）。
5. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts smoke`，非 0 就停。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run v04-b11`。**只跑一次**，不管结果。
7. `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`。
8. 不管结论是什么都不要再跑：写汇报、推送，然后按「不用人传话」等 next.md。

已知会出现的情况（都在 `e042215` 里，照常记一笔）：
- 上一次是上报 BLOCK，这一次的 task 会写「上一轮中断」，`interrupted_at` 的原因多半是 `unknown`，**不会告诉 worker 是 sha 出了问题**。
  worker 能不能自己找到原因（读 progress.md 里本批次那条记录，或者核对旧 report 里的 sha）是这一轮的看点。
- 仓库里还留着上一次那份 sha 写错的 `.collie/batches/v04-b11/report.md`。worker 要是原样不动，R2 读到的还是它，会再 BLOCK 一次。
- 单批次模式不改 backlog 状态列：就算 PASS，v04-b11 在 backlog 里仍是 `blocked`，由我来改。你不要动它。

## 重点看（写进汇报）

- task：frontmatter 的 `attempt`、`interrupted_at` 原样抄；「上一轮中断」一节原样抄。
- worker 怎么得到 sha 的：有没有运行 `git rev-parse`；有没有读 `docs/progress.md`；有没有读旧的 report；新 report 的 `head_sha` 原样抄，并核对它能不能解析、是不是 `049854d`。
- worker 有没有新的代码提交（预期没有，只重写 report）。有的话把提交抄下来。
- R2 取证：验收逐条、`ci.resolved`、受保护文件行数、reviewer 结论与 gaps、仲裁走到哪条规则、退出码。
- 结论是 BLOCK 或 FIX 时，把 `escalated` / `verdict.downgraded` 原样抄。这会是 b11 第二次被拦，按约定我要去问所有者，你不用再做什么。
- 花费与用时。

汇报：`docs/ops/v04-b11-r2.md`，提交 `ops: report v04-b11 r2`，推送，对话里回一句「已写 docs/ops/v04-b11-r2.md」，然后按「不用人传话」等 next.md。

## 你上一轮第 10 段各条的去向

1. v04-b11：本轮。
2. 「sha 不能解析」改判为声称不符并自动重跑：这是改仲裁规则，我要先问所有者。「报错不再被吞、原因写对」不改规则，我直接签批次。手册加「sha 取自 `git rev-parse HEAD`」。
3. 队列里补查上一条裁定提交的 CI：签批次，只记事件与告警，不改结论。
4. 场景 G：见上，签一个只改测试的批次（场景 N 用的是同一套假时钟，一并改）。
5. `why` 的结论行在缺 `rule` 时为空：签批次，从 `verdict.downgraded.rule` 推，推不出显示 `规则 —`。
6. 通知 webhook、7. PAT 轮换与磁盘：已转给所有者。
8. 固定版本前移：b11 这次 PASS 就前移到它的裁定提交，否则前移到 `9f6d593`（v04-b10 的裁定提交）。下一轮指令里写明。

基准提交：c5445a2
