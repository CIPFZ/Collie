# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：4558a23
固定版本：a1e35e5
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十六次队列 `--continue --max 2`，固定版本前移到 `a1e35e5`（应依次选中 v046-b33、v046-b34）

第二十五次队列的汇报我核过了，三批的 PASS 都成立，裁定记在 SPEC 14.36。你在克隆里把授权真跑一遍、又顺手试了「授权 `.github` 却改了 `SPEC.md`」，正是我要的。你第 7 段的几条：

- **第 1 条，固定版本前移到 `a1e35e5`：** 就是这一轮。
- **第 2 条，被拦的批次改回 pending 会被规则 2 拦：** 你说得对，而且根子在我的条目：我写了「把状态格改回 pending 再跑一次队列」，没有先核对这条路走不走得通。
  我定的是不改 R2：被拦的批次我不改回 pending。代码做完只差取证或审核的，照 v046-b12、b25 用单批次重跑；其余的保持 `blocked`、改签成新批次（SPEC 16.22）。v046-b30 那条用例里塞的假记录就留着。
- **第 3 条，`.github/../SPEC.md` 没有用例守、报错的说法：** 都在 **v046-b34**。繁体字那一处也并进去了。带 `..` 的文件名一并被拒，偏保守，不改。
- 磁盘已知。

**这一轮有三样东西第一次在真实队列里走，请都写细：**

1. **每次取证都跑变异检查。** 我在本项目 `.collie/collie.toml` 的 `verify.commands` 末尾加了 `npm run test:mutation`（所有者定的「每批必过」，SPEC 16.22）。R2 取证时会跑它，每次运行因此多 5 分钟左右；没过就是验收没过（规则 8）。
   - 每次运行：journal 里这条命令的结果（退出码、用了多久）原样抄；`evidence.collected` 的 `acceptance_passed` / `acceptance_total` 原样抄。
   - 它要是没过：把它输出的最后 20 行原样抄进汇报（哪一项 `survived` / `stale` / `timeout`），这是这一轮最要紧的信息。
   - worker 的手册加了一段，要它写汇报之前自己先跑一遍：它跑了没有、看到了什么，写一句。
2. **v046-b33 是第一个用批次授权的批次**（点名 `vitest.config.ts`）。worker 的 `task.md` 里授权那一节原样抄；它改了哪些文件；`evidence.collected` 原样抄（`spec_diff_lines` 应该是 0，带 `authorized_diff_lines`）；reviewer 核对表「受保护路径是否被改」一行原样抄。
3. **v046-b34 是第二个带情形的批次**（上一个是 v046-b21）。照 v046-b21 那一轮的做法写：`tester.started` 到 `batch.task_written` 的先后与字段；信封提交里的文件；**`test/acceptance/v046-b34/` 下三个文件的全文和测试 agent 的最终回复全文贴进汇报**；
   worker 有没有碰 `test/acceptance/`；reviewer 有没有逐条对照情形；结束后 `why v046-b34` 里 `tester:` 那一行。
   它没走通（测试 agent 这一步上报，或者 worker 一侧超过 `fix_max`）：停在哪一步就把那一步写清楚，不要重跑。固定版本现在有收尾，队列停下时可能多一个 `progress: v046-b34 cleanup` 提交，`git show --stat` 原样抄。

以后有可测行为的批次我都按「情形」写（SPEC 16.22），所以测试 agent 这一步会成为常态。

## 固定版本 `a1e35e5` 里第一次生效的东西

- `.github`、`eslint.config.js`、`vitest.config.ts` 是受保护路径：worker 的提交动了它们而批次没有授权，规则 2、BLOCK。
- 批次的授权小节被认得：任务书多一节，点名的路径不计入受保护文件改动行数。
- `rule9_same_head` 只看这一次的 `head_sha`；`api_error` 的续跑总带 `waited_secs`。
- 上一轮说的那几样仍然有效：worker 的 `api_error` 会先等 300 秒再自动重跑一次（那 5 分钟没有输出是正常的，不要中断）；队列以 `blocked`、`fix_max`、`rule9_same_head` 停下时可能有收尾提交。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/v046-b21/` 在树里是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。主仓库的 `node_modules` 要在（又被清了就 `npm ci`，记一笔）。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线，两条都必须过，末尾几行原样抄进汇报：
   - `npm test`：必须是绿的。
   - `npm run test:mutation`：末行必须是 `mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0`，跑完 `git status --porcelain` 仍为空。记下它用了多久。**这一条不过就不开跑**（不然每一批的取证都会挂在它上面），写汇报、推送，等 next.md。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach a1e35e5 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `a1e35e5`（锁文件没变，不用 `npm ci`；`/tmp/collie-r2/node_modules` 要在）。
6. 模型接口：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。三次都是退出码 0、整条命令在 60 秒以内，才算过。
   没过：等 30 分钟，重做第 1 步的检查和这一步，最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b33`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
   每次取证比以前多 5 分钟左右（变异检查）；v046-b34 开头另有几分钟是测试 agent 在系统临时目录里干活，这段时间 heartbeat 的 `phase` 是 `tester`，主工作区应该一直是干净的。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本或独立克隆里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **v046-b34。**
  - 测试 agent 写的测试够不够硬。在副本里逐个试，结果原样抄：
    把 worker 对报错说法的改动撤掉，跑 `npm test -- test/acceptance/v046-b34`：`new.test.ts` 的用例必须失败，`keep.test.ts` 的必须通过；
    把 `src/backlog.ts` 里拒绝 `..`、绝对路径、通配符的那一行去掉：`keep.test.ts` 里 K1、K2、K3 对应的用例必须失败（上一轮你撤这一行时只有一条红）；
    把「只许点名那三类」的检查整个去掉：K 里还有没有别的用例红。
  - S1 的测试断言的是不是情形里写的那两点（有那句新说法、整条信息里没有 `.github/*`）。只断言其中一点的，原样记下。
  - 对照表 `MAP.md` 里有没有它写不成测试的情形。
- **v046-b33。**
  - 主仓库 HEAD 的 `vitest.config.ts` 里那两行原样抄；除了这两行与注释，这个文件还有没有别的改动（`git diff a1e35e5..HEAD -- vitest.config.ts`）。
  - 一次性用例（`Sandbox` + `FakeRunner`，放仓库外，用固定版本 `a1e35e5` 的代码）：沙箱 backlog 里的批次带授权小节点名 `vitest.config.ts`，假 worker 只改它 → 预期通过、`spec_diff_lines` 0；同一个批次去掉授权小节 → 预期规则 2、BLOCK。上一轮你用 HEAD 做过，这一次是确认固定版本里的行为一样。
- **变异检查进了取证。**
  - 每次运行里这条命令是在哪个目录跑的、跑了多久、有没有在主仓库或系统临时目录留下东西（`.vitest/`、`collie-mut-*`、`collie-clone-*`）。
  - 在副本里故意让它不过一次，看 R2 怎么判：用一次性的沙箱（`Sandbox` + `FakeRunner`），全局命令里放一条一定失败的命令当替身也行，预期是规则 8、FIX，重跑的 task 里「未通过的验收命令」一节有它。写明你是怎么做的。
  - reviewer 有没有去重跑变异检查（它拿到的只有批次自己的验收命令，预期不会）；它核对表里「变异检查的清单」一行原样抄。
- **这一轮被删、被改的断言，请逐条过一遍。** 是不是条目点名的、是不是最小改动、有没有改松；不是点名的，撤掉它守的那一处看变不变红。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例或钩子因为超时到点而失败的，写明是哪个文件、是用例超时还是钩子超时、当时的负载。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄（别的批次的文件被 `Grep` 带出来的，分开写）。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数；v046-b34 另加测试 agent 的轮数、用时。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer、测试 agent 会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.22、16.21、14.36）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；队列里的收尾提交；worker 的 `api_error` 续跑；`rule9_same_head`。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 26`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
