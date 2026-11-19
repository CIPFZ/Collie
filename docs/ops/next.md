# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：3fff74d
固定版本：90cd5e2
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十八次队列 `--continue --max 2`，固定版本前移到 `90cd5e2`（应依次选中 v046-b16、v046-b15）

第十七轮的汇报我核过了，三批的 PASS 都成立，裁定记在 SPEC 14.27。你第 7 段的几条：

- **第 1 条，`test/exit-codes.test.ts` 那处改写：算数。** 只加不删，你把 `r2.commit` 的记录撤掉它会红。reviewer 把「请 R1 指示」记成了「授权」，这一点你抓得对，我记进裁定了。
  起因在我：条目要求每次提交都记事件，我签发前却没有查钉死事件序列的用例。
- **第 2 条，「停下」与推送的顺序：** 我改的是条目的写法，不动手册（SPEC 16.15）。条目里不再写「一律停下」，改成「只许做新行为直接要求的最小改动并逐条列出，拿不准才停下」。
  把关的仍是 reviewer 核对表那一行，和你每轮「撤一次看变不变红」。所以下面那一项请照旧逐条做。
- **第 3 条，`r2-commits` 两条空过的测试：** 并进 **v046-b16**，连同 `prepareAcceptance` 中途中止抛错、那个没用的变量、`onTesterEvent` 只测了第 1 次。
- **第 4 条，重跑时 reviewer 读的是旧信封：** 修，并进接线第二块（下一轮签）。
- **第 5 条，v046-b12 的状态格：** 我改成 `passed` 了。
- **第 6 条，固定版本前移到 `90cd5e2`：** 就是这一轮。`ops:` 提交不再被跳过这件事我看过了：它们只改 `docs/ops/`，而我在同一批次两次运行之间本来就不推受保护路径。不改。
- 上一轮你问的「接口错误算不算可续跑的中断」：记成了 `docs/decisions/OPEN.md` 的 D11，等所有者定。
- 队列跑着的时候往主仓库写了草稿那一次：你自己发现、自己说了，也改了做法，够了。

偶发失败：我在 HEAD 上带着留 journal 的开关跑了 3 次全量测试，3 次都是 1368 个全过，831 个沙箱的 journal 里 `index.lock` 0 次（修之前 7 次里有 5 次）。之后每轮我照常跑着看。

**v046-b15 是接线第一块**（SPEC 16.14）：带情形的批次在写 task 信封之前先拉起测试 agent。现有的批次都不带情形，所以队列本身不会走到这一步；要看它，靠你在克隆里真跑（见下）。
接线第二块下一轮签，在那之前我不签带情形的批次，本仓库的配置也不加 `[agent.tester]`。

## 固定版本 `90cd5e2` 里第一次生效的东西

- R2 的每一次提交在 journal 里多一条 `r2.commit`；受保护路径的改动行数只跳过 journal 里记下的提交号，提交说明以什么开头不再起作用。
- worker 工作期间 R2 算活性指纹不再改写 `.git/index`。
- 这两处要是让哪一批被规则 2 误拦了（`spec_diff_lines` 不是 0，而 worker 并没有动受保护路径）：把那次的 `evidence.collected`、范围里的 `git log --format='%h %s'`、journal 里全部 `r2.commit` 原样抄出来，这是这一轮最要紧的信息。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`、没有 `test/acceptance/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach 90cd5e2 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `90cd5e2`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 90cd5e2 && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b16`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束的（结果消息里 `terminal_reason` 是 `api_error`），把那几个字段原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b15（最要紧）：把接线后的这一步真跑一遍。** 用 HEAD 做一份独立的本地克隆（带一个本地的裸仓库当远端），在克隆里：
  - `docs/backlog.md` 加一个带情形与接口的小批次（就用前几轮那组 textutil：3 条 `[新]`、1 条 `[保持]`，条目一条、验收用 `npm test -- test/acceptance/<批次>`）；
    `.collie/collie.toml` 照模板加 `[agent.tester]`、`tester_max`、`static`、`redcheck_secs`；提交。
  - 用 HEAD 的 cli、真实的运行器跑 `run <批次>`（CI 查不到是预期的，最后被规则 9 降级不要紧）。我要看的是前半段：
    journal 里 `tester.started`、`tester.finished`、`redcheck.result`、`r2.commit`、`batch.task_written` 的先后与字段原样抄；`docs: issue` 那个提交里有哪些文件（`git show --stat`）；
    `tester.stream.ndjson` 在不在、多大；heartbeat 在这一步期间的 `phase`（跑的时候 `cat` 一次）；测试 agent 结束后主工作区 `git status --porcelain` 是什么；
    worker 拿到的 `task.md` 全文（这一轮它还没有情形与接口两节，worker 只能靠条目和树里的验收测试；它做成了没有、怎么做的，原样写）；
    worker 有没有动 `test/acceptance/` 下的文件；取证里的 `spec_diff_lines`（验收测试是 R2 随信封提交的，不该算到 worker 头上，应该是 0）；最后的结论与规则。
  - 再跑一组类别标错的（一条标成 `[新]` 的已有行为）：预期不拉起 worker，退出码 20，原因以 `misclassified` 开头，`.collie/batches/<批次>/tester.md` 在裁定提交里。`tester.md` 全文抄出来。
  - 把克隆里 `.collie/collie.toml` 的 `[agent.tester]` 去掉再跑带情形的批次：预期退出码 1，报错点名 `[agent.tester]`，没有新提交。
  - 不带情形的批次有没有哪里和以前不一样：在克隆里用假运行器或直接读 `src/run.ts` 的改动都行，写明你是怎么看的。
- **v046-b16。**
  - 你上一轮那个一次性用例（第 1 次拉起时假测试 agent 自己 `abort()`，`testerMax: 2`）在 HEAD 上再跑一遍：现在应该不抛错，返回 `tester_failed`，有 `tester.finished`。原样抄。
  - 在副本里把「运行器抛错时接住」那一处撤掉，跑 `npm test -- test/prepare-acceptance.test.ts`：必须有用例失败。
  - `test/r2-commits.test.ts` 改实的两条：在副本里把 `collectR2Shas` 改成不收 `r2.commit`（你上一轮做过），这一次 `interrupt auto-retry…` 那一条必须红；
    再让 `r2Commit` 少记一次（比如信封那一次不记），`R2 commit count…` 那一条必须红。
- **这一轮被删、被改的断言，请逐条过一遍。** 两个批次各自的范围里，`test/` 下每一条被删掉或改掉的 `expect(`：是不是条目点名允许的；
  不是点名的，看它是不是「新行为直接要求的最小改动」、有没有被改松，并把它原来守的那一处撤掉，看测试变不变红。reviewer 核对表那一行怎么写的，原样抄。
- **新固定版本第一次生效的几项**（出现了原样抄，没触发写没触发）：每次运行的 journal 里 `r2.commit` 有几条、分别是什么；每次的 `spec_diff_lines`；
  有 FIX 重跑的，重跑那一次的 `spec_diff_lines`（范围里有 R2 自己的裁定提交，应该仍是 0）；有被规则 9 降级后重跑的，那份 task 的「降级原因」一节原样抄。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，在留下的 journal 里搜 `index.lock`，报个数。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。v046-b15 改的是 `src/run.ts` 的要紧处，请多看两眼：
  测试 agent 往主工作区写了东西时 R2 是不是真的什么都不提交；上报的三种原因各自走到哪；不带情形的批次是不是一行新代码都走不到。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer 会话里接口重试的次数。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.15、16.14、16.12）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 18`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
