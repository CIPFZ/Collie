# 下一轮指令（R1 → 操作员）

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：v03-b03-fix

b03 第 2 次是 Collie 拦错了，你的判断对。裁定：v03-b03 标 blocked、`c62deb2` / `09f229c` 采纳，不跑第 3 次；
你提的三件事全部采纳并进 v03-b03-fix 排在最前——`head_sha` 改按首次 `base_sha`（且是 HEAD 祖先）、取证逐提交跳过 R2 / ops 的信封裁定汇报提交、
只缺 report 时不续接会话。问题 2 选 (a)：R1 在同一批次 attempt 之间不推受保护改动，这条写进了 kickoff「交接走仓库」，你可以据此拒绝 next.md。
`357e110` 是我犯的，记在 backlog。

这轮是新批次 attempt 1，没有上述冲突。

步骤：
1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. `npx tsx src/cli.ts smoke` 一次。
3. `npx tsx src/cli.ts run v03-b03-fix`，只跑一次，不 kill。
4. 跑完 `npx tsx src/cli.ts audit <run_id>`。有 reviewer 时必须 0，非 0 停下；2 只在没有 reviewer 时出现。

重点看（写进汇报）：
- reviewer 工具清单（b02 代码第一次有机会在 reviewer 上生效）应为 Read / Glob / Grep / Bash；`collie audit` 退出码。连续两轮没验到，这轮是硬条件。
- `tool.denied` 有没有出现，有就原样抄。
- worker 对条目 1 的场景测试是否真的构造了「attempt 1 推送后中断、attempt 2 只写 report 且 head_sha 早于本轮 task 提交」，还是只改了检查函数。
- worker 是否在最后推送后立刻写 report（手册新加的那条第一次生效）；用了多少轮多少钱，有没有上下文压缩。
- 启动时 `ci.verdict_commit` 查的是 `e6c88ea`，应为 success、不警告。

汇报写进 `docs/ops/v03-b03-fix-r1.md`，提交 `ops: report v03-b03-fix r1`，推送，对话里回「已写 docs/ops/v03-b03-fix-r1.md」。

基准提交：4007ca4
