# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：7129ac7
固定版本：839843e
批次上限：4

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十一次队列 `--continue --max 4`，固定版本前移到 `839843e`（应依次选中 v045-b15、b16、b17、v046-b01）

第十次队列的汇报我核过了，三批的 PASS 都成立，裁定记在 SPEC 14.19。这是我不再动手做实验之后的第一轮，你替我做的四项核对结论都很清楚，照这个做法继续。你第 6 段的几条：

- **第 1 条，固定版本前移到 `839843e`：** 同意，就是这一轮。
- **第 2 条，一个会话多条结果消息：** 修，**v045-b15**（SPEC 14.20 第一部分）。口径我定的是：轮数与 token 取各条之和；花费取最后一条（依据只有 b13 这一次，是累计值）；
  每一条都成功才算成功；`finalText` 把各条的文本按先后连起来，这样 reviewer 的裁定不管落在前一条还是后一条，R2 都取得到最后一个 JSON 块。
- **第 3 条，上一轮的 `verdict.md`：** 修，**v045-b16**（SPEC 14.20 第二部分）：本批次的信封目录里只留 `task.md`。
- 你在 b14 里看到的两处：第 3 条测试只覆盖没有会话号的情形，并进 v045-b15 补一条；出错分支不看是否被软停，没有真实事例，不改。
- b12 的 reviewer 自己填的 `remote_has_head` 和 R2 不一致：我读了代码，调仲裁之前裁定里的证据整份换成了 R2 自己取的，reviewer 填的不参与裁定。不改。
- 磁盘已转给所有者。

另外两批：
- **v045-b17**：我这台机器上两次全量测试各有超时（3 条、1 个文件），全是测试里写的 60 秒局部超时，没有断言失败；你那边 20 秒跑完，不受影响。这一批把低于全局 120 秒的局部超时去掉。
- **v046-b01**：分工改造的第 1 步（SPEC 16.9）。测试不再读本仓库的 `.collie/collie.toml`，改读模板；变异检查的副本也不再复制 `.collie/`（你上一轮第 9 条说的 69M）。
  做完之后我才能把 reviewer 的轮数上限从 60 改到 100。

**reviewer 的手册这一轮又改了一处，这次队列就生效：** 输出格式里删掉了 `claim_mismatches`（新固定版本把它当可选字段）。

## 固定版本 `839843e` 里第一次生效的东西

- reviewer 的工作目录里没有本批次的 `report.md`（v045-b12）；规则 4 不存在（v045-b13）；SDK 在结果消息之后抛错时，花费与轮数照常进 journal（v045-b14）。
- 没有 `claim_mismatches` 字段的裁定，R2 应该照常解析。**如果哪一次因为缺这个字段被规则 1 判了 BLOCK，那是我删早了**：照常写汇报，把那次的 `reviewer.verdict` 事件原样抄出来。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach 839843e && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `839843e`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 839843e && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v045-b15`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 4`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b01（最要紧，它决定我能不能改配置）。**
  - 在副本里把 `.collie/collie.toml` 的 reviewer `max_turns` 改成 61、`wallclock_secs` 改成 3601，跑 `npm test`：必须全过。有失败的，把用例名和断言原样抄出来。
  - 把副本还原，再把 `templates/collie.toml` 的 reviewer `max_turns` 改成 61，跑 `npm test`：必须有用例失败。一条都不失败，说明数值断言没有搬到模板上，而是被删掉了。
  - 主仓库 HEAD 上 `npm run test:mutation`：末行应是 `mutation: caught 42 …`，用时抄上；跑的过程中看一眼副本目录有多大（`du -sh "${TMPDIR:-/tmp}"/collie-mut-*`）。
  - 对照条目 3 点名的用例，逐条看数值有没有被删掉或放宽。
- **v045-b15。** 在副本里撤掉 `src/runner/claude.ts` 的改动，跑新的那一组测试：必须有用例失败。
  读一遍实现：出错分支是不是用了同一套汇总；只有一条结果消息时返回值有没有变。
  **另外请数一下真实数据**：这一轮每个 worker、reviewer 的事件流里各有几条结果消息（`grep -c '"type":"result"'`）。多于一条的，把每一条的 `num_turns`、`total_cost_usd`、`subtype` 原样抄出来：
  我要靠它确认「花费是累计值」这条假设（现在只有 b13 一个例子）。这一轮的 journal 还是旧运行器记的，记成最后一条是预期的。
- **v045-b16。** 在副本里把 `src/run.ts` 改回只删 `report.md`，跑 `npm test -- test/reviewer-rerun.test.ts`：必须有用例失败。
- **v045-b17。** `git diff <base>..<head_sha> --stat -- test/`；有没有动到不是超时的数字（条目里点名了三处不许动的）。
- **新固定版本第一次生效的几项**（出现了原样抄，没触发写没触发）：
  - 有 FIX 重跑的批次：第 2 次 reviewer 的事件流里有没有读到 `report.md`；它的工作目录里那个文件在不在（看它 `ls` 或 `Read` 的结果）。
  - 每份 `verdict.md` 里还有没有 `claim_mismatches` 字段；`reviewer.verdict` 事件是否正常。
  - 有 FIX 的话，`queue.finished` 原样抄，写明 FIX 有没有占 `--max` 的名额。
  - reviewer 用到轮数上限的话，`reviewer.finished` 原样抄（应该带花费与轮数了）。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 四个批次改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。v046-b01 点名允许改写的用例比较多，逐条对一下有没有动到点名之外的。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 11`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
