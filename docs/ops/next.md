# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：fb29c5e
固定版本：7a50daa
批次上限：9

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第九次队列 `--continue --max 9`，固定版本仍是 `7a50daa`（应依次选中 v045-b09、b10、b11）

**为什么是 `--max 9`：** 固定版本里 `--max` 仍然数运行次数（你发现的那一处，这一轮的 v045-b10 才修）。3 个批次、每个最多 3 次运行（`fix_max` 是 2），填 9 才不会被 FIX 重跑挤掉名额。
backlog 里可跑的只有这 3 个批次，全部通过后队列会自己结束。

第八次队列的汇报我核过了，v045-b08 的 PASS 成立，裁定记在 SPEC 14.13。你第 6 段的几条：

- **第 1 条，`--max`：按 SPEC 改代码，只数 PASS。** 这是实现和规格不符，不用所有者裁定。我用假 runner 复现了：两个批次、第一个先 FIX 再 PASS，`--max 2` 在第一个通过后就停。修法是 **v045-b10**（SPEC 14.14）。
- **第 2 条前一半，pull 通知：补回来。** 你读代码看到的我实测了：队列处理完之后远端不可达 5 圈，新通知 0 条；本地落后而快进被挡住 4 圈，新通知 0 条。
  你第 4 条（汇报提交失败照样记 `pendingReport`）我也实测了：用一个退出码 1 的 `pre-commit` 钩子，第 2 圈就发了「到对话里说看」，远端没有汇报。两处一起进 **v045-b11**（SPEC 14.15）。
- **第 2 条后一半，收紧「改写旧用例」：** 这次是我的条目写得松（「与新行为冲突的旧用例不算」，没点名是哪几条）。这一轮起：
  - 条目里点名允许改写的旧用例，别的不许动；
  - 两份手册各加了一段：worker 改写或删掉已有断言要在「偏离或疑问」里逐条列出；reviewer 的核对表单列一行「被改写或删去的断言」。
  - 这两段只要求写出来。「原要求仍然有效的断言被删，是否一律判 FIX」是判定的改动，已转给所有者（`docs/decisions/OPEN.md` 的 D5）。
- **第 3 条，固定版本：** 不前移，留在 `7a50daa`。等 v045-b10 通过再动。
- 推送：我复测的两组（失败 3 圈后恢复、队列期间远端多一个提交）和你的结论一样，修好了。`--once` 那一组我没有重跑，按你的结果记了；它是 SPEC 14.12 的设计，不改，第一次真实使用时用 `--timeout`。
- 你第 5 段的第 4、6 条（重跑 task 的提交清单、`report` 不列 FIX 重跑）：记在 SPEC 14.13，这一轮不签。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。
5. 固定版本：`git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `7a50daa`（上一轮就在这个版本，不用动）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 7a50daa && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v045-b09`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 9`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 重点看（写进汇报）

- **手册新加的两段有没有起作用**（三个批次都看）：
  - worker 汇报的「偏离或疑问」里，关于改写或删去断言的内容原样抄；写「无」的，你自己用 `git diff <base>..<head_sha> -- test/` 找一遍被删掉或改掉的 `expect(`，有就列出来。
  - reviewer 核对表里「被改写或删去的断言」那一行原样抄；没有这一行也写明。
- **v045-b11**（最要紧）。队列结束后在 `/data/tmp` 的仓库副本里（做完删掉），用假时钟驱动 `follow` 函数：
  - 队列处理完并推送之后，让远端不可达 5 圈：应该只在第 3 圈通知 1 条「git pull 连续失败」；恢复远端走 1 圈，`follow.json` 的 `syncFailures` 应为 0；再不可达 3 圈，应再通知 1 条。
  - 远端有新提交、本地的快进被一个未跟踪的同名文件挡住 3 圈：应通知 1 条。
  - 用退出码 1 的 `pre-commit` 钩子让汇报提交失败，走 3 圈：应只有 1 条通知，含「汇报没能提交」，不含「到对话里说」。
  - 上一轮的推送实验再做一遍（失败 4 圈、恢复、再 3 圈），确认没有被这一批改坏。这一组里现在会多出 1 条「git pull 连续失败」，是预期的。
  - 实际结果原样写。照旧读一遍 `src/follow.ts`，看到的问题写在批次汇报第 4 段。
  - worker / reviewer 的事件流里搜 `cli.ts follow`，命中的原样抄（只允许 `--help` 与 `--dry-run`）。
- **v045-b10**：这一轮的队列本身用的还是旧的计数，所以看测试：
  - `npm test -- test/queue-limit.test.ts` 末尾原样抄；读一遍这个文件，确认每条用例是用 `FakeRunner` 跑出来的真实队列，不是手写的事件。
  - `git diff <base>..<head_sha> -- src/run.ts` 原样抄（应该只有队列循环里到数的那一处）。
  - 这一批改的是 R2：reviewer 对两处加粗情形给的证据原样抄。
- **v045-b09**（和上一轮指令相同）。队列结束后在主仓库 HEAD 上：
  - `npm run test:mutation`，末行与用时原样抄；跑完 `git status --porcelain` 应为空（没有 `.vitest/`）。
  - 临时在 `test/` 里放一个类型检查不过的文件（例如一行 `export const x: number = 'a';`），跑 `npx tsx scripts/mutation.ts --only rule9-ci-third`：应该立刻以退出码 1 结束，末行是 `mutation: baseline failed (…)`，一项都不跑。输出原样抄，**然后删掉那个文件**。
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts; ls "$d"`：应该是空的。
- **FIX 重跑在 `--max 9` 下的表现**：有 FIX 就把队列 journal 里那几行原样抄，写明下一个批次有没有照常被选中。
- **还没在真实运行里触发过的**（出现了原样抄，没触发写没触发）：sha 写错判 FIX 并自动重跑；BLOCK 后重跑的 task 写「上一轮结论：」；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 常规项：每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、每批花费（worker / reviewer 分开）、
  开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
  队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。
- 临时目录：`$TMPDIR` 里的 `collie-clone-*` 开跑前可以直接删；v045-b09 通过之后不应该再出现新的。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report v045 queue 9`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
