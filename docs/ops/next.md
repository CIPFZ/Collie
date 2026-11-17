# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：2b20647
固定版本：1cf7bb1
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十二次队列 `--continue --max 3`，固定版本前移到 `1cf7bb1`（应依次选中 v045-b18、v046-b02、v046-b03）

第十一次队列的汇报我核过了，四批的 PASS 都成立，裁定记在 SPEC 14.21。你第 7 段的几条：

- **第 1 条，固定版本前移到 `1cf7bb1`：** 同意，就是这一轮，不等第 3 处修好。我读了 `src/run.ts`：运行器之外没有任何一处按结束原因是不是 `error` 分支，那一处只让 journal 里少一个字段。
- **v045-b15 的 3 处返回值：** 三处我读代码都确认了。第 1、2 处认下来（失败带结束原因更一致；空回复在 `persistVerdict` 那里两种写法结果一样），第 3 处修，**v045-b18**（SPEC 14.22）。
- **v045-b15 的条目自相矛盾：** 是我写的。我签那一批之前没有去查现有测试里谁守着旧行为。这一轮的三个条目里都写了「R1 查过」哪几条现有用例、冲不冲突；你读代码时顺带看一眼我查得对不对。
- **第 2 条，reviewer 的轮数上限：** 已经改了。本仓库 `.collie/collie.toml` 里 reviewer 的 `max_turns` 现在是 100（模板里的缺省值仍是 60）。这是我第一次只改配置、不动测试，靠的是你上一轮那三组验证。
- 磁盘没有再少，已知。

另外两批是分工改造第 3 步（测试 agent）的前两块，**都不接进队列**（SPEC 16.10）：
- **v046-b02**：测试 agent 的角色模块（角色、配置里可选的 `[agent.tester]`、提示词）。它的手册我已经写了：仓库根的 `AGENT-tester.md`。
- **v046-b03**：红检查。验收测试在没有实现的代码上，新行为的必须全部失败、要保持的必须全部通过。

## 固定版本 `1cf7bb1` 里第一次生效的东西

- 一个会话给出多条结果消息时，journal 里的轮数与 token 是合计（v045-b15）。
- reviewer 的工作目录里，本批次的信封目录只剩 `task.md`（v045-b16）。
- 配置：`reviewer.started` 里的 `max_turns` 应该是 100。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach 1cf7bb1 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `1cf7bb1`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 1cf7bb1 && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v045-b18`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b03 红检查（最要紧，下一步整个流程靠它把关）。** 在副本里建 `test/acceptance/probe/`，写一个一次性的脚本调用 `runRedCheck`，试下面几种，结果原样抄：
  1. `new.test.ts` 里两条用例，断言的都是现在还不存在的行为（比如在用例里 `await import('../../../src/does-not-exist.js')`）→ 应该「过」。
  2. 同上，但把导入写在文件顶部（静态导入）→ 应该「不过」，原因是文件加载失败。
  3. `new.test.ts` 里混进一条现在就能通过的用例 → 应该「不过」，原因里点名那一条。
  4. `new.test.ts` 里有一条 `it.skip` → 应该「不过」。
  5. 把一个现有的、会通过的小测试文件拷成 `keep.test.ts` → 不影响结果；再往里加一条会失败的 → 应该「不过」。
  6. 跑完之后副本里有没有 `.vitest/`，系统临时目录里有没有留下 `collie-redcheck-*`。
  - **另请试一件事（它决定下一步的设计）：** 第 1 种的 `new.test.ts` 留在副本的 `test/acceptance/probe/` 里，跑 `npm run typecheck` 和 `npm run lint`，结果原样抄。
    我想知道：验收测试里动态导入一个还不存在的模块，类型检查和 lint 认不认。
- **v046-b02 角色模块。**
  - 在副本里把 `src/runner/claude.ts` 中让 `bash_deny` 对 tester 生效的那一处撤掉，跑 `npm test -- test/runner-claude.test.ts test/tester.test.ts`：必须有用例失败。
  - 在副本里给 `.collie/collie.toml` 加一段 `[agent.tester]`（照模板抄），分别用固定版本 `1cf7bb1` 的 cli 和 HEAD 的 cli 跑 `show v046-b03`：
    预期前者报「不认识的字段」、后者正常。我要靠这一条确认：这一段只能等固定版本前移之后才往本仓库的配置里加。
  - 读 `buildTesterPrompt` 拼出来的提示词（在副本里打印一份，原样贴进汇报），对照 `AGENT-tester.md` 看有没有互相矛盾的地方。手册是我写的，你觉得哪里说不清、测试 agent 会误解，直接写出来。
- **v045-b18。** 在副本里撤掉 `src/runner/claude.ts` 的改动，跑新的那一组测试：必须有用例失败。
- **新固定版本第一次生效的几项**（出现了原样抄，没触发写没触发）：
  - 每次运行的 `reviewer.started` 原样抄（看 `max_turns`）；reviewer 实际用了多少轮。
  - 每个 worker、reviewer 的事件流里各有几条结果消息；多于一条的，把每一条的 `num_turns`、`total_cost_usd`、`subtype` 和 journal 里记下的轮数原样抄。
  - 有 FIX 重跑的批次：第 2 次 reviewer 的工作目录里 `.collie/batches/<本批次>/` 下有什么（看它 `ls` 或 `Read` 的结果）；`queue.finished` 原样抄，写明 FIX 有没有占 `--max` 的名额。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 三个批次改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。v046-b02 点名允许改写的只有 `VALID_TOML` 一处，对一下有没有动到别的。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 12`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
