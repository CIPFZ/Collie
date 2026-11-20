# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：4c92c89
固定版本：1745544
批次上限：4

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十二次队列再试，`--continue --max 4`，固定版本不动（应依次选中 v046-b24、b25、b26、b27）

你上一次没有开跑，做得对：三次检查每次 4 分钟、`runner` 是 `exitCode=1`，不该开。裁定记在 SPEC 14.33。你汇报里的几条：

- **第 2 段第 1 条，smoke 把非零退出码当 ok：** 我读了 `src/preflight.ts`，和你说的一样。`follow` 也靠这条命令判断能不能开跑，所以要修：新签 **v046-b27**（退出码非零判不过，写出结束原因与用时；`collie smoke` 同样）。
  结果消息的错误文字这一批不带出来：v046-b26 之后运行器会给出 `api_error` 这个结束原因，够判断了。
- **第 3 段第 1 条，什么时候再试：** 见下面第 6 步，这一次把「过了」和「没过怎么办」都写明了。你不用再等我。
- 你事后单独调的那一次（4 秒成功）：记下了，说明接口是时好时坏。
- 前三批的说明与上一份 next.md 相同：v046-b24 小修；v046-b25 收尾只提交自己改的路径；v046-b26 是 v046-b23 的改签。都不带情形。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/v046-b21/` 在树里是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
5. 固定版本：`git -C /tmp/collie-r2 rev-parse --short HEAD` 应是 `1745544`（不在就 `git worktree add /tmp/collie-r2 1745544 && (cd /tmp/collie-r2 && npm ci)`）。
6. **模型接口。** 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。
   - **一轮算过，要三次都满足这三条：** 命令的退出码是 0；`runner` 那一行是 `ok   runner: exitCode=0`（固定版本会把 `exitCode=1` 也写成 `ok`，所以要看这个数）；整条命令在 60 秒以内。
   - **过了：** 接着做第 7 步。
   - **没过：** 等 30 分钟，重做第 1 步的检查和这一步。最多做 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
   - 每一轮三次的开始时间、用时、退出码、`runner` 那一行都记进汇报（最后一起写，中间不用推送）。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b24`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 4`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本或独立克隆里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b25（最要紧）。**
  - 你上上轮那条一次性用例（队列模式、带情形的批次、假测试 agent 在主工作区留一个未跟踪的 `rogue.txt`）在 HEAD 上再跑一遍：预期**没有** `cleanup` 提交、没有 `batch.cleanup`，`rogue.txt` 不在任何提交里。原样抄。
  - 空转两次的那条（有救援提交）再跑一遍，工作区里另放一个未跟踪的文件：`cleanup` 提交只含救援改过的文件。
  - 自己造一个内容冲突（救援提交与之后 worker 的提交改同一行）：没有任何提交里出现 `<<<<<<<`，被跟踪的文件没有残留改动，journal 有 `batch.cleanup_failed`。
  - 逐个撤一次、看测试变不变红：「只提交自己的路径」那一处（改回 `add -A`）；「冲突时只 `revert --abort`」那一处；「没有要提交的就不提交」的判断。
  - `grep -nE "'reset'|'-A'|checkout', '\\.'" src/run.ts`：只应剩救援提交那一处 `add -A`。
- **v046-b26（v046-b23 改签）。** 把第十六、十九、二十一次队列里真实的 `api_error` 结果消息喂给运行器的汇总逻辑（一次性脚本），`stopReason` 应该是 `api_error`；
  逐个撤一次（运行器认 `api_error`、队列把它算中断、续跑前等待），各自必须有用例变红；副本配置加 `api_retry_wait_secs = 60`，固定版本与 HEAD 的 cli 各跑一次 `preflight`：预期旧的报不认识的字段、新的能读。
- **v046-b27。**
  - 用 HEAD 的 cli 在主仓库根跑一次 `preflight --smoke`（真实的运行器）：`runner` 一行原样抄，应带 `secs=`。
  - 一次性脚本：给 `preflight` 一个返回 `exitCode: 1` 的假运行器，输出与退出码原样抄；`collie smoke` 同样试一次。
  - 把「退出码非零判不过」那一处撤掉，跑 `npm test -- test/preflight.test.ts`：必须有用例失败；`smoke` 那一处同样撤一次。
- **v046-b24。** 撤掉恢复被跟踪文件那一行：`tester only deletes a tracked file → …` 必须红；测试 agent 的墙钟改回 `wallclock_secs`：`tester wallclock uses worktree_secs` 必须红；撤掉「reviewer 的 `task.md` 用这一次的信封」：新的一组必须红。
- **这一轮被删、被改的断言，请逐条过一遍。** 是不是条目点名的、是不是最小改动、有没有改松；不是点名的，撤掉它守的那一处看变不变红。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例因为自带的超时到点而失败的，写明是哪个文件。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer 会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.19、16.18、14.32、14.33、13.14）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`、`-4`）和生成的那一份。
提交 `ops: report queue 22`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
