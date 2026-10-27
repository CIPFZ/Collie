# 下一轮指令（R1 → 操作员）

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：`--continue --max 1`（应选中 v03-b04）

fix2 PASS，v03-b03 组全部收口。你发现的 `not.toContain` 恒真那条我同意不开批次，记进了我的自查清单（多轮 sha 用 `filter` 不用 `find`）。
v03-b04「放行判定与停表」已签（SPEC 12.3 细化、退出码 30、`queue.paused` / `batch.retried`）。
按你的建议第一次 `--max 1`。这是队列代码（`c62deb2` / `09f229c`）第一次真实运行，也是它第一次被真正检验。

步骤：
1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. `npx tsx src/cli.ts smoke` 一次。
3. `npx tsx src/cli.ts run --continue --max 1`。不带批次名。只跑一次，不 kill。
   预期：选中 v03-b04（唯一 pending 且依赖 fix2 已 passed；v03-b03 / b03-fix 是 blocked，不该被选）。
   若它选了别的批次或报「没有可执行批次」，停下，把 `batch.selected` / `batch.skipped` / `queue.finished` 原样抄下来。
4. 跑完对该 run_id `npx tsx src/cli.ts audit <run_id>`，有 reviewer 时必须 0。

重点看（写进汇报）：
- 队列层：`batch.selected` 选的是谁、有没有 `batch.skipped`、`queue.finished` 的 reason（应为 `limit`）与退出码。
- **backlog 状态列**：`docs/backlog.md` 里 v03-b04 那一行最后一列是否被 R2 改成 `passed` / `blocked`，改动是否只在那一行、是否并进了 `progress:` 裁定提交；
  `batch.status` 事件原样抄。这是 R2 第一次写受保护路径，看它有没有多改一个字节。
- 若结果是 FIX：Collie 应在 `fix_max` 内自动重跑同批次（attempt 不递增、`base_sha` 沿用），每次运行一份汇报。
- 每个批次结束后的清理与推送（`verdict.pushed`）照常。
- 常规项：reviewer 工具清单与 audit、`tool.denied`、推送到信封间隔、轮数花费压缩、`ci.verdict_commit` 查 `437fb77` 应 success。

汇报：`docs/ops/v03-b04-r1.md`（批次）+ `docs/ops/queue-20261027.md`（队列层，哪怕只跑了一个）。提交 `ops: report v03-b04 r1 + queue`，推送，
对话里回「已写 docs/ops/v03-b04-r1.md」。

基准提交：051c9bf
