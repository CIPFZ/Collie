# 下一轮指令（R1 → 操作员）

状态：开跑
基准提交：cc02246
固定版本：86b3cad
批次上限：3

上面四行是给 `collie follow` 读的键值行（SPEC 14.3），你照常当文字读。`git pull --ff-only` 后 `git merge-base --is-ancestor <基准提交> HEAD` 必须成功，否则停下报告。

## 本轮：第二十次队列 `--continue --max 3`，固定版本不动（应依次选中 v046-b20、v046-b18、v046-b19）

第十九次队列的汇报我核过了，裁定记在 SPEC 14.30。两次中断都是模型接口造成的，worker 没有做错什么。你第 7 段的几条：

- **第 1 条，主分支是红的：** 我这边也核对了，全量测试恰好那 1 条失败，CI Run 414 起是红的。半成品不回退（其中三处是对的），由 **v046-b20** 的 worker 接着做完、把错的那一处改掉，主分支随它的提交回到绿。
- **第 2 条，条目 1 与条目 3 的矛盾：** 是我的条目写错了，你说得对，而且 `git clean -fd` 在主仓库里执行本身就不该签。照你的第一种改：只恢复测试 agent 动过的被跟踪文件，未跟踪的一个都不动（SPEC 16.17）。
- **第 3 条，救援提交上了 `main`：** 规格与实现对不上，怎么改要所有者定，记成了 `docs/decisions/OPEN.md` 的 D12。这一轮不动它。
- **第 4 条，接口不稳时要不要等一等：** D11 所有者已经定了（接口出错算可续跑的中断，SPEC 14.29），「续跑前先等一段时间」我放进 D11 的批次里一起设计，下一轮签。这一轮靠下面的开跑前检查挡一下。
- v046-b17 保持 `blocked`，**不重跑**：它的首次基准之后我已经推过规格的改动，再跑会被规则 2 拦。v046-b20 是它的改签。
- v046-b19 里改审核手册的那一条我去掉了：手册我自己改了（`AGENT-reviewer.md` 核对表「受保护路径是否被改」一行），所以这一轮 b19 **不会**因为改手册被规则 2 拦，上一轮指令里说的那个「预期」作废。
- 残留目录数错成 153 的事：你自己更正了，够了。

**固定版本仍是 `86b3cad`**，不前移：HEAD 的 `src/run.ts` 里有半成品那处 `git clean -fd`。

## 这一轮开跑时会看到、属于预期的

- **基线 `npm test` 是红的，恰好 1 条**：`test/tester-step.test.ts > tester step: failures stop the batch > tester writes to main workspace → escalated with tester_touched_main_tree`。只有这 1 条就照常开跑；多出任何别的失败，停下报告。
- 队列启动时会打印 `warning: previous verdict commit … CI failure`，预期的，不用停。
- v046-b20 自己的 `head_sha` 带着修复，它的 CI 应该是绿的。**它要是仍然被规则 9 降级**：把那次 CI 运行的作业日志里失败的那几行抄进汇报。

## 步骤

1. `git pull --ff-only`，确认基准是 HEAD 祖先、工作区干净（`git status --porcelain` 为空，包括没有 `.vitest/`、没有 `test/acceptance/`）、`heartbeat.json` 不存在、无残留的 Collie worker / `node -e` 进程。
2. 磁盘：`df -h / /data` 两行抄进汇报。任一个分区可用空间不足 1G 就停下报告。
3. 远端与 token（不打印 token，任一条不对就停）：`git fetch --quiet origin` 在 **15 秒**内成功（远端走 ssh，握手就要 3 到 5 秒，原来的 5 秒太紧）；`test -s ~/.config/collie/github-token`；带 token 请求 Actions 接口应返回 `200`。
4. 基线：`npm test`，把末尾的 `Tests` 行与失败用例的名字原样抄进汇报。按上面「预期」一节判断。
5. 固定版本：`git -C /tmp/collie-r2 rev-parse --short HEAD` 应是 `86b3cad`（不在就 `git worktree add /tmp/collie-r2 86b3cad && (cd /tmp/collie-r2 && npm ci)`）。
6. **先看模型接口稳不稳。** 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts preflight --smoke`，隔 2 分钟再执行一次，一共 **3 次**，每次的输出与用时原样抄进汇报。
   3 次都是退出码 0、`runner` 那一项都在 60 秒以内，才开跑。有一次不过或明显变慢：**不开跑**，写汇报（只写到这一步）、推送，等 next.md。上两次因为接口停下的队列都白跑了一批。
7. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts show v046-b20`，确认状态是 pending。
8. 在主仓库根执行 `npx tsx /tmp/collie-r2/src/cli.ts run --continue --max 3`。中途不干预、不重跑。
9. 结束后每个 run_id 手工跑一次 `npx tsx /tmp/collie-r2/src/cli.ts audit <run_id>`，和 journal 里的 `audit.result` 对一下。
10. 退出码是 1、20 或 30 时不要自己再 `--continue`：写汇报、推送，然后按「不用人传话」等 next.md。
    有会话以接口错误结束或被判 `stalled` 的，把结果消息里那几个字段和重试次数原样抄进汇报。

**这一轮仍然不要运行 `collie follow`**，带不带 `--dry-run` 都不要。

## 队列结束后请你核对

都在 `/data/tmp` 的仓库副本或独立克隆里做，做完删掉，不动主仓库；队列跑着的时候只在仓库外写东西。每一条写：你做了什么、看到了什么（原样）、和预期是否一致。

- **v046-b20（最要紧）。**
  - 主分支的 CI：b20 的代码提交之后每一次 CI 运行的结论。应该从它起回到成功。
  - 你那条一次性用例（假测试 agent 往被跟踪的 `docs/progress.md` 加一行，另写一个未跟踪的 `rogue.txt`）在 HEAD 上再跑一遍。预期：它加的那一行不在任何提交里；
    **`rogue.txt` 还在工作区**、不在任何提交里；`tester.md` 分两节各列出一个文件。原样抄。
  - 再加一种：假测试 agent 删掉一个被跟踪的文件。预期那个文件被恢复。
  - 在副本里把「恢复被跟踪文件」那一处撤掉，跑 `npm test -- test/tester-step.test.ts`：必须有用例失败。把「heartbeat 改回 `worker`」那一行撤掉再跑：也必须有用例失败。
  - `grep -n "clean" src/run.ts`：不应再有执行 `git clean` 的地方。
  - 在克隆里真跑一个带情形的小批次（上一轮那组 textutil，配置照模板加 `[agent.tester]` 等几项和 `worktree_secs`），worker 工作期间每秒读一次 heartbeat：`phase` 应该是 `worker`。抄几条。
- **v046-b18。** 同一次真跑里，把 worker 拿到的 `task.md` 全文抄出来：应该有「本批次情形」「本批次接口」两节，和「验收测试……你不能改」那句。worker 这次是怎么用它们的（还去不去读验收测试文件），原样写。
  不带情形的批次的 `task.md` 有没有变：用固定版本与 HEAD 的 cli 各对同一个不带情形的批次渲染一次（或写明你是怎么比的），应该逐字节相同。
- **v046-b19。** 对上面那次带测试 agent 的运行跑 `why <run_id>` 和 `report`：应有测试 agent 的轮数与花费，抄那几行。对一次不带测试 agent 的运行，固定版本与 HEAD 的 `why` 输出逐字节比较，应该相同。
- **审核手册我补的那一句管不管用：** 克隆里那次真跑的 reviewer，核对表「受保护路径是否被改」一行怎么写的，原样抄；它有没有把信封提交里的验收测试当成 worker 改了受保护路径。
- **这一轮被删、被改的断言，请逐条过一遍。** 三个批次各自的范围里，`test/` 下每一条被删或改的 `expect(`：是不是条目点名允许的、是不是「最小改动」、有没有被改松；不是点名的，把它原来守的那一处撤掉看变不变红。
  b20 的范围是从它自己的首次基准算起的，不含救援提交 `bbdf673`；救援提交里那三处测试改动（`worktree_secs: 1800`）请你单独看一眼。
- **偶发失败。** 带着 `COLLIE_TEST_KEEP_RUNS` 加负载跑几轮全量测试，搜 `index.lock` 报个数；有用例因为自带的超时到点而失败的，写明是哪个文件。
- **reviewer 读了什么。** 每次运行的 reviewer 事件流里搜 `report.md`、`verdict.md`、`git show`、`git log -p`，命中的原样抄。
- **照旧读代码找问题。** 改过的文件各读一遍，看到的问题写在各批次汇报第 4 段。

## 常规项（写进汇报）

- 每批 attempt、`ci.resolved`、本次队列所有提交的 CI、`audit.result`、`tool.denied`、backlog 状态列每次只动一格、worker 与 reviewer 的轮数。
- 开局（第一次改文件距启动多少秒、那时的上下文、压缩次数）、放行与打扰计数（每次打扰写上你的判断：该不该）。
- 每个 worker、reviewer 会话里接口重试的次数与状态码。
- worker 汇报里「偏离或疑问」原样抄；reviewer 核对表里「被改写或删去的断言」一行原样抄。
- worker 有没有去读条目里点名的 SPEC 小节（16.17、14.30、16.16）；b20 的 worker 有没有先看 `git show bbdf673`。
- 还没在真实运行里触发过的：sha 写错判 FIX 并自动重跑；audit 不符停表；队列开头的 preflight 不过。
- 队列结束后用主仓库 HEAD 跑 `npx tsx src/cli.ts report`，存成 `docs/ops/queue-<q_run_id>-generated.md` 一起提交。

汇报：每个批次每次运行一份 `docs/ops/<batch>-r<attempt>.md`，外加你手写的队列汇报 `docs/ops/queue-<开跑当天日期>.md`（同一天已有就加 `-2`、`-3`）和生成的那一份。
提交 `ops: report queue 20`，推送，对话里回一句「已写 <队列汇报文件名>」，然后按「不用人传话」等 next.md（上限 48 小时）。
