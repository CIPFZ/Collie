# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：01824a5
固定版本：1745544
批次上限：1

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮分两步：A 单批次重跑 v046-b25 一次；B 队列 `--continue --max 1`（应选中 v046-b27）

第二十二次队列的汇报我核过了。我这边：lint、类型检查通过；全量测试 2 次都是 1453 个全过，`index.lock` 0 次；v046-b24、b25 的专项验收在 HEAD 上逐条通过；受保护路径只有 backlog 的状态格。
b25 的改动我自己读了一遍，和你实测的一致：收尾不再 `add -A`、不再 `reset`，只提交暂存区里撤销出来的改动与删掉的验收测试。
你把 `note.txt` 放在 reviewer 的场景里写、造出「救援之后、收尾之前」的未跟踪文件，又另造了一次真正的内容冲突，这两个实验补上了新用例没测到的地方。你第 7 段的几条：

- **第 1 条，v046-b25：重跑，照 v046-b12 的先例。** 它缺的只是 reviewer 的审核。单批次模式跑一次，由 R2 自己取证、reviewer 照常审。
  按启动手册「R1 的约束」，**这一轮我只推了这一个 `ops:` 提交，没有动任何受保护路径**。第二十二次队列的裁定、新批次、b24 与 b25 查出来的几处测试，都等它有了结果再推。
- **第 2 条，两处守不住的测试**（b24「reviewer 用这一次的信封」那一组；b25「只提交自己的路径」只有 grep 守、「content conflict」其实是改/删冲突）：都要改实，下一轮签一个批次。你那两种造法我会写进条目。
- **第 3 条，reviewer 的 `api_error` 与「worker 出错还拉 reviewer」：** 这是改队列重跑的规则，要所有者定，我这一轮提给所有者。
- **第 4 条，`node_modules`：** 你装回来是对的，留着。谁清的 `/data` 我去问所有者，你不用管；别的项目的目录你没有动，也对。
- v046-b26 这一轮不会被选中：它依赖 v046-b25，而 b25 在 backlog 里仍是 `blocked`（单批次模式不改状态格）。B 步只会选中 v046-b27。

## 开跑前（A、B 共用）

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/v046-b21/` 在树里是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. **那次清理有没有动到 journal。** 下面三个文件都要在、都不是空的，逐个 `ls -la` 抄进汇报：
   `.collie/runs/r-20261120095844/events.ndjson`、`.collie/runs/r-20261120104848/events.ndjson`、`.collie/runs/q-20261120094159/events.ndjson`。
   **有一个不在：停下报告，A 和 B 都不跑。** 固定版本靠本机 journal 里记下的提交号认 R2 自己的提交（SPEC 16.14）；journal 没了，R2 那三个改过 `docs/progress.md` 与 backlog 的裁定提交会被算到 worker 头上，重跑会被规则 2 拦下。
   顺带看一眼 `.collie/runs/` 下目录的个数，和你印象里的对不对得上。
4. 按启动手册「R1 的约束」核一次：`git log --oneline d352068..HEAD -- SPEC.md CONSTRAINTS.md 'AGENT-*.md' .collie/collie.toml docs/backlog.md`。
   应该只有 R2 自己的三个：`fb05463 progress: v046-b25 BLOCK`、`bf24c99 progress: v046-b25 rule1_retry`、`41e93ab progress: v046-b25 BLOCK`。出现 `r1:` 提交就停下报告，不跑。
5. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
6. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
7. 固定版本：`git -C /tmp/collie-r2 rev-parse --short HEAD` 应是 `1745544`，`/tmp/collie-r2/node_modules` 在（不在就 `git worktree add /tmp/collie-r2 1745544 && (cd /tmp/collie-r2 && npm ci)`）。
8. **模型接口。** 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。
   - 一轮算过，要三次都满足：命令的退出码是 0；`runner` 那一行是 `ok   runner: exitCode=0`；整条命令在 60 秒以内。
   - 没过：等 30 分钟，重做第 1 步的检查和这一步。最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。

## A：单批次重跑 v046-b25（只跑一次）

9. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run v046-b25`。**只跑一次**，不管结果。
10. `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`。

已知会出现的情况，照常记一笔：
- 这是第 3 次运行。task 会带上一轮的结论（规则 1）。worker 应该发现代码、测试、汇报都在。它什么都不改也可以；它要是有新的提交，把提交抄下来。
- 固定版本还没有 v046-b24 的修复：worker 没有新的代码提交时，reviewer 读到的是第 1 次的 `task.md`。条目没有变过，没有后果。
- 单批次模式不改 backlog 状态列：就算 PASS，v046-b25 仍是 `blocked`，由我来改。你不要动它。

**A 之后要不要接着做 B：**
- A 里有会话以接口错误结束（worker 或 reviewer 的结果消息里 `terminal_reason` 是 `api_error`）：**停下**，不做 B，写汇报、推送。
- 其余情况，不管 A 的结论是 PASS、FIX 还是 BLOCK，都接着做 B。v046-b25 不会再跑第四次：没过的话我另签批次。

## B：队列 `run --continue --max 1`

11. `git status --porcelain` 为空、`heartbeat.json` 不存在；在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b27`，确认状态是 pending。
12. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 1`。中途不干预、不重跑。
    队列 journal 里应先有一条 `batch.skipped`（v046-b26，缺 v046-b25），然后选中 v046-b27。选中的不是 v046-b27：让它跑完，如实写进汇报。
13. 结束后每个 run_id 手工跑一次 `audit`，和 journal 里的 `audit.result` 对一下。
14. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **A，v046-b25 的第 3 次运行（这一轮最要紧）。**
  - task：frontmatter 的 `attempt`、`interrupted_at` 原样抄；讲上一轮的那一节原样抄。worker 是续接的会话还是新开的；它读了什么、跑了什么、有没有新的提交；汇报的「偏离或疑问」原样抄。
  - R2 取证：验收逐条、`ci.resolved`、`spec_diff_lines`（应该是 0）、仲裁走到哪条规则、退出码。**`spec_diff_lines` 不是 0：** 把 `evidence.collected`、范围里的 `git log --format='%h %s'`、本机 journal 里全部 `r2.commit` 原样抄出来。
  - reviewer：结论、`gaps`、核对表里「被改写或删去的断言」与「不变量数值变化」两行原样抄。它有没有指出下面四处（指出了、怎么说的，原样抄；没指出就写没指出）：
    新用例的 `note.txt` 进了 `.gitignore`，不是真正的未跟踪文件；
    「content conflict」那条用例造的是改/删冲突；
    worker 在 `await push(` 上面加了一行注释，让 `every await push( in run.ts has push_failed or verdict within 5 lines above` 这条不变量通过；
    收尾提交没有经 `r2Commit`，是直接 `git commit` 再手工记 `r2.commit`。
  - worker 有新的代码提交时：你上一轮 `v046-b25-r1.md` 第 4 段的 ①②③ 三个实验在新的 HEAD 上再跑一遍。没有新提交就不用重做。
- **B，v046-b27。**
  - 用 HEAD 的 cli 在主仓库根跑一次 `preflight --smoke`（真实的运行器）：`runner` 一行原样抄，应带 `secs=`。
  - 一次性脚本：给 `preflight` 一个返回 `exitCode: 1` 的假运行器，输出与退出码原样抄（预期 `FAIL runner: exitCode=1 …`、末行 `preflight: failed (runner)`、退出码非零）；`collie smoke` 同样试一次（预期退出码 1、有 `smoke failed`、没有去查 CI）。
  - 把「退出码非零判不过」那一处撤掉，跑 `npm test -- test/preflight.test.ts`：必须有用例失败；`smoke` 那一处同样撤一次，跑 `npm test -- test/cli.test.ts`。
  - `secs=` 的值是不是经注入的时钟算的（测试里是一个确定的数，没有真的等）。
- **这一轮被删、被改的断言，请逐条过一遍。** 是不是条目点名的、是不是最小改动、有没有改松；不是点名的，撤掉它守的那一处看变不变红。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例因为自带的超时到点而失败的，写明是哪个文件。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本轮所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格（A 不动）、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer 会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（14.33、14.1）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过。
- B 结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`（A 是 `v046-b25-r3.md`），外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 23`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
