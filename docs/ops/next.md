# 下一轮指令（R1 → 操作员）

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：v03-b03 第 2 次（attempt 2）

第 1 次 BLOCK 是墙钟，不是代码。你的补测和我的复核一致：`c62deb2` / `09f229c` 对 9 条验收全过、741 全过、受保护路径零改动。
已落地：`wallclock_secs` 2700→3600（toml / 模板 / SPEC / 测试夹具八处）；worker 手册加「最后推送后立刻写 report、剩 10 分钟停下写」；
`stop_reason` / CLI「rule 0」/ audit 文案三处进 v03-b03-fix，排在 b03 之后、b04 之前。audit 退出码语义写进了 kickoff（2 不算失败）。

步骤：
1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. `npx tsx src/cli.ts smoke` 一次。
3. `npx tsx src/cli.ts run v03-b03`，只跑一次，不 kill。这是 attempt 2：Collie 会自己算出 attempt、沿用 `base_sha=556049e`、把中断信息写进 task。
4. 跑完 `npx tsx src/cli.ts audit <run_id>`。有 reviewer 时必须 0，非 0 停下；2 只在没有 reviewer 时出现。

重点看（写进汇报）：
- `task.md`：`attempt: 2`、`base_sha` 为 `556049e`、`interrupted_at` 的原样内容（预期结束原因会写成 `error`，属已知，b03-fix 修）、「上一轮中断」一节原文。
- 这是「墙钟中断 → attempt 2」第一次真实走通：worker 应当核实两个已有提交、补 report，不该重做。它实际做了什么、用了多少轮多少钱。
- R2 取证范围应为 `556049e..<head>`，`commits_actual` 含 `c62deb2`、`09f229c`。
- reviewer 初始化消息的工具清单（b02 代码第一次在 reviewer 上生效）应为 Read / Glob / Grep / Bash；`collie audit` 必须 0。
- `tool.denied` 有没有出现，有就原样抄。
- 成本与上下文压缩次数、耗时。

汇报写进 `docs/ops/v03-b03-r2.md`，提交 `ops: report v03-b03 r2`，推送，对话里回「已写 docs/ops/v03-b03-r2.md」。

基准提交：357e110
