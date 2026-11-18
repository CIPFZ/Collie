# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：7d8b9ab
固定版本：8e95868
批次上限：4

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十六次队列 `--continue --max 4`，固定版本前移到 `8e95868`（应依次选中 v046-b12、b13、b14、b15）

第十五次队列的汇报我核过了，三批的 PASS 都成立，主分支的 CI 从 `a29b87c` 起回到了成功，裁定记在 SPEC 14.26。你第 7 段的几条：

- **第 1 条，固定版本前移到 `8e95868`：** 就是这一轮。本仓库的配置这一轮仍不加新配置项：v046-b15 还要再加一个 `redcheck_secs`，等接线进了固定版本一起加。
- **第 2 条，v046-b08：** 它的代码随 b09 取到了证据，算数；状态保持 `blocked`。
- **第 3 条，两处小改：** 都并进 **v046-b12**，连同 `misclassified` 三处写法不一致的那一条。b09 删掉的两条残留检查，条目只许改它看的目录、不许删；reviewer 列出来了却判为合理，你把清理撤掉才看出守不住。
  我在签发自查里加了一条，这一轮起这类地方都请你撤一次。
- 被限流时也记 `ci.verdict_commit_error`、提交清单为空时那句话没头没尾：都不影响结论，不改。

**偶发失败，我这边拿到 journal 了。** 带着留 journal 的开关跑了 5 次全量测试，后 3 次都有失败，分两类：
- 撞索引锁，3 次各 1 个沙箱（`test/why.test.ts`、`test/queue-limit.test.ts`、`test/reviewer-rerun.test.ts`）：都是同一个沙箱里的第 2 次运行，假 worker 提交时报
  `fatal: Unable to create '…/.git/index.lock': File exists`，运行因此以上报结束。
- 时限，共 4 条：真实起 vitest 子进程的用例给的时限是 30 或 60 秒，我这台机器上一个子进程要 20 到 120 秒。这是机器慢，时限放宽并进了 v046-b12。
- 谁占着索引锁，是我读代码的推断：worker 工作期间 R2 自己每 500 毫秒算一次活性指纹（`git diff HEAD` 加 `git status`）；
  我记得 `GIT_OPTIONAL_LOCKS=0` 管得住 `git status`，管不住 `git diff` 顺手刷新索引。**这条推断请你核对（见下面第一项）。** 修它的是 **v046-b13**，条目要求 worker 先写一条在现有代码上会失败的测试，失败不了就停下。

另外我读代码查出一处，同样是推断：R2 凭提交说明的开头认自己的提交，取证数受保护路径的改动时会跳过以 `docs: issue `、`progress: `、`report(collie): `、`ops: ` 开头的提交。
worker 的提交要是用了这种开头，它对 SPEC、验收测试的改动就不会被规则 2 拦。**也请你核对（下面第二项）。** 修它的是 **v046-b14**，同样先写会失败的测试。

**v046-b15 是接线第一块**（SPEC 16.14）：带情形的批次在写 task 信封之前先拉起测试 agent。现有的批次都不带情形，所以这一轮的队列本身不会走到这一步。
接线第二块（worker 的任务书、没通过时拿掉验收测试、花费的显示）下一轮签，在那之前我不签带情形的批次。

## 请先帮我核对两条推断（开跑前做，十分钟以内；结果写进队列汇报第一段）

都在 `/data/tmp` 的仓库副本里做（HEAD），做完删掉。

1. **`git diff HEAD` 会不会改写索引。** 在副本里：`touch` 一个已跟踪的文件（内容不变）；记下 `.git/index` 的 inode 与修改时间；
   执行 `GIT_OPTIONAL_LOCKS=0 git diff HEAD >/dev/null`；再看 `.git/index` 的 inode 与修改时间变没变。同样的做法对 `GIT_OPTIONAL_LOCKS=0 git status --porcelain` 再做一遍。
   两条命令各自的结果原样抄。再请从本机历史运行的 worker 事件流里搜 `index.lock`，命中几次、分别在哪几次运行里，列出来：我想知道真实的 worker 撞没撞上过。
2. **worker 用 R2 的提交说明开头能不能绕过规则 2。** 写一个一次性的脚本（放仓库外），用 `Sandbox` 与 `FakeRunner` 跑一次真实的 `run`：假 worker 的一个提交改了 `SPEC.md`，提交说明是 `progress: sneaky`；别的都正常。
   这次运行的 `evidence.collected`（或 `run.finished`）里的 `spec_diff_lines` 与结论原样抄。再把提交说明换成 `feat: sneaky` 跑一次做对照（应该是规则 2、BLOCK）。

两条不管结果如何都照常开跑：v046-b13、b14 的条目里写了「测试在现有代码上不失败就停下」。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`、没有 `test/acceptance/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach 8e95868 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `8e95868`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 8e95868 && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b12`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 4`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b15（最要紧）：把接线后的这一步真跑一遍。** 用 HEAD 做一份独立的本地克隆（带一个本地的裸仓库当远端），在克隆里：
  - `docs/backlog.md` 加一个带情形与接口的小批次（就用前几轮那组 textutil：3 条 `[新]`、1 条 `[保持]`，条目一条、验收用 `npm test -- test/acceptance/<批次>`）；
    `.collie/collie.toml` 照模板加 `[agent.tester]`、`tester_max`、`static`、`redcheck_secs`；提交。
  - 用 HEAD 的 cli、真实的运行器跑 `run <批次>`（CI 查不到是预期的，最后被规则 9 降级不要紧）。我要看的是前半段：
    journal 里 `tester.started`、`tester.finished`、`redcheck.result`、`batch.task_written` 的先后与字段原样抄；`docs: issue` 那个提交里有哪些文件（`git show --stat`）；
    `tester.stream.ndjson` 在不在、多大；heartbeat 在这一步期间的 `phase`（跑的时候 `cat` 一次）；测试 agent 结束后主工作区 `git status --porcelain` 是什么；
    worker 拿到的 `task.md` 全文（这一轮它还没有情形与接口两节，worker 只能靠条目和树里的验收测试，它做成了没有、怎么做的，原样写）；
    worker 有没有动 `test/acceptance/` 下的文件；最后的结论与规则。
  - 再跑一组类别标错的（一条标成 `[新]` 的已有行为）：预期不拉起 worker，退出码 20，原因以 `misclassified` 开头，`.collie/batches/<批次>/tester.md` 在裁定提交里。`tester.md` 全文抄出来。
  - 把克隆里 `.collie/collie.toml` 的 `[agent.tester]` 去掉再跑带情形的批次：预期退出码 1，报错点名 `[agent.tester]`，没有新提交。
- **v046-b13。** 开跑前那个 `touch` 实验在 HEAD 上再做一遍，对象换成调 `computeFingerprint`（一次性脚本）：`.git/index` 应该不变。
  在副本里撤掉 `src/ladder.ts` 的改动，跑 `npm test -- test/fingerprint-lock.test.ts`：必须有用例失败。worker 选的是哪种写法、只有时间戳变时指纹变不变，照它的汇报抄。
  带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试：还有没有 `index.lock`（在留下的 journal 里搜）。
- **v046-b14。** 开跑前第 2 项的脚本在 HEAD 上再跑一遍：`progress: sneaky` 那一次现在应该是规则 2、BLOCK。
  在副本里把取证改回「按提交说明的开头跳过」，跑 `npm test -- test/r2-commits.test.ts`：必须有用例失败。
  这一轮队列自己的 journal 还是旧固定版本记的，没有 `r2.commit`，属于预期。
- **v046-b12。** 逐个撤一次、看测试变不变红：
  - `src/redcheck.ts` 里删报告目录的那一处（上一轮撤了照样全过，这一轮必须有用例失败）；
  - `src/acceptance.ts` 里把 `{ id, why }` 转成文字的那一处；
  - `prepareAcceptance` 里 `signal` 中止后不再重拉的那一处。
  - 另：`e=$(mktemp) && printf '[commit]\n\tgpgsign = true\n' > "$e" && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` 应该全过。
- **这一轮被删、被改的断言，请逐条过一遍。** `git diff <基准>..HEAD -- test/` 里每一条被删掉或改掉的 `expect(`：是不是条目点名允许的；不是的，把它原来守的那一处撤掉，看还有没有别的测试变红。
- **新固定版本第一次生效的几项**（出现了原样抄，没触发写没触发）：有被规则 9 降级后重跑的，那份 task 的「降级原因」一节原样抄（应带 `head_sha` 与 CI 链接）；journal 里有没有 `ci.verdict_commit_error`。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 四个批次改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。v046-b14、b15 改的是 `src/run.ts` 的要紧处，请多看两眼：
  R2 的每一次提交是不是都记了 `r2.commit`；不带情形的批次有没有哪里和以前不一样。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- b13、b14 的 worker 是不是先写了测试、看到它失败、再改的代码（事件流里的先后）。
- worker 有没有去读条目里点名的 SPEC 小节（16.14、14.26、16.12）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 16`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
