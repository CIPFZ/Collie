# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：1114acd
固定版本：1745544
批次上限：4

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十一次队列 `--continue --max 4`，固定版本前移到 `1745544`（应依次选中 v046-b21、b22、b23、b24）

第二十次队列的汇报我核过了，三批的 PASS 都成立，主分支的 CI 从 `ccb05f9` 起回到了成功，裁定记在 SPEC 14.31。你在克隆里那次真跑和「撤一次」查出来的三处，正是我要的。你第 7 段的几条：

- **第 1 条，固定版本前移到 `1745544`：** 就是这一轮。**本仓库的 `.collie/collie.toml` 我已经加上了 `[agent.tester]`、`tester_max`、`redcheck_secs`、`worktree_secs`、`static`**（照模板）。
  我核对过：`1745544` 读得了这份配置；改完之后全量测试全过。
- **第 2 条，两处守不住的测试：** 并进 **v046-b24**，连同上上轮你提的「重跑时 reviewer 读的是旧信封」。
- **第 3 条，`--json` 多出来的 `null`：** 算违反，条目写的是输出不变。改它的是 **v046-b21**，没有测试 agent 时不输出这两个键。
- **第 4 条，D12：** 所有者定了，选甲：承认救援提交会上 `main`；批次在队列里最终被拦时，R2 自动把救援提交的改动撤掉。就是 **v046-b22**，它同时把本批次的验收测试从树里拿掉（接线时我漏签的一项）。
- D11（接口出错算可续跑的中断）是 **v046-b23**，带上了你说的「续跑前先等一等」。
- 磁盘已知。

## v046-b21 是第一个带情形的批次，这一轮最要紧的就是它

它在真实队列里第一次走完整条新流程：测试 agent 写验收测试 → 红检查 → 验收测试随 task 信封提交 → worker 只写实现 → reviewer。它排在最前。请把它的经过写细：

- journal 里 `tester.started`、`tester.finished`、`redcheck.result`、`r2.commit`、`batch.task_written` 的先后与字段，原样抄；测试 agent 拉起了几次。
- `docs: issue v046-b21 task envelope` 那个提交里有哪些文件（`git show --stat`）。**`test/acceptance/v046-b21/` 下三个文件的全文贴进汇报**，测试 agent 的最终回复全文也贴上。
- 它写的测试是不是真的在断言情形说的事。我特别想知道 S1、S2：它断言的是「键不存在」（比如 `'tester' in obj` 为 false、或序列化后的文字里没有那个键），还是只断言「值是 undefined」。后一种太弱。
- worker：读了什么、改了什么、有没有碰 `test/acceptance/`、「偏离或疑问」原样；取证里的 `spec_diff_lines`（应该是 0）。
- reviewer：核对表「受保护路径是否被改」一行原样；它有没有逐条对照情形。
- 结束后 `why v046-b21` 的输出里应有 `tester:` 一行，抄出来。

**它要是没走通，停在哪一步就把那一步写清楚，不要重跑：**
- 测试 agent 这一步没过（`red_check_failed`、`misclassified`、`tester_failed`、`tester_touched_main_tree`）：队列会以 `blocked` 停下。`.collie/batches/v046-b21/tester.md` 全文、`redcheck.result` 的 `problems` 原样抄。
  是 `tester_touched_main_tree` 的话，主工作区里会留着它新建的未跟踪文件：列进汇报，然后删掉（不然下一次开跑前的检查过不了）。
- worker 这一侧超过 `fix_max`：`test/acceptance/v046-b21/` 会留在树里，主分支可能是红的。这是预期的（拿掉它的是 v046-b22，还没进固定版本）。照常写汇报、停下。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`、没有 `test/acceptance/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。**必须是绿的**（主分支已经修好，不再有预期的失败）。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach 1745544 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `1745544`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 1745544 && (cd /tmp/collie-r2 && npm ci)`。
6. 先看模型接口稳不稳：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，输出与用时抄进汇报。
   3 次都是退出码 0、整个命令都在 60 秒以内，才开跑；有一次不过或明显变慢，不开跑，写汇报（只写到这一步）、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b21`，确认状态是 pending，输出里有 `== scenarios ==` 一节（5 条）。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 4`。中途不干预、不重跑。
   v046-b21 开头会多几分钟：测试 agent 在系统临时目录的一个工作目录里干活，这段时间 heartbeat 的 `phase` 是 `tester`，主工作区应该一直是干净的。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本或独立克隆里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b21。**
  - 在副本里把 worker 对 `src/view.ts` 的改动撤掉，跑 `npm test -- test/acceptance/v046-b21`：`new.test.ts` 里的用例必须失败，`keep.test.ts` 里的必须通过。
  - 在副本里把实现改成「键还在，值是 `undefined`」（一次性改动），再跑：S1、S2 的用例还红不红。不红，说明测试 agent 写弱了，原样记下。
  - 没有测试 agent 的运行，`why <批次> --json` 与 `report --queue <队列> --json`：HEAD 与 `86b3cad`（v046-b19 之前）各跑一次，逐字节比较，应该相同。挑上一轮你比过的那 6 个批次、4 个队列。文字输出也再比一次。
- **v046-b22。**
  - 一次性用例（`Sandbox` + `FakeRunner`，放仓库外）：队列里假 worker 留下未提交的改动后被判空转、续跑又被判空转。把结束后的 `git log --format='%h %s'`、`git show --stat HEAD`、journal 里的 `batch.cleanup` 与最后几条事件原样抄；救援提交改过的文件与首次基准比，应该没有差别。
  - 逐个撤一次、看测试变不变红：撤销救援提交的那一步；删验收测试目录的那一步；「单批次模式不收尾」的判断；冲突时放弃撤销的那一处。
  - 读代码确认：没有 `reset`、`rebase`、强推、`git clean`；收尾在所有自动重跑的判断之后；worker 自己的提交不会被撤。
- **v046-b23。**
  - 把第十九次队列里那条真实的、以接口错误结束的结果消息（`"terminal_reason":"api_error"` 那条，从 `r-20261119092654` 的事件流里取）喂给运行器的汇总逻辑（一次性脚本）：`stopReason` 应该是 `api_error`。第十六次队列 `r-20261118091441` 那条也试一下。
  - 逐个撤一次：运行器里认 `api_error` 的那一处；队列里把它算作中断的那一处；续跑前等待的那一处。各自必须有用例变红。
  - 在副本的 `.collie/collie.toml` 里加 `api_retry_wait_secs = 60`，固定版本 `1745544` 与 HEAD 的 cli 各跑一次 `preflight`：预期旧的报不认识的字段、新的能读。
- **v046-b24。**
  - 把 `tester_touched_main_tree` 路径上恢复被跟踪文件的那一行撤掉：这一次 `tester only deletes a tracked file → …` 必须红。
  - 把测试 agent 的墙钟从 `worktree_secs` 改回 `wallclock_secs`：`tester wallclock uses worktree_secs` 必须红。
  - 把「reviewer 的 `task.md` 用这一次的信封」那一处撤掉：新的一组必须红。
- **这一轮被删、被改的断言，请逐条过一遍。** 四个批次各自的范围里，`test/` 下每一条被删或改的 `expect(`：是不是条目点名允许的、是不是「最小改动」、有没有被改松；不是点名的，把它原来守的那一处撤掉看变不变红。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例因为自带的超时到点而失败的，写明是哪个文件。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。b22、b23 改的是队列收尾与重跑的要紧处，请多看两眼。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数；v046-b21 另加测试 agent 的轮数、用时。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer、测试 agent 会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.18、14.31、11.4、13.14）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 21`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
