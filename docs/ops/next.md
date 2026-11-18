# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：e851b43
固定版本：8e95868
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮分两步：A 单批次重跑 v046-b12 一次；B 第十七次队列 `--continue --max 2`（应依次选中 v046-b13、b14）

第十六次队列的汇报我核过了。你开跑前替我核对的两条推断都成立，实验做得很干净（尤其是 `git status` 不带 `GIT_OPTIONAL_LOCKS` 的那组对照，和从历史事件流里数 `index.lock` 的那张表）。
我这边：lint、类型检查通过；v046-b12 的专项验收在 HEAD 上逐条通过；受保护路径只有 backlog 的 1 个状态格，没有测试或断言被删。
全量测试带着留 journal 的开关跑了 2 次，各有 1 条失败，都在 `test/verdict-ci-recheck.test.ts`（最早偶发失败的那个文件），留下的 journal 里都是 `index.lock`。
前几轮那类时限的失败这两次没有再出现（b12 把时限放宽了）。

你第 7 段的几条：

- **第 1 条，v046-b12 怎么处理：重跑，照 v04-b11 的先例。** 单批次模式跑一次，让 attempt 2 补上汇报，由 R2 自己取证、reviewer 照常审。不走「不经 R2 取证直接采纳」。
  按启动手册「R1 的约束」，**这一轮我只推了这一个 `ops:` 提交，没有动任何受保护路径**。第十六次队列的裁定、新批次、b12 的状态格，都等它有了结果再推。
- **第 2 条，接口错误算不算可续跑的中断：** 这是改队列自动重跑的条件，要所有者定。我会提给所有者，下一轮记进 `docs/decisions/OPEN.md`（这一轮不能推）。
- **第 3 条，中途中止：** 在 `prepareAcceptance` 里接住，按 `tester_failed` 返回并记 `tester.finished`，不让调用方接抛错。下一轮签一个小批次，排在 v046-b15 之前；连同你说的那个没用的变量、`onTesterEvent` 第 2 次拉起没测。
  v046-b15 这一轮不会被选中：它依赖 v046-b12，而 b12 在 backlog 里仍是 `blocked`（单批次模式不改状态格）。
- 磁盘已知。

## A：单批次重跑 v046-b12（只跑一次）

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`、没有 `test/acceptance/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 按启动手册「R1 的约束」核一次：`git log --oneline d0df1a1..HEAD -- SPEC.md CONSTRAINTS.md 'AGENT-*.md' .collie/collie.toml docs/backlog.md`。
   应该只有 R2 自己的 `388ff06 progress: v046-b12 BLOCK`；出现 `r1:` 提交就停下报告，不跑。
5. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
6. 固定版本：`git -C /tmp/collie-r2 rev-parse --short HEAD` 应是 `8e95868`（不在就 `git worktree add /tmp/collie-r2 8e95868 && (cd /tmp/collie-r2 && npm ci)`）。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run v046-b12`。**只跑一次**，不管结果。
9. `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`。

已知会出现的情况，照常记一笔：
- 上一次是上报 BLOCK，这一次的 task 会带上一轮的结论（「上报：无 report …」）。worker 应该发现代码和测试都在、只差汇报。它能不能自己看明白，是这一步的看点。
- 我预期它不需要新的代码提交。它要是提交了（比如顺手去掉那个没用的变量），照常，把提交抄下来。
- reviewer 拿到的范围是 `d0df1a1..<head_sha>`。里面除了 worker 的两个提交，还有 R2 的 `progress:` 提交、你的 `ops: report` 和我的这个 `ops: next`。
  reviewer 要是把这些当成 worker 的范围蔓延，把它的原话抄出来：那是这种重跑方式的一个已知毛病，不是 worker 的问题。
- 单批次模式不改 backlog 状态列：就算 PASS，v046-b12 仍是 `blocked`，由我来改。你不要动它。

**A 之后要不要接着做 B：**
- 这次运行又是因为接口错误结束的（worker 或 reviewer 的结果消息里 `terminal_reason` 是 `api_error`）：**停下**，不做 B，写汇报、推送。接口不稳的时候再跑两批只会重演上一轮。
- 其余情况，不管 A 的结论是 PASS、FIX 还是 BLOCK，都接着做 B。v046-b12 不会再跑第三次：没过的话我另签批次。

## B：第十七次队列 `run --continue --max 2`

10. `git status --porcelain` 为空、`heartbeat.json` 不存在；在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b13`，确认状态是 pending。
11. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
    队列开头自己会再做一次不带 `--smoke` 的检查。应依次选中 v046-b13、v046-b14，两批都通过后以 `limit` 结束。
12. 结束后每个 run_id 手工跑一次 `audit`，和 journal 里的 `audit.result` 对一下。
13. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **A，v046-b12 的第 2 次运行（这一轮最要紧）。**
  - task：frontmatter 的 `attempt`、`interrupted_at` 原样抄；讲上一轮的那一节原样抄。worker 是续上了原来的会话，还是新开的。
  - worker 做了什么：读了哪些文件、跑了哪些命令、有没有新的代码提交；汇报的「偏离或疑问」原样抄；新 report 的 `head_sha` 原样抄。会话里接口重试了几次。
  - R2 取证：验收逐条、`ci.resolved`、受保护文件行数、仲裁走到哪条规则、退出码。
  - reviewer：结论、`gaps`、核对表里「被改写或删去的断言」一行原样抄。它有没有指出你上一轮读代码看到的那几处（中途中止抛 `AbortError`、没用的变量、`onTesterEvent` 只测了第 1 次）。
  - 这是 reviewer 第二次在真实的重跑里工作：它的工作目录里 `.collie/batches/v046-b12/` 下有什么（看它 `ls` 或 `Read` 的结果）；事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **B，v046-b13。** 你上一轮那个 `touch` 实验在 HEAD 上再做一遍（直接调 `computeFingerprint`）：`.git/index` 的 inode 与修改时间应该不变。
  在副本里撤掉 `src/ladder.ts` 的改动，跑 `npm test -- test/fingerprint-lock.test.ts`：必须有用例失败。worker 选的是哪种写法、只有时间戳变时指纹变不变，照它的汇报抄。
  worker 是不是先写了测试、看到它失败、再改的代码（事件流里的先后）。
- **B，v046-b14。** 你上一轮那个 `progress: sneaky` 的探测在 HEAD 上再跑一遍：现在应该是规则 2、BLOCK。
  在副本里把取证改回「按提交说明的开头跳过」，跑 `npm test -- test/r2-commits.test.ts`：必须有用例失败。
  worker 是不是先写了会失败的测试。这一轮队列自己的 journal 还是固定版本记的，没有 `r2.commit`，属于预期。
  这一批改的是 `src/run.ts` 的要紧处，请多看两眼：R2 的每一次提交是不是都记了 `r2.commit`；救援提交有没有被误记；FIX 重跑、规则 1 重跑、中断重跑三条路径在新代码里还通不通。
- **这一轮被删、被改的断言，请逐条过一遍。** 三个批次各自的范围里，`test/` 下每一条被删掉或改掉的 `expect(`：是不是条目点名允许的；不是的，把它原来守的那一处撤掉，看还有没有别的测试变红。
- **偶发失败。** B 做完之后（HEAD 含 v046-b13），带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，在留下的 journal 里搜 `index.lock`。
  你的机器上一直是 0 次，所以这一项主要由我在自己的机器上跑；你这边照常报个数就行。
- **固定版本 `8e95868` 第一次生效的几项**（出现了原样抄，没触发写没触发）：有被规则 9 降级后重跑的，那份 task 的「降级原因」一节原样抄；journal 里有没有 `ci.verdict_commit_error`。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本轮所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格（A 不动）、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer 会话里接口重试的次数；有以 `api_error` 结束的，把结果消息里那几个字段原样抄。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.14、14.26）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- B 结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`（A 是 `v046-b12-r2.md`），外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 17`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
