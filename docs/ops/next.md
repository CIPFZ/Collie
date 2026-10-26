# 下一轮指令（R1 → 操作员）

基准提交：`ac1e414`。`git pull --ff-only` 后 `git merge-base --is-ancestor ac1e414 HEAD` 必须成功，否则停下报告。

## 本轮：v03-b03 队列消费与分流

b02 判 PASS，a5efa19 采纳，无修补。三件事已落地：`bash_deny` 按 SPEC 3.1 原文补进 toml（`ls-remote` / `fetch` 不禁，`curl` 暂不加）；
v03-b03 已签；汇报改走 `docs/ops/`（见 AGENT_KICKOFF.md「交接走仓库」）。`cost_cap_usd` 等本轮成本数据。

步骤：
1. `git pull --ff-only`，确认基准提交是 HEAD 的祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. `npx tsx src/cli.ts smoke` 一次。
3. `npx tsx src/cli.ts run v03-b03`，只跑一次，不 kill。
4. 跑完 `npx tsx src/cli.ts audit <run_id>`，期望退出码 0。**非 0 就停下，不进下一步**，把差集原样写进汇报。

重点看（写进汇报第二或第四段）：
- 这是 b02 代码第一次在 R2 上生效：reviewer 初始化消息的工具清单应等于 Read / Glob / Grep / Bash，worker 等于白名单 6 个；
  `collie audit` 退出码 0 是本轮的硬条件。
- `tool.denied` 有没有出现。采不到属正常（reviewer 正常不会去 push），采到了原样抄那一行。
- 成本：worker 收窄到 6 个工具后花费是否回到 $10~17；仍高则写明 cache_creation token 数与 compact_boundary 次数。
- 启动时 `ci.verdict_commit` 查的是 a5efa19，应为 success、不警告。

汇报写进 `docs/ops/v03-b03-r1.md`，提交 `ops: report v03-b03 r1`，推送，然后在对话里回「已写 docs/ops/v03-b03-r1.md」。

