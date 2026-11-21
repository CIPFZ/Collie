# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：0e40ced
固定版本：e28d50f
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十五次队列 `--continue --max 3`，固定版本前移到 `e28d50f`（应依次选中 v046-b30、b31、b32）

第二十四次队列的汇报我核过了，三批的 PASS 都成立，裁定记在 SPEC 14.35。你把 6 条真实的 `api_error` 结果消息喂给运行器、把 b28 的三个「撤一次」逐个做掉，正是我要的。你第 7 段的几条：

- **第 1 条，固定版本前移到 `e28d50f`：** 就是这一轮。
- **第 2 条，`rule9_same_head` 只看这一次的 sha：** 你读得对，我读了代码也同意。改它的是 **v046-b30**，顺带把 `api_retry_wait_secs = 0` 时 `batch.retried` 不带 `waited_secs` 也改掉。
- 磁盘已知。

另外两批是分工改造第 2 步和所有者已定的 D9（SPEC 16.21）：
- **v046-b31**：`.github`、`eslint.config.js`、`vitest.config.ts` 列为受保护路径，变异清单加三项。
- **v046-b32**：批次授权。backlog 的批次可以多一个小节点名这三类路径，worker 才能改；取证时点名的路径不计入受保护文件改动行数。

三批都不带情形。两份手册我已经相应改了（`AGENT-worker.md` 的禁写清单、`AGENT-reviewer.md` 核对表「受保护路径是否被改」一行）。

**我这边的一处情况，你不用处理：** 我的机器上按默认时限跑全量测试，3 次里有 2 次，`test/report.test.ts` 与 `test/reviewer-rerun.test.ts` 的 `beforeEach` 到了 120 秒的钩子超时（各跑了约 160 秒），不是断言失败；把时限临时放到 300 秒就全过。
v046-b24 给 `describe` 加的 `timeout` 管不到钩子：那是我条目里写错的。要改的是 `vitest.config.ts` 的 `hookTimeout`，等这一轮的授权做好，它就是第一个用授权的批次。你的机器快，碰不到。

## 新固定版本 `e28d50f` 里第一次生效的东西

出现了就原样抄，没触发写没触发：
- **worker 的会话以 `api_error` 结束：** 队列会先等 300 秒，再自动重跑一次。队列 journal 里是 `batch.retried`（`cause: interrupted`、`stop_reason: api_error`、`waited_secs: 300`）。重跑又失败才停下。等的那 5 分钟里没有任何输出是正常的，不要中断它。
- **同一个 `head_sha` 第二次被规则 9 降级：** 不再重跑，队列以 `rule9_same_head` 停下，退出码 20。
- **队列以 `blocked`、`fix_max`、`rule9_same_head` 停下时**，最后可能多一个 `progress: <批次> cleanup` 提交：`git show --stat` 原样抄，确认里面只有救援提交改过的文件和 `test/acceptance/<批次>/`。
- reviewer 的会话以 `api_error` 结束仍然走规则 1、整批重跑一次（这一条等所有者定，还没改）。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/v046-b21/` 在树里是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。主仓库的 `node_modules` 要在（又被清了就 `npm ci`，记一笔）。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach e28d50f && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `e28d50f`（锁文件没变，不用 `npm ci`；`/tmp/collie-r2/node_modules` 要在）。
6. 模型接口：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。三次都是退出码 0、整条命令在 60 秒以内，才算过。
   没过：等 30 分钟，重做第 1 步的检查和这一步，最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b30`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
   v046-b31、b32 的验收里各有一次完整的变异检查（46 项），这一步要多跑几分钟，属于正常。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本或独立克隆里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b32（最要紧）：把授权真跑一遍。** 用 HEAD 做一份独立的本地克隆（带一个本地的裸仓库当远端），在克隆里：
  - `docs/backlog.md` 加一个小批次：条目一条，「把 `vitest.config.ts` 的 `testTimeout` 与 `hookTimeout` 都改成 `300_000`，注释相应改」；加上授权的那个小节，点名 `vitest.config.ts`（小节的写法见 SPEC 16.21）；
    验收用 `grep -qE "hookTimeout: 300_000" vitest.config.ts && grep -qE "testTimeout: 300_000" vitest.config.ts`。提交。
  - 用 HEAD 的 cli、真实的运行器跑 `run <批次>`（CI 查不到是预期的，最后被规则 9 降级不要紧）。我要看的：
    worker 拿到的 `task.md` 全文（应有「本批次可改的受保护路径」一节）；worker 改了哪些文件、「偏离或疑问」原样；
    `evidence.collected` 原样（`spec_diff_lines` 应该是 0，`authorized_diff_lines` 大于 0）；
    reviewer 核对表「受保护路径是否被改」一行原样，它是怎么对待这处改动的（照新手册，应当认它是授权的，并核对有没有超出条目）；最后的结论与规则。
  - 一次性用例（`Sandbox` + `FakeRunner`，放仓库外）：同样授权了 `vitest.config.ts` 的批次，假 worker 另外还改了 `eslint.config.js`。预期规则 2、BLOCK，`spec_diff_lines` 只算 `eslint.config.js` 的行数。原样抄。
  - 在克隆的 backlog 里把授权的那一节改成点名 `SPEC.md`，跑 `show <批次>`：预期报错并指出这一项。再试 `docs/backlog.md`、`.github/*`、`../x`。
  - 固定版本 `e28d50f` 的 cli 读带这一节的 backlog：预期不报错、当成普通文字跳过（所以带授权的批次要等固定版本前移之后才能签）。原样写它的表现。
  - 逐个撤一次、看测试变不变红：解析里「只许点名那三类」的检查；取证里「排除授权路径」的那一处；任务书里多出的那一节。
- **v046-b31。**
  - 一次性用例：没有授权的批次，假 worker 的提交改了 `eslint.config.js`（再各试 `.github/workflows/ci.yml`、`vitest.config.ts`）。预期规则 2、BLOCK。
  - 在主仓库的副本里跑一次 `npx tsx scripts/mutation.ts`，末行原样抄（预期 `caught 46 survived 0 …`）。
- **v046-b30。**
  - 条目 1 加粗的那个情形照做一遍（第一次队列以 `rule9_same_head` 停下 → 状态格改回 pending → 第二次队列 worker 有新提交仍被规则 9 降级）：预期照常重跑，不上报。journal 末尾几条原样抄。
  - 把判断改回「任意一个 sha 出现两次」，跑 `npm test -- test/rule9-same-head.test.ts`：新的那条必须红。
  - `api_retry_wait_secs = 0` 时 `batch.retried` 带 `waited_secs: 0`；把这一处撤掉，对应的用例必须红。
- **这一轮被删、被改的断言，请逐条过一遍。** 是不是条目点名的、是不是最小改动、有没有改松；不是点名的，撤掉它守的那一处看变不变红。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例或钩子因为超时到点而失败的，写明是哪个文件、是用例超时还是钩子超时、当时的负载。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄（别的批次的文件被 `Grep` 带出来的，分开写）。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。v046-b32 请多看两眼：授权是不是只可能来自 backlog；有授权时别的受保护路径是不是照样计数。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer 会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.21、14.35）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；队列里的收尾提交；worker 的 `api_error` 续跑；`rule9_same_head`。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 25`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
