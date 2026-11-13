# 下一轮指令（R1 → 操作员）

状态：开跑

基准提交：见本文件末尾。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准> HEAD` 必须成功，否则停下报告。

## 本轮：第五次队列 `--continue --max 1`，固定版本前移到 `d7d6e47`（应选中 v04-b17）

第四次队列的汇报我核过了：五批 PASS 都成立，零误放行。我在 HEAD 上连跑 3 次全量测试，都是 965 个全过；场景 G 的随机失败修好了。裁定记在 SPEC 13.22。

你的缺口清单这样处理：
- 第 1、2、3、5 条（reviewer 花费、head_sha、裁定提交 CI、模型 / 用时 / token）进 **v04-b17**（SPEC 13.23），只改 `view.ts`。
- 第 4 条（worker 的声称）只在 `report.md` 里，不在 journal 里，四个命令不做；要看用 `show`。
- 第 6~10 条只有 stream 或 GitHub 有，在 v0.4 的范围之外，不做。

我自己另外找到一处：v04-b16 让 sha 写错的 FIX 带了 `rule: 0`，`why` 会显示「规则 0：规则 0」。我用 fake runner 实跑了一遍才看到，reviewer 没核出来。这一处也并进 b17。

不变量放宽那条，你建议的两种做法我都用上了：
- 我能预见时，在条目里写明新的上限；
- worker 手册加了一条：改了 `invariants` 的数值，要在 report 里写出原值、新值和理由；
- reviewer 手册加了一条：核对表单列一行「不变量数值变化」，没写明的放宽进 `reason`。

裁定规则没有改。

## 固定版本前移：`5b132fd` → `d7d6e47`

`d7d6e47` 是 v04-b16 的裁定提交，和 HEAD 的 `src/`、`test/` 完全相同，依赖没变，不用重新 `npm ci`。
从这一轮起第一次真实生效的（出现了就原样抄那一行事件，没触发就写没触发）：
- **v04-b13：** sha 校验分三步报；BLOCK 之后重跑的 task 写「上一轮结论：」；单批次模式的 run_id 不再带 `-`。
- **v04-b14：** 启动时上一条裁定提交的 CI 查到 pending / no_runs，会在取证之后补查，记 `ci.verdict_commit` 带 `when: after_evidence`。
  - 本轮只有一批，开跑时上一条裁定提交早已出结果，大概率是一条 `when: startup`，属正常。
- **v04-b16：** report 里的 sha 解析不了，判 FIX、自动重跑一次（`queue.batch_started.why` 为 `fix_retry`），不再停队列。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净、`heartbeat.json` 不存在、无残留 claude / `node -e` 进程。
2. 磁盘：`df -h / /data`，两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. `notify "[Collie] 第五次队列开跑（v04-b17）"`，输出写进汇报。
5. 固定版本前移：`git -C /tmp/collie-r2 checkout -q --detach d7d6e47 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `d7d6e47`。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 d7d6e47 && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v04-b17`，确认状态是 pending。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts smoke`，输出原样抄进汇报（应有 `ci ok`），非 0 就停。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 1`。中途不干预、不重跑。
9. 结束后每个 run_id 跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，有 reviewer 时必须 0。
10. 退出码是 20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

## 重点看（写进汇报）

- **v0.4 的验收：再写一次「只用四个命令」的汇报，这一次是收口依据。** 用主仓库 HEAD 的代码（含 b17）：
  `status`、`timeline --since 2026-11-13`、`timeline --by version`、`why v04-b17`、`why v04-b16`、`show --queue <q-run_id>`。
  - 「实际经过」表这次加三列：reviewer 花费、每批合计花费、head_sha。只从命令输出取，和你从 journal 里数的对一下，逐格写对不对。
  - `timeline --by version` 里 v04 的合计花费，和你按 journal 逐个运行加出来的（worker + reviewer）对一下，原样写两个数。
  - 缺口清单照上次的格式再列一遍，第 6~10 条不用再列。**「数据在 journal 里、命令却不显示」的，这一次应该是 0 条**；不是 0 就逐条列出。
- **`why v04-b16` 的结论行**原样抄。它是旧 journal（没有 sha 写错），用来确认 b17 没把正常运行的结论行改坏。
- **reviewer 的核对表**：有没有出现「不变量数值变化」那一行，原样抄。本批次条目写明不应改动任何数值上下限，出现了改动就重点写。
- **新固定版本第一次生效的各项**（上一节三条）：逐条写出现 / 没触发 / 出现了但不对。
- 常规项：attempt（第一次运行应为 1、`interrupted_at: null`）、`ci.resolved`、本次队列所有提交的 CI、audit、`tool.denied`、backlog 状态列只动一格、
  每批花费（worker / reviewer 分开）、开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、`npm test` 有没有零散失败。

汇报：`docs/ops/v04-b17-r<attempt>.md` 每次运行一份，外加队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`）。
提交 `ops: report v04 queue 5`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。

基准提交：135d489
