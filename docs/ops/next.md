# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：d4eac65
固定版本：8c908ef
批次上限：1

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第三十次队列 `--continue --max 1`，固定版本前移到 `8c908ef`（应选中 v046-b40）

第二十九次队列的汇报我核过了，两批的 PASS 都成立，裁定记在 SPEC 14.40。你把四种上报情形在单批次与队列模式下各跑一遍、新旧两边逐字节比，这是 reviewer 现在做不到的（它没有写权限，搭不了对比实验），正是我要的。你第 8 段的几条：

- **第 1 条，固定版本前移到 `8c908ef`：** 就是这一轮。
- **第 2 条，v046-b37：** 仍是 `blocked`，代码采纳，现在有 `test/output-tail.test.ts` 守着。
- `escalateAndCommit` 的附加字段能盖掉 `reason`、K2 对 `expect` 只断言「有」、reviewer 的自言自语：记一笔，不改。
- `/data` 的变化不在 Collie：知道了，我会告诉所有者。

**v046-b40 是批次清单归档**（SPEC 16.27）：R2 认得一个归档文件 `docs/backlog-archive.md`，已了结的批次可以挪进去，加载时两处都读。这一批只做「认得」，不挪任何批次。它带情形，测试 agent 先写验收测试。
两份手册的受保护清单里我已经加上了这个文件名。

## 固定版本 `8c908ef` 里第一次生效的东西

出现了就原样抄，没触发写没触发：
- **验收命令没过时的 `output_tail`** 是新取法：标准输出与标准错误各取最后 20 行，中间一行 `--- stderr ---`。变异检查真没过时，重跑的 task 里应该看得到是哪一项。
- 三条上报路径（没有有效汇报、测试 agent 这一步上报、worker 声明 `disputed_tests`）走同一个函数，行为与以前相同。
- 测试 agent 这一步的 `max_turns` 是 150。

每次取证仍然跑变异检查（约 5 分半）。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、`git status --porcelain` 为空（包括没有 `.vitest/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。`test/acceptance/` 下有 `v046-b21`、`b34`、`b35`、`b36`，是正常的。**主仓库里不应该有 `docs/backlog-archive.md`**（有就停下报告）。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。主仓库的 `node_modules` 要在。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 15 秒内成功；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线，两条都必须过，末尾几行原样抄进汇报：`npm test` 必须是绿的；`npm run test:mutation` 末行必须是 `mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0`，跑完 `git status --porcelain` 仍为空。不过就不开跑，写汇报、推送，等 next.md。
5. 固定版本：`git -C /tmp/collie-r2 fetch -q origin && git -C /tmp/collie-r2 checkout -q --detach 8c908ef && git -C /tmp/collie-r2 rev-parse --short HEAD` 应输出 `8c908ef`（锁文件没变，不用 `npm ci`；`/tmp/collie-r2/node_modules` 要在）。
6. 模型接口：在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟一次，一共 3 次，这算一轮。三次都是退出码 0、整条命令在 60 秒以内，才算过。
   没过：等 30 分钟，重做第 1 步的检查和这一步，最多 4 轮。4 轮都没过：不开跑，写汇报、推送，等 next.md。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b40`，确认状态是 pending，输出里有 `== scenarios ==` 一节（8 条）。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 1`。中途不干预、不重跑。
   开头有十来分钟是测试 agent 在系统临时目录里干活，这段时间 heartbeat 的 `phase` 是 `tester`，主工作区应该一直是干净的。
9. 结束后手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    - 测试 agent 这一步没过：`.collie/batches/v046-b40/tester.md` 全文抄进汇报；有 `misclassified` 的原样抄。不要重跑。
    - worker 声明了 `disputed_tests`：照第二十八次队列那样，先核对它说的对不对，把证据写进汇报。不要重跑。
    - 有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 结束后请你核对

都在 `/data/tmp` 的仓库副本或独立克隆里做，做完删掉，**不动主仓库，主仓库里不要建 `docs/backlog-archive.md`**。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **拿真实的 backlog 试一次归档（这一轮最要紧）。** 在 HEAD 的副本里：
  - 先记下归档之前的输出：`show v01-b01`、`show v046-b40`、`status`、`status --json`、`timeline`（各存一份）。
  - 把 `docs/backlog.md` 里最早的 50 个批次（总览表的行与对应的小节，原样）挪进 `docs/backlog-archive.md`，归档文件开头放自己的「队列总览」表。挪法写进汇报（你怎么切的、两个文件各多少行）。
  - 再跑同样五条命令，与归档之前逐字节比较。预期：全部相同。有任何一处不同（比如次序），原样抄。
  - 用**固定版本 `8c908ef`** 的 cli 读归档之后的副本：预期报错（`docs/backlog.md` 里有批次依赖的批次号找不到了），原样抄。所以我要等固定版本带上这一批之后才真的归档。
  - 再试三种错：同一个批次号两处都有；归档里放一个 `pending` 的批次；`docs/backlog.md` 里依赖一个哪里都没有的批次号。报错原样抄。
  - 在副本里用队列跑一个沙箱小批次不现实就不做；`run --continue` 的那条路看验收测试 S4 有没有守住即可。
- **验收测试够不够硬。** 把 worker 的实现整个撤掉：`new.test.ts` 必须全红、`keep.test.ts` 必须全绿。逐个撤一次，各自必须有验收用例变红，没有的写明：
  读归档文件的那一处（改成不读）；「两处都有」的检查；归档里状态的检查；依赖在并集里核对（改回只在本文件里核对）；`PROTECTED_PATHS` 里新加的那一行。
  逐条情形对一遍用例：每个期望有没有断言；有没有只在 `catch` 里断言的；临时目录有没有清掉（跑完看 `/tmp`、`/data/tmp` 下有没有它留下的目录）。
- **变异检查。** 副本里跑一次 `npm run test:mutation`，末行原样抄（预期 `caught 47 survived 0 …`）。
- **这一轮被删、被改的断言，请逐条过一遍。**
- **判 PASS 之后查出来的问题，照前几轮那样单列成表**：哪一批、什么问题、谁没发现（我的条目与规格 / 测试 agent / worker / reviewer）、算不算实质问题，末尾写合计。
- **reviewer：** 「情形与验收测试」表原样抄；`reason` 里有没有「测试缺口：」；核对表「受保护路径是否被改」一行原样抄。
- **偶发失败、reviewer 读了什么、照旧读代码找问题**：照常。

## 常规项（写进汇报）

- attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列只动一格、测试 agent / worker / reviewer 的轮数与用时。
- `tester.started`（`max_turns` 应该是 150）到 `batch.task_written` 的先后与字段；红检查的 `problems`；信封提交里的文件；`test/acceptance/v046-b40/` 下三个文件的全文和测试 agent 的最终回复全文贴进批次汇报的附录；worker 有没有碰 `test/acceptance/`。
- 取证里变异检查的结果（`docs/progress.md` 里那一行原样抄）与 `acceptance_passed` / `acceptance_total`。
- 每个会话里接口重试的次数与状态码；worker「偏离或疑问」与 reviewer「被改写或删去的断言」原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.27）。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过；worker 的 `api_error` 续跑；`rule9_same_head`；测试 agent 这一步上报；验收命令没过时的 `output_tail`。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 30`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
