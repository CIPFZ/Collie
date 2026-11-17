# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：e3321fa
固定版本：d51e5ac
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十三次队列 `--continue --max 2`，固定版本前移到 `d51e5ac`（应依次选中 v046-b04、v046-b05）

第十二次队列的汇报我核过了，三批的 PASS 都成立，裁定记在 SPEC 14.23。你这一轮的实测直接改了三处设计，逐条说去向：

- **第 1 条，固定版本前移到 `d51e5ac`：** 同意，就是这一轮。本仓库的配置这一轮仍不加 `[agent.tester]`，要到第一个带情形的批次之前才需要。
- **第 2 条，验收测试的放法与写法**（都记在 SPEC 16.11）：
  - 导入的写法：定为「路径放进常量」。这样实现之前就能过 lint 与类型检查，红检查就可以多查这一步（**v046-b05**）。worker 改不了验收测试，带着 lint 错误进主工作区的话批次永远过不了。
  - 全量 `npm test` 会跑到 `test/acceptance/`：保持这样，不从全量测试里排除。实现之前是红的，这是本意；worker 之前没有哪一步要求全量测试通过。
    所以你每次开跑前的基线 `npm test` 必须是绿的：红了，说明有哪个批次的验收测试没被拿掉，停下报告。
  - 条目分成「情形」与「条目」两部分，类别由我标：**v046-b04**。测试 agent 只拿情形与接口，看不到写给 worker 的条目。
- **手册的 6 条意见：** 都改了，`AGENT-tester.md` 这一轮重写过。第 1、2、3、6 条靠 v046-b04 落到提示词里；第 4 条改成了常量路径的写法并给了例子；第 5 条把 JSON 块挪到了四段之外。
- **`show` 不加载配置：** 是我指令写错了，你换成 `audit` 与 `preflight` 是对的。
- **`keep` 拿不到报告时被放行：** 并进 v046-b05。
- 我自己这一轮查出来的一处：条目开头那段说明文字（「规格见 SPEC x.y」）不进 `task.md`，worker 一直看不到。你前两轮报的「worker 没读 14.18」就是这个原因。这一轮起我把要读的小节号写在条目里。

这两批仍然**不接进队列**。接线的批次等它们通过、下面那次试跑有了结果之后再签。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach d51e5ac && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `d51e5ac`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 d51e5ac && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b04`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **真跑一次测试 agent（最要紧，它决定接线的批次怎么签）。** 两批都通过之后，在副本里（HEAD）：
  - 配置用模板（里面有 `[agent.tester]`）。写一个一次性的脚本：用真实的运行器调 `runTester`，`cwd` 是副本，`out_dir` 是 `test/acceptance/probe-textutil`，情形与接口用下面这一组：
    - 接口：模块 `src/textutil.ts`，导出 `truncate(text: string, max: number): string`
    - `S1 [新]` 文本长度不超过 `max`：原样返回
    - `S2 [新]` 文本长度超过 `max`：返回前 `max - 1` 个字符加一个 `…`，结果的长度等于 `max`
    - `S3 [新]` `max` 小于 1：抛出 `RangeError`
    - `K1 [保持]` `src/gate.ts` 的 `gateDecision` 在六项条件都满足时返回 `pass` 为 true、`reasons` 为空
  - 它结束后，用 `runRedCheck` 查它交出来的东西，`staticCommands` 给 `npm run lint` 与 `npm run typecheck`。结果原样抄。
  - 请写进汇报：它的最终回复全文；三个文件全文；用了多少轮、多久；`git -C <副本> status --porcelain` 原样（它有没有动输出目录之外的东西）；
    事件流里有没有被拦下的命令；它有没有照手册用常量路径导入；用例名是不是以情形编号开头；`K1` 是怎么写的。
  - 红检查没过的话，把原因原样抄出来，**不要替它改**。我要看的就是手册和提示词够不够用。
  - 再做一个对照：在副本里按接口写一个最小的 `src/textutil.ts` 让三条 `[新]` 情形成立（这是一次性的，副本用完就删），跑 `npm test -- test/acceptance/probe-textutil`、`npm run lint`、`npm run typecheck`：三样都应该通过。
    哪一样不过，说明测试 agent 交出来的测试在「实现正确」时也过不了，原样抄出来。
- **v046-b04。**
  - 在副本的 `docs/backlog.md` 末尾加一个带情形与接口的批次（就用上面那一组），分别用固定版本 `d51e5ac` 的 cli 和 HEAD 的 cli 跑 `show <那个批次>`：
    预期旧版本照常显示、不报错（它把这两节当说明文字略过），新版本多打印情形与接口。两边的输出原样抄。
  - 现有批次的解析结果有没有变：写一个一次性的脚本，分别用基准提交和 HEAD 的 `loadBacklog` 把当前 `docs/backlog.md` 解析成 JSON，两份逐字节比较，应该完全相同。
  - 打印一份 `buildTesterPrompt`（用上面那一组），原样贴进汇报；再用一组只有 `[新]` 的打印一份，确认通篇没有 `keep.test.ts`。对照改过的 `AGENT-tester.md`，还有没有互相矛盾的地方。
- **v046-b05。** 用 `runRedCheck` 加 `staticCommands: ['npm run lint', 'npm run typecheck']`，结果原样抄，并记下各用了多久：
  - 上一轮那个「路径直接写在 `import()` 里」的 `new.test.ts` → 应该不过，原因是静态检查；
  - 「路径放进常量」的写法 → 应该过；
  - 常量写法但文件里有一处格式不对（比如多一个空格，Prettier 会报）→ 应该不过。
  - 在副本里撤掉 `src/redcheck.ts` 这一批的改动，跑 `npm test -- test/redcheck.test.ts`：必须有用例失败。
- **新固定版本第一次生效的几项**（出现了原样抄，没触发写没触发）：有 FIX 重跑的批次，第 2 次 reviewer 的工作目录里 `.collie/batches/<本批次>/` 下有什么；
  `queue.finished` 原样抄，写明 FIX 有没有占 `--max` 的名额；多于一条结果消息的会话，各条的 `num_turns`、`total_cost_usd` 与 journal 里记下的轮数。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 两个批次改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。v046-b04 点名允许改写的是 `test/tester.test.ts` 里的四处，对一下有没有动到别的。
- worker 这一轮有没有去读条目里点名的 SPEC 小节（16.11、16.10）：我把小节号从开头的说明挪进了条目，想知道管不管用。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 13`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
