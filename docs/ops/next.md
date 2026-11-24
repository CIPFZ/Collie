# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：7daa202
固定版本：ae932f8
批次上限：2

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第三十一次队列 `--continue --max 2`，固定版本前移到 `ae932f8`（应依次选中 v046-b41、v046-b42）

第三十次队列的汇报我核过了，v046-b40 的 PASS 成立，裁定记在 SPEC 14.41。你拿真实的 backlog 试归档、又用旧固定版本去读归档后的副本，查出「`status` 出错了也不报」，这一条我在规格里写的自查办法正好会被它误导。你第 8 段的几条：

- **第 1 条，固定版本前移到 `ae932f8`、然后归档：** 都做了。**我已经把总览表最前面的 63 个批次（v01 到 v045，v045-b18 除外）连同小节原样挪进了 `docs/backlog-archive.md`**，`docs/backlog.md` 从 4462 行减到 1935 行。
  归档前后我用 HEAD 的代码比过：104 个批次的解析结果、7 个批次的 `show`、`status --json`、`timeline`，逐字节相同。我这边没有运行记录，所以带真实 journal 的那几条命令要请你再核一遍（见下面「结束后请你核对」的第一项）。
- **第 2 条，`status` 吞掉批次清单的错误：** 就是 **v046-b41**。`why`、`report` 同样会吞，一起改：批次清单存在却读不出来时，三条命令都报错、退出码 1。
- **第 3 条，补一条「归档里 `blocked` 被接受」的测试：** 放进了 v046-b41 的 [保持] 情形。reviewer 这次自己指出了这个缺口，说得对。
- 变异脚本注释里的项数：随 v046-b41 改。两种新报错不带行号：不改。
- **v046-b42** 是把你一直手工判断的「60 秒以内」做进 `preflight --smoke`：调一次模型超过 `smoke_max_secs`（缺省 60）就算不过。

两批都带情形。每次取证仍然跑变异检查（现在是 47 项）。

## 归档之后要留意的

- **旧固定版本读不了现在的 backlog**（它找不到被挪走的批次，`show` 会报错，`status` 却不报错、只是少几行）。所以**在第 5 步把 `/tmp/collie-r2` 前移到 `ae932f8` 之前，不要用它跑任何命令。**
- `docs/backlog-archive.md` 在主仓库里是正常的，它是受保护路径，R2 不写它。
- 以后查某个早期批次的条目，到归档文件里找；`show <批次>` 两处都认得。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/` 下有 `v046-b21`、`b34`、`b35`、`b36`、`b40`，`docs/` 下有 `backlog-archive.md`，都是正常的。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。主仓库的 `node_modules` 要在。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线，两条都必须过，末尾几行原样抄进汇报：`npm test` 必须是绿的；`npm run test:mutation` 末行必须是 `mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0`，跑完 `git status --porcelain` 仍为空。不过就不开跑，写汇报、推送，等 next.md。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach ae932f8 && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `ae932f8`（锁文件没变，不用 `npm ci`；`/tmp/collie-r2/node_modules` 要在）。
6. 模型接口：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。三次都是退出码 0、整条命令在 60 秒以内，才算过。
   没过：等 30 分钟，重做第 1 步的检查和这一步，最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b41`，确认状态是 pending，输出里有 `== scenarios ==` 一节（8 条）；再执行 `npx tsx /tmp/collie-r2/src/cli.ts show v01-b01`，确认归档里的批次也读得出（状态 passed）。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 2`。中途不干预、不重跑。
   每批开头有十来分钟是测试 agent 在系统临时目录里干活，这段时间 heartbeat 的 `phase` 是 `tester`，主工作区应该一直是干净的。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    - 测试 agent 这一步没过：`.collie/batches/<批次>/tester.md` 全文抄进汇报；有 `misclassified` 的原样抄。不要重跑。
    - worker 声明了 `disputed_tests`：照第二十八次队列那样，先核对它说的对不对，把证据写进汇报。不要重跑。
    - 有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 结束后请你核对

都在 `/data/tmp` 的仓库副本里做，做完删掉，不动主仓库。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。跑到哪一批就核对到哪一批。

- **我的归档，用真实的运行记录再核一遍（这一条不依赖队列，最先做也行）。** 归档是单独的一个提交 `029722c`，它只挪了那 63 个批次（外加两个文件开头各一句说明），前一个提交是 `9c86671`。做两份副本：一份在 `9c86671`（归档之前），一份在 `029722c`（归档之后；不要用再后面的提交，那里多了两个新批次），都把主仓库的 `.collie/runs` 以只读的方式接进去（链接或复制都行），用**同一份** HEAD 的 cli 分别在两份副本里跑：
  `status`、`status --json`、`timeline`、`show` 四五个批次（归档里的、没归档的各挑几个，含一个 `blocked` 的）、`why` 上一轮你比过的那 6 个批次、`report --queue` 最近 4 个队列。
  两边逐字节比较。预期：全部相同（输出里带当前时间的，说明是哪一处）。有任何别的不同，原样抄，我立刻处理。
- **v046-b41。**
  - 验收测试够不够硬：实现整个撤掉，`new.test.ts` 必须全红、`keep.test.ts` 必须全绿；把「三条命令共用的读法」改回吞错，各条命令对应的用例必须红。
  - 真实数据上的表现：在归档后的副本里把批次清单弄坏三种（`docs/backlog.md` 里依赖一个哪里都没有的批次号；归档里放一个 `pending`；同一个批次号两处都有），`status`、`status --json`、`why <批次>`、`report` 各跑一遍，输出与退出码原样抄（预期都是一行 `collie: …`、退出码 1）。
  - **批次清单合法时一个字都不变：** 上面第一项那几条命令，在 v046-b41 之前的提交与 HEAD 上各跑一遍比较。
  - 一个没有 `docs/backlog.md` 的空目录里跑 `status`：两个版本的输出与退出码相同。
  - 三条命令是不是共用一个函数（读代码）。
- **v046-b42。**
  - 用 HEAD 的 cli 在主仓库根跑一次 `preflight --smoke`（真实的运行器）：`runner` 一行原样抄。
  - 一次性用例：假运行器成功、注入的时钟 61 秒 → 预期 `FAIL runner: exitCode=0 secs=61 exceeds smoke_max_secs=60`、退出码非零；副本配置加 `smoke_max_secs = 120` 再跑 → 预期通过；加 `smoke_max_secs = 0` → 预期配置报错。
  - 把「超过上限判不过」那一处撤掉：验收里 S1、S3 必须红。
  - 模板里那一行是不是注释（`grep -n smoke_max_secs templates/collie.toml`）；沙箱生成的配置里有没有这个键。
- **两批的验收测试：** 逐条情形对一遍用例（每个期望有没有断言、有没有只在 `catch` 里断言的、临时目录有没有清掉）；红检查的 `problems`；有没有 `misclassified`。
- **这一轮被删、被改的断言，请逐条过一遍。**
- **判 PASS 之后查出来的问题，照前几轮那样单列成表**：哪一批、什么问题、谁没发现（我的条目与规格 / 测试 agent / worker / reviewer）、算不算实质问题，末尾写合计。
- **reviewer：** 两批的「情形与验收测试」表原样抄；`reason` 里有没有「测试缺口：」，说的对不对。
- **偶发失败、reviewer 读了什么、照旧读代码找问题**：照常。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格（`docs/backlog-archive.md` 不应被任何提交改动）、测试 agent / worker / reviewer 的轮数与用时。
- 每批：`tester.started` 到 `batch.task_written` 的先后与字段；信封提交里的文件；`test/acceptance/<批次>/` 下三个文件的全文和测试 agent 的最终回复全文贴进批次汇报的附录；worker 有没有碰 `test/acceptance/`。
- 每次取证里变异检查的结果（`docs/progress.md` 里那一行原样抄）与 `acceptance_passed` / `acceptance_total`。
- 每个会话里接口重试的次数与状态码；worker「偏离或疑问」与 reviewer「被改写或删去的断言」原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.28、14.41、14.33）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报；验收命令没过时的 `output_tail`。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 31`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
