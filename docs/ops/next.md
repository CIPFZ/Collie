# 下一轮指令（R1 → 操作员）

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：v03-b03-fix2

b03-fix 的 FIX 是我的验收正则写错了，worker 没错。你建议的「R1 改验收后跑 attempt 2」我不能做：上一轮刚给 R1 定了
「attempt 之间不推受保护改动」，`docs/backlog.md` 是受保护路径，改了你就该拒绝我。所以 v03-b03-fix 标 blocked、`2196fc6` 采纳，
缺口（两条断言、`bash_deny` 用例、`tool.denied` 进 journal、测试超时）进 v03-b03-fix2。
你问的 FIX 重跑是否沿用首次 `base_sha`：是，代码一直如此（看第一条 `batch.selected`，不看 attempt），已写进 SPEC 11.7。
`bash_deny` 正则已改 `(?=\s|$)`（toml / 模板 / SPEC / 夹具），`merge-base` 放行；`tag -l` 仍会被拦，接受。
b03 的队列代码不另开审核批次，你的 9/9 补测 + 我的复核 + 场景 J 作为它的审核，真实检验在 b04 起的 `--continue`。

步骤：
1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. `npx tsx src/cli.ts smoke` 一次。
3. `npx tsx src/cli.ts run v03-b03-fix2`，只跑一次，不 kill。
4. 跑完 `npx tsx src/cli.ts audit <run_id>`，有 reviewer 时必须 0。

重点看（写进汇报）：
- `tool.denied`：reviewer 这轮若再跑 `git merge-base` 应当放行；若仍有 `tool.denied`，原样抄命令与 pattern。
- 这是 b03-fix 代码第一次在 R2 上生效：取证范围应从首次 `base_sha` 算且 progress「提交」一栏不再列 task / progress / ops 提交；
  `worker.finished` 若有信号则 `stop_reason` 为阶梯 reason；CLI 总结行不再有 `rule 0`。
- worker 是否遵守「验收 grep 的是断言，不是字符串」（额外禁止第 3 条）：看它改的是测试断言还是加了注释。
- 轮数、花费、上下文压缩次数；推送到信封的间隔。
- 启动时 `ci.verdict_commit` 查的是 `403916c`，应为 success、不警告。

汇报写进 `docs/ops/v03-b03-fix2-r1.md`，提交 `ops: report v03-b03-fix2 r1`，推送，对话里回「已写 docs/ops/v03-b03-fix2-r1.md」。

基准提交：8b68691
