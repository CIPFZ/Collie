# 下一轮指令（R1 → 操作员）

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：`--continue --max 1`（应选中 v03-b04-fix）

b04 维持 PASS。`--continue` 第一次真实运行成立：选批对、FIX 自动重跑、`base_sha` 沿用、R2 写 backlog 状态列只动一格（你的逐字节比对是本轮最硬的证据）。
你的四条建议全部采纳：
- 「不得为过验收改字面」升为铁律 26（CONSTRAINTS），worker 手册 4.2、reviewer 手册核对表同步。reviewer 以后遇到这种情况 gaps 要写「转 R1」。
- FIX 重跑：attempt 递增、`interrupted_at` 为 null、不写「上一轮中断」、写「上一轮判 FIX」（SPEC 11.7）。
- `fix_max` 只计本次队列（SPEC 12.2）。
- 队列 journal 加 `queue.batch_started`，`queue.finished.batches` 带 run_id 与 verdict（SPEC 12.2 / 3.6）。
三条进 v03-b04-fix。这一轮 b04 的放行判定（`gateDecision` / `queue.paused` / 退出码 30）第一次在 R2 上生效。

步骤：
1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. `npx tsx src/cli.ts smoke` 一次。
3. `npx tsx src/cli.ts run --continue --max 1`。预期选中 v03-b04-fix。选了别的或报无可执行批次，停下抄事件。
4. 每个 run_id 各跑一次 `npx tsx src/cli.ts audit <run_id>`，有 reviewer 时必须 0。

重点看（写进汇报）：
- **放行判定首次生效**：PASS 之后 journal 里有没有 `queue.paused`；退出码是 0 还是 30；`queue.finished` 是否带 `paused_count`。
  若是 30，把 `queue.paused.reasons` 原样抄下来——这是「打扰」的第一个真实样本，要判断它该不该打扰。
- 若有 FIX 重跑：这轮 R2 还是 b04 代码，task 仍会错写「上一轮中断 / unknown」（属已知，本批次修）；看 worker 有没有被误导。
- 若 reviewer 又判验收匹配到注释：看它的 gaps 是否按新手册写「转 R1」，worker 是否按铁律 26 不改字面。
- backlog 状态列改动是否仍只动一格；队列 journal 内容原样。
- 常规项：audit、`tool.denied`、推送到信封间隔、轮数花费压缩、`ci.verdict_commit` 查 `2bbda1b` 应 success。

汇报：`docs/ops/v03-b04-fix-r<attempt>.md`（每次运行一份）+ `docs/ops/queue-20261027-2.md`。提交 `ops: report v03-b04-fix + queue`，推送，
对话里回「已写 docs/ops/v03-b04-fix-r1.md」。

基准提交：59a9579
