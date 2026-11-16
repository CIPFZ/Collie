# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：f486486
固定版本：7a50daa
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第八次队列 `--continue --max 2`，固定版本前移到 `7a50daa`（应依次选中 v045-b08、b09）

第七次队列的汇报我核过了，三批 PASS 都成立，裁定记在 SPEC 14.11。逐条说去向：

- **`follow` 推送失败后汇报永远推不上去：属实，再修一次。** 我用假时钟驱动真实循环复测：推送失败 3 圈、恢复远端、再走 3 圈，远端仍然没有汇报，本地领先 1；「队列结束」的通知第 1 圈就发了。
  你读代码得出的第 2 条（远端在队列期间前进后分叉）我也实测了：4 圈之后本地领先 1、落后 1。纯 git 核对过，这种状态下 `pull --ff-only` 与 `push` 都失败，`pull --rebase` 之后能推上去。
  修法是 **v045-b08**（SPEC 14.12），基本就是你建议的那三件：每圈先比较本地和远端、分叉时 rebase、看 `npm ci` 的退出码。另加一条：「队列结束」的通知等汇报上了远端才发。
- **我这次多找到三处**，都进了这两个批次：
  - `follow` 的测试里 `git pull` 从来没有成功过。测试沙箱没有给 `main` 配上游，而 `follow` 的拉取不写远端与分支，所以每一圈都失败。你那边的真实克隆有上游，不受影响；但「拉到新的 next.md」这条路径没有任何测试走到。
  - 缺省的子进程实现只留输出的末 200 行，汇报正文就取自它。现在的队列还没超（3 批是 103 行），运行次数一多就会截掉开头。
  - vitest 的 JSON 报告不指定输出文件时，会在当前目录建 `.vitest/json/output.json`，而且它没被 gitignore。v045-b09 要用这个报告，条目里写明了必须写到临时目录。
- **变异检查的 `caught` 判定偏宽：** 同意收紧，**v045-b09**（SPEC 15.5）。我这边也跑了一遍，44 项全是 `caught`，217 秒。
- **固定版本前移到 `7a50daa`：** 同意，就是这一轮。
- b07 的 worker 改 `eslint.config.js`：转给所有者，并进了 `docs/decisions/OPEN.md` 的 D1。这一轮两个批次都写明了不许改它。
- b06 用了 168 轮：是我拆得不好，签发自查里加了一条。b06 的 worker 问的 `batch.status` 两处都收，我确认是对的（SPEC 14.11）。
- `test/preflight.test.ts` 每跑一次留 1 个 `collie-clone-*` 在 `$TMPDIR`（你那边 `/data/tmp`，可以直接删），并进 v045-b09 清掉。

## 固定版本 `7a50daa` 里第一次生效的东西

- `worker.started` 与 `reviewer.started` 带 `max_turns`。`why` 的 `worker:` 行应显示 `turns=<轮数>/200`，`report` 的轮数一列同样；轮数等于上限时带「（到上限）」。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，**包括没有 `.vitest/`**）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。
5. 固定版本：`git -C /tmp/collie-r2 checkout -q --detach 7a50daa && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `7a50daa`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 7a50daa && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v045-b08`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。它的第一次真实使用再推后一轮。

## 重点看（写进汇报）

- **`max_turns` 第一次生效**：每个运行的 `worker.started` 原样抄；`why` 的 `worker:` 行原样抄。
- **v045-b08**（最要紧）：
  - 把你上次那个实验在新 HEAD 上再做一遍（在 `/data/tmp` 的仓库副本里，做完删掉）：「推送失败 3 圈 → 恢复远端 → 再走 3 圈」。这次应该是：远端有汇报提交，本地不领先，`run --continue` 只起 1 次，「队列结束」通知只有 1 条而且出现在恢复之后。实际结果原样写。
  - reviewer 的核对表里，对条目 1 两处加粗的情形给的证据原样抄。它有没有确认测试走到了「恢复之后」。
  - 新写的测试里，「拉取成功」那一条是怎么让拉取成功的（配了上游，还是代码里写明了 `origin main`）。
  - worker / reviewer 的事件流里搜 `cli.ts follow`，命中的原样抄（只允许 `--help` 与 `--dry-run`）。
  - 照旧读一遍 `src/follow.ts`，看到的问题写在批次汇报第 4 段。
- **v045-b09**：队列结束后在主仓库 HEAD 上：
  - `npm run test:mutation`，末行与用时原样抄；跑完 `git status --porcelain` 应为空（没有 `.vitest/`）。
  - 临时在 `test/` 里放一个类型检查不过的文件（例如一行 `export const x: number = 'a';`），跑 `npx tsx scripts/mutation.ts --only rule9-ci-third`：应该立刻以退出码 1 结束，末行是 `mutation: baseline failed (…)`，一项都不跑。输出原样抄，**然后删掉那个文件**。
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts; ls "$d"`：应该是空的。
- **还没在真实运行里触发过的**（出现了原样抄，没触发写没触发）：sha 写错判 FIX 并自动重跑；BLOCK 后重跑的 task 写「上一轮结论：」；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 常规项：每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、每批花费（worker / reviewer 分开）、
  开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
  队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report v045 queue 8`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
