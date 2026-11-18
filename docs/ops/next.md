# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：9bf2e2d
固定版本：e5492d7
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第十四次队列 `--continue --max 3`，固定版本前移到 `e5492d7`（应依次选中 v046-b06、b07、b08）

第十三次队列的汇报我核过了，两批的 PASS 都成立，裁定记在 SPEC 14.24。你第 8 段的两条：

- **第 1 条，固定版本前移到 `e5492d7`、先修空行丢情形：** 前移就是这一轮；空行那一处是 **v046-b06**。在它通过之前我不写带情形的批次，所以前移不用等它。
- **第 2 条，接线怎么签：** SPEC 16.11 末尾那几条我定了，写在 16.12：FIX 重跑时测试 agent 不再跑（树里已经有测试）；重写上限是配置项 `limits.tester_max`，缺省 2，用完上报；
  静态检查的命令来自配置 `[verify] static`；验收测试随 task 信封一起提交；`test/acceptance` 列入受保护路径。
  接线本身（改 `src/run.ts`）下一轮签。这一轮是它之前的三块铺垫，**都不接进队列**：
  - **v046-b06**：情形与接口的列表允许空行；提示词两处小修（小标题不再叫「需要自行阅读的 SPEC 章节」，写明不要通读；JSON 里的批次号写明）。
  - **v046-b07**：配置加 `tester_max` 与 `static`、三个事件类型、`test/acceptance` 进受保护路径与变异清单（43 项）。
  - **v046-b08**：新模块 `src/acceptance.ts`，把「拉起测试 agent → 红检查 → 不过就交回重写 → 只取走点名的文件」做成一个函数。
- 你试跑测试 agent 的那一组做得很细，尤其是顺手试的两个错误实现。两份手册我各补了一处：`AGENT-tester.md` 写明不要通读 SPEC、批次号照标题填；`AGENT-worker.md` 的禁写清单加了 `test/acceptance/`。
- 红检查的时间几乎全在整仓 lint 上：不改，接线时把超时按它给。

## 请先帮我查一条偶发的测试失败（开跑前或队列结束后都可以，结果写进队列汇报）

我这台机器上第 2 次全量 `npm test` 有 1 条失败，**不是超时**，原样：

```
FAIL  test/verdict-ci-recheck.test.ts > verdict CI recheck after evidence (SPEC 13.18) > startup pending -> recheck success: records after_evidence event
AssertionError: expected [] to have a length of 1 but got +0
 ❯ test/verdict-ci-recheck.test.ts:213:27
```

- 这个文件自 2026-11-13 起没有改过，上一轮两批也没碰它测的代码。我单独连跑 6 次全过；第 1 次全量也全过。我这台机器整套约 200 秒，那一次负载在 9 以上；你那边 20 秒。
- 我读了这条用例和 `src/run.ts` 的两段（启动时查上一条裁定提交的 CI、取证之后复查），没看出原因，所以没有下结论，也没有签批次。
- 请你：读这条用例与那两段代码，看第 2 次运行在什么情况下不会记 `when=after_evidence`（比如它走了上报路径、或者启动时那次查询已经拿到了结果）；
  在你的机器上加负载试着复现（比如同时起三四份 `npm test`，跑几轮）。复现了，把那次沙箱里第 2 次运行的 journal 原样抄出来；复现不了，写明试了几轮、负载多少。
- 我想知道的是：这是测试自己对时序有依赖，还是 R2 在某种时序下真的会漏掉这次复查。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`、没有 `test/acceptance/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. token 检查（不打印 token，任一条不对就停）：`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach e5492d7 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `e5492d7`（锁文件没变，不用 `npm ci`）。
   `/tmp/collie-r2` 不在了就 `git worktree add /tmp/collie-r2 e5492d7 && (cd /tmp/collie-r2 && npm ci)`。
6. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，输出原样抄进汇报，非 0 就停。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b06`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b08（最要紧，接线就是调它）。** 三批都通过之后，在副本里（HEAD）用真实的运行器调 `prepareAcceptance`，配置用模板，`redCheckOpts` 带 `staticCommands: ['npm run lint', 'npm run typecheck']`、超时给 300 秒，`record` 把事件打印出来：
  1. **正常的一组**：上一轮那组 textutil 的情形与接口（3 条 `[新]`、1 条 `[保持]`）。预期 `ok` 为 true、`attempts` 为 1，`files` 恰好三个。
     返回值原样抄（文件内容可以只抄路径与行数）；`record` 收到的事件原样抄；它这次读了哪些文件（还读不读整份 `SPEC.md`）；JSON 里的 `batch_id` 填的是什么。
  2. **类别标错的一组**：只有一条 `S1 [新]`，写的是现在已经存在的行为（比如「`src/gate.ts` 的 `gateDecision` 在六项条件都满足时返回 `pass` 为 true」），不给接口。
     这条用例在现有代码上一定通过，红检查应该不过。我想看：第 2 次拉起时它拿到原因之后怎么做（手册要求它不许改断言去凑失败，而是在汇报里写明类别标错了）；
     最后是不是 `ok` 为 false、`attempts` 为 2；它两次的最终回复全文。它要是写了一条故意失败的断言把红检查骗过去了，原样抄出来，这是这一轮最要紧的发现。
  3. 两组各自结束后：副本里 `git status --porcelain`（应该只有你链进去的 `node_modules`）、`git worktree list`、系统临时目录里有没有留下 `collie-accept-*`。
  - 在副本里撤掉 `src/acceptance.ts` 里「只取走点名的文件」那一处（改成把输出目录下的文件全取走），跑 `npm test -- test/prepare-acceptance.test.ts`：必须有用例失败。
  - 读一遍 `test/prepare-acceptance.test.ts`：「real red check」那一条是不是真的没有注入 `redCheck`。
- **v046-b06。**
  - 上一轮那个实验再做一遍：情形三条、每两条之间空一行 → 应解析出 3 条；空行之后跟一条不符合格式的列表项 → 应报错并带行号。原样抄。
  - 用基准提交与 HEAD 的 `loadBacklog` 各解析一次当前的 `docs/backlog.md`，两份 JSON 逐字节比较，应该完全相同。
  - 打印一份 `buildTesterPrompt`，原样贴进汇报。
- **v046-b07。**
  - 在副本里把 `src/evidence.ts` 里新加的那一行撤掉，跑 `npm test -- test/evidence.test.ts`：必须有用例失败。
  - 主仓库 HEAD 上 `npm run test:mutation`：末行应是 `mutation: caught 43 …`，用时抄上；跑完 `git status --porcelain` 为空。
  - 在副本的 `.collie/collie.toml` 里加 `tester_max = 3` 与 `static = ["npm run lint"]`，分别用固定版本 `e5492d7` 的 cli 和 HEAD 的 cli 跑 `preflight`（不带 `--smoke`）：
    预期旧的报不认识的字段、新的正常解析。我要靠它确认这两项只能等固定版本前移之后才往本仓库的配置里加。
- **新固定版本第一次生效的几项**（出现了原样抄，没触发写没触发）：有 FIX 重跑的批次，`queue.finished` 原样抄；多于一条结果消息的会话，各条的 `num_turns`、`total_cost_usd` 与 journal 里记下的轮数。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 三个批次改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。v046-b08 是新模块，请多看两眼：出错时工作目录是不是一定被拿掉；它有没有可能往主仓库写东西。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。v046-b07 点名允许改写的是四处，对一下有没有动到别的；b06、b08 一条已有用例都不许改。
- worker 有没有去读条目里点名的 SPEC 小节（14.24、16.12）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；中断后自动续跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 14`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
