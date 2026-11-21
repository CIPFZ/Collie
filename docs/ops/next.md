# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：5d015fe
固定版本：d4c0747
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十四次队列 `--continue --max 3`，固定版本前移到 `d4c0747`（应依次选中 v046-b26、b28、b29）

第二十三轮的汇报我核过了，两批的 PASS 都成立，裁定记在 SPEC 14.34。你开跑前先查 journal 在不在、数目录个数对账，正是我要的。你第 8 段的几条：

- **第 1 条，v046-b25 的状态格：** 我改成 `passed` 了，v046-b26 这一轮能被选中。
- **第 2 条，固定版本前移到 `d4c0747`：** 就是这一轮。从这一轮起：队列里批次最终被拦时会收尾（撤救援提交、拿掉本批次的验收测试，只提交它自己改的路径）；`preflight --smoke` 会因为运行器退出码非零判不过。
- **第 3 条，别的批次的 report / verdict 留在 reviewer 的树里：** 记一笔，先不改（没有发现它因此改变判断）。
- 上一轮你撤一次查出的四处测试缺口：前三处并进 **v046-b28**，造法照你的实验写进了条目；第四处（为过不变量加的注释）那条不变量太弱，不再加强。
- reviewer 接口出错时整批重跑一次的问题，我提给所有者了（D13）。
- **v046-b29** 是所有者已定的 D10：同一个 `head_sha` 第二次被规则 9 降级就上报，不再重跑。

三批都不带情形。

## 新固定版本里要留意的

- **队列以 `blocked`、`fix_max` 或 `rule9_same_head`（b29 进固定版本之后才有）停下时**，最后可能多一个 `progress: <批次> cleanup` 提交。出现了：`git show --stat` 原样抄，确认里面只有救援提交改过的文件和 `test/acceptance/<批次>/`，没有别的。
- 开跑前那 3 次 `preflight --smoke` 用的是固定版本，**现在运行器退出码非零会直接判不过**：命令的退出码非零就算这一次不过，不用再看 `runner` 那一行的数。`runner` 一行会带 `secs=`，照抄。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/v046-b21/` 在树里是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。主仓库的 `node_modules` 要在（又被清了就 `npm ci`，记一笔）。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 与 `Duration` 两行原样抄进汇报。必须是绿的。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach d4c0747 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `d4c0747`（锁文件没变，不用 `npm ci`；`/tmp/collie-r2/node_modules` 要在）。
6. 模型接口：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。三次都是退出码 0、整条命令在 60 秒以内，才算过。
   没过：等 30 分钟，重做第 1 步的检查和这一步，最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b26`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b26（v046-b23 改签）。** 把第十六、十九、二十一、二十二次队列里真实的 `api_error` 结果消息喂给运行器的汇总逻辑（一次性脚本），`stopReason` 应该是 `api_error`；
  逐个撤一次（运行器认 `api_error`、队列把它算中断、续跑前等待），各自必须有用例变红；副本配置加 `api_retry_wait_secs = 60`，固定版本与 HEAD 的 cli 各跑一次 `preflight`：预期旧的报不认识的字段、新的能读。
  这一轮队列里要是真的有 worker 以 `api_error` 结束：固定版本还没有 b26，照旧停下，属于预期。
- **v046-b28。** 条目里写的三个「撤一次必须失败」逐个照做，结果原样抄：撤掉「reviewer 用这一次的信封」；`batchCleanup` 改回 `git add -A`；冲突处理改成会把冲突标记提交上去。
  再看一眼改过的三条用例是不是真的造出了名字里的情形（第 2 次 worker 没有代码提交；`note.txt` 是真正的未跟踪文件；`feature.txt` 是内容冲突）。
- **v046-b29。** 一次性用例：队列里一个批次两次被规则 9 降级、`head_sha` 相同。结束后的 journal 末尾几条、`git log --format='%h %s' -n 5`、backlog 那一格原样抄；再试 `head_sha` 不同的情形，应该照常重跑。
  撤掉那条判断，跑 `npm test -- test/rule9-same-head.test.ts`：必须有用例失败。
- **这一轮被删、被改的断言，请逐条过一遍。** 是不是条目点名的、是不是最小改动、有没有改松；不是点名的，撤掉它守的那一处看变不变红。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例因为自带的超时到点而失败的，写明是哪个文件。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄（别的批次的文件被 `Grep` 带出来的，分开写）。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer 会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.18、16.20、14.34、13.14）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；队列里的收尾提交。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 24`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
