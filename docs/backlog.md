# Collie 批次队列

> 唯一可修改者：R1 方案设计 Agent（须用户批准）。其他角色只读。
> 优先级在方案确定阶段一次排定，批次随之固定，**不做滚动重新拆解**。
> v01 到 v045（v045-b18 除外）共 63 个已了结的批次在 [backlog-archive.md](./backlog-archive.md)（R1 2026-11-24 归档，SPEC 16.27、14.41）；R2 加载时两处都读。
> R1 签发自查（v02-b04-fix 后）：条目里每一条「测试要注入 X / 用 Y 替代 Z」的要求，验收必须同时 grep 源文件和对应测试文件，
> 只 grep `src/` 的验收抓不住「接口做了、测试没用上」（b04：只注入 now；b04-fix：指纹可注入但场景 G 没注入）。
> 凡验收表含 grep 类结构检查的批次，条目正文必须写「同步加进 `test/invariants.test.ts`」，验收加一条 grep 该文件（SPEC 3.2 结构不变量）。
> R1 签发自查（v04-b04 后，SPEC 13.12、13.13）：条目正文必须写明要读的 SPEC 小节号（worker 不再通读 SPEC，task 也不带小节开头的说明文字）；
> 条目要求展示某个值时，写明它取自哪个事件的哪个字段，并核对 R2 确实写了它；只读命令的测试至少有一组夹具来自 fake runner 跑出的真实运行。
> R1 签发自查（v045-b04 后，SPEC 14.8）：条目里有「只做一次」「重试」「退避」这类跨多圈才看得出的行为，写明「连续 N 圈之后是什么样」并要求测试真的走 N 圈；
> 要求「数据来自真实运行」时点名是哪几条断言；一个批次不要既改 R2 又加新命令（v045-b01 因此用满了 200 轮）。
> R1 签发自查（v045-b05 / b06 后，SPEC 14.11）：多圈行为的情形要一直写到「恢复之后」为止（失败几圈、恢复、再走几圈之后是什么样）；
> 改 R2 的条目单独成批，不和投影、多个测试文件的改动放在一起（v045-b06 用了 168 轮）。
> R1 签发自查（v045-b08 后，SPEC 14.13）：改已有模块的条目，写明哪些已有行为必须原样留下，并给容易被顺手删掉的那几条各配一条验收；
> 允许改写的旧用例要点名，不写「与新行为冲突的可以改」这种交给 worker 判断的豁免；队列参数（如 `--max`）碰到没跑过的情形之前，先用假 runner 试一遍。
> R1 复核自查（v045-b09 后，SPEC 14.16）：检查工具报「全部被发现」「全部通过」时先做一次对照——不做任何改动走一遍它的判定路径，结果应该是「没被发现」；
> 对照没做过的结论不写进规格（「变异检查 44 项全部被发现」里有 9 项是测试文件加载失败）。
> R1 签发自查（v045-b15 / v046-b03 后，SPEC 14.21、14.23）：签批次前先查现有测试里谁守着要改的行为，在条目里写「R1 查过」哪几条；
> 要读的 SPEC 小节号写在条目或情形里，不写在开头的说明里（说明文字不进任何任务书）；验收不数用例个数（夹具里的 `it(` 也会被数进去），改成点名用例组的标题。
> R1 签发自查（v046-b07 / b08 后，SPEC 14.25）：条目里举例时不拿本仓库的现状当例子（「本仓库的配置就没有这两项」被写成了断言）；
> 新测试文件要建 git 仓库、用临时目录的，验收里加一条「没有 git 全局身份、系统临时目录里有别人的同名前缀目录」时也通过的命令：CI 的机器和开发的机器不一样，worker 看不到 CI。
> R1 签发自查（v046-b09 后，SPEC 14.26）：条目里允许「改某条断言看的对象」时，同时写明「不许删这条断言」，并在指令里请操作员把被守的那一处撤掉、看测试变不变红（两条残留检查被删，reviewer 判为合理）。
> R1 签发自查（v046-b14 后，SPEC 14.27、16.15）：签发前还要查钉死完整清单的用例（事件序列、事件类型个数、整段配置对象、变异清单项数）；
> 条目里不写「发现别的现有用例失败一律停下」，写「只许做新行为直接要求的最小改动并逐条列出，拿不准才停下」（b14 照「停下」把代码推了上去，主分支红了 26 分钟）。
> R1 签发自查（v046-b17 后，SPEC 14.30）：每批最多 3 个条目，签完先 `show` 一遍；条目之间互相对一遍，尤其是「要做的清理」和「要保留的现有断言」会不会打架；
> 点名的文件先 `grep` 确认（超时写成了 `scenario-n`，实际在 `follow`）；手册是 R1 的文档，R1 自己改，不放进批次；在主仓库里执行 `git clean` 这类会删别人文件的命令不签。
> R1 签发自查（v046-b19、b20 后，SPEC 14.31）：写「输出不变」时写明是哪些输出（文字、JSON 都算），验收里各比一次；让测试删或改的文件，不能是 R2 自己本来就会重写的那个；
> 把一段留待以后的事拆成批次时，对着原来的清单逐项点一遍（16.14 留下四项，拆的时候漏了两项）。
> R1 签发自查（v046-b22 后，SPEC 14.32）：动 git 工作区的批次，加粗情形里要有「工作区里另有未跟踪文件时」；额外禁止里列了的命令（如 `reset`），验收里加一条 grep 守住；冲突类用例写明要内容冲突。
> R1 签发自查（v046-b24、b25 后，SPEC 14.34）：加粗情形里写了「X 的时候」，就写明测试怎样造出 X，并在验收里放一条「把修复撤掉，这条测试必须失败」由操作员核对；不许用 `.gitignore` 之类的办法绕开要造的情形。
> R1 签发自查（v046-b24 的时限后，SPEC 14.35）：条目里写到工具的行为（如「钩子跟着用例的时限走」）先查证再写，那一句是错的：vitest 的钩子时限是配置里的 `hookTimeout`。
> v046-b32 之后：「可改的受保护路径」加冒号独占一行就是小节标签，说明文字里提到它时不要让它独占一行。
> R1 签发自查（v046-b30 后，SPEC 14.36、16.22）：加粗情形里写到的操作步骤（如「把状态格改回 pending 再跑」），先核对这条路在 R2 里走不走得通；走不通的不写。
> 有可测行为的批次按「情形」写，验收只留 lint、类型检查、全量测试与本批次的验收测试；变异检查已在全局命令里，验收表里不再单独写。
> R1 签发自查（v046-b34 后，SPEC 14.37）：情形里每一个期望都单独想一遍在现有代码上成不成立：测试 agent 会把一条情形拆成几条用例，[新] 里混着现在就成立的期望，会被红检查判成「本该失败却通过」；现在就成立的归到 [保持]。
> R1 签发自查（v046-b35、b36 后，SPEC 14.38）：一批是为了某个真实的命令或数据做的，情形里至少有一条用它的真实形状（b35 为变异检查做，情形里的脚本却都只往一个输出流打印）；
> R1 签发自查（v046-b37 后，SPEC 14.39）：被拦的批次代码已经在主分支上时，补测试的批次不带情形（情形会全是 [保持]，测试 agent 那一步要至少一条 [新]）。
> R1 签发自查（v046-b40 后，SPEC 14.41）：情形只写了「被拒绝的」时，补一条「被接受的」；[新] 情形里不夹「输出是合法 JSON」这类现在就成立的话；
> 要测试 agent 往沙箱配置里加一个键时，模板里不能有同名的真键（实现之后会重复）；写进规格的自查办法，先确认用到的命令出错时会报错。
> 条目里要 worker 一定做到的事写成「必须」，并在验收里放一条能判定的命令，不写「能……就……」。
> 情形要用到现有类型上还没有的字段时，在「接口」里写明；「接口」里点出可以照着搭的现有测试文件。

更新时间：2026-11-17
当前版本：v0.4 已于 2026-11-16 记为收口（SPEC 13.24）；在做 SPEC 第 14 章「收掉操作员」与第 15 章，v045-b01 到 b10 已通过，v045-b11 是 `blocked`（代码已在 main 上，被拦的原因是 R2 的缺陷，见 SPEC 14.16）；所有者 2026-11-17 已裁定（SPEC 14.17）；v045-b12 到 b18 与 v046-b01 到 b16 已通过（SPEC 14.19~14.28）；v046-b08 是 `blocked`（代码已在 main 上，随 v046-b09 取证，见 SPEC 14.26）；v046-b17 是 `blocked`（两次因模型接口中断，改签为 v046-b20，见 SPEC 14.30）；v046-b18 到 b22、b24、b25、b27 已通过（SPEC 14.31~14.34；v046-b21 是第一个带情形的批次，v046-b25 是单批次重跑通过、状态格由 R1 改）；v046-b23 是 `blocked`（改签为 v046-b26）；v046-b26、b28、b29 已通过（SPEC 14.35）；v046-b30、b31、b32 已通过（SPEC 14.36）；v046-b33、b34 已通过（SPEC 14.37）；v046-b35、b36 已通过（SPEC 14.38）；v046-b37 是 `blocked`（代码采纳，补测试的是 v046-b39，SPEC 14.39）；v046-b39、b38 已通过（SPEC 14.40）；v046-b40 已通过，最早的 63 个批次已归档到 `docs/backlog-archive.md`（SPEC 14.41）；队列从 v046-b41 起，固定版本 `ae932f8`；本项目配置的全局命令里有变异检查，每次取证都跑
配套：[SPEC.md](./SPEC.md) 第 7 章里程碑、第 8 章验收场景

---

## 队列总览

| 优先级 | 批次 | 标题 | 依赖 | 状态 |
|---|---|---|---|---|
| 64 | v046-b01 | 配置解耦：测试不再盯着本仓库 .collie/collie.toml 里的数值 | v045-b13 | passed |
| 65 | v045-b18 | 运行器：失败的返回值一定带结束原因 | v045-b15 | passed |
| 66 | v046-b02 | 测试 agent 的角色模块：角色、配置段、提示词（不接进队列） | v046-b01 | passed |
| 67 | v046-b03 | 红检查：验收测试在没有实现时，新行为的全部失败、要保持的全部通过（不接进队列） | v046-b01 | passed |
| 68 | v046-b04 | 条目的「情形」写法：backlog 解析情形与接口，测试 agent 只拿情形（不接进队列） | v046-b02 | passed |
| 69 | v046-b05 | 红检查加静态检查：只多了验收测试的树上 lint 与类型检查必须通过（不接进队列） | v046-b03 | passed |
| 70 | v046-b06 | 情形与接口的列表允许空行；测试 agent 提示词两处小修（不接进队列） | v046-b04 | passed |
| 71 | v046-b07 | 配置加 tester_max 与静态检查命令、三个事件类型、test/acceptance 受保护（不接进队列） | v046-b05 | passed |
| 72 | v046-b08 | 测试 agent 这一步的模块：拉起、红检查、重写、只取走点名的文件（不接进队列） | v046-b06, v046-b07 | blocked |
| 73 | v046-b09 | 测试只依赖自己带的环境：git 身份、私有临时目录、不绑本仓库配置；沙箱可留 journal | v046-b06, v046-b07 | passed |
| 74 | v046-b10 | prepareAcceptance 收尾：带回测试 agent 的回复、类别标错不再重拉（不接进队列） | v046-b09 | passed |
| 75 | v046-b11 | R2 诊断信息：规则 9 重跑的 task 带 CI 链接；查裁定提交 CI 出异常时记事件 | v046-b09 | passed |
| 76 | v046-b12 | 接线前的铺垫补齐：测试 agent 的事件与中止、类别标错清单；三处测试小修（不接进队列） | v046-b10 | passed |
| 77 | v046-b13 | 活性指纹不占索引锁：R2 在 worker 工作期间不改写 .git/index | v046-b09 | passed |
| 78 | v046-b14 | R2 凭提交号认自己的提交：规则 2 不再按提交说明的开头跳过 | v046-b11 | passed |
| 79 | v046-b15 | 接线第一块：带情形的批次在写 task 信封之前先拉起测试 agent | v046-b12, v046-b14, v046-b16 | passed |
| 80 | v046-b16 | prepareAcceptance 里运行器抛错的两种情形；两条空过的测试改实（不接进队列） | v046-b12 | passed |
| 81 | v046-b17 | 接线收尾一：被跟踪文件不进提交、heartbeat 阶段改回、测试 agent 单独墙钟、放宽超时 | v046-b15 | blocked |
| 82 | v046-b18 | 接线收尾二：带情形的 worker 任务书多出情形与接口两节、写明验收测试不能改 | v046-b15, v046-b20 | passed |
| 83 | v046-b19 | 接线收尾三：why 与 report 显示测试 agent 的花费 | v046-b18 | passed |
| 84 | v046-b20 | v046-b17 改签：测试 agent 动过的被跟踪文件恢复原样、heartbeat 与墙钟补测试、放宽超时，把主分支修绿 | v046-b15 | passed |
| 85 | v046-b21 | 没有测试 agent 的运行，why 与 report 的 JSON 里不出现测试 agent 的键（第一个带情形的批次） | v046-b19 | passed |
| 86 | v046-b22 | 批次在队列里最终被拦时的收尾：撤销救援提交的改动、拿掉本批次的验收测试 | v046-b20 | passed |
| 87 | v046-b23 | 模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次 | v046-b22 | blocked |
| 88 | v046-b24 | 小修：reviewer 读这一次运行的信封；两处守不住的测试改实 | v046-b20 | passed |
| 89 | v046-b25 | 收尾只提交自己改的路径：不提交未跟踪文件、冲突时只用 revert --abort | v046-b22 | passed |
| 90 | v046-b26 | （v046-b23 改签）模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次 | v046-b25 | passed |
| 91 | v046-b27 | 开跑前检查：运行器退出码非零算不过，写出结束原因与用时 | v046-b20 | passed |
| 92 | v046-b28 | 测试改实：reviewer 信封、收尾的未跟踪文件与内容冲突三处造出真正的情形 | v046-b25 | passed |
| 93 | v046-b29 | 同一个 head_sha 第二次被规则 9 降级就上报，不再自动重跑（D10） | v046-b26 | passed |
| 94 | v046-b30 | 小修：rule9_same_head 只看这一次的 head_sha；api_error 续跑总带 waited_secs | v046-b29 | passed |
| 95 | v046-b31 | CI、lint、测试配置列为受保护路径，变异清单加三项（第 16 章第 2 步） | v046-b29 | passed |
| 96 | v046-b32 | 批次授权：条目点名的受保护路径由 worker 改，不计入受保护文件改动行数（D9） | v046-b31 | passed |
| 97 | v046-b33 | 测试时限提到 300 秒（第一个用批次授权的批次） | v046-b32 | passed |
| 98 | v046-b34 | 授权路径的两处补全：报错信息的说法、带 .. 的写法有测试守着（带情形） | v046-b32 | passed |
| 99 | v046-b35 | 没过的验收命令留下输出的末尾：进运行日志与重跑的任务书（带情形） | v046-b34 | passed |
| 100 | v046-b36 | worker 认为验收测试写错了：汇报里声明，R2 不拉审核、不计返工、上报停下（带情形） | v046-b34 | passed |
| 101 | v046-b37 | 输出末尾按两个输出流各取，变异检查没过时看得到是哪一项（带情形） | v046-b35 | blocked |
| 102 | v046-b38 | 三处上报合成一个函数，推送由 9 处变成 7 处（只重构） | v046-b36, v046-b39 | passed |
| 103 | v046-b39 | 给 v046-b37 已在主分支上的输出末尾取法补测试（只改测试） | v046-b35 | passed |
| 104 | v046-b40 | 批次清单归档：已了结的批次挪进归档文件，解析时两处都读（带情形） | v046-b38 | passed |
| 105 | v046-b41 | status、why、report 不再吞掉批次清单的错误（带情形） | v046-b40 | pending |
| 106 | v046-b42 | preflight --smoke 的用时上限：调一次模型超过 60 秒算不过（带情形） | v046-b27 | pending |

状态取值限 `pending` / `running` / `passed` / `blocked`（SPEC 3.2 枚举）。
本文件是批次的事实源，`task.md` 是其派生物；二者不一致时以本文件为准并重新签发 task。

---

## v046-b01 配置解耦：测试不再盯着本仓库 .collie/collie.toml 里的数值

优先级：64　依赖：v045-b13

分工改造的第 1 步（SPEC 第 16 章）。现在 7 个测试文件从仓库根加载 `.collie/collie.toml`，其中三处断言了它的具体数值。这个文件是受保护路径，worker 改不了，
所以本项目的任何阈值都没法单独调整。规格见 SPEC 16.9（读这一节；背景在 16.5）。

条目：
1. 新文件 `test/support/template-config.ts`，导出 `templateConfig()`：读 `templates/collie.toml`，把 `{{name}}`、`{{repo}}` 换成固定值后解析，返回配置对象。
   下面 7 个测试文件里从仓库自己的 `.collie/collie.toml` 取配置的地方（`loadConfig(repoRoot)` 与 `loadConfig(join(import.meta.dirname, '..'))`）都改用它：
   `test/cli.test.ts`、`test/config.test.ts`、`test/evidence.test.ts`、`test/reviewer-isolation.test.ts`、`test/reviewer.test.ts`、`test/runner-claude.test.ts`、`test/worker.test.ts`。
   `test/config.test.ts` 只留一条读本仓库配置的用例：它能加载、能通过校验，不断言任何数值。
   **做完之后的样子：把 `.collie/collie.toml` 里 reviewer 的 `max_turns` 改成 61、`wallclock_secs` 改成 3601，`npm test` 仍然全过。**
   **这一条由操作员在队列结束后在仓库副本里验证。你不要改 `.collie/collie.toml`，临时改也不行：它是受保护路径，留在工作区里会被拦停**
2. `scripts/mutation.ts`：临时副本不再复制 `.collie/`，改为复制 `templates/`（`test/evidence.test.ts` 改读模板之后不再需要本仓库的配置）。清单的 42 项不动。
3. 允许改写的旧用例只有下面几处，每一处都在「偏离或疑问」里列出用例名、原断言、现断言：
   `test/config.test.ts` 的 `config: the repository .collie/collie.toml` 一组（6 条）：断言的数值原样保留，一条不删、不放宽，只把对象从本仓库配置换成模板配置，组名相应改掉；`project` 那一条按 `templateConfig()` 填的固定值断言。
   `test/cli.test.ts` 的 `renders to exactly the SPEC 3.1 config the repository uses (no drift)`：改成「模板填上名字和仓库地址后能通过校验」，不再和本仓库配置比；`init derives the repo from an SSH origin…` 里的 `config.limits` 改成和模板配置的 `limits` 比。
   `test/reviewer.test.ts` 的 `launches role reviewer in root with the configured turns`：`maxTurns: 60` 改成取所用配置对象里的值。
   `test/invariants.test.ts` 加「`test/` 下的测试文件里，从仓库根加载配置的只有 `test/config.test.ts` 里的一处」。

本批次只改上面点名的 7 个测试文件、`test/support/template-config.ts`、`test/invariants.test.ts`、`scripts/mutation.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 改过的 7 个测试文件通过 | `npm test -- test/cli.test.ts test/config.test.ts test/evidence.test.ts test/reviewer-isolation.test.ts test/reviewer.test.ts test/runner-claude.test.ts test/worker.test.ts` | exit 0 |
| 取模板配置的函数存在，7 个文件都用上了 | `grep -qE "export function templateConfig" test/support/template-config.ts && grep -lE "templateConfig\(" test/*.test.ts \| grep -c . \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 从仓库根加载配置的只剩 config.test.ts 里的一处 | `grep -nE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/*.test.ts \| grep -v "^test/invariants.test.ts:" \| grep -c . \| grep -qx 1 && grep -qE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/config.test.ts` | exit 0 |
| 变异副本复制模板，不再复制 .collie（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" scripts/mutation.ts \| grep -qF "'.collie'" && grep -qF "'templates'" scripts/mutation.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qE "templateConfig\|template-config" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`，临时改也不行）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/` 下任何文件；改动 `test/support/sandbox.ts`
- 删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；把点名用例里断言的数值删掉或放宽；从变异清单里去掉任何一项
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v045-b18 运行器：失败的返回值一定带结束原因

优先级：65　依赖：v045-b15

v045-b15 之后，只有一条结果消息时返回值有 3 处和以前不同（操作员实测，R1 读代码确认，SPEC 14.21）。其中一处自相矛盾：成功的结果消息之后 SDK 抛错，退出码非 0 却没有结束原因。
规格见 SPEC 14.22（读这一节；三处的来历在 14.21）。

条目：
1. `src/runner/claude.ts` 的 `run`：SDK 抛错的分支里，汇总出来没有结束原因的，记 `error`（被软停的仍是 `stopped`，有 `error_max_turns` 的仍是 `turns_exhausted`）。
   另外两处是 v045-b15 带来、现在定为正确的行为，不改代码，只补测试：一条 `subtype: success` 但 `is_error: true` → 结束原因 `error`；成功但文本为空 → 不带 `finalText`。
   **做完之后：`run` 的任何返回值，只要退出码不是 0，就带结束原因**
2. `test/runner-claude.test.ts` 新加一组 `describe('runner-claude: failed runs always carry a stop reason', …)`，用文件里已有的假 SDK 写法：
   一条成功的结果消息之后抛错 → 退出码非 0、结束原因 `error`、花费与轮数照常带回、没有 `finalText`；
   两条成功的结果消息之后抛错 → 同上，轮数是合计；
   一条 `success` 但 `is_error: true` → 退出码非 0、结束原因 `error`、没有 `finalText`；
   一条成功、文本是空串 → 退出码 0、返回值里没有 `finalText` 这个键。
   已有用例一条都不改。R1 查过：现有用例里断言「没有结束原因」的只有两条，都是成功的情形（`two successful results…`、`three successful results…`），与本条不冲突；
   `two results then SDK throws…` 那一条没有断言结束原因。你发现还有别的用例与本条冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

本批次只改 `src/runner/claude.ts` 与 `test/runner-claude.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器的测试通过 | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 新的一组测试在 | `grep -qF "failed runs always carry a stop reason" test/runner-claude.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；改动传给 SDK 的参数
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b02 测试 agent 的角色模块：角色、配置段、提示词（不接进队列）

优先级：66　依赖：v046-b01

分工改造第 3 步的第一块（SPEC 第 16 章）。测试 agent（角色 R6）在 worker 之前把条目里的情形写成验收测试。这一批只做它的角色模块，不动队列。
规格见 SPEC 16.10 的「v046-b02 角色模块」一段（读 16.10；它的手册是仓库根的 `AGENT-tester.md`，整体流程在 16.2）。

条目：
1. 角色与配置：`src/runner/index.ts` 的 `AgentRole` 加 `'tester'`；`src/schema/index.ts` 的配置里 `agent.tester` 是可选的一段，结构与 reviewer 段相同（含 `bash_deny`）；
   `templates/collie.toml` 加 `[agent.tester]`：`model = "claude-opus-4-6"`、`allowed_tools = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]`、`max_turns = 100`、
   `permission_mode = "bypassPermissions"`、`bash_deny` 与 reviewer 段的两条相同。没有这一段的配置照常能加载（本仓库的 `.collie/collie.toml` 就没有，本批次不许动它）。
2. `src/runner/claude.ts`：角色是 `tester` 时用 `agent.tester` 的白名单与轮数；`bash_deny` 的拦截对 tester 同样生效；reviewer 专有的「禁用写工具」不套到 tester 上（它要写文件）；
   配置里没有这一段而被要求以 tester 运行 → 抛出一个点名 `[agent.tester]` 的错误。worker 与 reviewer 的行为不变。
   **tester 运行一条匹配 `bash_deny` 的命令（`git commit -m x`）被拦下，和 reviewer 被拦时是同一条路径；传给 SDK 的 tester 工具清单里有 `Write` 与 `Edit`**
3. 新文件 `src/roles/tester.ts`，导出：`TESTER_MANUAL`（值是 `'AGENT-tester.md'`）；`TesterInputSchema`（严格对象，只有 `batch_id`、`items`、`spec_paths`、`out_dir` 四个字段，多一个字段就拒绝）；
   `buildTesterPrompt(input)`（提示词里有：批次号；条目原文，一字不改；要读的 SPEC 路径；输出目录与三个文件名 `new.test.ts`、`keep.test.ts`、`MAP.md`；自检用的两条 `npx vitest run <输出目录>/…` 命令）；
   `runTester(runner, cfg, input, cwd)`（以角色 `tester`、`agent.tester` 的工具与轮数、`cwd` 下的 `AGENT-tester.md` 作系统提示词拉起；配置里没有这一段时抛出点名 `[agent.tester]` 的错误）。
   新文件 `test/tester.test.ts` 用 `FakeRunner` 覆盖上面每一点；`test/runner-claude.test.ts` 加条目 2 的用例；
   `test/config.test.ts`：模板配置一组里加一条「有 tester 段」，另加一条「没有 tester 段的配置能加载」。
   允许改写的旧用例只有一处：`test/config.test.ts` 的 `equals the inline SPEC 3.1 fixture used by the error tests` 所用的内联配置 `VALID_TOML`，要跟着模板加上 tester 段（断言本身不变）；在「偏离或疑问」里写明。
   R1 查过：`reports an unknown agent role` 用的是 `[agent.auditor]`，仍然应当被拒绝，不要改。
   `test/invariants.test.ts` 加「`src/roles/tester.ts` 的源码里不出现 `report.md`」（它在 worker 之前运行，和 worker 的产出无关）

本批次只改 `src/runner/index.ts`、`src/schema/index.ts`、`src/runner/claude.ts`、`src/roles/tester.ts`、`templates/collie.toml`、`test/tester.test.ts`、`test/runner-claude.test.ts`、`test/config.test.ts`、`test/invariants.test.ts`。
类型检查因为 `AgentRole` 多了一个值而要求改这之外的文件时，可以改，在「偏离或疑问」里逐个列出。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 角色模块、配置、运行器的测试通过 | `npm test -- test/tester.test.ts test/config.test.ts test/runner-claude.test.ts` | exit 0 |
| 角色模块的三个导出都在 | `grep -qE "export (async )?function runTester" src/roles/tester.ts && grep -qE "export function buildTesterPrompt" src/roles/tester.ts && grep -qE "export const TesterInputSchema" src/roles/tester.ts` | exit 0 |
| 角色模块的专项测试不少于 8 个 | `grep -cE "^\s+it(\.each)?\(" test/tester.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| 模板里有 tester 段，角色类型里有 tester | `grep -qE "^\[agent\.tester\]" templates/collie.toml && grep -qF "'tester'" src/runner/index.ts` | exit 0 |
| 不变量同步 | `grep -qE "roles/tester" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml` 与 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/roles/reviewer.ts`、`src/roles/worker.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把测试 agent 接进队列或加命令行子命令
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；改动 worker、reviewer 两个角色的任何行为
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b03 红检查：验收测试在没有实现时，新行为的全部失败、要保持的全部通过（不接进队列）

优先级：67　依赖：v046-b01

分工改造第 3 步的第二块（SPEC 第 16 章）。测试 agent 写完验收测试之后、worker 动手之前，要确认这些测试在现有代码上「新行为的全部失败、要保持的全部通过」。
这一批只做判定与执行两个函数，不动队列。规格见 SPEC 16.10 的「v046-b03 红检查」一段与判据那一条（读 16.10；vitest 的 JSON 报告在几种情形下的形状见 15.5）。

条目：
1. 新文件 `src/redcheck.ts`，导出 `judgeRedCheck(reports)`：输入是 `new.test.ts` 与 `keep.test.ts`（可以没有）各自的 vitest JSON 报告，输出 `{ ok, problems }`；
   `problems` 是原因清单，每条点名是哪个文件、哪条用例、为什么。判据：
   `new`：至少执行了一条用例，且每一条都失败；有通过的、跳过的、todo 的，或者文件加载不了（报告里一条用例都没有），都不过。
   `keep`：可以没有这个文件；有的话至少执行了一条且全部通过。
   它是纯函数：不起子进程、不读写文件。
2. 同一文件导出 `runRedCheck(tree, outDir, opts)`：在目录 `tree` 里对 `<outDir>/new.test.ts` 与（存在时）`<outDir>/keep.test.ts` 各跑一次 vitest，
   JSON 报告用 `--outputFile` 写到 `tree` 之外的系统临时目录（目录名以 `collie-redcheck-` 开头）、读完删掉（不带 `--outputFile` 时 vitest 会在当前目录建 `.vitest/`，SPEC 15.5）；
   `new.test.ts` 不存在算不过；超时算不过并写明是超时。超时的毫秒数与起子进程的函数都由调用方经 `opts` 传入，不在 `src/` 里写死数字。
   返回 `judgeRedCheck` 的结果，外加两个文件各执行了几条用例。
   **在一个临时目录里放真实的测试文件、用真实的 vitest 跑：`new` 里两条都失败 → 过；`new` 里一条失败一条通过 → 不过，原因里点名通过的那一条；**
   **`new` 一导入就报错 → 不过，原因写明文件加载失败；`new` 全失败而 `keep` 里有一条失败 → 不过，原因里点名那一条**
3. 新文件 `test/redcheck.test.ts`：`judgeRedCheck` 的每条判据各一条用例，喂报告样例（含跳过、todo、没有 `keep`、`keep` 一条用例都没有）；
   条目 2 加粗的四种情形各一条，必须用真实的 vitest 跑临时目录里的真实文件（临时目录建在系统临时目录下、名字以 `collie-redcheck-` 开头，把仓库的 `node_modules` 链进去，用完删掉；
   跑完系统临时目录里不留下任何 `collie-redcheck-*`，仓库里不出现 `.vitest/`）；超时一条，用注入的假子进程。
   `test/invariants.test.ts` 加「`src/redcheck.ts` 用了 `--outputFile`」

本批次只改 `src/redcheck.ts`、`test/redcheck.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 红检查的专项测试通过，仓库里没有留下报告 | `npm test -- test/redcheck.test.ts && ! test -e .vitest` | exit 0 |
| 专项测试不少于 12 个 | `grep -cE "^\s+it(\.each)?\(" test/redcheck.test.ts \| grep -qE "^(1[2-9]\|[2-9][0-9])$"` | exit 0 |
| 两个函数都导出了 | `grep -qE "export function judgeRedCheck" src/redcheck.ts && grep -qE "export (async )?function runRedCheck" src/redcheck.ts` | exit 0 |
| 专项测试不在系统临时目录留下东西 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qE "redcheck" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把红检查接进队列或加命令行子命令
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（本批次的测试可以起真实的 vitest 子进程，别的不行）；新增依赖

## v046-b04 条目的「情形」写法：backlog 解析情形与接口，测试 agent 只拿情形（不接进队列）

优先级：68　依赖：v046-b02

分工改造第 3 步（SPEC 第 16 章）。v046-b02 把写给 worker 的条目原文交给了测试 agent，操作员实测提示词后指出两者直接冲突。这一批定下条目里「情形」的写法，并让测试 agent 只拿情形。不动队列。

条目：
1. 读 SPEC 16.11 的「条目怎么写」一段。`src/backlog.ts` 与 `src/schema/index.ts`：批次小节里可选的两节，标签各占一行，写法与现有的 `条目` 标签相同（全角或半角冒号都认）。
   第一节的标签是 `情形`，内容是无序列表，每条 `- <编号> [新] <文字>` 或 `- <编号> [保持] <文字>`，编号是一个大写字母加数字，缩进的续行并进同一条（与条目的续行规则相同）；
   第二节的标签是 `接口`，内容是无序列表，自由文字。解析结果里多出 `scenarios`（每条有 `id`、`kind`（`new` 或 `keep`）、`text`）与 `interfaces`（字符串数组）。
   没有对应小节时，解析结果里不出现这个键。拒绝并报出行号的：编号重复；类别不是这两个；条目不符合上面的格式；有 `情形` 标签而一条都没有；一条 `[新]` 都没有；同一节出现两次。
   `collie show <批次>`：有情形时，在验收命令之后打印情形（编号、类别、文字）与接口。
   **一个带两条 `[新]`、一条 `[保持]`、两条接口的批次：解析出 3 条情形，编号、类别、文字都对；同一份 backlog 里不带这两节的批次，解析结果与现在逐字段相同，没有多出键**
2. 读 SPEC 16.11 的「测试 agent 拿到什么」一段。`src/roles/tester.ts`：`TesterInputSchema` 去掉 `items`，换成 `scenarios`（非空，至少一条 `new`）与 `interfaces`（可以为空数组），仍是严格对象，共五个字段。
   `buildTesterPrompt`：「情形」一节分「新行为」「必须保持」两组列出，编号与文字一字不改；「接口」一节逐条列出，为空时写「（未指定）」；通篇不出现「条目」二字。
   输出一节：`new.test.ts` 与 `MAP.md` 总是列出；`keep.test.ts` 与它的自检命令只在有 `keep` 情形时出现；自检命令的最后加 `npm run lint` 与 `npm run typecheck` 两行。
   **只有 `[新]` 情形时，提示词通篇不出现 `keep.test.ts`；有 `[保持]` 情形时，它和它的自检命令都在**
3. 测试。新用例放进点名的组里：`test/backlog.test.ts` 新加一组 `describe('backlog: scenarios and interfaces', …)`，含条目 1 加粗的情形、续行、两种冒号；
   `test/backlog-reject.test.ts` 新加一组 `describe('backlog: rejects malformed scenarios', …)`，条目 1 列的六种拒绝各一条，都断言报错里的行号；
   `test/cli.test.ts` 加一条 `show prints scenarios and interfaces when the batch has them`；
   `test/tester.test.ts` 新加一组 `describe('tester: scenarios in the prompt', …)`，含条目 2 加粗的两种情形、两组的先后、接口为空时的写法、自检命令里有 lint 与 typecheck 两行。
   R1 查过现有用例：`test/backlog.test.ts` 的 `matches the hand-written expectation including status` 用整对象比较，所以「没有小节时不出现这个键」必须成立，这一条不许改；
   `test/tester.test.ts` 里会被碰到的只有：夹具函数 `validInput`（`items` 换成 `scenarios` 与 `interfaces`）、`accepts a valid input with exactly four fields`（改成五个字段）、
   `includes items verbatim`（改成情形的文字一字不改）、`includes self-check vitest commands`（按有没有 `keep` 情形分开断言）。只许改写这四处，每处在「偏离或疑问」里列出原断言与现断言。
   你发现还有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/roles/tester.ts` 的非注释行里不出现 `items`」

本批次只改 `src/backlog.ts`、`src/schema/index.ts`、`src/cli.ts`、`src/roles/tester.ts`、`test/backlog.test.ts`、`test/backlog-reject.test.ts`、`test/cli.test.ts`、`test/tester.test.ts`、`test/invariants.test.ts`。
类型检查因为批次多了可选字段而要求改这之外的文件时，可以改，在「偏离或疑问」里逐个列出。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 解析、show、测试 agent 的测试通过 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` | exit 0 |
| 解析的两组新用例在 | `grep -qF "backlog: scenarios and interfaces" test/backlog.test.ts && grep -qF "backlog: rejects malformed scenarios" test/backlog-reject.test.ts` | exit 0 |
| show 与提示词的新用例在 | `grep -qF "show prints scenarios and interfaces when the batch has them" test/cli.test.ts && grep -qF "tester: scenarios in the prompt" test/tester.test.ts` | exit 0 |
| 测试 agent 不再拿条目（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/roles/tester.ts \| grep -qE "\bitems\b"` | exit 0 |
| 不变量同步 | `grep -qE "roles/tester.*items\|items.*roles/tester" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `docs/backlog.md`、`.collie/collie.toml`、`AGENT-tester.md`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把测试 agent 接进队列
- 改变不带这两节的批次的解析结果；为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b05 红检查加静态检查：只多了验收测试的树上 lint 与类型检查必须通过（不接进队列）

优先级：69　依赖：v046-b03

分工改造第 3 步（SPEC 第 16 章）。worker 改不了验收测试；带着格式错误或 lint 错误的验收测试一旦进了主工作区，批次就永远过不了。所以红检查要在它们进去之前多查一步。不动队列。

条目：
1. 读 SPEC 16.11 的「红检查加静态检查」一段（判据原文在 16.10）。`src/redcheck.ts`：`RunRedCheckOpts` 加可选的 `staticCommands`（字符串数组，每条是一条 shell 命令）。
   两个测试文件跑完之后，在 `tree` 里逐条执行（经注入的 `spawn`，以 `sh -c <命令>` 的形式，超时用同一个 `timeoutMs`）；退出码不是 0 的记一条问题：
   `file` 是 `'static'`，`testName` 是命令原文，`reason` 含退出码与输出的末 20 行；超时的同样记一条，写明是超时。测试的问题与静态检查的问题一起返回，`ok` 要两边都没有问题才是 true。
   不传 `staticCommands` 时，行为与返回值和现在完全一样。测试文件自己超时的，照旧直接返回，不再跑静态命令。
   **`new.test.ts` 两条都失败，静态命令是一条退出码 3、输出里有 `boom` 的命令 → 不过，问题里有这条命令的原文、`3` 与 `boom`；换成退出码 0 的命令 → 过**
2. 同一文件：`keep.test.ts` 存在而没有拿到它的报告（vitest 没有写出报告文件）时，记一条问题 `file` 为 `'keep'`、`reason` 是 `no report produced`，不再当成没有这个文件而放行。
   `judgeRedCheck` 不改：它的「`keepReport` 为 null 即没有 keep 文件」的约定留着，这一处在 `runRedCheck` 里判断。
3. `test/redcheck.test.ts` 新加一组 `describe('runRedCheck: static commands and missing reports', …)`：
   条目 1 加粗的两种情形（真实的 vitest 跑真实的文件，静态命令真实执行）；两条静态命令、第一条过第二条不过 → 只有第二条的问题；
   测试的问题与静态检查的问题同时存在 → 两类都在返回值里；静态命令超时（注入的假子进程）；不传 `staticCommands` → 一条静态命令都没执行；
   条目 2：`keep.test.ts` 存在、注入的假子进程不写报告 → 不过，原因是 `no report produced`。
   R1 查过现有用例：`passes when keep report is null (no keep file)` 是 `judgeRedCheck` 的用例，本批次不改 `judgeRedCheck`，它不受影响；
   `fails on timeout with injected fake spawn` 测的是测试文件超时，行为不变。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明。
   `test/invariants.test.ts` 加「`src/redcheck.ts` 里有 `staticCommands`」

本批次只改 `src/redcheck.ts`、`test/redcheck.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 红检查的测试通过，仓库里没有留下报告 | `npm test -- test/redcheck.test.ts && ! test -e .vitest` | exit 0 |
| 新的一组用例在 | `grep -qF "runRedCheck: static commands and missing reports" test/redcheck.test.ts` | exit 0 |
| 静态检查与缺报告两处都进了代码与测试 | `grep -qF "staticCommands" src/redcheck.ts && grep -qF "staticCommands" test/redcheck.test.ts && grep -qF "no report produced" src/redcheck.ts && grep -qF "no report produced" test/redcheck.test.ts` | exit 0 |
| 测试不在系统临时目录留下东西 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qF "staticCommands" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `judgeRedCheck` 的判据；改动 `src/run.ts`、`src/roles/`、`src/runner/`、`src/backlog.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把红检查接进队列
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（本批次的测试可以起真实的 vitest 子进程与真实的 `sh`，别的不行）；新增依赖

## v046-b06 情形与接口的列表允许空行；测试 agent 提示词两处小修（不接进队列）

优先级：70　依赖：v046-b04

操作员读代码并实测：情形列表里两条之间空一行，空行之后的情形被悄悄丢掉，不报错。另外，测试 agent 试跑时把整份 SPEC 读了一遍，汇报里的批次号也填错了。三处都是小修，不动队列。

条目：
1. 读 SPEC 14.24 里「操作员读代码查出来的」第一条与 16.12 的「v046-b06 小修」。`src/backlog.ts`：「情形」与「接口」两节的列表项之间允许空行。
   规则：空行跳过；符合格式的列表项接着算进同一个列表；紧跟在一条之后的缩进续行并进那一条（与现在相同）；遇到别的非空行（下一个标签、表格、说明文字）列表结束。
   「情形」一节里，空行之后出现一条不符合情形格式的无序列表项，报错并带那一行的行号（列表中间出现的本来就报错）。「条目」「额外禁止」两节的列表规则不动。
   **三条情形、每两条之间空一行：解析出 3 条，编号、类别、文字都对；两条情形之后空一行再跟一条 `- 这不是情形`：报错，行号是这一行；**
   **「接口」一节两条之间空一行：解析出 2 条**
2. 读 SPEC 14.24 里同一段的第二、三条。`src/roles/tester.ts` 的 `buildTesterPrompt`：
   小标题「需要自行阅读的 SPEC 章节」改成「可查阅的文件」，标题下加一句「情形里点名了小节号的，只读那一节；不要通读」，路径照旧逐条列出；
   「输出」一节加一句，写明汇报末尾 JSON 块里的 `batch_id` 填本批次的批次号（把批次号原样写出来）。
3. 测试。`test/backlog.test.ts` 新加一组 `describe('backlog: blank lines inside scenario and interface lists', …)`：条目 1 加粗的三种情形，外加「情形之后空一行再是 `接口` 标签 → 两节都解析对」；
   拒绝的那一条断言报错里的行号。`test/tester.test.ts` 新加一组 `describe('tester: prompt wording (v046-b06)', …)`：新小标题与那句话在、旧小标题不在；`batch_id` 那一句里有批次号。
   R1 查过现有用例：`test/tester.test.ts` 没有一条断言旧小标题的原文，`includes SPEC paths` 只断言路径字符串，不受影响；
   `test/backlog-reject.test.ts` 的 `rejects a scenario that does not match the expected format` 测的是列表中间的情形，行为不变；
   `test/backlog.test.ts` 的 `a batch without scenario/interface sections has no extra keys` 不受影响。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

本批次只改 `src/backlog.ts`、`src/roles/tester.ts`、`test/backlog.test.ts`、`test/tester.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 解析与提示词的测试通过 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/tester.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "backlog: blank lines inside scenario and interface lists" test/backlog.test.ts && grep -qF "tester: prompt wording (v046-b06)" test/tester.test.ts` | exit 0 |
| 旧小标题不在了（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/roles/tester.ts \| grep -qF "需要自行阅读的 SPEC 章节"` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `docs/backlog.md`、`AGENT-tester.md`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动「条目」「额外禁止」「验收标准」三节的解析；改变不带「情形」「接口」两节的批次的解析结果
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b07 配置加 tester_max 与静态检查命令、三个事件类型、test/acceptance 受保护（不接进队列）

优先级：71　依赖：v046-b05

分工改造第 3 步接线之前的铺垫（SPEC 第 16 章）：把接线要用到的配置项、事件类型和受保护路径先放好。这一批不调用测试 agent，不动队列的流程。

条目：
1. 读 SPEC 16.12 的「测试 agent 这一步怎么走」。`src/schema/index.ts` 与 `templates/collie.toml`：
   `[limits]` 加可选的 `tester_max`（正整数，缺省 2，缺省值的写法照 `grace_secs`）；`[verify]` 加可选的 `static`（非空字符串的数组；不写时解析结果里没有这个键）。
   模板里写上 `tester_max = 2` 与 `static = ["npm run lint", "npm run typecheck"]`，各带一行注释。本仓库的 `.collie/collie.toml` 不许动：它没有这两项，必须照常能加载。
   **没有这两项的配置能加载，`limits.tester_max` 是 2、`verify` 里没有 `static`；`tester_max = 0` 被拒绝，报错点名 `limits.tester_max`**
2. `src/schema/index.ts` 的事件类型加三个：`tester.started`、`tester.finished`、`redcheck.result`。这一批只加类型，不在任何地方记录它们。
3. `src/evidence.ts` 的受保护路径加 `test/acceptance`；`scripts/mutation.ts` 的清单加一项 `protected:test/acceptance`（写法照已有的 9 项），共 43 项。
   **worker 的提交在 `test/acceptance/` 下新增或改动一个文件：`spec_diff_lines` 大于 0**
   测试与允许改写的旧用例（只有下面四处，每处在「偏离或疑问」里列出原断言与现断言）：
   `test/config.test.ts` 的 `has the limits of SPEC 3.1`：期望对象里加 `tester_max: 2`；同一文件的内联配置 `VALID_TOML`：跟着模板加上 `static` 一行（`equals the inline SPEC 3.1 fixture…` 的断言本身不变）；
   `test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`：个数 37 改成 40，并加三条 `toContain`；
   `test/mutation.test.ts` 的 `every protected path is in the mutation list`：9 改成 10。
   R1 查过：`test/cli.test.ts` 里比较 `limits` 的那条两边都取自模板，不受影响；`test/mutation.test.ts` 的 `has at least 42 items` 用的是「不少于」，不用改；
   没有现有测试在沙箱仓库里往 `test/acceptance/` 写文件。你发现有别的现有用例因此失败，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   新用例：`test/config.test.ts` 新加一组 `describe('config: tester_max and verify.static', …)`，含条目 1 加粗的情形、模板里两项的值；
   `test/evidence.test.ts` 加一条 `counts test/acceptance as protected (SPEC 16.12)`。
   `test/invariants.test.ts` 加「`src/evidence.ts` 里有 `test/acceptance`」

本批次只改 `src/schema/index.ts`、`src/evidence.ts`、`scripts/mutation.ts`、`templates/collie.toml`、`test/config.test.ts`、`test/schema.test.ts`、`test/evidence.test.ts`、`test/mutation.test.ts`、`test/invariants.test.ts`。
不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 配置、事件、取证、变异清单的测试通过 | `npm test -- test/config.test.ts test/schema.test.ts test/evidence.test.ts test/mutation.test.ts` | exit 0 |
| 配置的新用例组与受保护路径的新用例在 | `grep -qF "config: tester_max and verify.static" test/config.test.ts && grep -qF "counts test/acceptance as protected (SPEC 16.12)" test/evidence.test.ts` | exit 0 |
| 模板里有两项，本仓库的配置没有被动 | `grep -qE "^tester_max = 2" templates/collie.toml && grep -qE "^static = " templates/collie.toml && ! grep -qE "tester_max\|^static = " .collie/collie.toml` | exit 0 |
| 变异清单是 43 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qx 43` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "test/acceptance" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/backlog.ts`、`src/view.ts`、`src/follow.ts`；在任何地方记录新加的三个事件；在仓库里建 `test/acceptance/` 目录
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；从变异清单里去掉任何一项
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b08 测试 agent 这一步的模块：拉起、红检查、重写、只取走点名的文件（不接进队列）

优先级：72　依赖：v046-b06, v046-b07

分工改造第 3 步接线之前的铺垫（SPEC 第 16 章）：把「拉起测试 agent → 红检查 → 不过就把原因交回重写 → 只取走点名的文件」做成一个依赖全部由调用方传入的函数。这一批不改 `src/run.ts`，不动队列。

条目：
1. 读 SPEC 16.12 的「测试 agent 这一步怎么走」前五条与「v046-b08」一段（红检查的接口在 `src/redcheck.ts`）。新文件 `src/acceptance.ts`，导出 `prepareAcceptance(opts)`：
   `opts` 有 `root`、`headSha`、`batch`、`config`、`runner`、`testerMax`、`redCheckOpts`，以及可选的 `record(事件名, 字段)` 与可选的 `redCheck`（缺省是 `runRedCheck`）。
   它在系统临时目录下建一个检出于 `headSha` 的 git worktree（目录名以 `collie-accept-` 开头；主仓库有 `node_modules` 就链进去），在里面最多拉起测试 agent `testerMax` 次：
   每次拉起之后做红检查；过了就结束；不过就把问题清单交给下一次。测试 agent 以非零退出的那一次不做红检查，直接算没过，原因写明退出码。
   过了之后只取走 `test/acceptance/<批次>/` 下的 `new.test.ts`、`MAP.md`，以及批次有 `[保持]` 情形时的 `keep.test.ts`；
   批次有 `[保持]` 情形而没有 `keep.test.ts`、或没有 `MAP.md`，算这一次没过。
   返回 `{ ok: true, attempts, files }`（每个文件有相对仓库根的 `path` 与 `content`）或 `{ ok: false, attempts, problems }`（字符串数组，最后一次的原因）。
   它不往 `root` 写任何东西、不提交；不论成败、是否抛错，结束时那个 worktree 都要拿掉。给了 `record` 时，每次拉起记 `tester.started` 与 `tester.finished`，每次红检查记 `redcheck.result`，字段见 SPEC 16.12「事件」一条。
   **第 1 次红检查不过、第 2 次过：测试 agent 一共被拉起 2 次，第 2 次的提示词里有第 1 次每一条问题的原文，返回 `ok` 为 true、`attempts` 为 2；**
   **`testerMax` 是 2 而两次都不过：测试 agent 恰好被拉起 2 次，返回 `ok` 为 false、`attempts` 为 2，`problems` 是第 2 次的原因；**
   **测试 agent 另外写了 `src/sneaky.ts` 和输出目录里的 `extra.ts`：返回的 `files` 里没有它们，主仓库 `git status --porcelain` 为空，`git worktree list` 只剩 1 行，系统临时目录里没有留下 `collie-accept-*`**
2. `src/roles/tester.ts`：`TesterInputSchema` 加可选的 `previous_problems`（非空字符串的数组）；非空时提示词在「情形」之前多一节「上一次没过的原因」，逐条原样列出，并写一句「只改有问题的地方，改完重新自检」。
   不给或为空数组时，提示词与现在逐字相同。
3. 新文件 `test/prepare-acceptance.test.ts`，三组：
   `describe('prepareAcceptance: retry loop', …)`：条目 1 前两处加粗的情形；测试 agent 非零退出的一次；`record` 收到的事件名与先后（两次都拉起时是 started、finished、result 各两条）。红检查用注入的假函数按次给结果。
   `describe('prepareAcceptance: what is taken from the tree', …)`：条目 1 第三处加粗的情形；有 `[保持]` 情形而没有 `keep.test.ts` → 没过；没有 `[保持]` 情形而测试 agent 写了 `keep.test.ts` → `files` 里没有它；没有 `MAP.md` → 没过；注入的红检查抛错 → 错误照常抛出，worktree 仍被拿掉。
   `describe('prepareAcceptance: real red check', …)`：一条，不注入 `redCheck`：`FakeRunner` 往工作目录里写一个真实的、两条用例都会失败的 `new.test.ts` 与一份 `MAP.md`，用真实的 `runRedCheck`（真实的 vitest，不带静态命令）→ `ok` 为 true。
   没有这一条，前两组什么也证明不了：它们的红检查是假的。
   做法：用 `Sandbox` 建仓库，自己往里提交一份 `AGENT-tester.md`；配置用 `templateConfig()`；测试 agent 用 `FakeRunner`（`files` 写进它拿到的工作目录）。不改 `test/support/sandbox.ts`。
   `test/tester.test.ts` 新加一组 `describe('tester: previous problems in the prompt', …)`：给了两条 → 两条原文都在、位置在「情形」之前；不给与给空数组 → 提示词与不带这个字段时逐字相同。
   R1 查过现有用例：`test/tester.test.ts` 的 `accepts a valid input with exactly five fields` 只断言能通过校验，多一个可选字段不影响它；`rejects an extra field (strict object)` 用的键是 `extra`，仍然应当被拒绝。
   已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `removeWorktree`」与「`src/run.ts` 的非注释行里没有 `acceptance.js`（还没有导入这个模块）」（后一条到接线那一批由那一批改掉）

本批次只改 `src/acceptance.ts`、`src/roles/tester.ts`、`test/prepare-acceptance.test.ts`、`test/tester.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 模块与提示词的测试通过，仓库里没有留下报告 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` | exit 0 |
| 模块的三组用例在 | `grep -qF "prepareAcceptance: retry loop" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: what is taken from the tree" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: real red check" test/prepare-acceptance.test.ts` | exit 0 |
| 提示词的新用例组在 | `grep -qF "tester: previous problems in the prompt" test/tester.test.ts` | exit 0 |
| 函数导出了，队列还没有用它（不看注释行） | `grep -qE "export (async )?function prepareAcceptance" src/acceptance.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 测试不在系统临时目录留下工作目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-tester.md`、`.collie/collie.toml`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/evidence.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`test/support/sandbox.ts`；把这个模块接进队列或加命令行子命令
- 让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送；让它取走点名之外的任何文件
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（「real red check」那一条可以起真实的 vitest 子进程，别的不行）；新增依赖

## v046-b09 测试只依赖自己带的环境：git 身份、私有临时目录、不绑本仓库配置；沙箱可留 journal

优先级：73　依赖：v046-b06, v046-b07

主分支的 CI 自 `777ce2a` 起是红的：v046-b08 新加的一条测试用到了机器的 git 全局身份，开发的机器有，CI 的机器没有。这一批把它修绿，并收掉另外两处同类的依赖。只改测试，不改 `src/`。

条目：
1. 读 SPEC 16.13 的第一段与 14.25 开头关于 CI 的那一段。`test/prepare-acceptance.test.ts`：文件里的每一次 `git commit` 都用测试自己设的身份，不用机器的全局配置
   （可以改用 `Sandbox`，也可以让辅助函数设的身份在整个用例期间有效；用完还原环境变量）。
   同一文件与 `test/redcheck.test.ts`：各自建一个私有的临时目录（在系统临时目录下），把 `process.env.TMPDIR` 指过去，结束时还原并删掉；
   「没有 `collie-accept-*` / `collie-redcheck-*` 残留」的断言只看这个私有目录。两个文件里别的断言不改。
   **没有任何 git 全局身份时（`GIT_CONFIG_GLOBAL` 指向一个空文件、`GIT_CONFIG_NOSYSTEM=1`），`test/prepare-acceptance.test.ts` 全部通过；**
   **系统临时目录里事先有别人的 `collie-accept-other` 与 `collie-redcheck-other` 两个目录时，这两个测试文件全部通过，跑完那两个目录还在**
2. `test/config.test.ts`：v046-b07 加的 `.collie/collie.toml loads without tester_max or verify.static` 断言的是本仓库配置里现在没有这两项，
   R1 之后要往本仓库配置里加它们。把这一条改成用内联配置（从 `VALID_TOML` 里去掉这两行）证明「没有这两项的配置能加载，`limits.tester_max` 是 2、`verify` 里没有 `static`」，不读本仓库的配置。
   `test/invariants.test.ts`：v046-b01 那条不变量旁边加一条，数出现的次数：`test/config.test.ts` 里从仓库根加载配置（`loadConfig(repoRoot)` 这一类）的恰好一处。
   允许改写的旧用例只有上面点名的这一条，在「偏离或疑问」里列出原断言与现断言。
   **做完之后的样子：往本仓库的 `.collie/collie.toml` 里加 `tester_max = 3` 与 `static = ["npm run lint"]`，`npm test` 仍然全过。这一条由操作员在仓库副本里验证，你不要改 `.collie/collie.toml`**
3. `test/support/sandbox.ts`：设了环境变量 `COLLIE_TEST_KEEP_RUNS=<目录>` 时，`dispose()` 在删除沙箱之前把沙箱仓库的 `.collie/runs/` 整个复制到 `<目录>/<沙箱目录名>/runs/`，
   并在 `<目录>/<沙箱目录名>/TEST_NAME` 里写下当前用例的全名（取不到就写空）。沙箱里没有 `.collie/runs/` 时只写 `TEST_NAME`。不设这个环境变量时行为与现在完全一样。复制出错不许让用例失败。
   新文件 `test/sandbox-keep.test.ts`，一组 `describe('sandbox: COLLIE_TEST_KEEP_RUNS', …)`：设了 → 用假 runner 跑一次 `run` 之后 `dispose()`，目标目录里有 `events.ndjson` 与 `TEST_NAME`；
   不设 → 什么也不留。用例自己设、自己还原这个环境变量，目标目录用完删掉。
   R1 查过：`test/support/sandbox.ts` 的 `dispose()` 现在只还原两个 git 环境变量并删除目录；没有现有用例断言 `dispose()` 之后沙箱外有什么。

本批次只改 `test/prepare-acceptance.test.ts`、`test/redcheck.test.ts`、`test/config.test.ts`、`test/invariants.test.ts`、`test/support/sandbox.ts`、`test/sandbox-keep.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 临时目录里有别人的同名前缀目录时，两个文件通过，别人的目录还在 | `d=$(mktemp -d) && mkdir "$d/collie-accept-other" "$d/collie-redcheck-other" && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts test/redcheck.test.ts && test -d "$d/collie-accept-other" && test -d "$d/collie-redcheck-other"` | exit 0 |
| config.test.ts 里从仓库根加载配置的恰好一处 | `grep -cE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/config.test.ts \| grep -qx 1` | exit 0 |
| 留 journal 的开关管用 | `d=$(mktemp -d) && COLLIE_TEST_KEEP_RUNS=$d npm test -- test/queue-limit.test.ts && find "$d" -name events.ndjson \| grep -q . && find "$d" -name TEST_NAME \| grep -q .` | exit 0 |
| 开关的用例组在 | `grep -qF "sandbox: COLLIE_TEST_KEEP_RUNS" test/sandbox-keep.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`；改动 `src/`、`scripts/`、`templates/` 下任何文件
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言（条目 1 里两处「没有残留」的断言只许改它看的目录）
- 在测试里改机器的 git 全局配置，或往仓库自己的 `.git/config` 里写身份
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b10 prepareAcceptance 收尾：带回测试 agent 的回复、类别标错不再重拉（不接进队列）

优先级：74　依赖：v046-b09

操作员用真实的运行器调了 `prepareAcceptance`：情形的类别标错时，测试 agent 照手册没有作弊、在汇报里请方案设计者改类别，但这句话调用方拿不到，第 2 次拉起也注定白跑。不动队列。

条目：
1. 读 SPEC 16.13 的「`prepareAcceptance` 的收尾」一段（流程在 16.12）。`src/acceptance.ts`：成功与失败两种返回值都加 `reports`（字符串数组，每次拉起的测试 agent 的最终回复原文，没有就是空串，按先后）；
   失败的返回值加 `reason`：`'red_check'`（红检查没过或缺文件）、`'tester_failed'`（最后一次是测试 agent 非零退出）、`'misclassified'`。
   红检查没过，而这一次测试 agent 最终回复的最后一个 JSON 围栏块里 `misclassified` 是非空数组时：不再拉起下一次，直接返回，`reason` 是 `'misclassified'`，`problems` 是这一次红检查的原因。
   最终回复里没有 JSON 块、解析不了、没有这个字段或是空数组，都按没有声明处理，照常重拉。红检查过了的，不看这个字段。
   **`testerMax` 是 2，第 1 次红检查没过且回复的 JSON 里 `misclassified` 列了一条：测试 agent 只被拉起 1 次，返回 `ok` 为 false、`attempts` 为 1、`reason` 为 `misclassified`，`reports` 有 1 条且就是那份回复；**
   **同样的红检查结果，但回复里没有 JSON 块：照常拉起第 2 次**
2. 同一文件：交给测试 agent 的要读的文件是 `SPEC.md` 与 `CONSTRAINTS.md` 两份；建工作目录的那一步失败时，已经建出来的目录与 git 里登记的 worktree 也要清理掉，错误照常抛出；
   测试 agent 以非零退出时，下一次拉起的「上一次没过的原因」里有一条写明上一次的退出码。
3. `test/prepare-acceptance.test.ts` 新加一组 `describe('prepareAcceptance: reports and early stop', …)`：条目 1 加粗的两种情形；`reports` 在成功时也有、条数等于拉起次数；
   三种 `reason` 各一条；JSON 里 `misclassified` 是空数组 → 照常重拉；非零退出之后第 2 次的提示词里有退出码；交给测试 agent 的提示词里两份文件都在；
   建工作目录失败（给一个不存在的 `headSha`）→ 抛错，`git worktree list` 只有 1 行，私有临时目录里没有 `collie-accept-*`。
   R1 查过现有用例：这个文件里的假测试 agent 返回的是 `{ exitCode: 0 }`，没有最终回复，所以现有的重拉用例（`first red check fails, second passes…`、`testerMax=2, both fail…`、`record receives events…`）不会被提前结束影响；
   现有用例对返回值都是逐个字段断言，多出两个字段不影响它们。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `misclassified`」

本批次只改 `src/acceptance.ts`、`test/prepare-acceptance.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时模块的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "prepareAcceptance: reports and early stop" test/prepare-acceptance.test.ts` | exit 0 |
| 两份要读的文件都给了（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "CONSTRAINTS.md"` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "misclassified" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/backlog.ts`、`src/schema/index.ts`、`src/evidence.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 按红检查的原因文字去猜类别标错（只看测试 agent 自己在 JSON 里的声明）；让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局身份；新增依赖

## v046-b11 R2 诊断信息：规则 9 重跑的 task 带 CI 链接；查裁定提交 CI 出异常时记事件

优先级：75　依赖：v046-b09

v046-b08 被规则 9 降级之后重跑了两次，task 里只有一句 `ci_conclusion=failure`，worker 不知道是哪次 CI 运行。另外，R2 查上一条裁定提交的 CI 时出了异常是悄悄吞掉的，一条偶发的测试失败因此无从查起。
这一批只加信息，不改任何判定。改 R2。

条目：
1. 读 SPEC 16.13 的「R2 的两处诊断信息」一段与 14.25 里关于后两次重跑的那一条。`src/run.ts`：上一次运行被规则 9 降级时，重跑的 task「降级原因」一节在规则与原因之后多两行，
   取自上一次运行 journal 里最后一条 `ci.resolved`：`- head_sha：<sha>` 与 `- CI 运行：<run_url>`（`run_url` 为空就不写这一行；没有 `ci.resolved` 就两行都不写）。别的规则降级时这一节不变。
   **上一次运行规则 9、`ci.resolved` 的 `conclusion` 是 `failure` 且带 `run_url`：重跑的 task 里有那个 `head_sha` 与那条链接**
2. `src/run.ts` 与 `src/schema/index.ts`：事件类型加 `ci.verdict_commit_error`。启动时查上一条裁定提交的 CI、取证之后复查，这两处捕获到异常时各记一条：
   `sha`、`when`（`startup` 或 `after_evidence`）、`error`（错误信息，限 500 字符）。别的行为不变：异常仍然不让这次运行失败，也不改它的结论与退出码。
   **启动时那次查询抛错：这次运行照常走完、结论与退出码和不抛错时相同，journal 里有 1 条 `ci.verdict_commit_error`、`when` 是 `startup`**
3. 测试。`test/queue-journal.test.ts` 加一条 `rule 9 FIX rerun task carries head_sha and CI run url`（条目 1 加粗的情形），再加一条 `run_url` 为空时没有「CI 运行」那一行；
   `test/verdict-ci-recheck.test.ts` 新加一组 `describe('verdict CI query errors are journaled', …)`：条目 2 加粗的情形；复查时抛错 → `when` 是 `after_evidence`，结论与退出码不变；两处都不抛错 → 没有这个事件。
   允许改写的旧用例只有一处：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`，个数 40 改成 41，并加一条 `toContain`；在「偏离或疑问」里写明。
   R1 查过：`test/queue-journal.test.ts` 的 `rule 9 FIX rerun task contains 降级原因 with rule and reason` 只断言含「降级原因」与「规则 9」，多两行不影响它；
   `test/verdict-ci-recheck.test.ts` 现有 8 条都没有让查询抛错，不会多出新事件。你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `ci.verdict_commit_error`」

本批次只改 `src/run.ts`、`src/schema/index.ts`、`test/queue-journal.test.ts`、`test/verdict-ci-recheck.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 队列日志、CI 复查、事件类型的测试通过 | `npm test -- test/queue-journal.test.ts test/verdict-ci-recheck.test.ts test/schema.test.ts` | exit 0 |
| task 带 CI 链接的用例在 | `grep -qF "rule 9 FIX rerun task carries head_sha and CI run url" test/queue-journal.test.ts` | exit 0 |
| 异常记事件的用例组在 | `grep -qF "verdict CI query errors are journaled" test/verdict-ci-recheck.test.ts` | exit 0 |
| 新事件进了类型清单与 R2（不看注释行） | `grep -qF "ci.verdict_commit_error" src/schema/index.ts && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "ci.verdict_commit_error"` | exit 0 |
| 不变量同步 | `grep -qF "ci.verdict_commit_error" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`src/follow.ts`；改动任何一条规则的判定、`fix_max` 的计数、重跑的条件
- 让 CI 查询的异常影响这次运行的结论或退出码
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局身份；新增依赖

## v046-b12 接线前的铺垫补齐：测试 agent 的事件与中止、类别标错清单；三处测试小修（不接进队列）

优先级：76　依赖：v046-b10

把测试 agent 接进队列之前，`src/acceptance.ts` 与 `src/roles/tester.ts` 还缺几样接线要用的东西；另有三处测试的小修。这一批不改 `src/run.ts`。

条目：
1. 读 SPEC 16.14 的「铺垫补齐」一段。`src/roles/tester.ts` 的 `runTester` 加第五个可选参数 `opts`：`signal`、`onEvent`、`redact`，原样交给运行器（写法照 `src/roles/reviewer.ts` 的 `runReviewer`）。
   `src/acceptance.ts` 的 `prepareAcceptance`：`opts` 加可选的 `signal`、`onTesterEvent(attempt, event)`、`redact`，交给 `runTester`；`signal` 已经中止时不再拉起下一次，按 `tester_failed` 结束。
   `tester.started` 的字段是 `attempt`、`model`、`max_turns`；`tester.finished` 的字段是 `attempt`、`exit_code`，以及运行器给了的 `num_turns`、`cost_usd`、`duration_ms`、`usage`
   （写法照 `src/run.ts` 里记 `reviewer.finished` 的那一段）；现在的 `exitCode` 改名为 `exit_code`。
   **假测试 agent 的返回值带 `numTurns: 7`、`costUsd: 0.5`：`tester.finished` 里有 `exit_code: 0`、`num_turns: 7`、`cost_usd: 0.5`，没有 `exitCode` 这个键；每次拉起的事件都经 `onTesterEvent` 送出，第一个参数是第几次**
2. 同一文件：类别标错的声明，数组里的每一项可以是字符串，也可以是 `{ id, why }`；失败的返回值加 `misclassified`（字符串数组：字符串原样，对象转成 `<id>：<why>`；没有声明时是空数组）。
   **回复的 JSON 里是 `"misclassified": [{ "id": "S1", "why": "已有行为" }]`：返回值的 `misclassified` 是 `['S1：已有行为']`，不出现 `[object Object]`**
3. 测试。新用例放进点名的组里：`test/prepare-acceptance.test.ts` 新加 `describe('prepareAcceptance: tester events, signal and misclassified list', …)`（条目 1、2 加粗的情形；`signal` 中止 → 不再重拉、`reason` 是 `tester_failed`；字符串写法照旧能用）；
   `test/tester.test.ts` 新加 `describe('tester: run options are forwarded', …)`。另有三处小修：
   甲、`test/redcheck.test.ts`：测试自己建的目录换一个不以 `collie-redcheck-` 开头的名字；每条用例结束、删除私有临时目录之前，断言里面没有 `collie-redcheck-*`。
   新加一组 `describe('runRedCheck: leaves nothing behind', …)`，至少一条：真实跑一次之后私有临时目录里没有 `collie-redcheck-*`。`test/prepare-acceptance.test.ts` 里被 v046-b09 删掉的那条残留检查同样补回（只看私有目录）。
   乙、`test/prepare-acceptance.test.ts` 的建仓库辅助函数：整个用例期间把 `GIT_CONFIG_GLOBAL` 换成自己写的文件、`GIT_CONFIG_NOSYSTEM` 设为 1，用完还原（照 `test/support/sandbox.ts` 的做法），不再读机器的全局 git 配置。
   丙、这两个文件里真实起 vitest 子进程的用例：交给 `runRedCheck` 的 `timeoutMs` 改成 240 秒（现在 `test/redcheck.test.ts` 里是 60 秒，`test/prepare-acceptance.test.ts` 里是 30 秒），用例自己的超时设成 300 秒（慢机器上一个子进程要 60 到 120 秒）。注入假子进程的用例不动。
   R1 查过现有用例：`record receives events in the right order for two attempts` 只断言事件名，改字段名不影响它；`misclassified in reply JSON → …` 用的是字符串写法，仍然应当通过。
   已有断言一条都不改、不删（甲是补回断言，丙只改时限的数值）；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `onTesterEvent`」

本批次只改 `src/acceptance.ts`、`src/roles/tester.ts`、`test/prepare-acceptance.test.ts`、`test/tester.test.ts`、`test/redcheck.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 三个文件的测试通过 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts test/redcheck.test.ts` | exit 0 |
| 全局 git 配置开了提交签名、没有身份时，模块的测试通过 | `e=$(mktemp) && printf '[commit]\n\tgpgsign = true\n[user]\n\tsigningkey = 0000000000000000\n' > "$e" && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` | exit 0 |
| 三组新用例在 | `grep -qF "prepareAcceptance: tester events, signal and misclassified list" test/prepare-acceptance.test.ts && grep -qF "tester: run options are forwarded" test/tester.test.ts && grep -qF "runRedCheck: leaves nothing behind" test/redcheck.test.ts` | exit 0 |
| 事件字段改了名（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "exit_code" && ! grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "exitCode: result.exitCode"` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "onTesterEvent" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/ladder.ts`、`src/evidence.ts`、`src/runner/`、`src/schema/index.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 为了让测试过而删除或跳过任何测试；改写或删去任何已有断言
- 在测试里改机器的 git 全局配置
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b13 活性指纹不占索引锁：R2 在 worker 工作期间不改写 .git/index

优先级：77　依赖：v046-b09

一条偶发的测试失败留下了 journal：沙箱里的假 worker 提交时报 `Unable to create '.git/index.lock': File exists`。worker 工作期间，R2 自己每 500 毫秒算一次活性指纹（`src/ladder.ts` 的 `computeFingerprint`：`git diff HEAD` 加 `git status`）。
R1 的推断（读代码得出，没有实跑）：`git diff HEAD` 在碰到时间戳变了、内容没变的文件时会顺手刷新索引，那一下要拿索引锁，`GIT_OPTIONAL_LOCKS=0` 管不住它。改 R2，只动指纹这一处。

条目：
1. 读 SPEC 14.26 里「偶发失败查到了直接原因」一段与 16.14 的「活性指纹不占索引锁」。**先写测试，再改代码**：新文件 `test/fingerprint-lock.test.ts`，一组 `describe('fingerprint: never rewrites the git index', …)`，用 `Sandbox` 建仓库：
   提交一个文件；把它的修改时间改到别的时刻、内容不变（让索引里的时间戳对不上）；记下 `.git/index` 的 inode 与修改时间；连调 5 次 `computeFingerprint`；断言 `.git/index` 的 inode 与修改时间都没变，过程中 `.git/index.lock` 没有出现过。
   **这条测试在现有代码上应该失败。它要是通过了，说明 R1 的推断不成立：停下，不要改 `src/ladder.ts`，在「偏离或疑问」里写明你看到的（包括你另外查到的、谁会占这把锁）**
2. `src/ladder.ts` 的 `computeFingerprint`：改成不创建 `.git/index.lock`、不改写 `.git/index` 的写法（比如给 `git diff` 关掉自动刷新索引，或者换成不刷新索引的底层命令；用哪种你定，在汇报里写明选了什么、为什么）。
   指纹仍然对内容敏感：被跟踪的文件内容变了，指纹必须变；HEAD 变了，指纹必须变；未跟踪的文件多了或变了，指纹必须变。只有时间戳变、内容没变时，指纹变不变都可以，在汇报里写明实际是哪一种。
3. 同一个测试文件再加三条，守条目 2 的三种「必须变」；`test/scenario-g.test.ts` 里已有的 `computeFingerprint: content-sensitive` 一组不许改，必须照常通过。
   R1 查过：现有测试里直接调 `computeFingerprint` 的只有 `test/scenario-g.test.ts` 那一组；别的测试经由 `LivenessMonitor` 间接用到它，或者注入了假的指纹函数。
   你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

本批次只改 `src/ladder.ts` 与 `test/fingerprint-lock.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 指纹的两组测试通过 | `npm test -- test/fingerprint-lock.test.ts test/scenario-g.test.ts` | exit 0 |
| 新的一组用例在，且用的是沙箱 | `grep -qF "fingerprint: never rewrites the git index" test/fingerprint-lock.test.ts && grep -qF "Sandbox" test/fingerprint-lock.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/git.ts`、`src/run.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/runner/`、`src/roles/`；改动活性检测的阈值、轮询间隔与判定（只改指纹怎么算）
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b14 R2 凭提交号认自己的提交：规则 2 不再按提交说明的开头跳过

优先级：78　依赖：v046-b11

R2 取证时数「受保护路径被改了多少行」，会跳过提交说明以 `docs: issue `、`progress: `、`report(collie): `、`ops: ` 开头的提交（`src/evidence.ts`）。
R1 读代码的推断（没有实跑）：worker 的提交只要用了这四种开头之一，它对 SPEC、backlog、验收测试的改动就不计入，规则 2 不会命中。验收测试靠规则 2 保护，接线之前要堵上。改 R2。

条目：
1. 读 SPEC 16.14 的「R2 凭提交号认自己的提交」一段。**先写测试，再改代码**：新文件 `test/r2-commits.test.ts`，第一组 `describe('rule 2 counts every commit that R2 did not make', …)`，用 `Sandbox` 与 `FakeRunner` 跑真实的 `run`：
   假 worker 的一个提交改了 `SPEC.md`，提交说明分别以四种开头之一起头（各一条）→ 结论是 BLOCK、规则 2；
   假 worker 用 `docs: issue v99-b01 task envelope` 这个说明提交了 `test/acceptance/v99-b01/new.test.ts` → BLOCK、规则 2。
   **这一组在现有代码上应该失败（结论不是规则 2）。它要是通过了，说明 R1 的推断不成立：停下，不要改 `src/`，在「偏离或疑问」里写明你看到的**
2. `src/run.ts`、`src/evidence.ts`、`src/schema/index.ts`：事件类型加 `r2.commit`（`sha`、`subject`）。R2 自己的每一次提交都经同一个辅助函数做「提交并记一条 `r2.commit`」；
   `src/run.ts` 里现在直接调 `commit(` 的 8 处都改用它，之后整个文件里直接调 `commit(root` 的只剩辅助函数里的一处。救援提交（`wip(collie):`）不经过它、不记这个事件。
   取证：受保护路径的改动行数对 `base_sha..head_sha` 里的每个提交都数，只跳过 `r2Shas` 里的提交；`r2Shas` 由 `src/run.ts` 从本机全部 journal 里收集：
   `r2.commit` 的 `sha`、`batch.task_written` 的 `commit`、`verdict.pushed` 与 `verdict.push_failed` 的 `sha`。提交说明以什么开头不再影响这个数。`commits_actual` 的列法不变。
   **同一个批次先 FIX 再 PASS：范围里有 R2 自己的裁定提交（它改了 `docs/progress.md`，是受保护路径），第 2 次的 `spec_diff_lines` 仍是 0、结论 PASS**
3. 同一个测试文件第二组 `describe('R2 own commits stay out of the count', …)`：条目 2 加粗的情形；规则 1 自动重跑、中断后自动重跑这两条路径各一条（重跑的那一次不被规则 2 拦）；
   一次运行结束后，`git log` 里 R2 的提交个数等于 journal 里 `r2.commit` 的条数；两次运行之间把 `.collie/runs/` 删掉 → 第 2 次被规则 2 拦下（记下这是已知的保守行为）。
   允许改写的旧用例只有一处：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`，个数 41 改成 42，并加一条 `toContain`；在「偏离或疑问」里写明。
   R1 查过：`test/evidence.test.ts` 没有用例手工造带这四种开头的提交再期望它被跳过；`test/invariants.test.ts` 的 `src/evidence.ts contains report(collie) in R2 commit prefixes (v03-b03-fix)` 仍然成立（开头的清单留着给 `commits_actual` 用）；
   FIX 重跑、规则 1 重跑、中断重跑的现有场景测试用的都是真实的 journal，应当照常通过。你发现有别的现有用例因此失败，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/run.ts` 的非注释行里直接调 `commit(root` 的恰好一处」与「`src/schema/index.ts` 里有 `r2.commit`」

本批次只改 `src/run.ts`、`src/evidence.ts`、`src/schema/index.ts`、`test/r2-commits.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 新测试与取证、事件类型的测试通过 | `npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts` | exit 0 |
| 两组用例在 | `grep -qF "rule 2 counts every commit that R2 did not make" test/r2-commits.test.ts && grep -qF "R2 own commits stay out of the count" test/r2-commits.test.ts` | exit 0 |
| R2 的提交都走同一处（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cE "\bcommit\(root" \| grep -qx 1` | exit 0 |
| 新事件进了类型清单 | `grep -qF "r2.commit" src/schema/index.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "r2.commit" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`scripts/mutation.ts`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/acceptance.ts`、`src/ladder.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`src/follow.ts`；改动受保护路径的清单、任何一条规则的判定、`commits_actual` 的列法
- 把救援提交记成 R2 的提交；让提交说明的开头继续影响受保护路径的计数
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b15 接线第一块：带情形的批次在写 task 信封之前先拉起测试 agent

优先级：79　依赖：v046-b12, v046-b14, v046-b16

分工改造第 3 步的接线（SPEC 第 16 章）：带「情形」的批次，R2 在写 task 信封之前先调 `prepareAcceptance`，过了就把验收测试和信封一起提交，没过就上报停下。不带情形的批次什么都不变。改 R2。

条目：
1. 读 SPEC 16.14 的「接线第一块」六条（`prepareAcceptance` 的参数与返回值在 `src/acceptance.ts`，流程的来历在 16.12）。`src/run.ts`：照那六条做。几处写明：
   配置检查在写 heartbeat 之前，报错走配置无效时的同一条路径（退出码 1）；`RunContext` 加可选的 `redCheck`（原样交给 `prepareAcceptance`，测试用）与 `testerSignal`（给了就用它代替内部的计时，做法照 `workerSignal`）；
   测试 agent 的事件流用 `appendStream` 写进 `tester.stream.ndjson`；信封提交与上报的裁定提交都经 v046-b14 的那个辅助函数（记 `r2.commit`）；
   上报时的说明文字写「上报：验收测试没有准备好 — <原因>」，不带「无 report」。
   `src/heartbeat.ts` 的阶段加 `tester`；`src/schema/index.ts` 与 `templates/collie.toml` 加 `limits.redcheck_secs`（正整数，可选，缺省 600，写法照 `tester_max`；模板里写 `redcheck_secs = 600` 带一行注释）。本仓库的 `.collie/collie.toml` 不许动。
   **带情形的批次、红检查一次就过：运行器被调用的先后是 tester、worker、reviewer；`docs: issue` 那一个提交里同时有 `task.md`、`new.test.ts`、`MAP.md`；journal 里 `tester.started`、`tester.finished`、`redcheck.result` 都在 `batch.task_written` 之前；这次运行的结论与不带情形时一样由 worker 与 reviewer 决定**
   **不带情形的批次：运行器只被调用 worker、reviewer 两次，journal 里没有 `tester.` 与 `redcheck.` 开头的事件，没有 `tester.stream.ndjson`**
2. 没过与越界的三种结局，都不拉起 worker 与 reviewer：
   红检查两次都不过 → 退出码 20，`escalated` 的原因以 `red_check_failed` 开头，`.collie/batches/<批次>/tester.md` 在裁定提交里，`--continue` 下批次记 `blocked`、队列以 `blocked` 结束；
   测试 agent 声明了类别标错 → 只拉起 1 次，原因以 `misclassified` 开头，`tester.md` 里有它的回复与声明的清单；
   测试 agent 往主工作区写了文件 → 原因以 `tester_touched_main_tree` 开头并列出那个文件，`git log` 里没有任何提交含验收测试或那个文件，那个文件还留在工作区里。
   另：`testerSignal` 中止 → 原因以 `tester_failed` 开头；配置里没有 `[agent.tester]` → 退出码 1，标准错误点名 `[agent.tester]`，没有新提交，批次状态不变；
   **同一个批次先 FIX 再 PASS：测试 agent 只在第 1 次被拉起，整个队列里运行器被调用的先后是 tester、worker、reviewer、worker、reviewer**
3. 新文件 `test/tester-step.test.ts`，用 `Sandbox`、`FakeRunner` 与注入的 `redCheck`（沙箱里的 backlog 自己写一个带情形的批次并提交；假测试 agent 在它拿到的工作目录里写文件），三组：
   `describe('tester step: runs before the task envelope', …)`（条目 1 加粗的两种情形）；
   `describe('tester step: failures stop the batch', …)`（条目 2 的五种结局各一条）；
   `describe('tester step: skipped when the tests are already in the tree', …)`（条目 2 加粗的情形；HEAD 的树里事先就有 `new.test.ts` 时一次也不拉起）。
   允许改写的旧用例只有下面四处，每处在「偏离或疑问」里列出原断言与现断言：
   `test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `redcheck_secs: 600`）与内联配置 `VALID_TOML`（跟着模板加一行）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这个字段，类型要求）；
   `test/invariants.test.ts` 的 `src/run.ts non-comment lines do not contain acceptance.js (v046-b08)`：改成断言 `src/run.ts` 引用了 `acceptance.js`，名字相应改掉。
   R1 查过：`test/heartbeat.test.ts` 没有钉死阶段的清单；`test/cli.test.ts` 比较 `limits` 的那条两边都取自模板；现有测试的沙箱 backlog 都不带情形，所以现有的场景测试都走不到新的一步。
   钉死完整清单的用例 R1 也查过：`test/exit-codes.test.ts` 的 `records the v0.1 event sequence in order` 跑的是不带情形的批次，它的事件序列一个都不许变；本批次不加事件类型，变异清单的项数不变。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 另加「`src/run.ts` 里有 `tester.stream.ndjson`」

本批次只改 `src/run.ts`、`src/heartbeat.ts`、`src/schema/index.ts`、`templates/collie.toml`、`test/tester-step.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。
类型检查因为 heartbeat 多了一个阶段而要求改这之外的文件时，可以改，在「偏离或疑问」里逐个列出。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线、配置、事件类型的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts test/heartbeat.test.ts` | exit 0 |
| 三组用例在 | `grep -qF "tester step: runs before the task envelope" test/tester-step.test.ts && grep -qF "tester step: failures stop the batch" test/tester-step.test.ts && grep -qF "tester step: skipped when the tests are already in the tree" test/tester-step.test.ts` | exit 0 |
| 队列用上了这个模块（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 模板里有新配置项，本仓库的配置没有被动 | `grep -qE "^redcheck_secs = 600" templates/collie.toml && ! grep -qE "redcheck_secs\|agent\.tester" .collie/collie.toml` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "tester.stream.ndjson" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-tester.md`、`AGENT-worker.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/backlog.ts`、`src/view.ts`、`src/follow.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 改变不带情形的批次的任何行为；在仓库里建 `test/acceptance/` 目录；替测试 agent 还原或删除它写到主工作区里的文件
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 vitest 子进程或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b16 prepareAcceptance 里运行器抛错的两种情形；两条空过的测试改实（不接进队列）

优先级：80　依赖：v046-b12

操作员读代码并实测：测试 agent 的一次运行中途被中止时，`prepareAcceptance` 直接抛出 `AbortError`，不按失败返回，也不记 `tester.finished`。接线（v046-b15）调的就是这个函数，先修。
另有两条 v046-b14 加的测试守不住自己的名字，一并改实。这一批不改 `src/run.ts`。

条目：
1. 读 SPEC 16.15 的「`prepareAcceptance` 里运行器抛错的两种情形」一段。`src/acceptance.ts`：照那四条做。顺手去掉没用的变量 `lastMisclassified`（没有声明类别标错时，失败返回值的 `misclassified` 仍是空数组）。
   **假测试 agent 在第 1 次运行中途让 `signal` 中止，`testerMax` 是 2：`prepareAcceptance` 不抛错，返回 `ok` 为 false、`attempts` 为 1、`reason` 为 `tester_failed`；运行器只被调用 1 次；**
   **`record` 收到 `tester.started` 与 `tester.finished` 各 1 条，后者带 `error`；私有临时目录里没有留下 `collie-accept-*`**
   **第 1 次运行器抛出普通错误（`signal` 没有中止）、第 2 次正常且红检查通过：返回 `ok` 为 true、`attempts` 为 2，第 2 次的提示词里有第 1 次的错误信息**
2. `test/prepare-acceptance.test.ts` 新加一组 `describe('prepareAcceptance: abort and runner errors', …)`：条目 1 加粗的两种情形；两次都抛普通错误 → `tester_failed`、`attempts` 为 2、`problems` 里有错误信息；
   `onTesterEvent` 在第 2 次拉起时第一个参数是 2（现在只测了第 1 次）。
   R1 查过现有用例：这个文件里没有一条让运行器抛错（假测试 agent 的场景都给的是返回值）；`signal aborted before next attempt → tester_failed, no second invocation` 用的是一开始就中止的信号，一次都不拉起，行为不变；
   `injected redCheck throws → …` 与 `addWorktree fails (bad headSha) → …` 两条仍然应当抛错；`record receives events in the right order for two attempts` 的两次都正常结束，事件序列不变。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里没有 `lastMisclassified`」
3. `test/r2-commits.test.ts` 的两条用例改实。这两条点名允许改写，在「偏离或疑问」里列出原断言与现断言：
   `interrupt auto-retry: second run is not blocked by R2 retry commit`：现在 worker 是崩溃、没有走到中断重跑，断言包在 `if` 里，空过。改成真的走到中断重跑
   （做法照 `test/scenario-n.test.ts` 的 `idle once → interrupt retry → PASS → queue continues (exit 0)`），去掉 `if`，断言：队列 journal 里有 `why` 为 `interrupt_retry` 的 `queue.batch_started`；重跑那一次的 `spec_diff_lines` 是 0、结论 PASS；退出码 0。
   `R2 commit count in git log equals r2.commit count in journal`：现在只断言大于 0。改成真的比较：`git log` 里提交说明以 `docs: issue ` 或 `progress: ` 开头的提交的 sha 集合，等于 journal 里 `r2.commit` 的 sha 集合。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/acceptance.ts`、`test/prepare-acceptance.test.ts`、`test/r2-commits.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时两个文件的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts test/r2-commits.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "prepareAcceptance: abort and runner errors" test/prepare-acceptance.test.ts` | exit 0 |
| 没用的变量去掉了 | `! grep -qF "lastMisclassified" src/acceptance.ts` | exit 0 |
| 中断重跑那条不再空过 | `grep -qF "interrupt_retry" test/r2-commits.test.ts && ! grep -qE "if \(passEvents\.length > 0\)" test/r2-commits.test.ts` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "lastMisclassified" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/roles/`、`src/runner/`、`src/schema/index.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 让红检查抛出的错误被吞掉；让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送
- 为了让测试过而删除或跳过任何测试；条目 3 点名的两条之外，删去或改松任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b17 接线收尾一：被跟踪文件不进提交、heartbeat 阶段改回、测试 agent 单独墙钟、放宽超时

优先级：81　依赖：v046-b15

（2026-11-20：本批次两次运行都因模型接口中断，没有完成；条目 1 与条目 3 还互相矛盾。已改签为 v046-b20，本批次保持 blocked，见 SPEC 14.30、16.17。）

接线第一块（v046-b15）跑起来之后，操作员在克隆里实测查出两处必须在带情形的批次正式跑之前修（SPEC 14.28）：测试 agent 改了主工作区里被跟踪的文件会被 R2 一起提交；worker 工作期间 heartbeat 的 `phase` 停在 `tester`。
再加测试 agent 单独的墙钟，并把两条高负载下会超时的用例放宽。改 R2，只动测试 agent 这一步相关的几处，不碰 worker / reviewer / 仲裁的判定。

条目：
1. 读 SPEC 16.16 的「v046-b17」一段与 14.28「b15 查出两处」。`src/run.ts`：上报原因是 `tester_touched_main_tree` 时，走上报路径之前先把主工作区恢复干净
   （在 `root` 里 `git checkout -- .` 再 `git clean -fd`，只在这一条路径上做），这样测试 agent 动过的被跟踪文件不会进 R2 的 `progress.md` / backlog 提交；被动过的文件名写进 `tester.md`（这条路径现在不写 `tester.md`，补上）。
   未跟踪的新文件照旧由「只提交点名路径」挡住。
   **假测试 agent 除了写验收测试还往主工作区被跟踪的 `docs/progress.md` 加一行：批次以 `tester_touched_main_tree` 上报、退出码 20；`git log` 里 R2 的提交都不含测试 agent 加的那一行；`tester.md` 列出了被动过的文件**
   同一处还有 heartbeat：测试 agent 这一步结束、拉起 worker 之前，`phase` 从 `tester` 改回 `worker`（worker 真正开始时本就有一处写 `worker`，现在的问题是它在测试 agent 之前；补一处即可）。
   **带情形的批次，worker 工作期间读 heartbeat，`phase` 是 `worker`，不是 `tester`**
2. `src/schema/index.ts` 与 `templates/collie.toml`：`[limits]` 加可选的 `worktree_secs`（正整数，缺省 1800，写法照 `tester_max`；模板写 `worktree_secs = 1800` 带一行注释）。
   测试 agent 这一步的墙钟（`src/run.ts` 里现在用 `wallclock_secs` 建的那个 `AbortSignal.timeout`）改用 `worktree_secs`。本仓库的 `.collie/collie.toml` 不许动。
   允许改写的旧用例只有：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `worktree_secs: 1800`）与内联 `VALID_TOML`；`test/schema.test.ts` 的夹具 `validConfig.limits`；每处在「偏离或疑问」里列出（这几处由本条点名）。
3. `test/queue-limit.test.ts`、`test/scenario-n.test.ts` 等真实跑多轮队列或真实起子进程的用例，`describe` / `it` 自带的超时从 120 秒放宽到 300 秒（只改数值，不改断言；慢机器高负载下 120 秒会到点）。
   `test/tester-step.test.ts` 新加一组 `describe('tester step: heartbeat and tracked-file safety', …)`：条目 1、2 加粗的情形；测试 agent 改未跟踪的新文件时照旧上报、文件留在工作区（和现有那条对比）。
   R1 查过现有用例：`test/view.test.ts` 的 `phase` 断言用的是不带情形的批次，不受影响；`tester step: failures stop the batch` 里 `tester writes to main workspace` 那条写的是未跟踪文件、只断言文件还在，本批次把它移进新组并补「被跟踪文件」的情形，原断言保留。
   已有断言除上面点名处外一条都不改；别的现有用例因为本批次的新行为而失败时的处理见下。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `worktree_secs`」
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`、`test/tester-step.test.ts`、`test/queue-limit.test.ts`、`test/scenario-n.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线那一步的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "tester step: heartbeat and tracked-file safety" test/tester-step.test.ts` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^worktree_secs = 1800" templates/collie.toml && ! grep -qE "worktree_secs" .collie/collie.toml` | exit 0 |
| 不变量同步 | `grep -qF "worktree_secs" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/backlog.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 把 `git checkout -- .` / `git clean` 用在 `tester_touched_main_tree` 以外的任何路径上；改变不带情形的批次的任何行为
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言（条目 4 只改超时数值）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b18 接线收尾二：带情形的 worker 任务书多出情形与接口两节、写明验收测试不能改

优先级：82　依赖：v046-b15, v046-b20

带情形的批次，worker 现在拿到的 `task.md` 没有情形与接口两节，也没写验收测试在哪、不能改（v046-b15 真跑时看到的）。这一批给任务书补上。只改任务书的文字，不改任何判定。

条目：
1. 读 SPEC 16.16 的「v046-b18」一段。`src/roles/worker.ts` 的 `renderBody`（或它的调用处）：批次有情形时，`task.md` 在「本批次条目」之后、「验收标准」之前多两节：
   「本批次情形」——每条 `- <编号> [新|保持] <文字>`，和给测试 agent 的情形逐字相同；「本批次接口」——有接口才出现，每条一行；并在「验收标准」里或紧接一句写明
   「`test/acceptance/<批次>/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）」。
   批次没有情形时，`task.md` 逐字不变。
   **一个带 2 情形、1 接口的批次：渲染出的 `task.md` 里有「本批次情形」两条、「本批次接口」一条，以及「验收测试……你不能改」那句；一个不带情形的批次：渲染结果和现在逐字节相同**
2. `test/task-envelope.test.ts`：新加一组或在「body」组里加用例，覆盖条目 1 加粗的两种情形（有情形、无情形逐字不变）；
   现有的 `has the SPEC 3.3 section order` 用的是不带情形的批次，断言的小节清单不变，本批次不许改它。
   `test/worker.test.ts` 的闭环用例用的批次不带情形，应当照常通过。
   R1 查过：`test/task-envelope.test.ts` 的 body 组逐条跑 backlog 里的真实批次，这些批次现在都不带情形，所以渲染结果不变、现有断言不受影响。
   已有断言一条都不改；别的现有用例因为本批次的新行为而失败时的处理见下。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/roles/worker.ts`、`test/task-envelope.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 任务书与 worker 的测试通过 | `npm test -- test/task-envelope.test.ts test/worker.test.ts` | exit 0 |
| 带情形时任务书有两节，不带情形时逐字不变——由新用例覆盖 | `grep -qE "本批次情形" src/roles/worker.ts && grep -qE "本批次接口" src/roles/worker.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/reviewer.ts`、`src/roles/tester.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/runner/`；改变不带情形的批次的任务书哪怕一个字节
- 在这一步校验情形、拉起谁、改任何判定
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b19 接线收尾三：why 与 report 显示测试 agent 的花费

优先级：83　依赖：v046-b18

测试 agent 这一步的轮数和花费现在只在 journal 里，`why` 与 `report` 看不到。这一批补上。只改显示，不改任何判定。

条目：
1. 读 SPEC 16.16 的「v046-b19」一段的第一条（第二条已由 R1 做完，见 16.17）。`src/view.ts`：`why <run_id>` 与 `report`（队列汇报）读本批次 journal 里的 `tester.started` / `tester.finished`，
   把测试 agent 的轮数、花费、用时显示出来，和 worker、reviewer 并列；一次运行里测试 agent 拉起多次时合计；没有 `tester.*` 事件的运行，不显示这一栏（输出和现在逐字节相同）。
   **一个有 `tester.finished`（带 `num_turns`、`cost_usd`、`duration_ms`）的运行：`why` 的输出里有测试 agent 的轮数与花费，`report` 那一行的合计花费把它算进去；一个没有 `tester.*` 的运行：`why` 与 `report` 的输出和现在逐字节相同**
2. `test/why.test.ts`、`test/report.test.ts`：条目 1 加粗的两种情形各加用例（有测试 agent；拉起两次时合计；无测试 agent 逐字不变）。
   R1 查过：这两个文件现有的用例里没有一条用到 `tester.*` 事件，所以「无测试 agent 逐字不变」成立时现有断言都不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/view.ts`、`test/why.test.ts`、`test/report.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| why 与 report 的测试通过 | `npm test -- test/why.test.ts test/report.test.ts` | exit 0 |
| 视图读了测试 agent 的事件，两份测试都覆盖到 | `grep -qF "tester.finished" src/view.ts && grep -qF "tester.finished" test/why.test.ts && grep -qF "tester.finished" test/report.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-*.md`、`.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/runner/`；改任何判定
- 改变没有测试 agent 的运行的 `why` / `report` 输出哪怕一个字节
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b20 v046-b17 改签：测试 agent 动过的被跟踪文件恢复原样、heartbeat 与墙钟补测试、放宽超时，把主分支修绿

优先级：84　依赖：v046-b15

v046-b17 两次运行都因模型接口中断，没有完成；它做了一半的改动随救援提交 `bbdf673` 上了主分支，其中一处是错的，**主分支的 CI 现在是红的**：
`test/tester-step.test.ts` 的 `tester writes to main workspace → escalated with tester_touched_main_tree` 失败（全量测试恰好这 1 条）。那一处错在 R1 的条目（让你 `git clean -fd`，又要未跟踪的文件留着）。
这一批接着做完，并把主分支修绿。改 R2，只动测试 agent 这一步相关的几处。

条目：
1. 先读 SPEC 16.17 与 14.30 里讲主分支 CI 的那一段，再 `git show bbdf673` 看主分支上已有的半成品。`src/run.ts` 的 `tester_touched_main_tree` 路径：去掉 `git checkout -- .` 与 `git clean -fd`，换成 16.17 的做法：
   测试 agent 动过的被跟踪文件（改了内容的、删掉的）恢复成 HEAD 的样子；未跟踪的文件一个都不动；不执行 `git clean`；`tester.md` 分两节列出「恢复了的被跟踪文件」与「留在工作区的未跟踪文件」（哪一节没有就写「无」）。
   **假测试 agent 往主工作区被跟踪的 `docs/progress.md` 加一行，又新建一个未跟踪的 `rogue.txt`：以 `tester_touched_main_tree` 上报、退出码 20；`git log -p` 里没有任何提交含它加的那一行；`rogue.txt` 还在工作区、不在任何提交里；`tester.md` 两节各列出对应的那个文件**
   **现有用例 `tester writes to main workspace → escalated with tester_touched_main_tree` 一个字都不改，重新通过**
2. 半成品里另外三处是对的，留着，核对一遍并补上测试：`limits.worktree_secs`（`src/schema/index.ts`、`templates/collie.toml`；`test/config.test.ts` 的期望对象与内联配置、`test/schema.test.ts` 的夹具已经在半成品里加了这一项，
   这几处是点名允许的改写，照常在「偏离或疑问」里列出）；测试 agent 这一步的墙钟用 `worktree_secs`；测试 agent 这一步结束之后 heartbeat 的 `phase` 改回 `worker`。本仓库的 `.collie/collie.toml` 不许动。
   **带情形的批次：假 worker 在它的场景里读 `.collie/heartbeat.json`，`phase` 是 `worker`；`worktree_secs = 0` 的配置被拒绝，报错点名 `limits.worktree_secs`；不写这一项的配置能加载，值是 1800**
3. 测试。`test/tester-step.test.ts` 新加一组 `describe('tester step: heartbeat and tracked-file safety', …)`：条目 1、2 加粗的情形（配置的两条放 `test/config.test.ts` 新加的一组 `describe('config: worktree_secs', …)` 里）；
   再加一条：测试 agent 只删掉了一个被跟踪的文件 → 那个文件被恢复，`tester.md` 列在「恢复了的被跟踪文件」里。
   `test/queue-limit.test.ts` 第 188 行与 `test/follow.test.ts` 第 121 行两处 `describe` 自带的超时 `120_000` 改成 `300_000`（只改这两个数值）。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `worktree_secs`」与「`src/run.ts` 的非注释行里没有 `'clean'`（不在主仓库里执行 `git clean`）」。
   R1 查过现有用例：`test/view.test.ts` 里断言 `phase` 的用例用的是不带情形的批次，不受影响；`test/tester-step.test.ts` 现有 9 条里只有上面点名的那一条现在是红的，别的不受影响；
   `src/run.ts` 的非注释行里现在只有半成品那一处用到 `'clean'`。已有断言除条目 2 点名处外一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`、`test/tester-step.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/queue-limit.test.ts`、`test/follow.test.ts`、`test/invariants.test.ts`。
不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线那一步与配置的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "tester step: heartbeat and tracked-file safety" test/tester-step.test.ts && grep -qF "config: worktree_secs" test/config.test.ts` | exit 0 |
| 不在主仓库里执行 git clean（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^worktree_secs = 1800" templates/collie.toml && ! grep -qE "worktree_secs" .collie/collie.toml` | exit 0 |
| 不变量同步 | `grep -qF "worktree_secs" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/backlog.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 在主仓库里执行 `git clean`，或用任何别的办法删除、移动测试 agent 留下的未跟踪文件；改变不带情形的批次的任何行为
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言（条目 3 的超时只改那两个数值）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b21 没有测试 agent 的运行，why 与 report 的 JSON 里不出现测试 agent 的键（第一个带情形的批次）

优先级：85　依赖：v046-b19

这是第一个按新流程走的批次（SPEC 16.18）：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b21/`，随 task 信封一起提交；worker 只写实现，不能改那个目录。
起因：v046-b19 之后，没有测试 agent 的运行，`why --json` 与 `report --json` 多出了值为 `null` 的新键，而那一批要求的是输出不变（SPEC 14.31）。

情形：
- S1 [新] 一次运行的 journal 里没有任何 `tester.` 开头的事件：`projectWhy` 得到的那个 attempt 对象没有 `tester` 这个键，它的 `cost` 对象也没有 `tester` 这个键；整个结果 `JSON.stringify` 之后不出现 `"tester":`
- S2 [新] 一个队列里每个批次的 journal 都没有任何 `tester.` 开头的事件：`projectReport` 得到的每一行 `batchRows` 都没有 `testerCost` 这个键；整个结果 `JSON.stringify` 之后不出现 `"testerCost":`
- K1 [保持] 一次运行的 journal 里有一条 `tester.finished`（`num_turns` 21、`cost_usd` 0.29、`duration_ms` 123000）：那个 attempt 的 `tester` 是 `turns` 21、`costUsd` 0.29、`durationMs` 123000、`invocations` 1，`cost.tester` 是 0.29；`formatWhy` 的文字里有以 `tester:` 开头的一行
- K2 [保持] 队列里一个批次的 journal 有一条 `tester.finished`（`cost_usd` 0.29）：`projectReport` 那一行的 `testerCost` 是 0.29；`formatReport` 的文字里有「tester 花费」这一列
- K3 [保持] 没有任何 `tester.` 开头事件的运行与队列：`formatWhy` 的文字里没有以 `tester:` 开头的行，`formatReport` 的文字里没有「tester 花费」

接口：
- `src/view.ts` 已有的导出，签名都不变：`loadRuns(root)`、`projectWhy(runDataList, batchId, filterAttempt?)`、`formatWhy(proj)`、`projectReport(allRunData, queueEvents, queueRunId)`、`formatReport(proj, whyTexts, showQueueText, queueRemainingText)`
- 类型 `RunData` 在 `src/view.ts`，`Event` 在 `src/schema/index.ts`；journal 是 `.collie/runs/<run_id>/events.ndjson`，一行一个事件

条目：
1. 读 SPEC 16.18 的「第一个带情形的批次」一段与 14.31 里「判 PASS 之后才查出来的三处」的第 1 条。`src/view.ts`：一次运行（或一个批次）的 journal 里没有 `tester.finished` 事件时，
   `projectWhy` 的 attempt 对象不带 `tester` 键、它的 `cost` 不带 `tester` 键，`projectReport` 的行不带 `testerCost` 键（类型上改成可选；不要输出值为 `null` 或 `undefined` 的占位）。
   有 `tester.finished` 时这三处与现在相同。`formatWhy`、`formatReport` 的文字输出一个字节都不变。
2. 现有用例里断言这三处是 `null` 的两条，改成断言键不存在。这是点名允许的改写，在「偏离或疑问」里列出原断言与现断言：
   `test/why.test.ts` 的 `no tester events: output identical to run without tester (tester field null)`（`a.tester` 与 `a.cost.tester` 两行；用例名里的 `tester field null` 相应改掉）；
   `test/report.test.ts` 的 `no tester events: output byte-identical (no tester column)`（`row.testerCost` 一行）。
   R1 查过：全部测试里断言这三个键为 `null` 的只有这三行；没有用例对 `cost` 或整行做整体的 `toEqual`。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/view.ts`、`test/why.test.ts`、`test/report.test.ts`。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，在「偏离或疑问」里写明是哪一条、错在哪。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b21` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/view.ts` 之外的 `src/` 文件；改变 `formatWhy`、`formatReport` 的文字输出；改变有测试 agent 时的 JSON
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b22 批次在队列里最终被拦时的收尾：撤销救援提交的改动、拿掉本批次的验收测试

优先级：86　依赖：v046-b20

所有者 2026-11-20 裁定 D12 选甲：救援提交会随之后的推送上主分支（v046-b17 的半成品让主分支红了一天）；批次在队列里最终被拦时，R2 自动把救援提交的改动撤掉。
同一处收尾还要把本批次的验收测试从树里拿掉（接线时留下没做的）。改 R2 的队列收尾，不改任何判定。

条目：
1. 读 SPEC 16.18 的「批次在队列里最终被拦时的收尾」一段（救援提交见 11.4）。`src/run.ts`：照那一段做，写成一个函数，在队列里两处调用：以 BLOCK 结束、规则 1 重跑与中断重跑都不适用（或已用过）、即将以 `blocked` 停下之前；超过 `fix_max`、即将以 `fix_max` 停下之前。
   提交经 `r2Commit`（记 `r2.commit`）。`src/schema/index.ts`：事件类型加 `batch.cleanup`、`batch.cleanup_failed`。单批次模式 `run <批次>` 不收尾。
   **队列里一个批次：第 1 次 worker 留下未提交的改动后被判空转（于是有救援提交），自动续跑的第 2 次又被判空转：队列以 `blocked` 结束，退出码 20；`git log` 最上面是 `progress: <批次> cleanup`，**
   **救援提交改过的文件恢复成开跑前的内容（`git diff <首次 base_sha> HEAD -- <那些文件>` 为空）；救援提交仍在历史里；journal 有 `batch.cleanup`，`reverted` 里是救援提交的 sha；这个提交记了 `r2.commit` 并推送了**
   **没有救援提交、树里也没有本批次验收测试的批次被拦：不多任何提交，journal 没有 `batch.cleanup`**
2. 同一个函数的另外几种情形：
   **带情形的批次超过 `fix_max`：收尾提交把 `test/acceptance/<批次>/` 从树里删掉（`removed_acceptance` 为 true）；worker 自己的代码提交一行不动**
   **撤销有冲突（救援提交之后，同一行又被 worker 后来的提交改过）：不留下半截的撤销，`git status --porcelain` 为空，记 `batch.cleanup_failed`；树里有本批次的验收测试时照样拿掉**
   **单批次模式 `run <批次>` 以 BLOCK 结束、有救援提交：不收尾，没有 `cleanup` 提交**
3. 新文件 `test/blocked-cleanup.test.ts`，用 `Sandbox` 与 `FakeRunner`，三组：
   `describe('blocked cleanup: rescue commits are reverted', …)`（条目 1 的情形；怎样让假 worker 被判空转，照 `test/scenario-n.test.ts` 的 `idle twice → exit 20 (BLOCK)`）；
   `describe('blocked cleanup: acceptance tests are removed', …)`（条目 2 第一条；带情形的沙箱批次、`[agent.tester]` 与注入的红检查照 `test/tester-step.test.ts`）；
   `describe('blocked cleanup: when it must not act', …)`（条目 2 后两条；以及队列以 `evidence_unavailable` 停下时不收尾）。
   允许改写的旧用例只有两处，在「偏离或疑问」里列出：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`（个数 42 改成 44，加两条 `toContain`）；
   `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)`（上限 6 改成 7，前提是新加的推送恰好一处）。
   R1 查过：队列以 `blocked` 或 `fix_max` 结束的现有用例在 `test/scenario-n.test.ts`（2 条）、`test/scenario-j.test.ts`、`test/scenario-m.test.ts`、`test/queue-limit.test.ts`、`test/r2-commits.test.ts`；
   其中假 worker 留下过未提交改动的，队列结束时会多出一个收尾提交和 `r2.commit`、`verdict.pushed`、`batch.cleanup` 三条事件。`test/r2-commits.test.ts` 比较提交 sha 集合的那一条，收尾提交以 `progress: ` 开头并记了 `r2.commit`，应当仍然相等。
   单批次模式的用例（`test/scenario-e.test.ts`、`test/scenario-i.test.ts`、`test/show.test.ts` 里有救援提交的那些）不应受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 另加「`src/run.ts` 里有 `batch.cleanup`」

本批次只改 `src/run.ts`、`src/schema/index.ts`、`test/blocked-cleanup.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | exit 0 |
| 三组用例在 | `grep -qF "blocked cleanup: rescue commits are reverted" test/blocked-cleanup.test.ts && grep -qF "blocked cleanup: acceptance tests are removed" test/blocked-cleanup.test.ts && grep -qF "blocked cleanup: when it must not act" test/blocked-cleanup.test.ts` | exit 0 |
| 两个事件进了类型清单 | `grep -qF "batch.cleanup_failed" src/schema/index.ts && grep -qE "'batch\.cleanup'" src/schema/index.ts` | exit 0 |
| 不在主仓库里执行 git clean（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | exit 0 |
| 不变量同步 | `grep -qF "batch.cleanup" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/cli.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 撤销 worker 自己提交的代码；改写或删除历史里的提交（不许 `reset`、`rebase`、强推）；在主仓库里执行 `git clean`，或删除、移动未跟踪的文件；在单批次模式里收尾
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b23 模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次

优先级：87　依赖：v046-b22

（2026-11-20：本批次因模型接口出错中断，没有完成，没有代码提交。R1 之后推了规格的改动，按 11.7 不能重跑；原样改签为 v046-b26，本批次保持 blocked，见 SPEC 14.32。）

所有者 2026-11-20 裁定 D11：worker 的会话因为模型接口出错而结束，算可续跑的中断。第十六、十九两次队列都因为它只跑了一批就停，其中一次 worker 的活已经做完、只差汇报。
改运行器与 R2 的队列，不改任何判定。

条目：
1. 读 SPEC 16.18 的「模型接口出错的会话算可续跑的中断」一段（中断后自动重跑见 13.14）。`src/runner/claude.ts` 与 `src/runner/index.ts`：读结果消息里的 `terminal_reason`；`RunResult.stopReason` 的取值加 `api_error`，
   先后是 `stopped` > `turns_exhausted` > `api_error` > `error`。
   **结果消息是 `subtype: success`、`is_error: true`、`terminal_reason: api_error`：返回值的 `exitCode` 非零、`stopReason` 是 `api_error`；同样的消息、会话是被中止的：`stopped`；出错而没有 `terminal_reason` 的消息：仍是 `error`**
2. `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`：`[limits]` 加可选的 `api_retry_wait_secs`（非负整数，缺省 300，写法照 `tester_max`；模板写 `api_retry_wait_secs = 300` 带一行注释）。本仓库的 `.collie/collie.toml` 不许动。
   队列里 `api_error` 与 `idling`、`stalled`、`wallclock` 一样算中断，共用每个批次每次队列一次的自动续跑；只有 `api_error` 在续跑之前先等 `api_retry_wait_secs`，`batch.retried` 多带 `waited_secs`。
   等待经可注入的函数做：`QueueContext` 加可选的 `retryDelay(ms)`（缺省真实等待），`src/cli.ts` 只做转发。v046-b22 的收尾仍在所有自动重跑的判断之后。
   **队列里 worker 第 1 次以 `api_error` 结束、没有 report：注入的等待函数收到 300000，然后自动重跑一次，`batch.retried` 是 `cause: interrupted`、`stop_reason: api_error`、`waited_secs: 300`；重跑 PASS：队列继续，退出码 0**
   **重跑又以 `api_error` 结束：不再重跑，队列以 `blocked` 结束，退出码 20；第 1 次是 `idling` 的重跑不等，等待函数没有被调用**
3. 测试。`test/runner-claude.test.ts` 新加一组 `describe('runner: api_error stop reason', …)`（条目 1 的三种情形）；新文件 `test/api-error-retry.test.ts`，一组 `describe('queue: api_error counts as a resumable interruption', …)`（条目 2 的情形；假 worker 的返回值直接给 `stopReason: 'api_error'`）。
   允许改写的旧用例只有：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `api_retry_wait_secs: 300`）与内联配置 `VALID_TOML`（跟着模板加一行）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这一项）。在「偏离或疑问」里列出。
   R1 查过：`test/runner-claude.test.ts` 现有 6 处断言 `stopReason` 是 `error` 的用例，夹具都不带 `terminal_reason`，不受影响；`test/scenario-n.test.ts` 的 `worker crash → no interrupt retry` 里 worker 是抛错，结束原因是 `error`，仍然不重跑；
   全部测试里现在没有一处用到 `terminal_reason` 或 `api_error`。测试要注入等待函数而 `test/support/sandbox.ts` 传不过去时，可以给它加转发，在「偏离或疑问」里写明。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `api_error`」

本批次只改 `src/runner/claude.ts`、`src/runner/index.ts`、`src/run.ts`、`src/schema/index.ts`、`src/cli.ts`、`templates/collie.toml`、`test/runner-claude.test.ts`、`test/api-error-retry.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`
（以及上面说的 `test/support/sandbox.ts`）。不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器、队列、配置的测试通过 | `npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "runner: api_error stop reason" test/runner-claude.test.ts && grep -qF "queue: api_error counts as a resumable interruption" test/api-error-retry.test.ts` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^api_retry_wait_secs = 300" templates/collie.toml && ! grep -qF "api_retry_wait_secs" .collie/collie.toml` | exit 0 |
| 运行器与队列都认得 api_error（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/runner/claude.ts \| grep -qF "api_error" && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "api_error"` | exit 0 |
| 不变量同步 | `grep -qF "api_error" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/ladder.ts`、`src/view.ts`；改动任何一条规则的判定、`fix_max` 的计数
- 让一个批次在一次队列里被自动续跑超过一次；让测试 agent 或 reviewer 的会话也走这条续跑；在测试里真的等待
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b24 小修：reviewer 读这一次运行的信封；两处守不住的测试改实

优先级：88　依赖：v046-b20

三处小修。第一处改 R2：重跑时 worker 要是没有新的代码提交，reviewer 读到的是上一次的任务书（SPEC 14.27）。后两处是 v046-b20 留下的、守不住的测试（SPEC 14.31）。

条目：
1. 读 SPEC 16.18 的「小修」一段。`src/run.ts` 给 reviewer 准备工作目录的地方（现在只留本批次的 `task.md`）：那份 `task.md` 换成主工作区里这一次运行的信封（`.collie/batches/<批次>/task.md`），不用 `head_sha` 的树里的。目录里仍然只有 `task.md`，别的批次的目录不动。
   **同一个批次第 1 次判 FIX，第 2 次 worker 没有新的代码提交、只重写了 report：第 2 次 reviewer 的工作目录里，`task.md` 的 frontmatter `attempt` 是 2，正文有「上一轮判 FIX」一节；目录里只有 `task.md`**
2. 测试。`test/reviewer-rerun.test.ts` 新加一组 `describe('reviewer-rerun: task.md comes from the current run', …)`（条目 1 的情形；怎样记下 reviewer 工作目录里的东西，照这个文件现有的做法）。
   `test/tester-step.test.ts` 的 `tester only deletes a tracked file → that file is restored, listed in tester.md`：它删的是 `docs/progress.md`，R2 上报时本来就会重写这个文件，所以恢复被撤掉它也通过。
   改成删 `SPEC.md`，并断言恢复之后的内容与 HEAD 上的相同。这是点名允许的改写，在「偏离或疑问」里列出。
   同一个文件新加一条 `tester wallclock uses worktree_secs`：沙箱配置里 `worktree_secs = 1`、`wallclock_secs` 不动、不注入 `testerSignal`，假测试 agent 一直等到中止信号才结束 → 以 `tester_failed` 上报，退出码 20。
   假测试 agent 的场景拿不到中止信号时，可以给 `src/runner/fake.ts` 的场景上下文加上它，在「偏离或疑问」里写明。
   `test/reviewer-rerun.test.ts` 的 `reviewer-rerun: FIX then PASS` 一组的 `beforeEach` 在慢机器上两次到了 120 秒的钩子超时（SPEC 14.31、14.32）：给这一组的 `describe` 加 `{ timeout: 300_000 }`（钩子跟着用例的时限走），新加的一组同样加上。只改时限。
   R1 查过：`test/reviewer-rerun.test.ts` 现有用例断言的是目录里只有 `task.md`、`task.md` 存在、别的批次的目录没有被动，不看 `task.md` 的内容，不受影响。已有断言除点名的那一条外都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/reviewer-rerun.test.ts`、`test/tester-step.test.ts`（以及上面说的 `src/runner/fake.ts`）。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个文件的测试通过 | `npm test -- test/reviewer-rerun.test.ts test/tester-step.test.ts` | exit 0 |
| 新的一组与新的一条在 | `grep -qF "reviewer-rerun: task.md comes from the current run" test/reviewer-rerun.test.ts && grep -qF "tester wallclock uses worktree_secs" test/tester-step.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/schema/index.ts`；改任何判定
- 让 reviewer 的工作目录里出现 `task.md` 之外的信封文件（`report.md`、`verdict.md`、`tester.md`）
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b25 收尾只提交自己改的路径：不提交未跟踪文件、冲突时只用 revert --abort

优先级：89　依赖：v046-b22

v046-b22 加的收尾（批次在队列里最终被拦时撤掉救援提交、拿掉验收测试）有两处问题，操作员实测、R1 读代码确认（SPEC 14.32）：它最后 `git add -A` 提交整个工作区，会把未跟踪的文件推上 `main`；冲突时用了 `git reset HEAD` 与 `git checkout .`，那条用例也守不住。
这一批只改 `batchCleanup`，不改它在什么时候被调用。

条目：
1. 读 SPEC 16.19（16.18 的收尾一段是背景）。`src/run.ts` 的 `batchCleanup`：只提交它自己改的路径（撤销了的救援提交改过的文件，与 `test/acceptance/<批次>/` 下被删的文件），经 `r2Commit` 传这些路径；
   去掉 `git add -A` 与提交 `.`；没有撤销任何救援提交、树里也没有本批次验收测试时，不提交、不推送、不记 `batch.cleanup`。
   **队列里一个带情形的批次以 `tester_touched_main_tree` 上报，主工作区留着测试 agent 新建的未跟踪 `rogue.txt`：没有 `cleanup` 提交，没有 `batch.cleanup` 事件；`rogue.txt` 还在工作区、不在任何提交里**
   **队列里假 worker 留下未提交的改动、两次被判空转（有救援提交），工作区里另有一个未跟踪的 `note.txt`：`cleanup` 提交只含救援提交改过的文件，`note.txt` 不在任何提交里、还在工作区**
2. 同一个函数的冲突处理：只执行 `git revert --abort`，不执行 `git reset`、`git checkout .`；放弃之后被跟踪的文件仍有改动时，记 `batch.cleanup_failed`（`reason: abort_left_changes`），什么都不提交；
   放弃干净了，记 `batch.cleanup_failed`（`reason` 以 `revert_conflict` 开头），树里有本批次验收测试时照常只提交删掉那个目录。
   **内容冲突（救援提交改了 `feature.txt` 的第 1 行，之后 worker 的提交又改了同一行）：没有任何提交里出现 `<<<<<<<`；`git status --porcelain` 里没有被跟踪文件的改动；journal 有 `batch.cleanup_failed`，`reason` 以 `revert_conflict` 开头**
3. 测试。`test/blocked-cleanup.test.ts` 新加一组 `describe('blocked cleanup: only its own paths', …)`：条目 1、2 加粗的三种情形（第一种照 `test/tester-step.test.ts` 让假测试 agent 写主工作区，第二、三种照这个文件第一组让假 worker 被判空转）。
   这个文件里现有的 6 条不改，都应当照常通过（R1 查过：它们的工作区里没有未跟踪文件，收尾提交里的路径不变）。
   `test/invariants.test.ts` 加两条：「`src/run.ts` 的非注释行里没有 `'reset'`」与「`src/run.ts` 的非注释行里 `['add', '-A']` 恰好一处（救援提交那一处）」。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/blocked-cleanup.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时收尾的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "blocked cleanup: only its own paths" test/blocked-cleanup.test.ts` | exit 0 |
| 不再 reset（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'reset'"` | exit 0 |
| `add -A` 只剩救援那一处（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cF "['add', '-A']" \| grep -qx 1` | exit 0 |
| 不变量同步 | `grep -qF "'reset'" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `batchCleanup` 被调用的位置与条件、任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件；改动 `src/` 下 `src/run.ts` 以外的文件
- 执行 `git reset`、`git clean`、`rebase`、强推；提交未跟踪文件；改写或删除历史里的提交
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b26 （v046-b23 改签）模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次

优先级：90　依赖：v046-b25

（v046-b23 因模型接口出错中断，没有完成，原样改签为本批次，见 SPEC 14.32、16.19。下面的条目、验收与额外禁止与 v046-b23 相同。）

所有者 2026-11-20 裁定 D11：worker 的会话因为模型接口出错而结束，算可续跑的中断。第十六、十九两次队列都因为它只跑了一批就停，其中一次 worker 的活已经做完、只差汇报。
改运行器与 R2 的队列，不改任何判定。

条目：
1. 读 SPEC 16.18 的「模型接口出错的会话算可续跑的中断」一段（中断后自动重跑见 13.14）。`src/runner/claude.ts` 与 `src/runner/index.ts`：读结果消息里的 `terminal_reason`；`RunResult.stopReason` 的取值加 `api_error`，
   先后是 `stopped` > `turns_exhausted` > `api_error` > `error`。
   **结果消息是 `subtype: success`、`is_error: true`、`terminal_reason: api_error`：返回值的 `exitCode` 非零、`stopReason` 是 `api_error`；同样的消息、会话是被中止的：`stopped`；出错而没有 `terminal_reason` 的消息：仍是 `error`**
2. `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`：`[limits]` 加可选的 `api_retry_wait_secs`（非负整数，缺省 300，写法照 `tester_max`；模板写 `api_retry_wait_secs = 300` 带一行注释）。本仓库的 `.collie/collie.toml` 不许动。
   队列里 `api_error` 与 `idling`、`stalled`、`wallclock` 一样算中断，共用每个批次每次队列一次的自动续跑；只有 `api_error` 在续跑之前先等 `api_retry_wait_secs`，`batch.retried` 多带 `waited_secs`。
   等待经可注入的函数做：`QueueContext` 加可选的 `retryDelay(ms)`（缺省真实等待），`src/cli.ts` 只做转发。v046-b22 的收尾仍在所有自动重跑的判断之后。
   **队列里 worker 第 1 次以 `api_error` 结束、没有 report：注入的等待函数收到 300000，然后自动重跑一次，`batch.retried` 是 `cause: interrupted`、`stop_reason: api_error`、`waited_secs: 300`；重跑 PASS：队列继续，退出码 0**
   **重跑又以 `api_error` 结束：不再重跑，队列以 `blocked` 结束，退出码 20；第 1 次是 `idling` 的重跑不等，等待函数没有被调用**
3. 测试。`test/runner-claude.test.ts` 新加一组 `describe('runner: api_error stop reason', …)`（条目 1 的三种情形）；新文件 `test/api-error-retry.test.ts`，一组 `describe('queue: api_error counts as a resumable interruption', …)`（条目 2 的情形；假 worker 的返回值直接给 `stopReason: 'api_error'`）。
   允许改写的旧用例只有：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `api_retry_wait_secs: 300`）与内联配置 `VALID_TOML`（跟着模板加一行）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这一项）。在「偏离或疑问」里列出。
   R1 查过：`test/runner-claude.test.ts` 现有 6 处断言 `stopReason` 是 `error` 的用例，夹具都不带 `terminal_reason`，不受影响；`test/scenario-n.test.ts` 的 `worker crash → no interrupt retry` 里 worker 是抛错，结束原因是 `error`，仍然不重跑；
   全部测试里现在没有一处用到 `terminal_reason` 或 `api_error`。测试要注入等待函数而 `test/support/sandbox.ts` 传不过去时，可以给它加转发，在「偏离或疑问」里写明。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `api_error`」

本批次只改 `src/runner/claude.ts`、`src/runner/index.ts`、`src/run.ts`、`src/schema/index.ts`、`src/cli.ts`、`templates/collie.toml`、`test/runner-claude.test.ts`、`test/api-error-retry.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`
（以及上面说的 `test/support/sandbox.ts`）。不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器、队列、配置的测试通过 | `npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "runner: api_error stop reason" test/runner-claude.test.ts && grep -qF "queue: api_error counts as a resumable interruption" test/api-error-retry.test.ts` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^api_retry_wait_secs = 300" templates/collie.toml && ! grep -qF "api_retry_wait_secs" .collie/collie.toml` | exit 0 |
| 运行器与队列都认得 api_error（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/runner/claude.ts \| grep -qF "api_error" && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "api_error"` | exit 0 |
| 不变量同步 | `grep -qF "api_error" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/ladder.ts`、`src/view.ts`；改动任何一条规则的判定、`fix_max` 的计数
- 让一个批次在一次队列里被自动续跑超过一次；让测试 agent 或 reviewer 的会话也走这条续跑；在测试里真的等待
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b27 开跑前检查：运行器退出码非零算不过，写出结束原因与用时

优先级：91　依赖：v046-b20

第二十二次队列开跑前，模型接口坏着：`preflight --smoke` 每次要 4 分钟，`runner` 一项写的是 `exitCode=1`，可这一项仍记 `ok`，整条命令退出码 0（SPEC 14.33）。
操作员是自己量用时、读那一行文字才拦下来的；`collie follow` 靠这条命令判断能不能开跑。改 `preflight` 与 `smoke` 两条命令对运行器结果的判断，不改队列。

条目：
1. 读 SPEC 14.33 的「开跑前检查的修补」一段（这条命令的来历在 14.1）。`src/preflight.ts` 的 `runner` 一项：运行器返回的退出码非零 → `ok` 为 false，`detail` 是 `exitCode=<N>`，返回值带 `stopReason` 时再加 ` stopReason=<原因>`；
   通过与不过的 `detail` 末尾都加 ` secs=<用时秒数，取整>`。用时经可注入的时钟算（缺省用真实时钟），测试里不许真的等。运行器抛错时照旧不过，`detail` 是错误信息。
   **假运行器返回 `exitCode: 1`、`stopReason: 'error'`：`preflight --smoke` 输出里有一行以 `FAIL runner: exitCode=1 stopReason=error` 开头，末行是 `preflight: failed (runner)`，命令的退出码非零；`--json` 里这一项的 `ok` 是 false**
   **假运行器返回 `exitCode: 0`：这一行以 `ok   runner: exitCode=0` 开头、带 `secs=`，命令的退出码是 0**
2. `src/cli.ts` 的 `collie smoke`：运行器返回的退出码非零 → 标准错误写 `smoke failed: exitCode=<N>`（有 `stopReason` 时带上），退出码 1，不再去查 CI，标准输出里没有 `smoke ok`。
   **假运行器返回 `exitCode: 1`：`collie smoke` 的退出码是 1，输出里有 `smoke failed: exitCode=1`、没有 `smoke ok`，CI 一次都没有被查询**
3. 测试。`test/preflight.test.ts` 新加一组 `describe('preflight: runner check judges the exit code', …)`（条目 1 的情形；`secs=` 用注入的时钟让它是一个确定的数）；`test/cli.test.ts` 新加一条 `smoke exits 1 when the runner returns a non-zero exit code`（条目 2 的情形）。
   R1 查过现有用例：`test/preflight.test.ts` 的 `--smoke adds runner and ci_query checks` 用的是 `exitCode: 0`，断言 `ok   runner`，仍然成立；`--smoke runner failure shows FAIL runner` 是运行器抛错，仍然成立；
   `test/cli.test.ts` 的 `smoke succeeds with a fake runner that returns a RunResult` 是 `exitCode: 0`，断言含 `smoke ok` 与 `exitCode=0`，仍然成立；`test/scenario-m.test.ts` 两条 `smoke exits 1 …` 的运行器都是成功的，不受影响；
   `test/follow.test.ts` 用假的子进程代替 `preflight`，不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/preflight.ts`、`src/cli.ts`、`test/preflight.test.ts`、`test/cli.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两条命令与用到它们的测试通过 | `npm test -- test/preflight.test.ts test/cli.test.ts test/scenario-m.test.ts test/follow.test.ts` | exit 0 |
| 新的一组与新的一条在 | `grep -qF "preflight: runner check judges the exit code" test/preflight.test.ts && grep -qF "smoke exits 1 when the runner returns a non-zero exit code" test/cli.test.ts` | exit 0 |
| 两条命令都有了不过的说法（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/cli.ts \| grep -qF "smoke failed" && grep -vE "^\s*(//\|\*\|/\*)" src/preflight.ts \| grep -qF "stopReason"` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/run.ts`、`src/follow.ts`、`src/runner/`、`src/schema/index.ts`；改动 `preflight` 别的检查项、不带 `--smoke` 时的行为、队列开头那次检查
- 给用时加阈值或新的配置项（这一批只把用时写出来）；在 `detail` 或输出里写出模型的回复全文、token 或文件的绝对路径
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；测试里真的等待；新增依赖

## v046-b28 测试改实：reviewer 信封、收尾的未跟踪文件与内容冲突三处造出真正的情形

优先级：92　依赖：v046-b25

v046-b24、b25 加的三处测试没有造出它们名字里说的情形，把修复撤掉照样全过（SPEC 14.34，操作员撤一次查出来的）。这一批只改测试，不改 `src/`。

条目：
1. 读 SPEC 14.34「判 PASS 之后才查出的测试缺口」与 16.20。`test/reviewer-rerun.test.ts` 的 `describe('reviewer-rerun: task.md comes from the current run', …)`：第 2 次 worker 改成**不提交任何代码**，只重写 `.collie/batches/<批次>/report.md` 并以 `report(collie): <批次>` 提交、推送，`head_sha` 仍写第 1 次的代码提交。
   这一组现有的 4 条断言不改，都应当照常通过。
   **把 `src/run.ts` 里「reviewer 的 `task.md` 用主工作区这一次的信封」那几行撤掉：这一组的 `attempt 2 reviewer sees task.md with attempt: 2 frontmatter` 必须失败**
2. `test/blocked-cleanup.test.ts` 的 `describe('blocked cleanup: only its own paths', …)` 里两条：
   `idle workers with note.txt → cleanup only commits rescue paths; note.txt stays`：去掉把 `note.txt` 放进 `.gitignore` 的做法，改成在救援之后、收尾之前的一个场景里（最后一个 reviewer 场景）往主工作区写一个真正未跟踪的 `note.txt`；
   `content conflict → revert_conflict; no merge markers; workspace clean`：改成真正的内容冲突，沙箱基准里先有 `feature.txt`（两行），救援提交改第 1 行，之后 worker 的提交又改同一行，`fix_max = 1`。
   两条用例名与现有断言不变，可以加断言。这两处是点名允许的改写，在「偏离或疑问」里列出改了什么。
   **把 `batchCleanup` 改回提交前 `git add -A`：`note.txt` 那条必须失败；把冲突处理里 `git revert --abort` 之后补上 `git checkout -- .` 与提交：`content conflict` 那条仍要守住「没有任何提交里出现 `<<<<<<<`」**
3. 不改 `src/`；不改 `test/invariants.test.ts`。R1 查过：这三条用例之外的现有用例不受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `test/reviewer-rerun.test.ts`、`test/blocked-cleanup.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个文件的测试通过 | `npm test -- test/reviewer-rerun.test.ts test/blocked-cleanup.test.ts` | exit 0 |
| 不再用 .gitignore 绕开未跟踪文件 | `! grep -qE "gitignore.*note\.txt\|note\.txt.*gitignore" test/blocked-cleanup.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `src/`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 用 `.gitignore`、改配置或跳过步骤的办法绕开要造的情形
- 为了让测试过而删除或跳过任何测试；删去或改松任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b29 同一个 head_sha 第二次被规则 9 降级就上报，不再自动重跑（D10）

优先级：93　依赖：v046-b26

所有者 2026-11-20 裁定 D10：同一个 `head_sha` 第二次被规则 9 降成 FIX 时，不再重跑，直接上报。现在照常重跑到 `fix_max`，v046-b08 因此白跑过两次（代码没变，CI 的结论不会变）。改 R2 的队列，不改仲裁。

条目：
1. 读 SPEC 16.20 的「v046-b29」一段（规则 9 见 12.3，超过 `fix_max` 的那条路与收尾见 16.18）。`src/run.ts` 的队列循环：批次判 FIX、降级规则是 9，而本批次此前（本机 journal 里）已有一次规则 9 降级、两次 `ci.resolved` 的 `head_sha` 相同：
   不再 `fix_retry`；记 `escalated`（`reason: rule9_same_head`、`batch_id`、`head_sha`），批次记 `blocked`，照超过 `fix_max` 那条路提交、推送、收尾，`queue.finished` 的 `reason` 是 `rule9_same_head`，退出码 20。
   `head_sha` 不同时照旧按 `fix_max` 计数重跑。以 `evidence_unavailable` 停下的判断仍在它之前。
   **队列里一个批次：第 1 次 CI 失败被规则 9 降成 FIX，自动重跑的第 2 次 worker 没有新提交、CI 仍失败：只重跑了一次，第 2 次之后队列以 `rule9_same_head` 停下，退出码 20，backlog 记 `blocked`，journal 有 `escalated`（`reason: rule9_same_head`，带 `head_sha`）**
   **同样两次规则 9，但第 2 次 worker 有新的代码提交（`head_sha` 不同）：照常第 3 次重跑（`fix_max` 是 2）**
2. `src/schema/index.ts` 不加新事件类型（复用 `escalated`）。允许改写的旧用例：`test/invariants.test.ts` 的 `every await push( …` 上限 7 改成 8，前提是新加的推送恰好一处（复用现有那条路就不用改）；在「偏离或疑问」里列出。
3. 新文件 `test/rule9-same-head.test.ts`，一组 `describe('queue: rule 9 twice on the same head_sha escalates', …)`：条目 1 的两种情形，再加一条：第 1 次规则 9 之后第 2 次 PASS → 照常放行、队列继续。
   CI 结论用注入的假 `fetch` 给（做法照 `test/scenario-l.test.ts` 的 `scenario L group c` 与 `test/verdict-ci-recheck.test.ts`）。
   R1 查过：`test/scenario-l.test.ts` 的 group c 是两个不同批次各一次规则 9（`rule9_twice`），不受影响；`test/queue-limit.test.ts`、`test/scenario-j.test.ts` 超过 `fix_max` 的用例里没有规则 9 降级，不受影响。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `rule9_same_head`」。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/rule9-same-head.test.ts`、`test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "queue: rule 9 twice on the same head_sha escalates" test/rule9-same-head.test.ts` | exit 0 |
| 队列认得这条原因（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "rule9_same_head"` | exit 0 |
| 不变量同步 | `grep -qF "rule9_same_head" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/roles/`、`src/runner/`、`src/schema/index.ts`；改动任何一条仲裁规则的判定、`rule9_twice` 的判断
- 在单批次模式里加这条判断；`head_sha` 不同时也停下
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b30 小修：rule9_same_head 只看这一次的 head_sha；api_error 续跑总带 waited_secs

优先级：94　依赖：v046-b29

v046-b29、b26 通过之后查出来的两处小问题（SPEC 14.35）。改 R2 的队列，不改仲裁。

条目：
1. 读 SPEC 16.21 的「v046-b30」一段与 14.35「查出来的两处」。`src/run.ts` 队列里 `rule9_same_head` 的判断：现在是「本批次历史上有某个 `head_sha` 被规则 9 降级过两次」，改成只看这一次——
   这一次运行的 `ci.resolved` 的 `head_sha`，等于本批次此前别的运行里被规则 9 降级那一次的 `head_sha`，才上报；`escalated` 的 `head_sha` 写这一次的。
   **一个批次在第一次队列里两次被规则 9 降级、`head_sha` 都是 A，以 `rule9_same_head` 停下。把 backlog 里它的状态格改回 pending 并提交，再跑一次队列：worker 这一次有新的代码提交（`head_sha` 是 B），CI 仍失败、被规则 9 降级 → 照常自动重跑，不上报；**
   **重跑时 worker 没有新提交、仍被规则 9 降级 → 以 `rule9_same_head` 停下，`escalated` 的 `head_sha` 是 B**
2. `src/run.ts`：`api_error` 的自动续跑，`batch.retried` 总带 `waited_secs`（`api_retry_wait_secs = 0` 时是 0）；别的中断原因仍不带这个字段。
   **沙箱配置里 `api_retry_wait_secs = 0`，worker 第 1 次以 `api_error` 结束：`batch.retried` 带 `waited_secs: 0`，然后照常重跑一次**
3. 测试。`test/rule9-same-head.test.ts` 加一条 `second queue with a new head_sha is retried, then escalates on its own repeat`（条目 1 的情形）；
   `test/api-error-retry.test.ts` 加一条 `api_error with api_retry_wait_secs = 0 still records waited_secs: 0`（条目 2 的情形）。
   R1 查过：`test/rule9-same-head.test.ts` 现有 3 条都在同一次队列里，结果不变；`test/api-error-retry.test.ts` 的 `idling first → retry does NOT wait, retryDelay never called` 断言 `idling` 的续跑不带 `waited_secs`，仍然成立。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/rule9-same-head.test.ts`、`test/api-error-retry.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时两个文件的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts test/api-error-retry.test.ts` | exit 0 |
| 两条新用例在 | `grep -qF "second queue with a new head_sha is retried, then escalates on its own repeat" test/rule9-same-head.test.ts && grep -qF "api_error with api_retry_wait_secs = 0 still records waited_secs: 0" test/api-error-retry.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/` 下 `src/run.ts` 以外的文件；改动任何一条仲裁规则的判定、`fix_max` 的计数、`rule9_twice` 的判断、收尾（`batchCleanup`）
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；测试里真的等待；用到机器的 git 全局配置；新增依赖

## v046-b31 CI、lint、测试配置列为受保护路径，变异清单加三项（第 16 章第 2 步）

优先级：95　依赖：v046-b29

分工改造第 2 步（SPEC 第 16 章，所有者 2026-11-17 裁定的原 D1）：`.github/`、`eslint.config.js`、`vitest.config.ts` 定义的是检查本身，worker 不能随手改（v045-b07 的 worker 改过 `eslint.config.js` 给自己的目录豁免规则）。
这一批把它们列为受保护路径。以后要改它们靠批次授权，那是下一批（v046-b32）。

条目：
1. 读 SPEC 16.21 的「v046-b31」一段。`src/evidence.ts` 的 `PROTECTED_PATHS` 加三项：`.github`、`eslint.config.js`、`vitest.config.ts`（写法照现有各项，每项一行）。
   **worker 的提交改了 `.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts` 当中任何一个：`spec_diff_lines` 大于 0（于是按规则 2 拦停）**
2. `scripts/mutation.ts` 的清单加三项 `protected:.github`、`protected:eslint.config.js`、`protected:vitest.config.ts`（写法照已有的 10 项），共 46 项；清单上方注释里的项数相应改掉。
3. 测试。`test/evidence.test.ts` 加一组 `it.each`，用例名 `counts %s as protected (SPEC 16.21)`，三个路径是 `.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts`；
   `test/mutation.test.ts` 的 `every protected path is in the mutation list`：10 改成 13（点名允许的改写，在「偏离或疑问」里列出）；
   `test/invariants.test.ts` 加一条，用例名 `src/evidence.ts has .github, eslint.config.js and vitest.config.ts in PROTECTED_PATHS (v046-b31)`。
   R1 查过：`test/mutation.test.ts` 的 `has at least 42 items` 用的是「不少于」，不用改；`test/prepare-acceptance.test.ts`、`test/redcheck.test.ts` 往自己的临时仓库里写 `vitest.config.ts`，不经过 R2 的取证，不受影响；
   没有现有测试让假 worker 的提交带上这三类文件再去取证。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/evidence.ts`、`scripts/mutation.ts`、`test/evidence.test.ts`、`test/mutation.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。
注意：你不能改 `.github/`、`eslint.config.js`、`vitest.config.ts` 这三处本身，只是把它们的名字加进清单。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 取证与变异清单的测试通过 | `npm test -- test/evidence.test.ts test/mutation.test.ts` | exit 0 |
| 三个路径进了清单，新用例在 | `grep -qF "'.github'," src/evidence.ts && grep -qF "'eslint.config.js'," src/evidence.ts && grep -qF "'vitest.config.ts'," src/evidence.ts && grep -qF "as protected (SPEC 16.21)" test/evidence.test.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "in PROTECTED_PATHS (v046-b31)" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/` 下 `src/evidence.ts` 以外的文件；改动任何一条仲裁规则的判定；从 `PROTECTED_PATHS` 里去掉或改写已有的项
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b32 批次授权：条目点名的受保护路径由 worker 改，不计入受保护文件改动行数（D9）

优先级：96　依赖：v046-b31

所有者 2026-11-20 裁定 D9：CI、lint、测试配置受保护之后，要改它们由 R1 在批次里点名授权、worker 来改，R2 对点名的路径不按规则 2 拦，别的照拦。这一批让 backlog、任务书和取证认得这种授权。不改仲裁规则本身。

条目：
1. 读 SPEC 16.21 的「v046-b32」一段。`src/backlog.ts`、`src/schema/index.ts`：批次可以多一个可选小节，标签是「可改的受保护路径」加冒号（全角半角都认，写法照 `LABEL_INTERFACES`），下面是 `- <路径>` 的列表（允许空行，照「接口」一节）；
   解析结果多一个可选字段 `allowed_protected`。能点名的只有 `.github`、`.github/` 下的路径、`eslint.config.js`、`vitest.config.ts`；别的一律报错并指出是哪一项。
   `src/roles/worker.ts`：有这一节时，`task.md` 在「本批次条目」之后多一节「本批次可改的受保护路径」，逐条列出，后面一句「只做条目要求的改动，并在『偏离或疑问』里列出改了什么」。
   **批次有这一节、两行是 `- vitest.config.ts` 与 `- .github/workflows/ci.yml`：`allowed_protected` 是这两项，`task.md` 里有「本批次可改的受保护路径」一节两条；**
   **点名 `SPEC.md`、`docs/backlog.md`、`test/acceptance/x.test.ts`、`.collie/collie.toml`、`../x`、`/etc/x`、`.github/*` 当中任何一个：解析报错，错误信息里有那一项；没有这一节的批次：没有 `allowed_protected` 这个键，`task.md` 逐字节不变**
2. `src/evidence.ts`、`src/run.ts`：取证时把本批次 `allowed_protected` 里的路径排除在受保护文件改动行数之外，这部分行数另记在 `evidence.collected` 事件的 `authorized_diff_lines`（批次没有授权时不带这个字段）。别的受保护路径照计。
   **批次授权了 `vitest.config.ts`，worker 的提交只改了它和普通源码：`spec_diff_lines` 是 0，`evidence.collected` 带 `authorized_diff_lines` 且大于 0，reviewer 判 PASS 时批次通过；**
   **同一个批次 worker 还改了 `eslint.config.js`（没有授权）：`spec_diff_lines` 大于 0，按规则 2 拦停；没有授权的批次改了 `vitest.config.ts`：按规则 2 拦停，`evidence.collected` 不带 `authorized_diff_lines`**
3. 测试。`test/backlog.test.ts` 新加一组 `describe('backlog: allowed protected paths', …)`（条目 1 的解析情形）；`test/task-envelope.test.ts` 加条目 1 里任务书的两种情形；
   新文件 `test/batch-authorisation.test.ts`，一组 `describe('batch authorisation: named protected paths do not count', …)`，用 `Sandbox` 与 `FakeRunner` 跑条目 2 的三种情形（沙箱 backlog 的写法照 `test/tester-step.test.ts` 里带「情形」的那种，自己拼小节）。
   `test/invariants.test.ts` 加「`src/backlog.ts` 里有 `可改的受保护路径`」与「`src/run.ts` 里有 `authorized_diff_lines`」。
   R1 查过：`docs/backlog.md` 现有的批次都没有这一节，`test/task-envelope.test.ts` 逐条跑真实批次的那两组不受影响；`evidence.collected` 只在有授权时多一个字段，`test/exit-codes.test.ts` 的事件序列不变；
   `BatchSchema` 加的是可选字段，现有夹具不用改。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/backlog.ts`、`src/schema/index.ts`、`src/roles/worker.ts`、`src/evidence.ts`、`src/run.ts`、`test/backlog.test.ts`、`test/task-envelope.test.ts`、`test/batch-authorisation.test.ts`、`test/invariants.test.ts`。
不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/batch-authorisation.test.ts` | exit 0 |
| 解析、任务书、取证的测试通过 | `npm test -- test/backlog.test.ts test/task-envelope.test.ts test/evidence.test.ts test/batch-authorisation.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "backlog: allowed protected paths" test/backlog.test.ts && grep -qF "batch authorisation: named protected paths do not count" test/batch-authorisation.test.ts` | exit 0 |
| 解析与取证都认得授权（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/backlog.ts \| grep -qF "可改的受保护路径" && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "authorized_diff_lines"` | exit 0 |
| 变异检查仍然全部被发现 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "authorized_diff_lines" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`、`scripts/mutation.ts`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/reviewer.ts`、`src/roles/tester.ts`、`src/runner/`；改动任何一条仲裁规则的判定；从 `PROTECTED_PATHS` 里去掉任何一项
- 让授权能点名那三类之外的路径；让授权来自 backlog 之外的任何地方（task、report、配置、环境变量）；有授权时把别的受保护路径也放过
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b33 测试时限提到 300 秒（第一个用批次授权的批次）

优先级：97　依赖：v046-b32

`vitest.config.ts` 里用例与钩子的时限现在都是 120 秒。R1 的机器比操作员的机器慢十几倍，那里有两个测试文件的 `beforeEach` 要 160 秒左右，全量测试 3 次里有 2 次因此到点（SPEC 14.35）。没有任何断言依赖这两个数。
`vitest.config.ts` 是受保护路径（v046-b31）；这一批用下面的授权小节点名它，你只许改这一个文件。

条目：
1. 读 SPEC 16.22 的第一段。`vitest.config.ts`：`testTimeout` 与 `hookTimeout` 都改成 `300_000`，那一行的注释相应改成说明现在的值与原因（慢机器上钩子要 160 秒左右；没有断言依赖这个值）。别的配置项不动。
   在「偏离或疑问」里列出你对这个文件做的每一处改动。

可改的受保护路径：
- vitest.config.ts

本批次只改 `vitest.config.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个时限都是 300 秒 | `grep -qE "testTimeout: 300_000" vitest.config.ts && grep -qE "hookTimeout: 300_000" vitest.config.ts` | exit 0 |

额外禁止：
- 改动授权小节点名之外的任何受保护路径（含 `.github/`、`eslint.config.js`）；改动 `vitest.config.ts` 里两个时限与那一行注释之外的任何内容
- 改动 `src/`、`test/`、`scripts/`、`templates/`、`package.json`
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增依赖

## v046-b34 授权路径的两处补全：报错信息的说法、带 .. 的写法有测试守着（带情形）

优先级：98　依赖：v046-b32

v046-b32 加了批次授权。操作员核对时查出两处（SPEC 14.36）：报错信息里把 `.github/*` 列成能点名的写法，可它正好拒绝字面上的 `.github/*`；`.github/../SPEC.md` 这类写法现在是拒绝的，但没有测试守着。
这一批按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b34/`，随 task 信封一起提交；你只写实现，不能改那个目录。

情形：
- S1 [新] 批次的授权小节点名 `SPEC.md`：`parseBacklog` 抛出 `BacklogError`，它的 `message` 里有 `only .github, paths under .github/, eslint.config.js, vitest.config.ts`，并且整条 `message` 里不出现 `.github/*`
- K1 [保持] 授权小节点名 `.github/../SPEC.md`：`parseBacklog` 抛出 `BacklogError`，`message` 里有 `.github/../SPEC.md`
- K2 [保持] 授权小节点名 `.github/workflows/../../docs/backlog.md`：`parseBacklog` 抛出 `BacklogError`
- K3 [保持] 授权小节点名 `/etc/x`、`../x`、`.github/*`、`.github/workflows/?.yml` 当中任何一个：`parseBacklog` 抛出 `BacklogError`，`message` 里有被点名的那一项
- K4 [保持] 授权小节依次点名 `.github`、`.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts`：不报错，那个批次的 `allowed_protected` 就是这四项、次序相同
- K5 [保持] 没有授权小节的批次：解析结果里没有 `allowed_protected` 这个键

接口：
- `src/backlog.ts` 已有的导出，签名不变：`parseBacklog(text: string, source?: string): Batch[]`、`class BacklogError extends Error`（有 `message`、`batchId`、`line`）
- 授权小节的标签是「可改的受保护路径」后面跟一个冒号、独占一行，下面每行一个 `- <路径>`（SPEC 16.21）；一份最小的 backlog 文本怎么拼，照 `test/backlog.test.ts` 里 `describe('backlog: allowed protected paths', …)` 一组用的辅助函数

条目：
1. 读 SPEC 16.21 的「v046-b32」一段与 14.36「判 PASS 之后才查出来的」第 2、3 条。`src/backlog.ts`：授权小节里点名了不许点名的路径时，报错信息末尾括号里的说法改成
   `(only .github, paths under .github/, eslint.config.js, vitest.config.ts)`。哪些路径能点名、哪些被拒绝，一概不变。
2. `src/evidence.ts` 第 103 行附近那条注释里的「受保護」改成「受保护」（只改这一个字）。
   R1 查过：`test/backlog.test.ts` 的 `rejects %s as not allowable` 一组只断言报错信息里有被点名的那一项，改说法不影响它；别的测试没有断言这句括号里的文字。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/backlog.ts`、`src/evidence.ts`。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，在「偏离或疑问」里写明是哪一条、错在哪。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b34` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/backlog.ts`、`src/evidence.ts` 之外的 `src/` 文件；改变哪些路径能被授权；改动 `src/evidence.ts` 里那一个字之外的任何内容
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b35 没过的验收命令留下输出的末尾：进运行日志与重跑的任务书（带情形）

优先级：99　依赖：v046-b34

变异检查现在每次取证都跑。它没过时，R2 只在 `docs/progress.md` 里留输出的最后一行，`acceptance.failed` 事件与重跑的 task 里只有命令和退出码：哪一项没被发现，worker 要自己重跑才知道（SPEC 14.37）。
这一批让没过的验收命令把输出的末尾留下来。按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b35/`；你只写实现，不能改那个目录。

情形：
- S1 [新] `renderFixSection` 拿到的 `failedAcceptance` 里有一项是 `cmd` 为 `sh noisy.sh`、`exit_code` 为 1、`output_tail` 为两行文字 `line A` 与 `line B`：返回的文字里，`sh noisy.sh` 那一行之后有一个围栏代码块，块里依次是 `line A`、`line B` 两行
- S2 [新] 沙箱的全局验收命令里多一条 `sh noisy.sh`，它依次打印 `out 1` 到 `out 30` 共 30 行后以 1 退出；假 worker 如实提交、假 reviewer 判 PASS，跑一次：journal 里 `cmd` 为 `sh noisy.sh` 的 `acceptance.failed` 事件带 `output_tail`，按行拆开恰好 20 行，第一行是 `out 11`，最后一行是 `out 30`
- S3 [新] 同样的沙箱，`noisy.sh` 改成先打印一行 500 个 `x` 再以 1 退出：`output_tail` 里那一行恰好是 300 个 `x`
- S4 [新] 同样的沙箱，测试里把环境变量 `GITHUB_TOKEN` 设成 `tok-secret-12345`（用完还原），`noisy.sh` 打印一行 `token=tok-secret-12345` 后以 1 退出：`output_tail` 恰好是一行 `token=***`
- S5 [新] 接着 S2 那一次（结论是 FIX）再跑一次，第 2 次的假 worker 把它拿到的 `task.md` 读出来：`task.md` 里有单独成行的 `out 11`，也有单独成行的 `out 30`
- K1 [保持] `renderFixSection` 拿到的 `failedAcceptance` 里那一项不带 `output_tail`：返回的文字里有一行 ``- `sh noisy.sh` → exit 1``，并且「未通过的验收命令」那一节里没有围栏代码块
- K2 [保持] S2 那一次运行里，`acceptance.failed` 事件的 `cmd`、`exit_code`、`expect` 三个字段照旧都在；结论是 FIX、规则 8，退出码 10
- K3 [保持] 全局验收命令都通过的一次运行：journal 里没有 `acceptance.failed` 事件

接口：
- `src/run.ts` 已有的导出：`renderFixSection(info: FixInfo): string` 与类型 `FixInfo`。`FixInfo.failedAcceptance` 每一项现在是 `{ cmd, exit_code }`，本批次起多一个可选的 `output_tail?: string`（多行文字，用换行分隔）；实现之前类型上还没有它
- `acceptance.failed` 事件本批次起多一个字段 `output_tail`（字符串）；读事件用 `Sandbox` 的 `events()`
- 沙箱、假 worker、假 reviewer 怎么搭，照 `test/scenario-d.test.ts`（它就是「worker 如实、验收命令没过、reviewer 判 PASS」）与 `test/support/sandbox.ts` 导出的 `Sandbox`、`workerScene`、`fooledReviewerScene`、`honestClaims`、`TEST_CMD`；
  往全局验收命令里加一条的办法：改写沙箱里 `.collie/collie.toml` 的 `commands` 一行并提交，`noisy.sh` 写在沙箱仓库根并提交；第 2 次运行里读 `task.md` 的假 worker 自己写一个场景

条目：
1. 读 SPEC 16.23 的「没过的验收命令留下输出的末尾」一段。`src/run.ts`：记 `acceptance.failed` 的地方带上 `output_tail`；从上一次运行的 journal 重建 `failedAcceptance` 的地方把它取出来；`renderFixSection` 把它渲染成那条命令下面的围栏代码块。
   取多少行、每行截到多少字符写成具名常量（20、300）；脱敏用这次运行已有的那份清单，替换成 `***`；命令没有输出时不带这个字段。
2. 不许变的：`acceptance.failed` 原有的三个字段；`docs/progress.md` 里每条命令的摘要；`why` 与 `report` 的输出；命令通过时不记事件；事件类型的个数。
   R1 查过：`test/scenario-d.test.ts` 对 `acceptance.failed` 的断言用的是 `objectContaining`，多一个字段不影响；`test/scenario-n.test.ts`、`test/why.test.ts` 里涉及这个事件的用例不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`（确有需要时加 `src/verify.ts`，在「偏离或疑问」里写明为什么）。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，在「偏离或疑问」里写明是哪一条、错在哪。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b35` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/progress.ts`、`src/schema/index.ts`、`src/roles/`、`src/runner/`；改任何一条规则的判定
- 把整段输出不截断、不脱敏地写进 journal 或 task
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b36 worker 认为验收测试写错了：汇报里声明，R2 不拉审核、不计返工、上报停下（带情形）

优先级：100　依赖：v046-b34

分工改造第 4 步（SPEC 第 16 章）：验收测试是测试 agent 写的，worker 改不了。worker 认为某条验收测试和情形对不上时，现在只能在汇报里写一句，批次照常被判验收没过、返工到上限才停。
这一批给它一条正路：在汇报的 JSON 里声明，R2 就不拉审核、不计返工，直接上报停下，等 R1 裁定。按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b36/`；你只写实现，不能改那个目录。

情形：
- S1 [新] `ReportSchema` 解析一份别的字段都合法、另带 `disputed_tests` 的汇报，`disputed_tests` 是只有一项的数组，那一项的 `test` 为 `test/acceptance/v99-b01/new.test.ts: S1: x`、`why` 为 `情形要的是 A，测试断言的是 B`：解析成功，结果里这一项原样在
- S2 [新] 单批次运行（`run <批次>`），假 worker 照常提交代码与汇报，汇报的 JSON 里 `disputed_tests` 有 S1 的那一项，脚本里只给了 worker 一个场景：journal 里 `escalated` 事件的 `reason` 以 `acceptance_disputed: ` 开头并含 `S1: x`，它的 `disputed` 等于汇报里那个数组；`docs/progress.md` 里有「worker 认为验收测试有错」
- S3 [新] 汇报的 JSON 里 `disputed_tests` 是空数组，假 worker 如实、验收全过、假 reviewer 判 PASS：运行器被调用的先后是 worker、reviewer，退出码 0
- K1 [保持] 汇报的 JSON 里没有 `disputed_tests` 这个键，其余同 S3：运行器被调用的先后是 worker、reviewer，退出码 0，journal 里没有 `escalated`
- K2 [保持] `ReportSchema` 解析带 `disputed_tests` 的汇报，其中那一项的 `test` 是空串，或 `why` 是空串，或多出一个 `note` 键：三种都解析失败
- K3 [保持] S2 那一次运行：退出码 20；运行器只被调用 1 次、角色是 worker；journal 里没有 `reviewer.started`，也没有 `evidence.collected`（现在这样的汇报会被当成格式不对而上报，这几样已经如此；实现之后上报的原因变了，这几样不变）
- K4 [保持] 队列运行（`run --continue`），同 S2 的假 worker：退出码 20；`docs/backlog.md` 里这个批次的状态是 `blocked`；队列 journal 里这个批次的 `queue.batch_started` 只有 1 条；`queue.finished` 的 `reason` 是 `blocked`

接口：
- `src/schema/index.ts` 已有的导出 `ReportSchema`（zod 的严格对象，用 `safeParse`）；本批次起多一个可选字段 `disputed_tests`，实现之前带这个键的汇报会被拒绝
- 汇报是 `.collie/batches/<批次>/report.md` 末尾的围栏 JSON 块；一份合法的汇报怎么写、假 worker 怎么提交它，照 `test/support/sandbox.ts` 的 `workerScene`。它不支持多出来的键：要带 `disputed_tests` 时在测试文件里自己写一个假 worker 的场景，JSON 用不带类型标注的对象拼
- 沙箱与两种运行方式照 `test/support/sandbox.ts` 导出的 `Sandbox`（`run(runner)` 是单批次，`cli(['run', '--continue'], runner)` 是队列）、`fooledReviewerScene`、`honestClaims`、`BATCH`；运行器被调用了几次、各是什么角色，读 `FakeRunner` 的 `calls`
- `escalated` 事件本批次起在这条路上多带 `disputed`（数组）；读事件用 `Sandbox` 的 `events()`，队列 journal 的读法照 `test/queue-limit.test.ts`

条目：
1. 读 SPEC 16.23 的「worker 认为验收测试写错了」一段。`src/schema/index.ts`：`ReportSchema` 加可选的 `disputed_tests`（数组，每项是只有 `test`、`why` 两个非空字符串的严格对象）。
2. `src/run.ts`：读到有效的汇报而 `disputed_tests` 非空时，照那一段上报（不拉 reviewer、不取证；`escalated` 的 `reason` 与 `disputed`；progress 的说明文字「上报：worker 认为验收测试有错 — …」；`--continue` 下记 `blocked`；裁定提交经 `r2Commit` 并按 12.1 推送；BLOCK、退出码 20）。
   做法照现有的 `escalate` 与 `testerEscalate`；能合成一个带说明文字参数的函数就合，不要再抄一份。队列的循环不用改：它走现有 BLOCK 那一支，停下之前照常收尾。
   `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)`：你新加了一处推送时上限 8 改成 9（点名允许的改写）；复用现有函数、没有新加推送就不改。在「偏离或疑问」里写明是哪一种。
3. 不许变的：没有这个字段或它是空数组时的全部行为；`escalated` 在别的上报路径上的字段；事件类型的个数（复用 `escalated`，不加新类型）。`test/support/` 不许改。
   R1 查过：`test/envelope.test.ts`、`test/worker.test.ts` 与 `test/support/sandbox.ts` 里的汇报都不带这个字段，加一个可选字段不影响它们。已有断言除上面点名的那一处外都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/schema/index.ts`、`src/run.ts`、`test/invariants.test.ts`（仅条目 2 点名的那一处）。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，在「偏离或疑问」里写明是哪一条、错在哪（这一批还没生效，你不要在自己的汇报里用 `disputed_tests`）。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b36` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`test/support/`；改任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件、收尾
- 在这条路上拉起 reviewer 或自动重跑；让 worker 的声明改动、删除或跳过任何验收测试
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b37 输出末尾按两个输出流各取，变异检查没过时看得到是哪一项（带情形）

优先级：101　依赖：v046-b35

（2026-11-23：worker 用 `disputed_tests` 指出 S4 那条验收测试写错了，R1 核对后认定 worker 对。代码采纳、留在主分支上，本批次保持 blocked；补测试的是 v046-b39，见 SPEC 14.39、16.26。）

v046-b35 让没过的验收命令把输出的最后 20 行留在 `acceptance.failed` 事件与重跑的 task 里。它是为变异检查做的，可真的变异检查没过时用不上：
`scripts/mutation.ts` 把 46 项的进度写标准错误，把没被发现的各项与结论行写标准输出；现在的取法是「标准输出在前、标准错误在后、合起来取最后 20 行」，留下的全是进度（SPEC 14.38）。
这一批把取法改成两个输出流各取末尾。按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b37/`；你只写实现，不能改那个目录。

情形：
- S1 [新] 沙箱的全局验收命令里多一条 `sh split.sh`，它向标准输出打印一行 `result: 1 survived`，再向标准错误依次打印 `progress 1` 到 `progress 30`，以 1 退出；假 worker 如实提交、假 reviewer 判 PASS，跑一次：`cmd` 为 `sh split.sh` 的 `acceptance.failed` 事件的 `output_tail` 按行拆开，第一行是 `result: 1 survived`，第二行是 `--- stderr ---`
- S2 [新] 同样的沙箱，`split.sh` 改成向标准输出依次打印 `o1` 到 `o25`、向标准错误依次打印 `e1` 到 `e25`，以 1 退出：`output_tail` 恰好 41 行，第一行是 `o6`，第 21 行是 `--- stderr ---`，第 22 行是 `e6`
- S3 [新] 同样的沙箱，`split.sh` 只向标准错误依次打印 `e1`、`e2`、`e3`，以 1 退出：`output_tail` 恰好 4 行，第一行是 `--- stderr ---`，第二行是 `e1`
- S4 [新] `renderFixSection` 拿到的 `failedAcceptance` 里那一项的 `output_tail` 是三行：`before`、恰好三个反引号的一行、`after`：返回的文字里，这条命令下面的代码块以恰好四个反引号的一行开头、以恰好四个反引号的一行结尾，这两行之间依次是 `before`、三个反引号、`after`
- K1 [保持] 同样的沙箱，`split.sh` 只向标准输出依次打印 `out 1` 到 `out 30`，以 1 退出：`output_tail` 恰好 20 行，第一行是 `out 11`，最后一行是 `out 30`，其中没有 `--- stderr ---` 这一行
- K2 [保持] S1 那一次运行：`output_tail` 里有单独成行的 `progress 30`，没有单独成行的 `progress 10`；这条 `acceptance.failed` 事件的 `cmd`、`exit_code`、`expect` 三个字段都在
- K3 [保持] 同样的沙箱，测试里把环境变量 `GITHUB_TOKEN` 设成 `tok-secret-12345`（用完还原），`split.sh` 向标准错误打印一行 `token=tok-secret-12345` 后以 1 退出：`output_tail` 里有 `token=***`，没有 `tok-secret-12345`
- K4 [保持] `renderFixSection` 拿到的那一项的 `output_tail` 是两行 `line A`、`line B`：代码块以恰好三个反引号的一行开头、以恰好三个反引号的一行结尾，这两行之间依次是 `line A`、`line B`
- K5 [保持] 同样的沙箱，`split.sh` 什么都不打印、以 1 退出：`cmd` 为 `sh split.sh` 的 `acceptance.failed` 事件没有 `output_tail` 这个键

接口：
- `src/run.ts` 已有的导出，签名都不变：`renderFixSection(info: FixInfo): string`、类型 `FixInfo`（`failedAcceptance` 每一项是 `{ cmd, exit_code, output_tail? }`）
- `acceptance.failed` 事件的 `output_tail` 是一个多行字符串，用换行分隔；读事件用 `Sandbox` 的 `events()`
- 沙箱怎么搭、怎样往全局验收命令里加一条、假 worker 与假 reviewer 怎么写，照上一批的验收测试 `test/acceptance/v046-b35/new.test.ts` 与 `keep.test.ts`（那里的脚本叫 `noisy.sh`）；脚本里往标准错误打印用 `>&2`

条目：
1. 读 SPEC 16.25 的「`output_tail` 的取法」一段与 14.38「判 PASS 之后查出来的」第 1、3 条。`src/run.ts` 的 `buildOutputTail`：标准输出与标准错误分开取（各去掉末尾空行、各取最后 `OUTPUT_TAIL_MAX_LINES` 行、每行照旧截断、各自脱敏），
   标准错误有内容时在两段之间加一行 `--- stderr ---`；两边都没有内容时照旧返回 `undefined`。
   `renderFixSection`：围栏用的反引号个数，比内容里行首最长的一串反引号多一个，最少三个。
2. 不许变的：只往标准输出打印的命令，`output_tail` 与现在逐字节相同；`acceptance.failed` 的其余字段；`docs/progress.md` 的摘要；`why` 与 `report` 的输出。
   `test/acceptance/v046-b35/` 下的测试（上一批的验收测试，现在是回归测试）必须照常通过，你不能改它们。R1 查过：它们的脚本都只往标准输出打印，新取法不影响它们。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，照 `AGENT-worker.md` 第 5 节在汇报里写明并列进 `disputed_tests`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次与上一批的验收测试通过 | `npm test -- test/acceptance/v046-b37 test/acceptance/v046-b35` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/run.ts` 之外的 `src/` 文件；改动 `scripts/mutation.ts`（不靠改变异脚本的输出来解决）；改任何一条规则的判定
- 把整段输出不截断、不脱敏地写进 journal 或 task
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b38 三处上报合成一个函数，推送由 9 处变成 7 处（只重构）

优先级：102　依赖：v046-b36, v046-b39

`src/run.ts` 里有三条上报路径：没有有效汇报（`escalate`）、验收测试没有准备好（`testerEscalate`）、worker 认为验收测试有错（v046-b36 加的那一段）。三处各有一份几乎相同的代码：
取提交清单与推送状态、写 progress、`--continue` 下改状态格、提交、推送。v046-b36 的条目要求合并，没有做到（SPEC 14.38）。这一批把它们合成一个函数。只重构，三条路径的行为一个字都不变；不带情形。

条目：
1. 读 SPEC 16.25 的「三处上报合成一个」一段。`src/run.ts`：三条上报路径**必须**共用同一个函数来做「取提交清单与推送状态、写 progress、改状态格、提交、推送、返回 BLOCK」。
   三处不同的地方作为参数传进去：`escalated` 事件的 `reason` 与附加字段（如 `disputed`）、progress 说明文字的前缀（「上报：无 report — 」「上报：验收测试没有准备好 — 」「上报：worker 认为验收测试有错 — 」）、
   随裁定提交一起提交的附加文件（如 `tester.md`）、取提交清单用的基准（「没有有效汇报」那条路径上可以没有）。
   各条路径记的事件、事件的字段与先后、progress 里的文字、提交里的文件、退出码，都与现在相同。
2. `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)`：上限 9 改成 7，上面那句注释里的清单相应改（点名允许的改写，是改严；在「偏离或疑问」里列出）。
   合并之后 `src/run.ts` 的非注释行里 `await push(` 必须恰好 7 处。
3. 不加新测试，不改别的测试。三条路径现在各有测试守着：`test/exit-codes.test.ts`、`test/scenario-e.test.ts`、`test/tester-step.test.ts`、`test/blocked-cleanup.test.ts`、`test/acceptance/v046-b36/`。它们都必须照常通过。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/invariants.test.ts`（仅条目 2 点名的那一处）。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 三条上报路径的测试通过 | `npm test -- test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36` | exit 0 |
| 推送恰好 7 处（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cF "await push(" \| grep -qx 7` | exit 0 |
| 不变量的上限同步成 7 | `grep -qF "toBeLessThanOrEqual(7)" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts` 之外的 `src/` 文件；改变任何一条上报路径的事件、字段、文字、提交的文件或退出码；改任何一条规则的判定、队列的重跑与收尾
- 顺手做别的重构或改名
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增依赖

## v046-b39 给 v046-b37 已在主分支上的输出末尾取法补测试（只改测试）

优先级：103　依赖：v046-b35

v046-b37 改了 `src/run.ts` 里的 `buildOutputTail` 与 `renderFixSection`：两个输出流各取最后 20 行，标准错误有内容时中间加一行 `--- stderr ---`；代码块的围栏比内容里行首最长的一串反引号多一个。
实现是对的，已在主分支上，但它的验收测试有一条写错了，随收尾拿掉了（SPEC 14.39）。现在这段代码没有测试守着。这一批只写测试，不改 `src/`。

条目：
1. 读 SPEC 16.25 的「`output_tail` 的取法」一段与 14.39。新文件 `test/output-tail.test.ts`，一组 `describe('output_tail: per-stream tail and fence width (SPEC 16.25)', …)`，把下面九种情形各写成至少一条用例（用例名以编号开头），每个期望都要有断言：
   - S1：沙箱的全局验收命令里多一条 `sh split.sh`，向标准输出打印 `result: 1 survived`，再向标准错误打印 `progress 1` 到 `progress 30`，以 1 退出；假 worker 如实、假 reviewer 判 PASS：`cmd` 为 `sh split.sh` 的 `acceptance.failed` 的 `output_tail` 第一行是 `result: 1 survived`，第二行是 `--- stderr ---`
   - S2：`split.sh` 向标准输出打印 `o1` 到 `o25`、向标准错误打印 `e1` 到 `e25`：`output_tail` 恰好 41 行，第 1 行 `o6`，第 21 行 `--- stderr ---`，第 22 行 `e6`
   - S3：只向标准错误打印 `e1`、`e2`、`e3`：`output_tail` 恰好 4 行，第 1 行 `--- stderr ---`，第 2 行 `e1`
   - S4：`renderFixSection` 拿到的那一项的 `output_tail` 是 `before`、一行恰好三个反引号、`after`：那条命令下面的代码块以恰好四个反引号的一行开头，**收尾找与开头那一行完全相同的下一行**，它也是恰好四个反引号；两行之间依次是 `before`、三个反引号、`after`
   - K1：只向标准输出打印 `out 1` 到 `out 30`：恰好 20 行，第 1 行 `out 11`，最后一行 `out 30`，没有 `--- stderr ---`
   - K2：S1 那一次：`output_tail` 里有单独成行的 `progress 30`、没有单独成行的 `progress 10`；这条事件的 `cmd`、`exit_code`、`expect` 都在
   - K3：环境变量 `GITHUB_TOKEN` 设成 `tok-secret-12345`（用完还原），`split.sh` 向标准错误打印 `token=tok-secret-12345`：`output_tail` 里有 `token=***`，没有 `tok-secret-12345`
   - K4：`output_tail` 是 `line A`、`line B` 两行：代码块以恰好三个反引号的一行开头、以同样的一行结尾，中间依次是 `line A`、`line B`
   - K5：`split.sh` 什么都不打印、以 1 退出：那条 `acceptance.failed` 事件没有 `output_tail` 这个键
2. 沙箱、往全局验收命令里加一条、假 worker 与假 reviewer 的搭法，照 `test/acceptance/v046-b35/new.test.ts`（那里的脚本叫 `noisy.sh`，往标准错误打印用 `>&2`）。被拿掉的那份 v046-b37 验收测试在提交 `b86382a` 里，可以 `git show b86382a:test/acceptance/v046-b37/new.test.ts` 参考，**但它的 S4 找法是错的，不要照抄**。
   把 `src/run.ts` 里下面四处各撤一次（只在你自己的工作区里试，不提交），各自都必须有这个文件里的用例失败；在汇报的「测试结果」里逐条写明撤了哪里、哪几条红：
   两个输出流分开取（改回合起来取）；`--- stderr ---` 那一行；标准错误那一段的 20 行上限；围栏按内容加长（改回永远三个）。
3. 不改别的测试。`test/acceptance/` 下现有的测试必须照常通过。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只新建 `test/output-tail.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 新测试与上一批的验收测试通过 | `npm test -- test/output-tail.test.ts test/acceptance/v046-b35` | exit 0 |
| 新的一组用例在 | `grep -qF "output_tail: per-stream tail and fence width (SPEC 16.25)" test/output-tail.test.ts` | exit 0 |

额外禁止：
- 改动 `src/`、`scripts/`、任何受保护路径（含 `test/acceptance/`）、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 用「以三个以上反引号开头」这类会被内容匹配到的模式找收尾围栏
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b40 批次清单归档：已了结的批次挪进归档文件，解析时两处都读（带情形）

优先级：104　依赖：v046-b38

`docs/backlog.md` 已有 4400 多行、一百多个批次，九成已经通过。这一批让 R2 认得一个归档文件 `docs/backlog-archive.md`：已了结的批次可以挪进去，加载时两处都读（SPEC 16.27）。
这一批只做「认得」，不挪任何批次（那是 R1 之后的事）。按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b40/`；你只写实现，不能改那个目录。

情形：
- S1 [新] 一个目录下 `docs/backlog-archive.md` 里有一个状态为 `passed` 的批次 `v01-a01`，`docs/backlog.md` 里有一个状态为 `pending`、依赖 `v01-a01` 的批次 `v01-b01`：`loadBacklog` 返回恰好两个批次，依次是 `v01-a01`、`v01-b01`，后者的 `depends_on` 是只含 `v01-a01` 的数组
- S2 [新] 批次号 `v01-a01` 在 `docs/backlog-archive.md` 与 `docs/backlog.md` 里各有一个（两个文件单独看都合法）：`loadBacklog` 抛出 `BacklogError`，它的 `message` 里有 `v01-a01`，也有 `backlog-archive.md`
- S3 [新] `docs/backlog-archive.md` 里那个批次的状态是 `pending`，或者是 `running`（`docs/backlog.md` 单独看合法）：两种都让 `loadBacklog` 抛出 `BacklogError`，`message` 里有归档里那个批次的批次号
- S4 [新] 沙箱里 `docs/backlog-archive.md` 有一个 `passed` 的批次 `v98-a01`，`docs/backlog.md` 里 `v99-b01` 是 `pending`、依赖 `v98-a01`，两个文件都已提交；假 worker 如实提交、假 reviewer 判 PASS，队列模式跑一次（`run --continue`）：退出码 0，`docs/backlog.md` 里 `v99-b01` 的状态是 `passed`
- S5 [新] 沙箱里 `docs/backlog-archive.md` 有一个 `passed` 的批次 `v98-a01`（已提交），`docs/backlog.md` 里 `v99-b01` 是 `pending`、不依赖别的；假 worker 在它的代码提交里另外往 `docs/backlog-archive.md` 末尾加了一个空行和一行文字 `note`，假 reviewer 判 PASS，单批次跑一次：退出码 20，`evidence.collected` 事件的 `spec_diff_lines` 大于 0
- K1 [保持] 目录下没有 `docs/backlog-archive.md`，`docs/backlog.md` 里有一个批次：`loadBacklog` 返回恰好这一个批次
- K2 [保持] `docs/backlog-archive.md` 存在且合法，`docs/backlog.md` 里的批次依赖一个两个文件里都没有的批次号 `v00-x99`：`loadBacklog` 抛出 `BacklogError`，`message` 里有 `v00-x99`
- K3 [保持] S4 那一次运行之后，`docs/backlog-archive.md` 的内容与运行之前逐字节相同

接口：
- `src/backlog.ts` 已有的导出，签名不变：`loadBacklog(root: string): Batch[]`、`class BacklogError extends Error`（有 `message`、`batchId`）。归档文件是 `<root>/docs/backlog-archive.md`，格式与 `docs/backlog.md` 完全相同：自己的「队列总览」表加各批次的小节
- 一份最小的 backlog 文本怎么拼，照 `test/backlog.test.ts` 里的辅助函数；直接测 `loadBacklog` 时，目录用 `mkdtempSync` 建在系统临时目录下、`afterEach` 里删掉
- 沙箱用 `test/support/sandbox.ts` 导出的 `Sandbox`（`run(runner)` 是单批次，`cli(['run', '--continue'], runner)` 是队列；`read`、`write`、`commitAll`、`events()`）、`workerScene`、`fooledReviewerScene`、`honestClaims`、`BATCH`（就是 `v99-b01`）。
  沙箱自带一份 `docs/backlog.md`：要让 `v99-b01` 依赖别的批次，用 `box.read` 读出来改（总览表里「依赖」那一格与小节里「依赖：」那一行要一致）再提交；要在提交里多改一个文件的假 worker 自己写一个场景，写法照 `test/acceptance/v046-b36/`

条目：
1. 读 SPEC 16.27。`src/backlog.ts`：导出常量 `BACKLOG_ARCHIVE_RELATIVE_PATH`（`docs/backlog-archive.md`）；`loadBacklog` 在归档文件存在时两处都读，归档里的批次排在前面；
   依赖在两处的并集里核对；同一个批次号两处都有时报错（信息里有批次号与归档文件名）；归档里的批次状态不是 `passed` 或 `blocked` 时报错（信息里有批次号）。
   `parseBacklog` 对单份文本的现有检查都不变（需要的话给它加一个可选参数，传「另一处已有的批次号」）。R2 改状态格的地方不动，仍只写 `docs/backlog.md`。
2. `src/evidence.ts` 的 `PROTECTED_PATHS` 加 `docs/backlog-archive.md`（写法照现有各项，每项一行）；`scripts/mutation.ts` 的清单**必须**加一项 `protected:docs/backlog-archive.md`（写法照已有的 13 项），共 47 项，清单上方注释里的项数相应改。
3. 测试。`test/evidence.test.ts` 加一条 `counts docs/backlog-archive.md as protected (SPEC 16.27)`；`test/mutation.test.ts` 的 `every protected path is in the mutation list`：13 改成 14（点名允许的改写，在「偏离或疑问」里列出）；
   `test/invariants.test.ts` 加一条，用例名 `src/evidence.ts has docs/backlog-archive.md in PROTECTED_PATHS (v046-b40)`。
   R1 查过：仓库里现在没有归档文件，所有读真实 `docs/backlog.md` 的测试结果不变；`test/backlog.test.ts` 测的是 `parseBacklog` 单份文本的行为，不受影响；`test/mutation.test.ts` 的 `has at least 42 items` 用的是「不少于」，不用改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/backlog.ts`、`src/evidence.ts`、`scripts/mutation.ts`、`test/evidence.test.ts`、`test/mutation.test.ts`、`test/invariants.test.ts`。不要新建 `docs/backlog-archive.md`。
`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，照 `AGENT-worker.md` 第 5 节在汇报里写明并列进 `disputed_tests`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b40` | exit 0 |
| 变异清单里有新的一项 | `grep -qF "protected:docs/backlog-archive.md" scripts/mutation.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`docs/backlog.md`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）；新建或改动 `docs/backlog-archive.md`
- 改动 `src/run.ts`、`src/cli.ts`、`src/view.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/roles/`、`src/runner/`；让 R2 写归档文件；让批次授权能点名归档文件
- 改变没有归档文件时的任何行为；从 `PROTECTED_PATHS` 里去掉或改写已有的项
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b41 status、why、report 不再吞掉批次清单的错误（带情形）

优先级：105　依赖：v046-b40

`status`、`why`、`report` 三条命令读批次清单出错时，现在把错误吞掉、当成「没有批次」接着走：`status` 退出码 0，只是少了几行；`why` 会说批次不在 backlog 里。
批次清单分成两个文件（归档）之后更容易出这种错，而且看不出来（SPEC 14.41）。这一批让它们报错。按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b41/`；你只写实现，不能改那个目录。

情形：
- S1 [新] 沙箱里把 `docs/backlog.md` 中 `v99-b01` 的依赖改成一个不存在的批次号 `v00-x99`（总览表「依赖」一格与小节里「依赖：」那一行都改），执行 `status`：退出码 1；命令的输出里有 `v00-x99`
- S2 [新] 同样的沙箱，执行 `status --json`：退出码 1；命令的输出里有 `v00-x99`
- S3 [新] 同样的沙箱，执行 `why v99-b01`：命令的输出里有 `v00-x99`，没有 `is not in docs/backlog.md`
- S4 [新] 同样的沙箱，执行 `report`：退出码 1；命令的输出里有 `v00-x99`
- K1 [保持] 沙箱的批次清单没有动过、还没有任何运行记录，执行 `status`：退出码 0，输出里有 `no runs recorded`
- K2 [保持] 沙箱的批次清单没有动过，执行 `why v99-b99`：退出码 1，输出里有 `batch v99-b99 is not in docs/backlog.md`
- K3 [保持] S1 那个沙箱，执行 `show v99-b01`：退出码 1，输出里有 `v00-x99`
- K4 [保持] 一个目录下 `docs/backlog-archive.md` 里有两个批次，状态依次是 `blocked`、`passed`，`docs/backlog.md` 里有一个 `pending` 的批次：`loadBacklog` 不报错，返回恰好三个批次，前两个的 `status` 依次是 `blocked`、`passed`

接口：
- 命令经 `test/support/sandbox.ts` 的 `Sandbox` 执行：`await box.cli(['status'], undefined)` 返回退出码；标准输出与标准错误都进 `box.output`（字符串数组，`join('')` 之后看），所以「命令的输出」指两者合起来
- 沙箱自带的 `docs/backlog.md` 只有 `v99-b01` 一个批次，依赖写的是「无」（总览表里是 `—`）：用 `box.read` 读出来，把这两处改成 `v00-x99`，再 `box.write` 写回，不必提交
- K4 直接测 `src/backlog.ts` 的 `loadBacklog(root)`：目录用 `mkdtempSync` 建在系统临时目录下、`afterEach` 里删掉；两个文件怎么拼，照 `test/acceptance/v046-b40/new.test.ts`

条目：
1. 读 SPEC 16.28 的第一段与 14.41「判 PASS 之后查出来的」第 1 条。`src/cli.ts` 的 `status`、`why`、`report`：一开头就读批次清单。`docs/backlog.md` 存在而加载失败时，把错误信息写到标准错误（一行，以 `collie: ` 开头，与 `show` 报错的写法相同），
   返回退出码 1，别的什么都不输出（`--json` 时也一样）。`docs/backlog.md` 不存在时照现在的做法，当成没有批次。三条命令**必须**共用同一个读法（一个函数），不要各写一份 `try`。
2. `scripts/mutation.ts` 里 `Protected paths (11)` 那句注释的项数改成 14（只改这个数）。
   不许变的：批次清单合法时这三条命令的输出与退出码；`show`、`run`、`timeline`、`preflight` 的行为。
   R1 没有查到在「批次清单存在却解析不了」的目录里跑这三条命令的现有用例；在没有 `docs/backlog.md` 的临时目录里跑它们的用例走「文件不存在」那一支，不应受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/cli.ts`、`scripts/mutation.ts`（仅条目 2 那一处）。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，照 `AGENT-worker.md` 第 5 节在汇报里写明并列进 `disputed_tests`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b41` | exit 0 |
| 变异脚本注释里的项数对了 | `grep -qF "Protected paths (14)" scripts/mutation.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`docs/backlog.md`、`docs/backlog-archive.md`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/cli.ts` 之外的 `src/` 文件；改动 `scripts/mutation.ts` 里那个数之外的任何内容；改变批次清单合法时任何命令的输出
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26；条目 2 点名的那一处除外）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b42 preflight --smoke 的用时上限：调一次模型超过 60 秒算不过（带情形）

优先级：106　依赖：v046-b27

`preflight --smoke` 会调一次模型来确认接口能用（v046-b27 起，退出码非零算不过，并写出用了几秒）。接口有时不报错、只是极慢：第二十七次队列开跑前有一次用了 95 秒才返回成功，照现在的代码算通过（SPEC 14.38）。
操作员一直是手工按「60 秒以内」判断的；`collie follow` 以后靠这条命令的退出码自己判断，所以把这个上限做进去（SPEC 16.28）。按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b42/`；你只写实现，不能改那个目录。

情形：
- S1 [新] 假运行器返回 `exitCode: 0`，注入的时钟让 `runner` 这一项用了 61 秒，沙箱配置里没有 `smoke_max_secs`，执行 `preflight --smoke --runner fake`：退出码不是 0；输出里有一行以 `FAIL runner: exitCode=0 secs=61` 开头；输出的最后一行是 `preflight: failed (runner)`
- S2 [新] 同 S1，但沙箱的 `.collie/collie.toml` 在 `[limits]` 一节里多了一行 `smoke_max_secs = 120`（已提交）：退出码是 0；输出里有一行以 `ok   runner: exitCode=0 secs=61` 开头
- S3 [新] 同 S1，命令再加 `--json`，把输出按 JSON 解析：`checks` 里 `name` 为 `runner` 的那一项的 `ok` 是 false，顶层的 `ok` 是 false
- K1 [保持] 假运行器返回 `exitCode: 0`，注入的时钟让这一项用了恰好 60 秒，沙箱配置里没有 `smoke_max_secs`：退出码是 0；输出里有一行以 `ok   runner: exitCode=0 secs=60` 开头
- K2 [保持] 假运行器返回 `exitCode: 1`，这一项用了 3 秒：输出里有一行以 `FAIL runner: exitCode=1` 开头，输出的最后一行是 `preflight: failed (runner)`
- K3 [保持] 不带 `--smoke` 执行 `preflight`：退出码是 0；输出里没有以 `ok   runner` 或 `FAIL runner` 开头的行

接口：
- `test/support/sandbox.ts` 的 `Sandbox`：`await box.cli(argv, runner, extra)`，第三个参数可以传 `{ preflightNow: () => number }`（毫秒）。`runner` 一项的用时是它在这一项前后两次返回值的差，四舍五入到秒；搭法照 `test/preflight.test.ts` 里 `describe('preflight: runner check judges the exit code', …)` 一组
- 假运行器：`new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }])`（来自 `src/runner/fake.ts`）
- 往沙箱配置里加一项：`box.read('.collie/collie.toml')`，在 `[limits]` 那一行后面插入一行，`box.write` 写回并 `box.commitAll`（开跑前检查要求工作区干净）。实现之前这个键不被认得，配置读不出来，所以 S2 现在是红的
- `--json` 的输出是 `{ "ok": boolean, "checks": [{ "name", "ok", "detail" }] }`；输出末尾有一个换行，「最后一行」指去掉它之后的最后一行

条目：
1. 读 SPEC 16.28 的第二段（来历在 14.33）。`src/schema/index.ts`：`[limits]` 加可选的 `smoke_max_secs`（整数，必须大于 0，缺省 60；写法照 `api_retry_wait_secs`）。
   `src/preflight.ts` 的 `runner` 一项：运行器的退出码是 0，而用时（就是 `secs=` 那个数）大于 `smoke_max_secs` 时，这一项不过，`detail` 是 `exitCode=0 secs=<N> exceeds smoke_max_secs=<M>`；不大于时与现在相同。退出码非零、运行器抛错两种情况不变。
2. `templates/collie.toml` 的 `[limits]` 里加一行**注释掉的**说明：`# smoke_max_secs = 60   # 可选；preflight --smoke 调一次模型超过这么多秒就算不过（SPEC 16.28）`。
   **不要加成真的键**：验收测试会往沙箱配置里自己加这一项，模板里已有同名的键就重复了。本仓库的 `.collie/collie.toml` 不许动。`collie smoke` 命令不改。
3. 点名允许改写的旧用例（因为解析结果里多了一个带缺省值的字段），在「偏离或疑问」里列出：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `smoke_max_secs: 60`）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这一项，只在它因此失败时才加）。
   R1 查过：`test/preflight.test.ts` 现有用例里注入的用时都在 60 秒以内；`test/follow.test.ts` 用假的子进程代替 `preflight`，不受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/schema/index.ts`、`src/preflight.ts`、`templates/collie.toml`、`test/config.test.ts`、`test/schema.test.ts`。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，照 `AGENT-worker.md` 第 5 节在汇报里写明并列进 `disputed_tests`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b42` | exit 0 |
| 模板里只有注释掉的说明，本仓库的配置没动 | `grep -qE "^# smoke_max_secs = 60" templates/collie.toml && ! grep -qE "^smoke_max_secs" templates/collie.toml && ! grep -qF "smoke_max_secs" .collie/collie.toml` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/cli.ts`、`src/follow.ts`、`src/run.ts`、`src/runner/`；改动 `preflight` 别的检查项、`collie smoke`、队列开头那次检查
- 把模板里那一行加成真的键；在 `detail` 或输出里写出模型的回复、token 或文件的绝对路径
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；测试里真的等待；新增依赖
